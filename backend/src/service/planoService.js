const transportador = require('../utils/mailer');
const Usuario       = require('../models/Usuario');
const Alerta        = require('../models/alertaModel');
const { PLANOS, obterTipoPlanoEfetivo } = require('../config/planos');
const { escaparHtml } = require('../utils/html');

const PLANO_FREE = { tipo: 'free', status: 'ativo', validoAte: null, origem: null, mpAssinaturaId: null };

// ============================================
// ⬇️ DOWNGRADE — volta para o Free e pausa o excedente
// ============================================
// Mantém ativos os alertas mais recentes até o limite do Free;
// o resto fica pausado com motivoPausa 'plano' para voltar no upgrade.
async function aplicarDowngrade(usuario, { notificar = true } = {}) {
  usuario.plano = { ...PLANO_FREE };
  await usuario.save();

  const limite = PLANOS.free.maxAlertasAtivos;
  const ativos = await Alerta.find({ usuario: usuario._id, status: 'ativo' })
    .sort({ criadoEm: -1 })
    .select('_id titulo url');

  const excedentes = ativos.slice(limite);
  if (excedentes.length > 0) {
    await Alerta.updateMany(
      { _id: { $in: excedentes.map((a) => a._id) } },
      { status: 'pausado', motivoPausa: 'plano' }
    );
  }

  if (notificar) {
    enviarEmailDowngrade(usuario, excedentes).catch((err) =>
      console.error('[Plano] Falha ao enviar e-mail de downgrade:', err.message)
    );
  }

  return { alertasPausados: excedentes.length };
}

// ============================================
// ⬆️ UPGRADE — reativa o que o downgrade pausou
// ============================================
async function reativarAlertasPausadosPorPlano(usuarioId) {
  const resultado = await Alerta.updateMany(
    { usuario: usuarioId, status: 'pausado', motivoPausa: 'plano' },
    { status: 'ativo', motivoPausa: null, proximaVerificacao: new Date() }
  );
  return resultado.modifiedCount;
}

// ============================================
// 🕒 JOB DIÁRIO — processa assinaturas vencidas
// ============================================
async function processarPlanosExpirados() {
  const candidatos = await Usuario.find({ 'plano.tipo': 'pro' }).select('-senha');
  const expirados  = candidatos.filter((u) => obterTipoPlanoEfetivo(u) === 'free');

  let alertasPausados = 0;
  for (const usuario of expirados) {
    try {
      const r = await aplicarDowngrade(usuario);
      alertasPausados += r.alertasPausados;
    } catch (err) {
      console.error(`[Plano] Falha no downgrade de ${usuario.email}:`, err.message);
    }
  }

  if (expirados.length > 0) {
    console.log(`[Plano] ${expirados.length} plano(s) expirado(s) — ${alertasPausados} alerta(s) pausado(s).`);
  }
  return { usuariosRebaixados: expirados.length, alertasPausados };
}

// ============================================
// 📧 E-MAIL DE DOWNGRADE
// ============================================
async function enviarEmailDowngrade(usuario, excedentes) {
  const listaPausados = excedentes.length > 0
    ? `
      <p>Como o plano gratuito permite até <b>${PLANOS.free.maxAlertasAtivos} alertas ativos</b>,
      pausamos ${excedentes.length} monitoramento(s):</p>
      <ul>${excedentes.map((a) => `<li>${escaparHtml(a.titulo || a.url)}</li>`).join('')}</ul>
      <p>Eles voltam a funcionar automaticamente assim que você renovar o Pro.</p>`
    : '<p>Seus alertas continuam ativos, agora com checagem a cada 24 horas.</p>';

  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: usuario.email,
    subject: 'Seu plano Pro do Notifica.ai terminou',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Seu plano Pro terminou</h2>
        <p>Olá, ${escaparHtml(usuario.nome)}! Sua conta voltou para o plano gratuito.</p>
        ${listaPausados}
      </div>
    `,
  });
}

module.exports = { aplicarDowngrade, reativarAlertasPausadosPorPlano, processarPlanosExpirados };
