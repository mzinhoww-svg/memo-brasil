// Exportação dos dados de um evento (LGPD, direito de acesso/portabilidade).
// Gera um .zip com dados.json (sem tokens nem segredos) e as fotos originais.
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const { limparSegredos, normalizarEvento, caminhoFotos } = require('./dados');

const nomeSeguro = (s) =>
  String(s || 'convidado').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 60) || 'convidado';

// Lista as fotos do evento com o nome que terão dentro do zip.
function listarFotos(ev, dataDir) {
  const dir = caminhoFotos(dataDir, ev.id);
  const contagem = {};
  const itens = [];
  for (const p of ev.photos || []) {
    const autor = nomeSeguro(p.autor);
    contagem[autor] = (contagem[autor] || 0) + 1;
    itens.push({
      id: p.id,
      nome: `fotos/${autor}/${String(contagem[autor]).padStart(3, '0')}.${p.ext}`,
      origem: path.join(dir, `${p.id}.${p.ext}`),
      oculta: !!p.oculta,
    });
  }
  return itens.map((f) => ({ ...f, existe: fs.existsSync(f.origem) }));
}

// Monta o JSON exportável: dados do evento sem segredos + índice das fotos.
function dadosExportaveis(ev, fotos, agora = new Date()) {
  const clone = JSON.parse(JSON.stringify({ ...ev }));
  normalizarEvento(clone);
  const porId = new Map((fotos || []).map((f) => [f.id, f.nome]));
  clone.photos = (ev.photos || []).map((p) => ({
    id: p.id, autor: p.autor, criadaEm: p.criadaEm, oculta: !!p.oculta,
    arquivo: porId.get(p.id) || null,
  }));
  const limpo = limparSegredos(clone);
  limpo._export = { formato: 1, geradoEm: agora.toISOString(), observacao: 'Dados do evento, sem tokens de acesso.' };
  return limpo;
}

function leiaMe(ev) {
  return [
    'Dados do seu evento',
    '',
    `Evento: ${ev.id}`,
    'Este pacote contém:',
    '- dados.json: convidados, recados, programação, denúncias e o registro de consentimentos.',
    '- fotos/: as fotos enviadas, organizadas pelo nome de quem tirou.',
    '',
    'Por segurança, os tokens de acesso ao painel e as inscrições de avisos no aparelho',
    'não entram na exportação. Guarde este arquivo com cuidado: ele contém dados pessoais.',
    '',
  ].join('\n');
}

// Cria o zip. Retorna { arquivo, entradas, dados }. Não expõe nenhum token.
async function exportarEvento({ ev, dataDir, destino, agora = new Date() }) {
  const fotos = listarFotos(ev, dataDir);
  const dados = dadosExportaveis(ev, fotos, agora);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const entradas = ['dados.json', 'LEIA-ME.txt'];
  await new Promise((resolve, reject) => {
    const z = new ZipArchive({ store: true });
    const saida = fs.createWriteStream(destino);
    z.on('error', reject);
    saida.on('error', reject);
    saida.on('close', resolve);
    z.pipe(saida);
    z.append(JSON.stringify(dados, null, 2), { name: 'dados.json' });
    z.append(leiaMe(ev), { name: 'LEIA-ME.txt' });
    for (const f of fotos) if (f.existe) { z.file(f.origem, { name: f.nome }); entradas.push(f.nome); }
    z.finalize();
  });
  return { arquivo: destino, entradas, dados };
}

module.exports = { nomeSeguro, listarFotos, dadosExportaveis, leiaMe, exportarEvento };
