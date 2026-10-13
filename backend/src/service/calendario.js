const mongoose = require('mongoose');
const Prazo = require('../models/Prazo');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');

// ============================================
// 📅 CALENDÁRIO: ENEM, SISU, ProUni, concursos
// ============================================
// Datas públicas mantidas pela equipe no admin. Quem toca em "Me avise"
// recebe e-mail + push 7 dias antes, na véspera e no dia (vale para o Free),
// e a data entra na lista de Prazos (e na agenda, para quem é Pro).

const PUBLICOS = ['vestibulando', 'concurseiro'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

const eventoSchema = new mongoose.Schema({
  chave:      { type: String, default: null }, // datas semeadas: não voltam se a equipe ocultar
  titulo:     { type: String, required: true, maxlength: 120 },
  publico:    { type: String, enum: PUBLICOS, required: true },
  data:       { type: String, required: true, match: DATA_RE },
  dataFim:    { type: String, default: null, match: DATA_RE },
  // Previsão (ainda sem edital): mostramos só o mês, com o aviso "previsão"
  previsao:   { type: Boolean, default: false },
  descricao:  { type: String, default: '', maxlength: 300 },
  link:       { type: String, default: null, maxlength: 500 },
  publicado:  { type: Boolean, default: true },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });
eventoSchema.index({ chave: 1 }, { unique: true, partialFilterExpression: { chave: { $type: 'string' } } });
const EventoCalendario = mongoose.models.EventoCalendario || mongoose.model('EventoCalendario', eventoSchema);

const lembreteSchema = new mongoose.Schema({
  usuario:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  evento:   { type: mongoose.Schema.Types.ObjectId, ref: 'EventoCalendario', required: true },
  enviados: { type: [Number], default: [] }, // marcos (dias antes) já avisados
}, { timestamps: { createdAt: 'criadoEm', updatedAt: false } });
lembreteSchema.index({ usuario: 1, evento: 1 }, { unique: true });
const LembreteCalendario = mongoose.models.LembreteCalendario || mongoose.model('LembreteCalendario', lembreteSchema);

// Datas oficiais conhecidas ao lançar (confira e edite no admin)
const SEMENTES = [
  { chave: 'enem-2026-dia1', titulo: 'ENEM 2026 — 1º dia de prova', publico: 'vestibulando', data: '2026-11-08',
    descricao: 'Linguagens, Ciências Humanas e redação. Portões fecham às 13h (horário de Brasília).', link: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem' },
  { chave: 'enem-2026-dia2', titulo: 'ENEM 2026 — 2º dia de prova', publico: 'vestibulando', data: '2026-11-15',
    descricao: 'Matemática e Ciências da Natureza.', link: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem' },
  { chave: 'sisu-2027-inscricoes', titulo: 'SISU 2027 — inscrições', publico: 'vestibulando', data: '2027-01-15', previsao: true,
    descricao: 'O MEC ainda não publicou o edital. Ative o aviso e mandamos a data assim que sair.', link: 'https://acessounico.mec.gov.br/sisu' },
];

async function semearCalendario() {
  for (const { chave, ...resto } of SEMENTES) {
    await EventoCalendario.updateOne({ chave }, { $setOnInsert: { chave, ...resto } }, { upsert: true })
      .catch((err) => { if (err.code !== 11000) throw err; });
  }
}

const hojeSP = (agora = new Date()) => new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const diasAte = (data, agora = new Date()) => Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hojeSP(agora)}T00:00:00Z`)) / 864e5);

function eventoParaApi(e) {
  return {
    id: String(e._id), titulo: e.titulo, publico: e.publico, data: e.data, dataFim: e.dataFim,
    previsao: e.previsao, descricao: e.descricao, link: e.link, diasRestantes: diasAte(e.dataFim || e.data),
  };
}

// Próximas datas (inclui as que estão acontecendo)
async function proximosEventos(agora = new Date()) {
  const hoje = hojeSP(agora);
  const lista = await EventoCalendario.find({ publicado: true, $or: [{ data: { $gte: hoje } }, { dataFim: { $gte: hoje } }] }).sort({ data: 1 }).limit(60);
  return lista.map(eventoParaApi);
}

function validarEvento(b, atual = {}) {
  const v = {
    titulo: String(b.titulo ?? atual.titulo ?? '').trim(),
    publico: b.publico ?? atual.publico,
    data: String(b.data ?? atual.data ?? ''),
    dataFim: b.dataFim === undefined ? (atual.dataFim ?? null) : (b.dataFim || null),
    previsao: typeof b.previsao === 'boolean' ? b.previsao : Boolean(atual.previsao),
    descricao: String(b.descricao ?? atual.descricao ?? '').trim(),
    link: b.link === undefined ? (atual.link ?? null) : (String(b.link || '').trim() || null),
    publicado: typeof b.publicado === 'boolean' ? b.publicado : (atual.publicado ?? true),
  };
  if (v.titulo.length < 3 || v.titulo.length > 120) return { erro: 'Título entre 3 e 120 caracteres.' };
  if (!PUBLICOS.includes(v.publico)) return { erro: 'Público: vestibulando ou concurseiro.' };
  if (!DATA_RE.test(v.data) || Number.isNaN(Date.parse(v.data))) return { erro: 'Data inválida (AAAA-MM-DD).' };
  if (v.dataFim && (!DATA_RE.test(v.dataFim) || v.dataFim < v.data)) return { erro: 'A data final deve ser depois da inicial.' };
  if (v.descricao.length > 300) return { erro: 'Descrição com até 300 caracteres.' };
  if (v.link && !/^https:\/\/\S+$/.test(v.link)) return { erro: 'O link precisa começar com https://' };
  return { valor: v };
}

// "Me avise": guarda o pedido e põe a data em Prazos
async function lembrarEvento(usuarioId, evento) {
  await LembreteCalendario.updateOne({ usuario: usuarioId, evento: evento._id }, { $setOnInsert: { usuario: usuarioId, evento: evento._id } }, { upsert: true });
  await sincronizarPrazoEvento(usuarioId, evento);
}

async function sincronizarPrazoEvento(usuarioId, evento) {
  await Prazo.updateOne(
    { usuario: usuarioId, chave: `calendario:${evento._id}` },
    {
      $set: { titulo: evento.previsao ? `${evento.titulo} (previsão)` : evento.titulo, data: evento.data, url: evento.link, contexto: 'Calendário Notifica.ai' },
      $setOnInsert: { usuario: usuarioId, chave: `calendario:${evento._id}`, tipo: /prova/i.test(evento.titulo) ? 'prova' : /inscri/i.test(evento.titulo) ? 'inscricao' : 'outro', origem: 'manual' },
    },
    { upsert: true }
  ).catch((err) => { if (err.code !== 11000) throw err; });
}

// Quando a equipe muda a data, os prazos de quem pediu aviso acompanham
async function aoAlterarEvento(evento, mudouData) {
  const lembretes = await LembreteCalendario.find({ evento: evento._id }).select('usuario');
  for (const l of lembretes) await sincronizarPrazoEvento(l.usuario, evento);
  if (mudouData) await LembreteCalendario.updateMany({ evento: evento._id }, { $set: { enviados: [] } });
}

const MARCOS = [7, 1, 0];
const quandoTexto = (dias) => (dias === 0 ? 'é hoje' : dias === 1 ? 'é amanhã' : `faltam ${dias} dias`);

// Roda 1x por dia, de manhã
async function enviarLembretesCalendario(agora = new Date()) {
  const eventos = await EventoCalendario.find({ publicado: true, previsao: false, data: { $gte: hojeSP(agora) } });
  let enviados = 0;
  for (const e of eventos) {
    const dias = diasAte(e.data, agora);
    const marco = MARCOS.find((m) => dias === m);
    if (marco === undefined) continue;
    const lembretes = await LembreteCalendario.find({ evento: e._id, enviados: { $ne: marco } }).populate('usuario', 'email nome');
    for (const l of lembretes) {
      const r = await LembreteCalendario.updateOne({ _id: l._id, enviados: { $ne: marco } }, { $addToSet: { enviados: marco } });
      if (!r.modifiedCount || !l.usuario) continue;
      const quando = e.data.split('-').reverse().join('/');
      await transportador.sendMail({
        from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
        to: l.usuario.email,
        subject: `📅 ${e.titulo}: ${quandoTexto(dias)} (${quando})`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
            <h2 style="margin-top:0">📅 ${escaparHtml(e.titulo)}</h2>
            <p><strong>${quandoTexto(dias).replace(/^./, (c) => c.toUpperCase())}</strong> — ${quando}.</p>
            ${e.descricao ? `<p>${escaparHtml(e.descricao)}</p>` : ''}
            ${e.link ? `<p><a href="${escaparHtml(e.link)}">Ver na página oficial</a></p>` : ''}
            <p style="font-size:12px;color:#666">Você pediu este aviso no calendário do Notifica.ai.</p>
          </div>`,
      }).catch((err) => console.error('[Calendário] Falha no e-mail:', err.message));
      await require('./push').enviarPush(l.usuario._id, { titulo: `📅 ${e.titulo}`, corpo: `${quandoTexto(dias)} (${quando}).`, url: '/calendario', tag: `calendario-${e._id}` });
      enviados += 1;
    }
  }
  return enviados;
}

module.exports = {
  EventoCalendario, LembreteCalendario, SEMENTES, semearCalendario, proximosEventos, eventoParaApi,
  validarEvento, lembrarEvento, aoAlterarEvento, enviarLembretesCalendario,
};
