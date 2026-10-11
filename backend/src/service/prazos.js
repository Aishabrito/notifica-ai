const crypto = require('crypto');
const Prazo = require('../models/Prazo');
const Usuario = require('../models/Usuario');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');
const { momentoLimite } = require('../utils/ics');
const { obterTipoPlanoEfetivo } = require('../config/planos');

// ============================================
// ⏰ PRAZOS E CÓDIGO VERMELHO
// ============================================
// As datas que a IA acha numa mudança viram prazos da pessoa (Pro).
// O Código Vermelho avisa 72h, 24h e 3h antes, por e-mail e Telegram,
// até a pessoa marcar "já fiz".

const MARCOS_HORAS = [72, 24, 3];
const HORA_MS = 60 * 60 * 1000;

const ROTULOS = {
  inscricao: 'Inscrição', prova: 'Prova', recurso: 'Recurso', resultado: 'Resultado',
  matricula: 'Matrícula', documentos: 'Documentos', outro: 'Prazo',
};

const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Datas da IA → prazos. Documentos exigidos viram o checklist do prazo de
// matrícula/documentos (ou do primeiro prazo, se não houver um desses).
async function registrarPrazosDaMudanca(alerta, resumo) {
  if (!resumo?.datas?.length) return 0;
  const usuarioId = alerta.usuario?._id ?? alerta.usuario;
  if (!usuarioId) return 0;

  const documentos = resumo.documentos ?? [];
  const alvoChecklist = documentos.length
    ? (resumo.datas.find((d) => d.tipo === 'matricula' || d.tipo === 'documentos') ?? resumo.datas[0])
    : null;

  let criados = 0;
  for (const d of resumo.datas) {
    const chave = crypto.createHash('sha256')
      .update(`${alerta._id}|${d.data}|${d.tipo ?? 'outro'}|${normalizar(d.descricao)}`)
      .digest('hex').slice(0, 32);
    try {
      const r = await Prazo.updateOne(
        { usuario: usuarioId, chave },
        {
          $setOnInsert: {
            usuario: usuarioId, alerta: alerta._id, chave, origem: 'ia',
            titulo: d.descricao, contexto: (alerta.titulo || '').slice(0, 200) || null, url: alerta.url,
            data: d.data, hora: d.hora ?? null, tipo: d.tipo ?? 'outro',
            checklist: d === alvoChecklist ? documentos.map((item) => ({ item, feito: false })) : [],
          },
        },
        { upsert: true }
      );
      if (r.upsertedCount) criados += 1;
    } catch (err) {
      if (err.code !== 11000) console.error('[Prazos] Falha ao registrar prazo:', err.message);
    }
  }
  return criados;
}

// ─── Link "já fiz" do e-mail (sem login) ────────────
const tokenFeito = (prazoId) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`prazo-feito:${prazoId}`).digest('hex');

function tokenFeitoValido(prazoId, token) {
  const esperado = Buffer.from(tokenFeito(prazoId));
  const recebido = Buffer.from(String(token ?? ''));
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

const linkFeito = (prazoId) => `${process.env.BASE_URL}/prazo-feito/${prazoId}/${tokenFeito(prazoId)}`;

function textoRestante(horas) {
  if (horas < 1) return 'menos de 1 hora';
  if (horas < 48) return `${Math.floor(horas)} hora${Math.floor(horas) === 1 ? '' : 's'}`;
  return `${Math.floor(horas / 24)} dias`;
}

const dataBR = (iso) => iso.split('-').reverse().join('/');

async function enviarCodigoVermelho(prazo, usuario, horas) {
  const restante = textoRestante(horas);
  const quando = `${dataBR(prazo.data)}${prazo.hora ? ` às ${prazo.hora}` : ''}`;
  const pendentes = prazo.checklist.filter((c) => !c.feito);
  const urgente = horas <= 24;

  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: usuario.email,
    subject: `${urgente ? '🔴' : '🟠'} Faltam ${restante}: ${prazo.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
        <p style="display:inline-block;background:${urgente ? '#dc2626' : '#ea580c'};color:#fff;font-weight:bold;padding:4px 10px;border-radius:6px;margin:0 0 12px">CÓDIGO VERMELHO · faltam ${restante}</p>
        <h2 style="margin:0 0 8px">${escaparHtml(prazo.titulo)}</h2>
        <p style="color:#555;margin:0 0 16px">${escaparHtml(ROTULOS[prazo.tipo] ?? 'Prazo')} · até <strong>${quando}</strong>${prazo.contexto ? ` · ${escaparHtml(prazo.contexto)}` : ''}</p>
        ${pendentes.length ? `<p style="margin:0 0 6px"><strong>Ainda falta separar:</strong></p><ul>${pendentes.map((c) => `<li>${escaparHtml(c.item)}</li>`).join('')}</ul>` : ''}
        ${prazo.url ? `<p><a href="${escaparHtml(prazo.url)}">Abrir o documento oficial</a></p>` : ''}
        <p style="margin-top:20px"><a href="${linkFeito(prazo._id)}" style="background:#10b981;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">✅ Já fiz — parar os lembretes</a></p>
        <p style="font-size:12px;color:#888">Confira sempre a data no documento oficial: as datas são lidas automaticamente.</p>
      </div>`,
  });

  const telegram = require('./telegram');
  if (telegram.telegramConfigurado() && usuario.telegram?.chatId) {
    await telegram.enviarMensagem(usuario.telegram.chatId,
      `${urgente ? '🔴' : '🟠'} <b>Faltam ${restante}</b>\n${escaparHtml(prazo.titulo)} — até ${quando}`
      + `${pendentes.length ? `\n\nAinda falta: ${pendentes.map((c) => escaparHtml(c.item)).join(', ')}` : ''}`
      + `\n\nJá fez? ${linkFeito(prazo._id)}`);
  }
}

// Roda de hora em hora. Para cada prazo aberto que entrou numa janela
// (72h, 24h ou 3h), manda UM lembrete — o do marco mais próximo — e marca
// os marcos maiores como enviados (não manda "faltam 72h" depois do de 24h).
async function executarCodigoVermelho(agora = new Date()) {
  const desde = new Date(agora.getTime() - 3 * HORA_MS).toISOString().slice(0, 10);
  const ate = new Date(agora.getTime() + 4 * 24 * HORA_MS).toISOString().slice(0, 10);
  const prazos = await Prazo.find({ concluidoEm: null, data: { $gte: desde, $lte: ate } });
  let enviados = 0;

  const usuarios = new Map();
  for (const prazo of prazos) {
    const horas = (momentoLimite(prazo).getTime() - agora.getTime()) / HORA_MS;
    if (horas <= 0) continue;
    const marcos = MARCOS_HORAS.filter((m) => horas <= m);
    const proximo = Math.min(...marcos);
    if (!marcos.length || prazo.lembretes.includes(proximo)) continue;

    const chaveUsuario = String(prazo.usuario);
    if (!usuarios.has(chaveUsuario)) usuarios.set(chaveUsuario, await Usuario.findById(prazo.usuario).select('email nome plano telegram'));
    const usuario = usuarios.get(chaveUsuario);
    if (!usuario || obterTipoPlanoEfetivo(usuario) !== 'pro') continue;

    // Marca antes de enviar: se outra instância rodar junto, só uma envia
    const r = await Prazo.updateOne(
      { _id: prazo._id, lembretes: { $ne: proximo } },
      { $addToSet: { lembretes: { $each: marcos } } }
    );
    if (!r.modifiedCount) continue;

    try {
      await enviarCodigoVermelho(prazo, usuario, horas);
      enviados += 1;
    } catch (err) {
      console.error('[Prazos] Falha ao enviar Código Vermelho:', err.message);
    }
  }
  if (enviados) console.log(`[Prazos] 🔴 Código Vermelho: ${enviados} lembrete(s) enviado(s).`);
  return enviados;
}

module.exports = { registrarPrazosDaMudanca, executarCodigoVermelho, tokenFeitoValido, linkFeito, ROTULOS, MARCOS_HORAS };
