const crypto    = require('crypto');
const express   = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const Transacao = require('../models/Transacao');
const Usuario   = require('../models/Usuario');
const { reativarAlertasPausadosPorPlano } = require('../service/planoService');
const mp = require('../service/mercadoPago');
const { SUBSCRIPTION_OFFERS, PIX_OFFERS, resolveOffer, resolvePixOffer } = require('../config/ofertas');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const {
  sincronizarAssinatura,
  processarPagamentoPix,
  temAssinaturaPagaAtiva,
} = require('../service/assinaturaService');

const router = express.Router();

const limiterAssinatura = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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

// Evita duas criações simultâneas para o mesmo usuário (clique duplo,
// duas abas). O frontend também desabilita o botão enquanto processa.
const inFlight = new Set();
function umaPorVez(req, res, next) {
  const chave = String(req.usuario._id);
  if (inFlight.has(chave)) {
    return res.status(409).json({ sucesso: false, mensagem: 'Já estamos processando um pagamento seu. Aguarde um instante.' });
  }
  inFlight.add(chave);
  res.on('finish', () => inFlight.delete(chave));
  res.on('close', () => inFlight.delete(chave));
  next();
}

const novaReferencia = (usuario, tipo) => `${usuario._id}:${tipo}:${crypto.randomUUID()}`;

// ─── CONFIGURAÇÃO PÚBLICA (chave pública + ofertas) ─────────
// Montada em GET /api/mp-config. A chave pública não é segredo, mas vem do
// servidor para não precisar de rebuild do frontend ao trocar de credencial.
function mpConfigHandler(_req, res) {
  res.set('Cache-Control', 'no-store, max-age=0');
  try {
    const cartao = SUBSCRIPTION_OFFERS()['pro-mensal'];
    res.json({
      sucesso: true,
      publicKey: process.env.MP_PUBLIC_KEY || null,
      pagamentosAtivos: mp.mercadoPagoConfigurado() && Boolean(process.env.MP_PUBLIC_KEY),
      cartao: { id: cartao.id, valor: cartao.amount },
      pix: Object.values(PIX_OFFERS()).map((o) => ({ id: o.id, dias: o.dias, valor: o.amount, descricao: o.descricao })),
    });
  } catch (err) {
    console.error('[Assinatura] Configuração de preços inválida:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Pagamentos indisponíveis no momento.' });
  }
}

// ─── ASSINATURA NO CARTÃO ──────────────────────────
// Body: { offerId, cardToken } — cardToken vem do Card Payment Brick
// (tokenização no navegador). O e-mail do pagador vem da sessão.
router.post('/cartao', limiterAssinatura, autenticar, exigirMercadoPago, umaPorVez, async (req, res) => {
  try {
    const trustedOffer = resolveOffer(req.body?.offerId);
    const cardTokenId  = typeof req.body?.cardToken === 'string' ? req.body.cardToken : null;
    if (!trustedOffer || !cardTokenId) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados do pagamento incompletos.' });
    }
    if (temAssinaturaPagaAtiva(req.usuario)) {
      return res.status(409).json({ sucesso: false, mensagem: 'Você já tem uma assinatura Pro ativa.' });
    }

    // Quem ainda tem dias de Pro (Pix ou cortesia com prazo) só começa a
    // pagar quando eles acabarem
    const validoAte = req.usuario.plano?.validoAte ? new Date(req.usuario.plano.validoAte) : null;
    const inicioCobranca = obterTipoPlanoEfetivo(req.usuario) === 'pro' && validoAte && validoAte > new Date()
      ? validoAte : null;

    const externalReference = novaReferencia(req.usuario, 'assinatura');
    await Transacao.create({
      tipo: 'assinatura',
      usuario: req.usuario._id,
      externalReference,
      oferta: trustedOffer.id,
      valor: trustedOffer.amount,
    });

    const assinatura = await mp.criarAssinaturaCartao({
      trustedOffer,
      payerEmail: req.usuario.email,
      cardTokenId,
      externalReference,
      inicioCobranca,
    });
    await Transacao.updateOne({ externalReference }, { mpId: String(assinatura.id), status: assinatura.status });

    // Não espera o webhook: a assinatura já volta authorized (ou recusada)
    const resultado = await sincronizarAssinatura(assinatura);
    if (assinatura.status !== 'authorized') {
      return res.status(402).json({
        sucesso: false,
        status: assinatura.status,
        mensagem: 'O cartão não foi aprovado. Confira os dados ou tente outro cartão.',
      });
    }

    res.json({ sucesso: true, status: assinatura.status, assinaturaId: String(assinatura.id), resultado });
  } catch (err) {
    console.error('[Assinatura] Erro ao criar assinatura no cartão:', err.message);
    const recusado = err instanceof mp.ErroMercadoPago && err.status < 500;
    res.status(recusado ? 402 : 502).json({
      sucesso: false,
      mensagem: recusado
        ? 'O Mercado Pago recusou o pagamento. Confira os dados do cartão ou tente outro cartão.'
        : 'Não foi possível processar o pagamento agora. Tente novamente.',
    });
  }
});

// ─── CONSULTA DA ASSINATURA (reconciliação) ────────
router.get('/subscriptions/:id', limiterAssinatura, autenticar, exigirMercadoPago, async (req, res) => {
  try {
    if (req.usuario.plano?.mpAssinaturaId !== req.params.id) {
      return res.status(404).json({ sucesso: false, mensagem: 'Assinatura não encontrada.' });
    }
    const assinatura = await mp.buscarAssinatura(req.params.id);
    await sincronizarAssinatura(assinatura);
    res.json({
      sucesso: true,
      assinatura: {
        id: String(assinatura.id),
        status: assinatura.status, // pending | authorized | paused | cancelled
        proximaCobranca: assinatura.next_payment_date ?? null,
        valor: assinatura.auto_recurring?.transaction_amount ?? null,
      },
    });
  } catch (err) {
    console.error('[Assinatura] Erro ao consultar assinatura:', err.message);
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível consultar a assinatura agora.' });
  }
});

// ─── PAUSAR / REATIVAR / CANCELAR ──────────────────
// Só estas três ações; o status nunca vem livre do navegador.
const ACOES_ASSINATURA = {
  pause: 'paused',
  reactivate: 'authorized',
  cancel: 'cancelled', // a API do MP usa "cancelled" (canceled)
};

router.post('/subscriptions/:id/:acao', limiterAssinatura, autenticar, exigirMercadoPago, umaPorVez, async (req, res) => {
  try {
    const novoStatus = ACOES_ASSINATURA[req.params.acao];
    if (!novoStatus) return res.status(400).json({ sucesso: false, mensagem: 'Ação inválida.' });
    if (req.usuario.plano?.mpAssinaturaId !== req.params.id) {
      return res.status(404).json({ sucesso: false, mensagem: 'Assinatura não encontrada.' });
    }

    await mp.alterarStatusAssinatura(req.params.id, novoStatus);
    // Não espera o webhook: lê o estado atualizado e sincroniza na hora
    const assinatura = await mp.buscarAssinatura(req.params.id);
    await sincronizarAssinatura(assinatura);

    const ate = req.usuario.plano?.validoAte
      ? new Date(req.usuario.plano.validoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : null;
    const mensagens = {
      pause:      `Assinatura pausada. Seu acesso Pro continua${ate ? ` até ${ate}` : ''}.`,
      reactivate: 'Assinatura reativada! As cobranças mensais voltam normalmente.',
      cancel:     `Assinatura cancelada. Seu acesso Pro continua${ate ? ` até ${ate}` : ''}.`,
    };
    res.json({ sucesso: true, status: assinatura.status, mensagem: mensagens[req.params.acao] });
  } catch (err) {
    console.error(`[Assinatura] Erro na ação ${req.params.acao}:`, err.message);
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível concluir agora. Tente novamente.' });
  }
});

// ─── TESTE GRÁTIS (uma vez por conta, sem cartão) ──
// Exige e-mail confirmado para dificultar contas descartáveis.
const diasTesteGratis = () => Math.min(30, Math.max(1, Number(process.env.TESTE_GRATIS_DIAS || 7)));

router.post('/teste-gratis', limiterAssinatura, autenticar, umaPorVez, async (req, res) => {
  try {
    if (obterTipoPlanoEfetivo(req.usuario) === 'pro') {
      return res.status(409).json({ sucesso: false, mensagem: 'Você já é Pro. 🙂' });
    }
    if (req.usuario.testeGratisUsadoEm) {
      return res.status(409).json({ sucesso: false, mensagem: 'O teste grátis já foi usado nesta conta.' });
    }
    if (!req.usuario.emailVerificado) {
      return res.status(403).json({ sucesso: false, codigo: 'EMAIL_NAO_VERIFICADO', mensagem: 'Confirme seu e-mail para liberar o teste grátis.' });
    }

    const dias = diasTesteGratis();
    // Atômico: duas requisições simultâneas não geram dois testes
    const usuario = await Usuario.findOneAndUpdate(
      { _id: req.usuario._id, testeGratisUsadoEm: null },
      {
        $set: {
          testeGratisUsadoEm: new Date(),
          plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + dias * 24 * 60 * 60 * 1000), origem: 'teste', mpAssinaturaId: null, lembreteRenovacaoEm: null },
        },
      },
      { new: true }
    );
    if (!usuario) return res.status(409).json({ sucesso: false, mensagem: 'O teste grátis já foi usado nesta conta.' });

    await reativarAlertasPausadosPorPlano(usuario._id);
    res.json({ sucesso: true, validoAte: usuario.plano.validoAte, mensagem: `Pronto! Você tem ${dias} dias de Pro grátis.` });
  } catch (err) {
    console.error('[Assinatura] Erro ao iniciar teste grátis:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível iniciar o teste agora.' });
  }
});

// ─── PIX ───────────────────────────────────────────
// Body: { offerId } → QR Code para pagar. Não renova sozinho.
router.post('/pix', limiterAssinatura, autenticar, exigirMercadoPago, umaPorVez, async (req, res) => {
  try {
    const oferta = resolvePixOffer(req.body?.offerId);
    if (!oferta) return res.status(400).json({ sucesso: false, mensagem: 'Oferta inválida.' });

    if (temAssinaturaPagaAtiva(req.usuario)) {
      return res.status(409).json({ sucesso: false, mensagem: 'Você já tem uma assinatura no cartão, que renova sozinha.' });
    }
    if (obterTipoPlanoEfetivo(req.usuario) === 'pro' && !req.usuario.plano?.validoAte) {
      return res.status(409).json({ sucesso: false, mensagem: 'Seu plano Pro não tem data para acabar. 🙂' });
    }

    const externalReference = novaReferencia(req.usuario, 'pix');
    const transacao = await Transacao.create({
      tipo: 'pix',
      usuario: req.usuario._id,
      externalReference,
      oferta: oferta.id,
      valor: oferta.amount,
      dias: oferta.dias,
    });

    const pagamento = await mp.criarPagamentoPix({ oferta, usuario: req.usuario, externalReference });
    transacao.mpId = String(pagamento.id);
    transacao.status = pagamento.status;
    await transacao.save();

    const dadosPix = pagamento.point_of_interaction?.transaction_data ?? {};
    res.json({
      sucesso: true,
      pagamentoId: String(pagamento.id),
      status: pagamento.status, // pending até o pagamento cair
      valor: oferta.amount,
      dias: oferta.dias,
      qrCode: dadosPix.qr_code ?? null,             // "copia e cola"
      qrCodeBase64: dadosPix.qr_code_base64 ?? null, // imagem PNG
      linkPagamento: dadosPix.ticket_url ?? null,
      expiraEm: pagamento.date_of_expiration ?? null,
    });
  } catch (err) {
    console.error('[Assinatura] Erro ao criar Pix:', err.message);
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível gerar o Pix agora. Tente novamente.' });
  }
});

// Consulta do status do Pix (o frontend chama a cada poucos segundos).
// Também processa o pagamento: funciona mesmo se o webhook atrasar.
router.get('/pix/:id', autenticar, exigirMercadoPago, async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ tipo: 'pix', mpId: req.params.id, usuario: req.usuario._id });
    if (!transacao) return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });

    if (!transacao.processadoEm) {
      const pagamento = await mp.buscarPagamento(req.params.id);
      await processarPagamentoPix(pagamento);
    }
    const atualizada = await Transacao.findById(transacao._id).lean();
    res.json({ sucesso: true, status: atualizada.status, aprovado: Boolean(atualizada.processadoEm) });
  } catch (err) {
    console.error('[Assinatura] Erro ao consultar Pix:', err.message);
    res.status(502).json({ sucesso: false, mensagem: 'Não foi possível consultar o pagamento agora.' });
  }
});

// ─── WEBHOOK DO MERCADO PAGO ───────────────────────
// Configurar no painel do MP (Suas integrações → Webhooks) com os eventos
// "Planos e assinaturas" e "Pagamentos". URL: <BASE_URL>/api/webhooks/mercadopago
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
    let resultado;
    if (tipo === 'subscription_preapproval') {
      resultado = await sincronizarAssinatura(await mp.buscarAssinatura(String(dataId)));
    } else if (tipo === 'subscription_authorized_payment') {
      const cobranca = await mp.buscarPagamentoAutorizado(String(dataId));
      resultado = cobranca?.preapproval_id
        ? await sincronizarAssinatura(await mp.buscarAssinatura(cobranca.preapproval_id))
        : 'ignorada:sem-assinatura';
    } else if (tipo === 'payment') {
      // Pix avulso (cobranças das assinaturas também chegam aqui e são ignoradas)
      resultado = await processarPagamentoPix(await mp.buscarPagamento(String(dataId)));
    } else {
      return res.sendStatus(200); // outros eventos não interessam
    }

    console.log(`[Webhook MP] ${tipo} ${dataId} → ${resultado}`);
    res.sendStatus(200);
  } catch (err) {
    // Erro 5xx faz o MP reenviar a notificação mais tarde
    console.error(`[Webhook MP] Erro ao processar ${tipo} ${dataId}:`, err.message);
    res.sendStatus(500);
  }
});

module.exports = { assinaturaRouter: router, webhookRouter, mpConfigHandler };
