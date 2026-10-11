const crypto = require('crypto');
const Usuario  = require('../models/Usuario');
const Alerta   = require('../models/alertaModel');
const Mudanca  = require('../models/Mudanca');
const Prazo    = require('../models/Prazo');
const OcorrenciaRadar = require('../models/OcorrenciaRadar');
const { EditalEncontrado } = require('../models/InteresseEdital');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const { nomeDiario } = require('../config/radar');

// ============================================
// 🗞️ RESUMO SEMANAL (segunda de manhã)
// ============================================
// Uma visão da semana: o que mudou, prazos que vêm aí, Radar e editais.
// Só vai para quem tem algo para ler; dá para sair por um link no e-mail.

const DIA_MS = 24 * 60 * 60 * 1000;
const dataBR = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');

// ─── Link "não quero mais" (sem login) ──────────────
const tokenSair = (id) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`resumo-semanal-sair:${id}`).digest('hex');
function tokenSairValido(id, token) {
  const esperado = Buffer.from(tokenSair(id));
  const recebido = Buffer.from(String(token ?? ''));
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}
const linkSair = (id) => `${process.env.BASE_URL}/resumo-semanal/sair/${id}/${tokenSair(id)}`;

async function montarResumo(usuario, agora = new Date()) {
  const desde = new Date(agora.getTime() - 7 * DIA_MS);
  const hoje = new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const daqui14 = new Date(agora.getTime() + 14 * DIA_MS).toISOString().slice(0, 10);
  const ehPro = obterTipoPlanoEfetivo(usuario) === 'pro';

  const alertas = await Alerta.find({ usuario: usuario._id }).select('titulo url status motivoPausa').lean();
  const porId = new Map(alertas.map((a) => [String(a._id), a]));
  const [mudancas, prazos, ocorrencias, editais] = await Promise.all([
    Mudanca.find({ alertaId: { $in: alertas.map((a) => a._id) }, detectadaEm: { $gte: desde }, 'resumo.relevante': { $ne: false } })
      .sort({ detectadaEm: -1 }).limit(30).lean(),
    ehPro ? Prazo.find({ usuario: usuario._id, concluidoEm: null, data: { $gte: hoje, $lte: daqui14 } }).sort({ data: 1 }).limit(10).lean() : [],
    ehPro ? OcorrenciaRadar.countDocuments({ usuario: usuario._id, criadoEm: { $gte: desde } }) : 0,
    ehPro ? EditalEncontrado.find({ usuario: usuario._id, criadoEm: { $gte: desde } }).sort({ dataPublicacao: -1 }).limit(5).lean() : [],
  ]);

  // Mudanças agrupadas por página
  const porPagina = new Map();
  for (const m of mudancas) {
    const id = String(m.alertaId);
    if (!porPagina.has(id)) porPagina.set(id, []);
    porPagina.get(id).push(m);
  }
  const pausadosPorFalha = alertas.filter((a) => a.status === 'pausado' && a.motivoPausa === 'falhas');

  return {
    ehPro,
    alertasAtivos: alertas.filter((a) => a.status === 'ativo').length,
    paginas: [...porPagina.entries()].map(([id, ms]) => ({ alerta: porId.get(id), mudancas: ms })),
    prazos,
    ocorrencias,
    editais,
    pausadosPorFalha,
    vazio: porPagina.size === 0 && prazos.length === 0 && ocorrencias === 0 && editais.length === 0 && pausadosPorFalha.length === 0,
  };
}

function htmlResumo(usuario, r) {
  const frontend = process.env.FRONTEND_URL || 'https://notifica.dev.br';
  const bloco = (titulo, corpo) => `<h3 style="margin:24px 0 8px;font-size:15px">${titulo}</h3>${corpo}`;
  const partes = [];

  if (r.prazos.length) {
    partes.push(bloco('⏰ Prazos nas próximas 2 semanas', `<ul style="padding-left:18px">${r.prazos.map((p) =>
      `<li><strong>${dataBR(p.data)}${p.hora ? ` ${p.hora}` : ''}</strong> — ${escaparHtml(p.titulo)}${p.contexto ? ` <span style="color:#777">(${escaparHtml(p.contexto)})</span>` : ''}</li>`).join('')}</ul>`));
  }

  if (r.paginas.length) {
    partes.push(bloco(`🔔 ${r.paginas.length} página(s) mudaram esta semana`, r.paginas.slice(0, 10).map(({ alerta, mudancas }) => {
      const comResumo = mudancas.filter((m) => m.resumo?.titulo).slice(0, 3);
      return `<div style="border-left:3px solid #10b981;padding:4px 10px;margin:10px 0">
        <p style="margin:0"><a href="${escaparHtml(alerta?.url ?? '#')}" style="color:#111;font-weight:bold">${escaparHtml(alerta?.titulo || alerta?.url || 'Página')}</a>
        <span style="color:#777"> · ${mudancas.length} mudança(s)</span></p>
        ${comResumo.map((m) => `<p style="margin:4px 0;font-size:13px;color:#444">• ${escaparHtml(m.resumo.titulo)}</p>`).join('')}
      </div>`;
    }).join('')));
  }

  if (r.ocorrencias) {
    partes.push(bloco('📰 Radar do Diário Oficial', `<p>Você foi citado(a) em <strong>${r.ocorrencias}</strong> publicação(ões) esta semana. <a href="${frontend}/radar">Ver no Radar</a></p>`));
  }
  if (r.editais.length) {
    partes.push(bloco('📢 Editais para o seu cargo', `<ul style="padding-left:18px">${r.editais.map((e) =>
      `<li>${escaparHtml(nomeDiario(e.cidadeId))} · ${dataBR(e.dataPublicacao)} — <a href="${escaparHtml(e.url)}">abrir</a></li>`).join('')}</ul>`));
  }
  if (r.pausadosPorFalha.length) {
    partes.push(bloco('⚠️ Precisa da sua atenção', `<p>${r.pausadosPorFalha.length} página(s) pararam de abrir e foram pausadas. Confira se o endereço mudou no <a href="${frontend}/dashboard">painel</a>.</p>`));
  }
  if (!r.ehPro) {
    partes.push(`<p style="margin-top:24px;padding:12px;background:#f5f3ff;border-radius:8px;font-size:13px;color:#5b21b6">💎 No Pro, este resumo traz também os prazos da semana, o Radar do Diário Oficial e os editais do seu cargo. <a href="${frontend}/planos">Conhecer o Pro</a></p>`);
  }

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color:#111">
      <p style="font-size:12px;color:#777;margin:0">Resumo semanal · Notifica.ai</p>
      <h2 style="margin:4px 0 0">Sua semana, ${escaparHtml(String(usuario.nome || '').split(' ')[0] || 'candidato(a)')} 👋</h2>
      <p style="color:#555">${r.alertasAtivos} página(s) sendo monitoradas.</p>
      ${partes.join('')}
      <hr style="margin-top:28px;border:none;border-top:1px solid #eee">
      <p style="font-size:11px;color:#999">Você recebe este resumo às segundas. <a href="${linkSair(usuario._id)}" style="color:#999">Não quero mais o resumo semanal</a> (os alertas continuam).</p>
    </div>`;
}

function assunto(r) {
  if (r.prazos.length) return `⏰ ${r.prazos.length} prazo(s) chegando · seu resumo da semana`;
  if (r.paginas.length) return `🗞️ ${r.paginas.length} página(s) mudaram · seu resumo da semana`;
  return '🗞️ Seu resumo da semana no Notifica.ai';
}

async function enviarResumosSemanais(agora = new Date()) {
  // Quem recebeu nos últimos 6 dias pula (reinício do servidor ou 2 instâncias)
  const limite = new Date(agora.getTime() - 6 * DIA_MS);
  const usuarios = await Usuario.find({
    resumoSemanal: { $ne: false },
    $or: [{ resumoSemanalEnviadoEm: null }, { resumoSemanalEnviadoEm: { $lt: limite } }],
  }).select('nome email plano');

  let enviados = 0;
  for (const usuario of usuarios) {
    try {
      const r = await montarResumo(usuario, agora);
      if (r.vazio) continue;
      // Marca antes de enviar: só uma instância envia
      const marcado = await Usuario.updateOne(
        { _id: usuario._id, $or: [{ resumoSemanalEnviadoEm: null }, { resumoSemanalEnviadoEm: { $lt: limite } }] },
        { $set: { resumoSemanalEnviadoEm: agora } }
      );
      if (!marcado.modifiedCount) continue;
      await transportador.sendMail({
        from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
        to: usuario.email,
        subject: assunto(r),
        html: htmlResumo(usuario, r),
        headers: { 'List-Unsubscribe': `<${linkSair(usuario._id)}>` },
      });
      enviados += 1;
    } catch (err) {
      console.error(`[Resumo semanal] Falha para ${usuario.email}:`, err.message);
    }
  }
  if (enviados) console.log(`[Resumo semanal] ${enviados} resumo(s) enviado(s).`);
  return enviados;
}

module.exports = { enviarResumosSemanais, montarResumo, tokenSairValido, linkSair };
