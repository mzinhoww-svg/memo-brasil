#!/usr/bin/env node
// Confere os textos em docs/copy/*.md contra docs/copy/features.json.
//  - toda chave `feature.x` citada precisa existir em features.json e a linha precisa levar 🔧;
//  - sem --publicar: chave desligada é só "pendente" (o texto ainda é rascunho);
//  - com --publicar: qualquer texto cuja chave esteja desligada é erro (impede publicar promessa sem recurso);
//  - prazo de retenção fixo ("12 meses") e o nome/variável antigos da marca são erros.
const fs = require('fs');
const path = require('path');

const CHAVE = /feature\.[a-z0-9_]+/g;

// Em tabelas "elemento | atual | novo", só a última coluna é texto novo; "atual" cita o código.
function trechoNovo(linha) {
  if (!linha.trimStart().startsWith('|')) return linha;
  const celulas = linha.split('|').map((c) => c.trim()).filter(Boolean);
  return celulas.length >= 3 ? celulas[celulas.length - 1] : linha;
}

function checarCopy(dir, { publicar = false } = {}) {
  const features = JSON.parse(fs.readFileSync(path.join(dir, 'features.json'), 'utf8'));
  const erros = [];
  const pendentes = [];
  for (const arq of fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()) {
    fs.readFileSync(path.join(dir, arq), 'utf8').split('\n').forEach((linha, i) => {
      const onde = `${arq}:${i + 1}`;
      const chaves = linha.match(CHAVE) || [];
      for (const k of new Set(chaves)) {
        if (!features[k]) { erros.push(`${onde}: chave ${k} não existe em features.json`); continue; }
        if (!linha.includes('🔧')) erros.push(`${onde}: ${k} sem o marcador 🔧`);
        if (!features[k].ativo) {
          (publicar ? erros : pendentes).push(`${onde}: ${k} desligada${publicar ? ' — não publicar este texto' : ''}`);
        }
      }
      const novo = trechoNovo(linha);
      if (/\b12 meses\b/.test(novo) && !novo.includes('{retencao_meses}')) {
        erros.push(`${onde}: prazo fixo; use {retencao_meses}`);
      }
      if (/memo brasil|\{marca\}/i.test(novo)) erros.push(`${onde}: o produto se chama Lume`);
    });
  }
  return { erros, pendentes };
}

module.exports = { checarCopy };

if (require.main === module) {
  const publicar = process.argv.includes('--publicar');
  const { erros, pendentes } = checarCopy(path.join(__dirname, '..', 'docs', 'copy'), { publicar });
  if (!publicar && pendentes.length) console.log(`${pendentes.length} trecho(s) 🔧 aguardando recurso (rascunho).`);
  if (erros.length) { console.error(erros.join('\n')); process.exit(1); }
  console.log('copy ok');
}
