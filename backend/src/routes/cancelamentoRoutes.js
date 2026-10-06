const express = require('express');
const mongoose = require('mongoose');
const Alerta  = require('../models/alertaModel');
const { tokenCancelamentoValido } = require('../utils/linkCancelamento');
const { escaparHtml } = require('../utils/html');

const router = express.Router();

// Página HTML simples servida pelo próprio backend (link do e-mail).
// O GET só mostra a confirmação: leitores de e-mail e antivírus abrem links
// automaticamente, então a exclusão só acontece no POST do botão.
function pagina(titulo, corpo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo} — Notifica.ai</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #0a0a0a; color: #f5f2eb; font-family: Arial, sans-serif; padding: 16px; box-sizing: border-box; }
    .card { max-width: 420px; width: 100%; background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { color: #a3a3a3; line-height: 1.5; word-break: break-word; }
    button { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 10px;
             background: #dc2626; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body><div class="card">${corpo}</div></body>
</html>`;
}

async function buscarAlerta(req, res) {
  const { id, token } = req.params;
  if (!mongoose.isValidObjectId(id) || !tokenCancelamentoValido(id, token)) {
    res.status(400).send(pagina('Link inválido', '<h1>Link inválido</h1><p>Este link de cancelamento não é válido.</p>'));
    return null;
  }
  const alerta = await Alerta.findById(id);
  if (!alerta) {
    res.send(pagina('Já cancelado', '<h1>Monitoramento já cancelado</h1><p>Este alerta não existe mais. Você não receberá novos e-mails sobre ele.</p>'));
    return null;
  }
  return alerta;
}

router.get('/:id/:token', async (req, res) => {
  try {
    const alerta = await buscarAlerta(req, res);
    if (!alerta) return;

    const site = escaparHtml(alerta.titulo || alerta.url);
    res.send(pagina('Cancelar monitoramento', `
      <h1>Cancelar monitoramento?</h1>
      <p>Você vai parar de receber alertas de:<br><strong>${site}</strong></p>
      <form method="POST">
        <button type="submit">Sim, cancelar monitoramento</button>
      </form>`));
  } catch (err) {
    console.error('[Cancelamento] Erro:', err.message);
    res.status(500).send(pagina('Erro', '<h1>Algo deu errado</h1><p>Tente novamente em instantes.</p>'));
  }
});

router.post('/:id/:token', async (req, res) => {
  try {
    const alerta = await buscarAlerta(req, res);
    if (!alerta) return;

    const site = escaparHtml(alerta.titulo || alerta.url);
    await alerta.deleteOne();
    res.send(pagina('Monitoramento cancelado', `
      <h1>Monitoramento cancelado</h1>
      <p>Você não receberá mais alertas de <strong>${site}</strong>.</p>`));
  } catch (err) {
    console.error('[Cancelamento] Erro:', err.message);
    res.status(500).send(pagina('Erro', '<h1>Algo deu errado</h1><p>Tente novamente em instantes.</p>'));
  }
});

module.exports = router;
