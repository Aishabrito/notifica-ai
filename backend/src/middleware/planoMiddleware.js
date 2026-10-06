const Alerta = require('../models/alertaModel');
const { obterRegrasPlano } = require('../config/planos');

// Retorna null se o usuário ainda pode ter mais um alerta ativo,
// ou a mensagem de erro caso o limite do plano já tenha sido atingido.
async function checarLimiteAlertas(usuario) {
  const regras = obterRegrasPlano(usuario);
  if (regras.maxAlertasAtivos === null) return null;

  const ativos = await Alerta.countDocuments({ usuario: usuario._id, status: 'ativo' });
  if (ativos < regras.maxAlertasAtivos) return null;

  return `Limite de ${regras.maxAlertasAtivos} alertas ativos do plano ${regras.nome} atingido. ` +
    'Faça upgrade para o Pro para monitorar sem limites.';
}

// Bloqueia a criação/reativação de alertas além do limite do plano
// e frequências de checagem que o plano não libera.
const verificarLimitePlano = async (req, res, next) => {
  try {
    const erroLimite = await checarLimiteAlertas(req.usuario);
    if (erroLimite) {
      return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: erroLimite });
    }

    if (req.body?.intervaloHoras !== undefined) {
      const erroIntervalo = validarIntervalo(req.usuario, req.body.intervaloHoras);
      if (erroIntervalo) return res.status(403).json(erroIntervalo);
    }

    next();
  } catch (err) {
    console.error('[Plano] Erro ao verificar limite:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao verificar o plano.' });
  }
};

function validarIntervalo(usuario, intervaloHoras) {
  const regras = obterRegrasPlano(usuario);
  if (regras.intervalosPermitidos.includes(Number(intervaloHoras))) return null;
  return {
    sucesso: false,
    codigo: 'INTERVALO_NAO_PERMITIDO',
    mensagem: `O plano ${regras.nome} permite checagens a cada: ` +
      regras.intervalosPermitidos.map(formatarIntervalo).join(', ') + '.',
  };
}

function formatarIntervalo(horas) {
  return horas < 1 ? `${Math.round(horas * 60)}min` : `${horas}h`;
}

module.exports = { verificarLimitePlano, checarLimiteAlertas, validarIntervalo };
