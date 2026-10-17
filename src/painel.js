'use strict';
// Rotas novas do painel (item 6): QR do convite (PNG com moldura e cartaz A5 em
// PDF), remoção de convidado e controle da revelação. Ficam isoladas aqui para
// o server.js mudar o mínimo possível; as dependências vêm do próprio server.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { criarQrPng } = require('./qr-placa');
const { criarQrPdf } = require('./qr-pdf');

const INSTRUCOES = [
  'Confirme sua presença e abra a câmera do convite.',
  'Suas fotos ficam guardadas e só aparecem na hora da revelação.',
  'Perdeu o QR Code? Peça o link do convite para a organização.',
];

module.exports = function criarRotasPainel(deps) {
  const { getEvent, adminOnly, donoOnly, save, audit, baseUrl, publicInfo, revealed, photoDir, clock } = deps;
  const r = express.Router();

  // QR Code do link do convidado, com moldura de placa — só a organização.
  r.get('/:id/qr.png', getEvent, adminOnly, (req, res) => {
    const png = criarQrPng(`${baseUrl(req)}/e/${req.ev.id}`);
    res.type('png').send(png);
  });

  // Cartaz A5 pronto para imprimir: moldura, título, QR grande e instruções.
  r.get('/:id/qr.pdf', getEvent, adminOnly, (req, res) => {
    const pdf = criarQrPdf({ titulo: req.ev.titulo, link: `${baseUrl(req)}/e/${req.ev.id}`, instrucoes: INSTRUCOES });
    audit(req, 'qr.impresso', { formato: 'pdf' });
    res.type('application/pdf').set('Content-Disposition', `attachment; filename="qr-${req.ev.id}.pdf"`).send(pdf);
  });

  // Remover convidado = cortar o acesso dele à câmera. As fotos que ele já
  // enviou continuam no álbum, a menos que a organização peça ?apagarFotos=1.
  r.delete('/:id/convidados/:gid', getEvent, adminOnly, (req, res) => {
    const ev = req.ev;
    const i = ev.guests.findIndex((g) => g.id === req.params.gid);
    if (i < 0) return res.status(404).json({ erro: 'Convidado não encontrado.' });
    const [g] = ev.guests.splice(i, 1);
    const apagarFotos = ['1', 'true', 'sim'].includes(String(req.query.apagarFotos || '').toLowerCase());
    let fotosApagadas = 0;
    if (apagarFotos) {
      const minhas = ev.photos.filter((p) => p.guestId === g.id);
      for (const p of minhas) fs.rmSync(path.join(photoDir, ev.id, `${p.id}.${p.ext}`), { force: true });
      fotosApagadas = minhas.length;
      ev.photos = ev.photos.filter((p) => p.guestId !== g.id);
    }
    audit(req, 'convidado.removido', { convidado: g.id, nome: g.nome, apagarFotos, fotosApagadas });
    save();
    res.json({ ok: true, nome: g.nome, fotosApagadas });
  });

  // Estender a revelação: só o casal, e sempre para uma data futura.
  r.patch('/:id/revelacao', getEvent, adminOnly, donoOnly, (req, res) => {
    const ev = req.ev;
    if (revealed(ev)) return res.status(409).json({ erro: 'O álbum já foi revelado. Não dá para voltar atrás.' });
    const d = new Date(req.body.revealAt);
    if (isNaN(d)) return res.status(400).json({ erro: 'Informe a nova data da revelação.' });
    if (d.getTime() <= clock.nowMs()) return res.status(400).json({ erro: 'A nova revelação precisa estar no futuro. Para revelar agora, use "Encerrar revelação".' });
    ev.revealAt = d.toISOString();
    ev.revealNotified = false;
    audit(req, 'revelacao.estendida', { revealAt: ev.revealAt });
    save();
    res.json(publicInfo(ev));
  });

  // Encerrar = revelar agora. Só o casal; o aviso automático sai depois.
  r.post('/:id/revelacao/encerrar', getEvent, adminOnly, donoOnly, (req, res) => {
    const ev = req.ev;
    if (revealed(ev)) return res.status(409).json({ erro: 'O álbum já está revelado.' });
    ev.revealAt = clock.iso();
    ev.revealNotified = false;
    audit(req, 'revelacao.encerrada');
    save();
    res.json(publicInfo(ev));
  });

  return r;
};
