// ============================================
// 💎 REGRAS DE NEGÓCIO DOS PLANOS
// ============================================
// Fonte única de verdade para limites e recursos de cada plano.
// intervalosPermitidos estão em horas (0.25 = 15 minutos).

const PLANOS = {
  free: {
    nome: 'Gratuito',
    maxAlertasAtivos: 3,
    intervalosPermitidos: [24],
    intervaloPadrao: 24,
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

module.exports = { PLANOS, obterTipoPlanoEfetivo, obterRegrasPlano, intervaloEfetivo };
