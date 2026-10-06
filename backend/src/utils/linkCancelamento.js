const crypto = require('crypto');

// Token HMAC do id do alerta: permite cancelar pelo link do e-mail sem login,
// sem que alguém consiga cancelar alertas de outras pessoas trocando o id.
function gerarTokenCancelamento(alertaId) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`cancelar-alerta:${alertaId}`)
    .digest('hex');
}

function tokenCancelamentoValido(alertaId, token) {
  const esperado = Buffer.from(gerarTokenCancelamento(alertaId));
  const recebido = Buffer.from(String(token ?? ''));
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

function gerarLinkCancelamento(alertaId) {
  return `${process.env.BASE_URL}/cancelar/${alertaId}/${gerarTokenCancelamento(alertaId)}`;
}

module.exports = { gerarLinkCancelamento, tokenCancelamentoValido };
