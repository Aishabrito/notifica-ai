const mongoose = require('mongoose');
const webpush = require('web-push');

// ============================================
// 📲 NOTIFICAÇÃO NO CELULAR (Web Push)
// ============================================
// O site é instalável (PWA). Quem ativa recebe o aviso na hora, como um app,
// sem custo por mensagem. Chaves VAPID: gere uma vez com
//   npx web-push generate-vapid-keys
// e coloque VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no servidor.

const inscricaoSchema = new mongoose.Schema({
  usuario:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys:     { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  aparelho: { type: String, default: null, maxlength: 200 },
  falhas:   { type: Number, default: 0 },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const PushInscricao = mongoose.models.PushInscricao || mongoose.model('PushInscricao', inscricaoSchema);

let configurado = null;
function pushConfigurado() {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  const assinatura = `${pub}|${priv}`;
  if (configurado !== assinatura) {
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@notifica.dev.br', pub, priv);
      configurado = assinatura;
    } catch (err) {
      console.error('[Push] Chaves VAPID inválidas:', err.message);
      return false;
    }
  }
  return true;
}

// Permite trocar o envio nos testes
let enviarNotificacao = (inscricao, corpo, opcoes) => webpush.sendNotification(inscricao, corpo, opcoes);
function _definirEnvio(fn) { enviarNotificacao = fn; }

/**
 * Envia para todos os aparelhos da pessoa. Nunca lança erro.
 * @param {{ titulo: string, corpo?: string, url?: string, tag?: string, urgente?: boolean }} msg
 */
async function enviarPush(usuarioId, msg) {
  if (!pushConfigurado() || !usuarioId) return 0;
  const inscricoes = await PushInscricao.find({ usuario: usuarioId._id ?? usuarioId }).lean().catch(() => []);
  const payload = JSON.stringify({
    titulo: String(msg.titulo).slice(0, 120),
    corpo: String(msg.corpo ?? '').slice(0, 300),
    url: msg.url || '/dashboard',
    tag: msg.tag || undefined,
    urgente: Boolean(msg.urgente),
  });
  let enviados = 0;
  for (const i of inscricoes) {
    try {
      await enviarNotificacao({ endpoint: i.endpoint, keys: i.keys }, payload, { TTL: 24 * 60 * 60, urgency: msg.urgente ? 'high' : 'normal' });
      enviados += 1;
      if (i.falhas) await PushInscricao.updateOne({ _id: i._id }, { falhas: 0 });
    } catch (err) {
      // 404/410: o aparelho desinstalou ou revogou — apaga a inscrição
      if (err.statusCode === 404 || err.statusCode === 410 || i.falhas >= 4) await PushInscricao.deleteOne({ _id: i._id });
      else await PushInscricao.updateOne({ _id: i._id }, { $inc: { falhas: 1 } });
    }
  }
  return enviados;
}

module.exports = { PushInscricao, pushConfigurado, enviarPush, _definirEnvio };
