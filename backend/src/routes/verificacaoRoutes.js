const express  = require('express');
const mongoose = require('mongoose');
const Usuario  = require('../models/Usuario');
const { verificacaoValida } = require('../utils/verificacaoEmail');
const { pagina } = require('../utils/paginaSimples');

const router = express.Router();
const frontend = () => process.env.FRONTEND_URL || 'https://notifica.dev.br';

// Link do e-mail de confirmação (servido pelo backend, como o de cancelamento)
router.get('/:id/:ts/:token', async (req, res) => {
  try {
    const { id, ts, token } = req.params;
    const usuario = mongoose.isValidObjectId(id) ? await Usuario.findById(id) : null;
    if (!usuario || !verificacaoValida(usuario, ts, token)) {
      return res.status(400).send(pagina('Link inválido', `
        <h1>Link inválido ou expirado</h1>
        <p>Peça um novo link de confirmação no painel do Notifica.ai.</p>`));
    }
    if (!usuario.emailVerificado) {
      usuario.emailVerificado = true;
      usuario.emailVerificadoEm = new Date();
      await usuario.save();
    }
    res.send(pagina('E-mail confirmado', `
      <h1>E-mail confirmado ✅</h1>
      <p>Tudo certo! Agora você já pode usar o Radar do Diário Oficial.</p>
      <p><a href="${frontend()}/radar" style="color:#10b981;">Ir para o Radar →</a></p>`));
  } catch (err) {
    console.error('[Verificação] Erro:', err.message);
    res.status(500).send(pagina('Erro', '<h1>Algo deu errado</h1><p>Tente novamente em instantes.</p>'));
  }
});

module.exports = router;
