// ============================================
// 💳 CATÁLOGO DE OFERTAS (fonte confiável de preços)
// ============================================
// O navegador só envia o ID da oferta; valor, moeda, recorrência e duração
// vêm sempre daqui. Três períodos, com o mesmo preço no cartão e no Pix:
//   mensal     → MP_PRECO_MENSAL     (valor cobrado todo mês)
//   semestral  → MP_PRECO_SEMESTRAL  (valor TOTAL cobrado a cada 6 meses)
//   anual      → MP_PRECO_ANUAL      (valor TOTAL cobrado a cada 12 meses)

const PERIODOS = [
  { periodo: 'mensal',    meses: 1,  dias: 30,  variavel: 'MP_PRECO_MENSAL',    padrao: '20.00', nome: 'Mensal' },
  { periodo: 'semestral', meses: 6,  dias: 182, variavel: 'MP_PRECO_SEMESTRAL', padrao: '90.00', nome: 'Semestral' },
  { periodo: 'anual',     meses: 12, dias: 365, variavel: 'MP_PRECO_ANUAL',     padrao: '90.00', nome: 'Anual' },
];

function preco(variavel, padrao) {
  const valor = Number(process.env[variavel] || padrao);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error(`${variavel} inválido.`);
  return Math.round(valor * 100) / 100;
}

const porMes = (total, meses) => Math.round((total / meses) * 100) / 100;

// Assinatura recorrente no cartão (sem conta no Mercado Pago)
function SUBSCRIPTION_OFFERS() {
  return Object.fromEntries(PERIODOS.map((p) => {
    const amount = preco(p.variavel, p.padrao);
    const id = `pro-${p.periodo}`;
    return [id, {
      id,
      periodo: p.periodo,
      nome: p.nome,
      reason: p.meses === 1 ? 'Notifica.ai Pro' : `Notifica.ai Pro — ${p.nome}`,
      frequency: p.meses,
      frequencyType: 'months',
      meses: p.meses,
      amount,
      porMes: porMes(amount, p.meses),
      currency: 'BRL',
    }];
  }));
}

// Pix avulso: paga uma vez e ganha N dias de Pro (não renova sozinho)
// O ID do mensal continua "pix-30-dias" para não quebrar transações antigas.
function PIX_OFFERS() {
  return Object.fromEntries(PERIODOS.map((p) => {
    const amount = preco(p.variavel, p.padrao);
    const id = p.periodo === 'mensal' ? 'pix-30-dias' : `pix-${p.periodo}`;
    return [id, {
      id,
      periodo: p.periodo,
      nome: p.nome,
      descricao: p.meses === 1 ? 'Notifica.ai Pro — 30 dias' : `Notifica.ai Pro — ${p.meses === 12 ? '1 ano' : `${p.meses} meses`}`,
      dias: p.dias,
      meses: p.meses,
      amount,
      porMes: porMes(amount, p.meses),
    }];
  }));
}

function resolveOffer(id) {
  return SUBSCRIPTION_OFFERS()[id] ?? null;
}

function resolvePixOffer(id) {
  return PIX_OFFERS()[id] ?? null;
}

module.exports = { PERIODOS, SUBSCRIPTION_OFFERS, PIX_OFFERS, resolveOffer, resolvePixOffer };
