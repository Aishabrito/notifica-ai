const crypto = require('crypto');
const { WebhookSignatureValidator } = require('mercadopago');

// ============================================
// 💳 CLIENTE MERCADO PAGO
// ============================================
// Wrapper fino: toda chamada à API do MP passa por aqui, o que deixa a regra
// de negócio (assinaturaService) fácil de testar sem rede.

const API_MP = 'https://api.mercadopago.com';

function mercadoPagoConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

// Erro com o status e o motivo devolvidos pelo MP — sem repetir o corpo da
// requisição (que pode conter o token do cartão).
class ErroMercadoPago extends Error {
  constructor(status, corpo) {
    const causa = Array.isArray(corpo?.cause) && corpo.cause.length
      ? ` (${corpo.cause.map((c) => c.description || c.code).filter(Boolean).join('; ')})`
      : '';
    super(`Mercado Pago ${status}: ${corpo?.message || corpo?.error || 'erro desconhecido'}${causa}`);
    this.name = 'ErroMercadoPago';
    this.status = status;
  }
}

// Aceita caminho relativo ("/preapproval") ou URL completa da API do MP
async function mpFetch(caminho, { method = 'GET', body, idempotencyKey } = {}) {
  if (!mercadoPagoConfigurado()) throw new Error('MP_ACCESS_TOKEN não configurado.');
  const url = caminho.startsWith('http') ? caminho : `${API_MP}${caminho}`;

  const resposta = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroMercadoPago(resposta.status, dados);
  return dados;
}

function urlRetorno() {
  return `${process.env.FRONTEND_URL || 'https://notifica.dev.br'}/planos?assinatura=retorno`;
}

// ============================================
// 🔁 ASSINATURA NO CARTÃO (sem plano, autorizada)
// ============================================
// O cartão é tokenizado no navegador pelo Card Payment Brick: o comprador
// não precisa ter conta no Mercado Pago. Recorrência e valor vêm da oferta
// confiável do servidor (config/ofertas.js), nunca do navegador.
async function criarAssinaturaCartao({ trustedOffer, payerEmail, cardTokenId, externalReference, inicioCobranca }) {
  return mpFetch('/preapproval', {
    method: 'POST',
    body: {
      reason: trustedOffer.reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      card_token_id: cardTokenId,
      auto_recurring: {
        frequency: trustedOffer.frequency,
        frequency_type: trustedOffer.frequencyType,
        transaction_amount: trustedOffer.amount,
        currency_id: trustedOffer.currency,
        // Quem ainda tem dias de Pro (ex.: Pix) só começa a pagar quando eles acabarem
        ...(inicioCobranca ? { start_date: inicioCobranca.toISOString() } : {}),
      },
      back_url: urlRetorno(),
      status: 'authorized',
    },
  });
}

async function buscarAssinatura(id) {
  return mpFetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`);
}

// status: 'paused' | 'authorized' | 'cancelled' — quem chama faz o allowlist
async function alterarStatusAssinatura(id, status) {
  return mpFetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { status },
  });
}

async function cancelarAssinatura(id) {
  return alterarStatusAssinatura(id, 'cancelled');
}

// Cobrança mensal de uma assinatura (notificação subscription_authorized_payment)
async function buscarPagamentoAutorizado(id) {
  return mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);
}

// ============================================
// ⚡ PIX AVULSO
// ============================================
async function criarPagamentoPix({ oferta, usuario, externalReference }) {
  const [primeiroNome, ...resto] = String(usuario.nome || '').trim().split(/\s+/);
  return mpFetch('/v1/payments', {
    method: 'POST',
    idempotencyKey: crypto.randomUUID(),
    body: {
      transaction_amount: oferta.amount,
      description: oferta.descricao,
      payment_method_id: 'pix',
      external_reference: externalReference,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payer: {
        email: usuario.email,
        first_name: primeiroNome || undefined,
        last_name: resto.join(' ') || undefined,
      },
    },
  });
}

async function buscarPagamento(id) {
  return mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
}

// ============================================
// 🔐 WEBHOOK
// ============================================
// Lança InvalidWebhookSignatureError se a notificação não veio do MP.
function validarAssinaturaWebhook({ xSignature, xRequestId, dataId }) {
  WebhookSignatureValidator.validate({
    xSignature,
    xRequestId,
    dataId,
    secret: process.env.MP_WEBHOOK_SECRET,
    toleranceSeconds: 10 * 60, // mitiga replay de notificações antigas
  });
}

module.exports = {
  mercadoPagoConfigurado,
  criarAssinaturaCartao,
  buscarAssinatura,
  alterarStatusAssinatura,
  cancelarAssinatura,
  buscarPagamentoAutorizado,
  criarPagamentoPix,
  buscarPagamento,
  validarAssinaturaWebhook,
  ErroMercadoPago,
};
