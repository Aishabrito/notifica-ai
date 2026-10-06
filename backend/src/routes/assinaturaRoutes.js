const express   = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const mp = require('../service/mercadoPago');
const { sincronizarAssinatura, temAssinaturaPagaAtiva } = require('../service/assinaturaService');

const router = express.Router();

const limiterAssinatura = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde alguns minutos.' },
});

function exigirMercadoPago(_req, res, next) {
  if (!mp.mercadoPagoConfigurado()) {
    return res.status(503).json({ sucesso: false, mensagem: 'Pagamentos indisponíveis no momento.' });
  }
  next();
}

// ─── CRIAR ASSINATURA → link de pagamento (init_point) ─────
router.post('/criar', limiterAssinatura, autenticar, exigirMercadoPago, async (req, res) => {
  try {
    if (temAssinaturaPagaAtiva(req.usuario)) {
      return res.status(409).json({ sucesso: false, mensagem: 'Você já tem uma assinatura Pro ativa.' });
    }

    const assinatura = await mp.criarAssinatura(req.usuario);
    if (!assinatura?.init_point) throw new Error('Mercado Pago não retornou init_point.');

    res.json({ sucesso: true, initPoint: assinatura.init_point });
  } catch (err) {
    console.error('[Assinatura] Erro ao criar assinatura:', err.message, err.cause ?? '');
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível iniciar o pagamento. Tente novamente.' });
  }
});

// ─── CANCELAR ASSINATURA ───────────────────────────
router.post('/cancelar', limiterAssinatura, autenticar, exigirMercadoPago, async (req, res) => {
  try {
    const plano = req.usuario.plano;
    if (plano?.origem !== 'mercadopago' || !plano.mpAssinaturaId || plano.status === 'cancelado') {
      return res.status(400).json({ sucesso: false, mensagem: 'Você não tem uma assinatura ativa para cancelar.' });
    }

    await mp.cancelarAssinatura(plano.mpAssinaturaId);
    // Não espera o webhook: lê o estado atualizado e sincroniza na hora
    await sincronizarAssinatura(await mp.buscarAssinatura(plano.mpAssinaturaId));

    const ate = plano.validoAte
      ? new Date(plano.validoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : null;
    res.json({
      sucesso: true,
      mensagem: ate
        ? `Assinatura cancelada. Seu acesso Pro continua até ${ate}.`
        : 'Assinatura cancelada.',
    });
  } catch (err) {
    console.error('[Assinatura] Erro ao cancelar assinatura:', err.message);
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível cancelar agora. Tente novamente.' });
  }
});

// ─── WEBHOOK DO MERCADO PAGO ───────────────────────
// Configurar no painel do MP (Suas integrações → Webhooks) com os eventos
// "Planos e assinaturas". URL: <BASE_URL>/api/webhooks/mercadopago
const webhookRouter = express.Router();

webhookRouter.post('/mercadopago', async (req, res) => {
  const tipo   = req.body?.type || req.query.type || req.query.topic;
  const dataId = req.query['data.id'] || req.body?.data?.id;

  if (!dataId) return res.sendStatus(200); // nada a processar

  if (process.env.MP_WEBHOOK_SECRET) {
    try {
      mp.validarAssinaturaWebhook({
        xSignature: req.headers['x-signature'],
        xRequestId: req.headers['x-request-id'],
        dataId: String(dataId),
      });
    } catch (err) {
      console.warn('[Webhook MP] Assinatura inválida:', err.reason || err.message);
      return res.sendStatus(401);
    }
  } else {
    // Mesmo sem o segredo, nunca confiamos no corpo: o estado é sempre lido da API do MP
    console.warn('[Webhook MP] MP_WEBHOOK_SECRET não configurado — assinatura do webhook não verificada.');
  }

  try {
    let assinatura = null;
    if (tipo === 'subscription_preapproval') {
      assinatura = await mp.buscarAssinatura(String(dataId));
    } else if (tipo === 'subscription_authorized_payment') {
      const pagamento = await mp.buscarPagamentoAutorizado(String(dataId));
      if (pagamento?.preapproval_id) assinatura = await mp.buscarAssinatura(pagamento.preapproval_id);
    } else {
      return res.sendStatus(200); // outros eventos não interessam
    }

    const resultado = assinatura ? await sincronizarAssinatura(assinatura) : 'ignorada:sem-assinatura';
    console.log(`[Webhook MP] ${tipo} ${dataId} → ${resultado}`);
    res.sendStatus(200);
  } catch (err) {
    // Erro 5xx faz o MP reenviar a notificação mais tarde
    console.error(`[Webhook MP] Erro ao processar ${tipo} ${dataId}:`, err.message);
    res.sendStatus(500);
  }
});

module.exports = { assinaturaRouter: router, webhookRouter };
