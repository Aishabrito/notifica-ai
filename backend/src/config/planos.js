// ============================================
// 💎 REGRAS DE NEGÓCIO DOS PLANOS
// ============================================
// Fonte única de verdade para limites e recursos de cada plano.
// intervalosPermitidos estão em horas (0.25 = 15 minutos).

// Frequência do Free: 6h é o que os Termos de Uso e o site prometem.
// Para mudar (6, 12 ou 24), avise os usuários por e-mail antes (Termos, item 3).
const INTERVALO_FREE = [6, 12, 24].includes(Number(process.env.FREE_INTERVALO_HORAS))
  ? Number(process.env.FREE_INTERVALO_HORAS)
  : 6;

// Quantas páginas o Free monitora ao mesmo tempo (padrão: 1 — o suficiente
// para experimentar; o resto é Pro). Quem já tinha mais alertas ativos antes
// de uma redução continua com eles; o limite vale para novos cadastros.
const MAX_ALERTAS_FREE = Number.isInteger(Number(process.env.FREE_MAX_ALERTAS)) && Number(process.env.FREE_MAX_ALERTAS) > 0
  ? Number(process.env.FREE_MAX_ALERTAS)
  : 1;

const PLANOS = {
  free: {
    nome: 'Gratuito',
    maxAlertasAtivos: MAX_ALERTAS_FREE,
    intervalosPermitidos: [INTERVALO_FREE],
    intervaloPadrao: INTERVALO_FREE,
  },
  pro: {
    nome: 'Pro',
    maxAlertasAtivos: null, // ilimitado
    intervalosPermitidos: [24, 6, 1, 0.25],
    intervaloPadrao: 1,
  },
};

// Plano realmente em vigor para o usuário.
// Uma assinatura cancelada continua valendo até o fim do período pago (validoAte).
function obterTipoPlanoEfetivo(usuario) {
  const plano = usuario?.plano;
  if (!plano || plano.tipo !== 'pro') return 'free';
  if (plano.validoAte && new Date(plano.validoAte) <= new Date()) return 'free';
  if (plano.status === 'cancelado' && !plano.validoAte) return 'free';
  return 'pro';
}

function obterRegrasPlano(usuario) {
  return PLANOS[obterTipoPlanoEfetivo(usuario)];
}

// Intervalo que o crawler deve usar: se o usuário perdeu o Pro,
// alertas com frequência turbo voltam ao intervalo padrão do Free.
function intervaloEfetivo(alerta, usuario) {
  const regras = obterRegrasPlano(usuario);
  const intervalo = alerta.intervaloHoras ?? regras.intervaloPadrao;
  return regras.intervalosPermitidos.includes(intervalo) ? intervalo : regras.intervaloPadrao;
}

// "1 alerta" / "3 alertas"
const alertasTexto = (n) => `${n} ${n === 1 ? 'alerta ativo' : 'alertas ativos'}`;

module.exports = { alertasTexto, PLANOS, obterTipoPlanoEfetivo, obterRegrasPlano, intervaloEfetivo };
