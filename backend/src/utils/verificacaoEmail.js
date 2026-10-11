const crypto = require('crypto');

// Link de confirmação de e-mail: HMAC de (id, e-mail, momento). Sem estado no
// banco; vale 48h e deixa de valer se o e-mail da conta mudar.
const VALIDADE_MS = 48 * 60 * 60 * 1000;

function assinar(id, email, ts) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`verificar-email:${id}:${String(email).toLowerCase()}:${ts}`)
    .digest('hex');
}

function gerarLinkVerificacao(usuario) {
  const ts = Date.now();
  return `${process.env.BASE_URL}/verificar-email/${usuario._id}/${ts}/${assinar(usuario._id, usuario.email, ts)}`;
}

function verificacaoValida(usuario, ts, token) {
  const momento = Number(ts);
  if (!Number.isFinite(momento) || Date.now() - momento > VALIDADE_MS || momento > Date.now() + 60000) return false;
  const esperado = Buffer.from(assinar(usuario._id, usuario.email, momento));
  const recebido = Buffer.from(String(token ?? ''));
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

module.exports = { gerarLinkVerificacao, verificacaoValida };
