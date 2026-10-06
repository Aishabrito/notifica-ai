const crypto = require('crypto');
const Alerta = require('../models/alertaModel');
const LogCron = require('../models/LogCron');
require('../models/Usuario'); // registra o modelo usado no populate('usuario')
const { executarMonitoramento } = require('./crawler');

// ============================================
// ⚙️ CONFIGURAÇÕES
// ============================================
const LOTE_MAX_ALERTAS = 200;
// Tempo máximo que um alerta fica reservado. Se o servidor cair no meio
// da rodada, depois desse prazo outra rodada (ou instância) assume o alerta.
const DURACAO_RESERVA_MS = 30 * 60 * 1000;

// ============================================
// 🔒 RESERVA ATÔMICA DE ALERTAS VENCIDOS
// ============================================
// Seguro com várias instâncias do backend rodando o mesmo cron:
// 1. lê candidatos (vencidos e sem reserva válida);
// 2. updateMany marca com um travaId único — o filtro repete as condições,
//    então cada documento só é marcado por quem chegar primeiro (o update
//    de um documento é atômico no MongoDB);
// 3. busca de volta só o que tem o nosso travaId.
async function reservarAlertasVencidos(limite = LOTE_MAX_ALERTAS) {
  const agora = new Date();
  const disponivel = {
    status: 'ativo',
    $and: [
      { $or: [
        { proximaVerificacao: { $lte: agora } },
        { proximaVerificacao: { $exists: false } }, // alertas criados antes da Fase 1
        { proximaVerificacao: null },
      ] },
      { $or: [
        { travadoAte: { $exists: false } },
        { travadoAte: null },
        { travadoAte: { $lte: agora } },
      ] },
    ],
  };

  const candidatos = await Alerta.find(disponivel)
    .sort({ proximaVerificacao: 1 })
    .limit(limite)
    .select('_id')
    .lean();
  if (candidatos.length === 0) return [];

  const travaId = crypto.randomUUID();
  await Alerta.updateMany(
    { ...disponivel, _id: { $in: candidatos.map((c) => c._id) } },
    { $set: { travadoAte: new Date(agora.getTime() + DURACAO_RESERVA_MS), travaId } }
  );

  return Alerta.find({ travaId })
    .select('+ultimoConteudo +linksPdf') // versão anterior, para o resumo com IA
    .populate('usuario', 'plano');
}

// ============================================
// 🔁 RODADA DO CRON
// ============================================
let rodadaEmExecucao = false;

async function executarRodada() {
  // Dentro de um mesmo processo, uma rodada por vez (limita a carga).
  // Entre processos diferentes, quem garante a exclusividade é a reserva.
  if (rodadaEmExecucao) {
    console.log('[Cron] Rodada anterior ainda em execução — pulando.');
    return null;
  }
  rodadaEmExecucao = true;

  const iniciadoEm = new Date();
  let metricas = { alertasVerificados: 0, alertasComMudanca: 0, alertasComErro: 0 };
  let sucesso = true;
  let erroGlobal = null;

  try {
    const alertas = await reservarAlertasVencidos();
    metricas = await executarMonitoramento(alertas);
  } catch (errExec) {
    sucesso = false;
    erroGlobal = errExec.message;
    console.error('Erro durante o monitoramento do cron:', errExec.message);
  } finally {
    rodadaEmExecucao = false;
  }

  // Rodadas vazias (a maioria, a cada 5 min) não poluem o histórico
  if (sucesso && metricas.alertasVerificados === 0) return metricas;

  const finalizadoEm = new Date();
  try {
    await LogCron.create({
      alertasVerificados: metricas.alertasVerificados,
      mudancasDetectadas: metricas.alertasComMudanca,
      alertasComErro:     metricas.alertasComErro,
      tempoDuracao:       finalizadoEm - iniciadoEm,
      sucesso,
      erroGlobal,
      iniciadoEm,
      finalizadoEm,
    });
  } catch (errLog) {
    console.error('Erro ao salvar log do cron:', errLog.message);
  }
  return metricas;
}

module.exports = { reservarAlertasVencidos, executarRodada };
