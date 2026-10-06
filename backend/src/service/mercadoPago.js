const axios = require('axios');
const { MercadoPagoConfig, PreApproval, WebhookSignatureValidator } = require('mercadopago');

// ============================================
// 💳 CLIENTE MERCADO PAGO (assinaturas / preapproval)
// ============================================
// Wrapper fino: toda chamada à API do MP passa por aqui, o que deixa a regra
// de negócio (assinaturaService) fácil de testar sem rede.

const API_MP = 'https://api.mercadopago.com';

function mercadoPagoConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function preApproval() {
  if (!mercadoPagoConfigurado()) throw new Error('MP_ACCESS_TOKEN não configurado.');
  const config = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
    options: { timeout: 10000 },
  });
  return new PreApproval(config);
}

function precoMensal() {
  const preco = Number(process.env.MP_PRECO_MENSAL || '14.90');
  if (!Number.isFinite(preco) || preco <= 0) throw new Error('MP_PRECO_MENSAL inválido.');
  return preco;
}

// Assinatura "sem plano associado" com status pending: o MP devolve um
// init_point (checkout hospedado) onde o usuário cadastra o cartão.
// external_reference = id do usuário, usado pelo webhook para achar a conta.
async function criarAssinatura(usuario) {
  return preApproval().create({
    body: {
      reason: 'Notifica.ai Pro',
      external_reference: String(usuario._id),
      payer_email: usuario.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: precoMensal(),
        currency_id: 'BRL',
      },
      back_url: `${process.env.FRONTEND_URL || 'https://notifica.dev.br'}/home?assinatura=retorno`,
      status: 'pending',
    },
  });
}

async function buscarAssinatura(id) {
  return preApproval().get({ id });
}

async function cancelarAssinatura(id) {
  return preApproval().update({ id, body: { status: 'cancelled' } });
}

// Cobrança mensal de uma assinatura (notificação subscription_authorized_payment).
// O SDK não expõe esse recurso, então vai direto na API REST.
async function buscarPagamentoAutorizado(id) {
  if (!mercadoPagoConfigurado()) throw new Error('MP_ACCESS_TOKEN não configurado.');
  const { data } = await axios.get(`${API_MP}/authorized_payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    timeout: 10000,
  });
  return data;
}

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
  criarAssinatura,
  buscarAssinatura,
  cancelarAssinatura,
  buscarPagamentoAutorizado,
  validarAssinaturaWebhook,
};
