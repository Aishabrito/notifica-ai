// ============================================
// 💳 CATÁLOGO DE OFERTAS (fonte confiável de preços)
// ============================================
// O navegador só envia o ID da oferta; valor, moeda, recorrência e duração
// vêm sempre daqui. Preços configuráveis por variável de ambiente.

function preco(variavel, padrao) {
  const valor = Number(process.env[variavel] || padrao);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error(`${variavel} inválido.`);
  return Math.round(valor * 100) / 100;
}

const precoMensal = () => preco('MP_PRECO_MENSAL', '14.90');

// Assinatura recorrente no cartão (sem conta no Mercado Pago)
function SUBSCRIPTION_OFFERS() {
  return {
    'pro-mensal': {
      id: 'pro-mensal',
      reason: 'Notifica.ai Pro',
      frequency: 1,
      frequencyType: 'months',
      amount: precoMensal(),
      currency: 'BRL',
    },
  };
}

// Pix avulso: paga uma vez e ganha N dias de Pro (não renova sozinho)
function PIX_OFFERS() {
  const mensal = precoMensal();
  return {
    'pix-30-dias': {
      id: 'pix-30-dias',
      descricao: 'Notifica.ai Pro — 30 dias',
      dias: 30,
      amount: preco('MP_PRECO_PIX_30_DIAS', String(mensal)),
    },
    'pix-anual': {
      id: 'pix-anual',
      descricao: 'Notifica.ai Pro — 1 ano',
      dias: 365,
      // padrão: 12 meses pelo preço de 10
      amount: preco('MP_PRECO_PIX_ANUAL', String(mensal * 10)),
    },
  };
}

function resolveOffer(id) {
  return SUBSCRIPTION_OFFERS()[id] ?? null;
}

function resolvePixOffer(id) {
  return PIX_OFFERS()[id] ?? null;
}

module.exports = { SUBSCRIPTION_OFFERS, PIX_OFFERS, resolveOffer, resolvePixOffer };
