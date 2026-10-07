const transportador = require('../utils/mailer');
const Usuario       = require('../models/Usuario');
const Alerta        = require('../models/alertaModel');
const MonitorRadar  = require('../models/MonitorRadar');
const { PLANOS, obterTipoPlanoEfetivo } = require('../config/planos');
const { escaparHtml } = require('../utils/html');

const PLANO_FREE = { tipo: 'free', status: 'ativo', validoAte: null, origem: null, mpAssinaturaId: null, lembreteRenovacaoEm: null };
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_AVISO_RENOVACAO = 3;

// ============================================
// ⬇️ DOWNGRADE — volta para o Free e pausa o excedente
// ============================================
// Mantém ativos os alertas mais recentes até o limite do Free;
// o resto fica pausado com motivoPausa 'plano' para voltar no upgrade.
async function aplicarDowngrade(usuario, { notificar = true } = {}) {
  const eraTeste = usuario.plano?.origem === 'teste';
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

  // Radar do Diário Oficial é só do Pro
  await MonitorRadar.updateMany({ usuario: usuario._id, ativo: true }, { ativo: false, motivoPausa: 'plano' });

  if (notificar) {
    enviarEmailDowngrade(usuario, excedentes, { eraTeste }).catch((err) =>
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
  await MonitorRadar.updateMany({ usuario: usuarioId, ativo: false, motivoPausa: 'plano' }, { ativo: true, motivoPausa: null });
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
async function enviarEmailDowngrade(usuario, excedentes, { eraTeste = false } = {}) {
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
    subject: eraTeste ? 'Seu teste grátis do Notifica.ai Pro terminou' : 'Seu plano Pro do Notifica.ai terminou',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${eraTeste ? 'Seu teste grátis terminou' : 'Seu plano Pro terminou'}</h2>
        <p>Olá, ${escaparHtml(usuario.nome)}! Sua conta voltou para o plano gratuito.</p>
        ${listaPausados}
      </div>
    `,
  });
}

// ============================================
// ⏰ LEMBRETE DE RENOVAÇÃO (Pix não renova sozinho)
// ============================================
async function enviarLembretesRenovacao() {
  const agora  = new Date();
  const limite = new Date(agora.getTime() + DIAS_AVISO_RENOVACAO * DIA_MS);
  const usuarios = await Usuario.find({
    'plano.tipo': 'pro',
    'plano.origem': { $in: ['pix', 'teste'] },
    'plano.validoAte': { $gt: agora, $lte: limite },
    'plano.lembreteRenovacaoEm': null,
  }).select('nome email plano');

  let enviados = 0;
  for (const usuario of usuarios) {
    try {
      const dias = Math.max(1, Math.ceil((new Date(usuario.plano.validoAte) - agora) / DIA_MS));
      const linkPlanos = `${process.env.FRONTEND_URL || 'https://notifica.dev.br'}/planos`;
      const teste = usuario.plano.origem === 'teste';
      await transportador.sendMail({
        from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
        to: usuario.email,
        subject: teste
          ? `⏰ Seu teste grátis do Pro acaba em ${dias} dia(s)`
          : `⏰ Seu Pro do Notifica.ai vence em ${dias} dia(s)`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>${teste ? `Seu teste grátis acaba em ${dias} dia(s)` : `Seu plano Pro vence em ${dias} dia(s)`}</h2>
            <p>Olá, ${escaparHtml(usuario.nome)}! ${teste
              ? 'Depois disso sua conta volta ao plano gratuito, e alertas acima de 3 ficam pausados.'
              : 'Pagamentos via Pix não renovam sozinhos.'}</p>
            <p>Para continuar com alertas ilimitados, checagens rápidas e resumos com IA,
            renove em <a href="${linkPlanos}">${linkPlanos}</a> — por Pix de novo ou no
            cartão (aí renova automaticamente).</p>
          </div>
        `,
      });
      usuario.plano.lembreteRenovacaoEm = agora;
      await usuario.save();
      enviados += 1;
    } catch (err) {
      console.error(`[Plano] Falha ao enviar lembrete de renovação para ${usuario.email}:`, err.message);
    }
  }
  return { lembretesEnviados: enviados };
}

module.exports = { aplicarDowngrade, reativarAlertasPausadosPorPlano, processarPlanosExpirados, enviarLembretesRenovacao };
