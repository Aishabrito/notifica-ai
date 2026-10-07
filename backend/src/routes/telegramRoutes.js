const express   = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const telegram = require('../service/telegram');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde alguns minutos.' },
});

function exigirTelegram(_req, res, next) {
  if (!telegram.telegramConfigurado()) {
    return res.status(503).json({ sucesso: false, mensagem: 'Alertas no Telegram indisponíveis no momento.' });
  }
  next();
}

// ─── GERAR LINK DE CONEXÃO (vale 15 min) ───────────
router.post('/conectar', limiter, autenticar, exigirTelegram, async (req, res) => {
  try {
    if (obterTipoPlanoEfetivo(req.usuario) !== 'pro') {
      return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: 'Alertas no Telegram são exclusivos do plano Pro.' });
    }
    const link = await telegram.gerarLinkConexao(req.usuario);
    res.json({ sucesso: true, link });
  } catch (err) {
    console.error('[Telegram] Erro ao gerar link:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível gerar o link agora.' });
  }
});

// ─── DESCONECTAR ───────────────────────────────────
router.delete('/', limiter, autenticar, async (req, res) => {
  try {
    await telegram.desconectar(req.usuario);
    res.json({ sucesso: true, mensagem: 'Telegram desconectado.' });
  } catch (err) {
    console.error('[Telegram] Erro ao desconectar:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível desconectar agora.' });
  }
});

// ─── WEBHOOK (mensagens recebidas pelo bot) ────────
const webhookTelegramRouter = express.Router();

webhookTelegramRouter.post('/telegram', async (req, res) => {
  if (!telegram.webhookAutentico(req.headers['x-telegram-bot-api-secret-token'])) {
    return res.sendStatus(401);
  }
  try {
    await telegram.processarAtualizacao(req.body);
  } catch (err) {
    console.error('[Telegram] Erro ao processar mensagem:', err.message);
  }
  // Sempre 200: senão o Telegram reenvia a mesma mensagem em loop
  res.sendStatus(200);
});

module.exports = { telegramRouter: router, webhookTelegramRouter };
