const express = require('express');
const mongoose = require('mongoose');
const Alerta  = require('../models/alertaModel');
const { tokenCancelamentoValido } = require('../utils/linkCancelamento');
const { escaparHtml } = require('../utils/html');
const { pagina } = require('../utils/paginaSimples');

const router = express.Router();

// O GET só mostra a confirmação: leitores de e-mail e antivírus abrem links
// automaticamente, então a exclusão só acontece no POST do botão.

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
