const crypto = require('crypto');
const mongoose = require('mongoose');
const Prazo = require('../models/Prazo');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');

// ============================================
// 🏛️ NOMEAÇÃO, POSSE E VALIDADE DO CONCURSO
// ============================================
// 1) Quando o Radar acha o nome numa publicação de nomeação/convocação, o
//    aviso é urgente e vira um prazo de posse com o checklist de documentos.
// 2) A pessoa aprovada cadastra o concurso e acompanha a validade (2 anos,
//    prorrogável por mais 2), com lembretes 6, 3 e 1 mês antes do fim.

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POSSE_PADRAO = 30; // Lei 8.112 (federal); estados e municípios podem ter outro prazo

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SINAIS_NOMEACAO = /\b(nomea\w*|nomeia|convoca\w*|posse|entrar em exercicio|apresentar-se|comparecer)\b/;

function ehNomeacao(trechos) {
  return (trechos ?? []).some((t) => SINAIS_NOMEACAO.test(normalizar(t)));
}

const DOCUMENTOS_POSSE = [
  'RG e CPF (original e cópia)',
  'Título de eleitor e comprovante de quitação eleitoral',
  'Certificado de reservista (homens)',
  'Diploma ou certificado da escolaridade exigida',
  'Comprovante de residência',
  'Certidão de nascimento ou casamento',
  'Número do PIS/PASEP',
  'Foto 3x4',
  'Exames médicos admissionais (ver a lista no edital)',
  'Declaração de bens e de não acumulação de cargos',
];

// Cria (uma vez por publicação) o prazo de posse com o checklist
async function criarPrazoPosse(usuarioId, ocorrencia, nomeDiario) {
  const limite = new Date(new Date(`${ocorrencia.dataPublicacao}T12:00:00Z`).getTime() + DIAS_POSSE_PADRAO * DIA_MS).toISOString().slice(0, 10);
  const chave = crypto.createHash('sha256').update(`posse|${ocorrencia.url}|${ocorrencia.dataPublicacao}`).digest('hex').slice(0, 32);
  await Prazo.updateOne(
    { usuario: usuarioId, chave },
    {
      $setOnInsert: {
        usuario: usuarioId, chave, origem: 'ia', tipo: 'documentos',
        titulo: `Tomar posse (prazo comum: ${DIAS_POSSE_PADRAO} dias — confira no ato)`,
        contexto: nomeDiario, url: ocorrencia.url, data: limite,
        checklist: DOCUMENTOS_POSSE.map((item) => ({ item, feito: false })),
      },
    },
    { upsert: true }
  ).catch((err) => { if (err.code !== 11000) console.error('[Nomeação] Falha ao criar prazo de posse:', err.message); });
}

// ─── Validade do concurso ───────────────────────────
const concursoSchema = new mongoose.Schema({
  usuario:      { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nome:         { type: String, required: true, maxlength: 120 },   // "TJ-RJ 2025 — Analista"
  homologadoEm: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  validadeAnos: { type: Number, default: 2, min: 1, max: 4 },
  prorrogado:   { type: Boolean, default: false },
  classificacao: { type: Number, default: null },
  lembretes:    { type: [Number], default: [] }, // marcos (dias) já avisados
}, { timestamps: { createdAt: 'criadoEm', updatedAt: false } });
const Concurso = mongoose.models.Concurso || mongoose.model('Concurso', concursoSchema);

function validadeAte(c) {
  const d = new Date(`${c.homologadoEm}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + c.validadeAnos * (c.prorrogado ? 2 : 1));
  return d.toISOString().slice(0, 10);
}

const diasAte = (iso, agora = new Date()) => Math.ceil((new Date(`${iso}T23:59:59-03:00`).getTime() - agora.getTime()) / DIA_MS);

function concursoParaApi(c) {
  const fim = validadeAte(c);
  return {
    id: String(c._id), nome: c.nome, homologadoEm: c.homologadoEm, validadeAnos: c.validadeAnos,
    prorrogado: c.prorrogado, classificacao: c.classificacao, validadeAte: fim, diasRestantes: diasAte(fim),
  };
}

// Mantém um prazo "fim da validade" em Prazos (aparece na agenda)
async function sincronizarPrazoValidade(c) {
  await Prazo.updateOne(
    { usuario: c.usuario, chave: `validade:${c._id}` },
    { $set: { titulo: `Fim da validade do concurso: ${c.nome}`, data: validadeAte(c), tipo: 'outro', origem: 'manual' }, $setOnInsert: { usuario: c.usuario, chave: `validade:${c._id}` } },
    { upsert: true }
  );
}

const MARCOS_VALIDADE = [180, 90, 30];

// Roda 1x por dia: lembra quando a validade está chegando ao fim
async function lembrarValidades(agora = new Date()) {
  const concursos = await Concurso.find({}).populate('usuario', 'email nome');
  let enviados = 0;
  for (const c of concursos) {
    if (!c.usuario) continue;
    const fim = validadeAte(c);
    const dias = diasAte(fim, agora);
    if (dias < 0) continue;
    const marco = MARCOS_VALIDADE.filter((m) => dias <= m).sort((a, b) => a - b)[0];
    if (!marco || c.lembretes.includes(marco)) continue;
    const r = await Concurso.updateOne({ _id: c._id, lembretes: { $ne: marco } }, { $addToSet: { lembretes: { $each: MARCOS_VALIDADE.filter((m) => dias <= m) } } });
    if (!r.modifiedCount) continue;
    const quando = fim.split('-').reverse().join('/');
    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: c.usuario.email,
      subject: `⏳ Faltam ${dias} dias para acabar a validade do concurso ${c.nome}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
          <h2 style="margin-top:0">⏳ A validade do seu concurso está acabando</h2>
          <p><strong>${escaparHtml(c.nome)}</strong> vale até <strong>${quando}</strong>${c.prorrogado ? ' (já prorrogado)' : ''}.</p>
          <p>Perto do fim da validade os órgãos costumam convocar mais aprovados${c.prorrogado ? '' : ' — ou prorrogar o concurso por mais um período'}. Fique de olho no Diário Oficial e nos canais do órgão.</p>
          ${c.prorrogado ? '' : '<p>💡 Se sair a prorrogação, marque no Notifica.ai para atualizarmos a contagem.</p>'}
        </div>`,
    }).catch((err) => console.error('[Validade] Falha no e-mail:', err.message));
    await require('./push').enviarPush(c.usuario._id, { titulo: `⏳ Faltam ${dias} dias de validade`, corpo: `${c.nome} vale até ${quando}.`, url: '/radar', tag: `validade-${c._id}` });
    enviados += 1;
  }
  return enviados;
}

module.exports = { ehNomeacao, criarPrazoPosse, DOCUMENTOS_POSSE, Concurso, validadeAte, concursoParaApi, sincronizarPrazoValidade, lembrarValidades };
