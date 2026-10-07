const crypto  = require('crypto');
const axios   = require('axios');
const Usuario = require('../models/Usuario');
const { escaparHtml } = require('../utils/html');
const { obterTipoPlanoEfetivo } = require('../config/planos');

// ============================================
// 💬 BOT DO TELEGRAM
// ============================================
// Conexão: o site gera um código de uso único → link t.me/<bot>?start=<código>
// → a pessoa toca em "Iniciar" → o Telegram manda "/start <código>" para o
// nosso webhook → guardamos o chat_id. Só o hash do código fica no banco.

const API = 'https://api.telegram.org';
const VALIDADE_CODIGO_MS = 15 * 60 * 1000;

function telegramConfigurado() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
}

const hashCodigo = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');

async function chamarApi(metodo, corpo) {
  const { data } = await axios.post(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, corpo, { timeout: 15000 });
  return data;
}

/**
 * Envia uma mensagem (HTML simples do Telegram). Se a pessoa bloqueou o bot,
 * desconecta o chat para não tentar de novo.
 */
async function enviarMensagem(chatId, html) {
  if (!telegramConfigurado() || !chatId) return false;
  try {
    await chamarApi('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
    return true;
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 400) {
      // 403: bot bloqueado; 400: chat inexistente — não adianta insistir
      await Usuario.updateOne({ 'telegram.chatId': String(chatId) }, { $set: { 'telegram.chatId': null } });
    }
    console.error('[Telegram] Falha ao enviar mensagem:', status ?? '', err.response?.data?.description ?? err.message);
    return false;
  }
}

// ─── Conexão ─────────────────────────────────────────
async function gerarLinkConexao(usuario) {
  const codigo = crypto.randomBytes(18).toString('base64url'); // ≤ 64 chars, só [A-Za-z0-9_-]
  await Usuario.updateOne({ _id: usuario._id }, {
    $set: { 'telegram.codigoHash': hashCodigo(codigo), 'telegram.codigoExpira': new Date(Date.now() + VALIDADE_CODIGO_MS) },
  });
  return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${codigo}`;
}

async function desconectar(usuario) {
  const chatId = usuario.telegram?.chatId;
  await Usuario.updateOne({ _id: usuario._id }, { $set: { 'telegram.chatId': null, 'telegram.conectadoEm': null } });
  if (chatId) await enviarMensagem(chatId, 'Você desconectou o Notifica.ai deste chat. Até logo! 👋');
}

// ─── Mensagens recebidas (webhook) ──────────────────
async function processarAtualizacao(atualizacao) {
  const mensagem = atualizacao?.message;
  const chatId = mensagem?.chat?.id;
  const texto = String(mensagem?.text ?? '').trim();
  if (!chatId || mensagem.chat.type !== 'private') return 'ignorada';

  const [comando, argumento] = texto.split(/\s+/, 2);

  if (comando === '/start' && argumento) {
    const usuario = await Usuario.findOneAndUpdate(
      { 'telegram.codigoHash': hashCodigo(argumento), 'telegram.codigoExpira': { $gt: new Date() } },
      { $set: { 'telegram.chatId': String(chatId), 'telegram.conectadoEm': new Date(), 'telegram.codigoHash': null, 'telegram.codigoExpira': null } },
      { new: true }
    );
    if (!usuario) {
      await enviarMensagem(chatId, 'Esse link expirou ou já foi usado. Gere um novo no painel do Notifica.ai (vale por 15 minutos).');
      return 'codigo-invalido';
    }
    // Um chat por conta: se o mesmo chat estava ligado a outra conta, desliga
    await Usuario.updateMany({ _id: { $ne: usuario._id }, 'telegram.chatId': String(chatId) }, { $set: { 'telegram.chatId': null } });
    await enviarMensagem(chatId, `✅ Pronto, ${escaparHtml(usuario.nome.split(' ')[0])}! Seus alertas do Notifica.ai vão chegar aqui também.\n\nPara parar, envie /parar.`);
    return 'conectado';
  }

  if (comando === '/parar' || comando === '/stop') {
    const r = await Usuario.updateMany({ 'telegram.chatId': String(chatId) }, { $set: { 'telegram.chatId': null, 'telegram.conectadoEm': null } });
    await enviarMensagem(chatId, r.modifiedCount ? 'Desconectado. Você não vai mais receber alertas aqui.' : 'Este chat não está conectado a nenhuma conta.');
    return 'desconectado';
  }

  await enviarMensagem(chatId, 'Oi! Eu envio os alertas do <b>Notifica.ai</b>. Para conectar, abra o painel do site e toque em "Conectar Telegram".');
  return 'ajuda';
}

// Valida o cabeçalho secreto que o Telegram envia em cada chamada do webhook
function webhookAutentico(cabecalho) {
  const esperado = Buffer.from(String(process.env.TELEGRAM_WEBHOOK_SECRET ?? ''));
  const recebido = Buffer.from(String(cabecalho ?? ''));
  return esperado.length > 0 && recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

// Registra a URL do webhook no Telegram (idempotente; roda ao iniciar)
async function configurarWebhook() {
  if (!telegramConfigurado()) return;
  try {
    await chamarApi('setWebhook', {
      url: `${process.env.BASE_URL}/api/webhooks/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    });
    console.log('[Telegram] Webhook configurado.');
  } catch (err) {
    console.error('[Telegram] Falha ao configurar webhook:', err.response?.data?.description ?? err.message);
  }
}

// ─── Notificações (só Pro, só quem conectou) ────────
function podeReceber(usuario) {
  return Boolean(usuario?.telegram?.chatId) && obterTipoPlanoEfetivo(usuario) === 'pro';
}

async function notificarMudanca(usuario, alerta, resumo) {
  if (!podeReceber(usuario)) return false;
  const site = escaparHtml(alerta.titulo || alerta.url);
  const corpo = resumo
    ? `🚨 <b>${escaparHtml(resumo.titulo)}</b>\n${escaparHtml(resumo.resumo)}${resumo.datas?.length ? `\n\n📅 ${resumo.datas.map((d) => `${d.data.split('-').reverse().join('/')} — ${escaparHtml(d.descricao)}`).join('\n📅 ')}` : ''}`
    : '🚨 <b>Mudança detectada</b>';
  return enviarMensagem(usuario.telegram.chatId, `${corpo}\n\n${site}\n${escaparHtml(alerta.url)}`);
}

async function notificarOcorrencias(usuario, _dados, ocorrencias) {
  if (!podeReceber(usuario)) return false;
  const { nomeDiario } = require('../config/radar');
  const linhas = ocorrencias.slice(0, 5).map((o) =>
    `• <b>${escaparHtml(nomeDiario(o.cidadeId))}</b> — ${o.dataPublicacao.split('-').reverse().join('/')}\n${escaparHtml(o.url)}`
  );
  return enviarMensagem(usuario.telegram.chatId,
    `📰 <b>Você foi citado(a) no Diário Oficial</b> (${ocorrencias.length} publicação${ocorrencias.length > 1 ? 'ões' : ''})\n\n${linhas.join('\n\n')}\n\nOs trechos completos foram para o seu e-mail.`);
}

module.exports = {
  telegramConfigurado,
  enviarMensagem,
  gerarLinkConexao,
  desconectar,
  processarAtualizacao,
  webhookAutentico,
  configurarWebhook,
  notificarMudanca,
  notificarOcorrencias,
};
