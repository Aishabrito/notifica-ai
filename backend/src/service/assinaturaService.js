const mongoose      = require('mongoose');
const transportador = require('../utils/mailer');
const Usuario       = require('../models/Usuario');
const mp            = require('./mercadoPago');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const { reativarAlertasPausadosPorPlano } = require('./planoService');
const { emailPremium } = require('../utils/emailPremium');

// Dias de tolerância após a data da próxima cobrança: o MP pode levar
// alguns dias para cobrar (ou retentar um cartão recusado).
const DIAS_TOLERANCIA = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

function calcularValidoAte(assinatura) {
  const proxima = assinatura.next_payment_date ? new Date(assinatura.next_payment_date) : null;
  const base = proxima && !Number.isNaN(proxima.getTime()) ? proxima : new Date(Date.now() + 30 * DIA_MS);
  return new Date(base.getTime() + DIAS_TOLERANCIA * DIA_MS);
}

function temAssinaturaPagaAtiva(usuario) {
  return usuario.plano?.origem === 'mercadopago'
    && usuario.plano?.status === 'ativo'
    && obterTipoPlanoEfetivo(usuario) === 'pro';
}

// ============================================
// 🔄 SINCRONIZA O PLANO COM O ESTADO DA ASSINATURA NO MP
// ============================================
// Sempre recebe o objeto vindo da API do MP (nunca o corpo do webhook),
// então é idempotente: processar a mesma notificação 2x dá o mesmo resultado.
async function sincronizarAssinatura(assinatura) {
  const usuarioId = assinatura?.external_reference;
  if (!usuarioId || !mongoose.isValidObjectId(usuarioId)) return 'ignorada:sem-usuario';

  const usuario = await Usuario.findById(usuarioId).select('-senha');
  if (!usuario) return 'ignorada:usuario-inexistente';

  const id = String(assinatura.id);

  if (assinatura.status === 'authorized') {
    const anteriorId   = usuario.plano?.mpAssinaturaId;
    const jaEraEssa    = anteriorId === id && temAssinaturaPagaAtiva(usuario);
    const outraAtiva   = anteriorId && anteriorId !== id && temAssinaturaPagaAtiva(usuario);

    usuario.plano = {
      tipo: 'pro',
      status: 'ativo',
      validoAte: calcularValidoAte(assinatura),
      origem: 'mercadopago',
      mpAssinaturaId: id,
    };
    await usuario.save();

    // Duas assinaturas autorizadas (ex: checkout aberto 2x): cancela a antiga
    // para o usuário não ser cobrado em dobro.
    if (outraAtiva) {
      mp.cancelarAssinatura(anteriorId).catch((err) =>
        console.error(`[Assinatura] Falha ao cancelar assinatura duplicada ${anteriorId}:`, err.message)
      );
    }

    if (jaEraEssa) return 'renovada';

    await reativarAlertasPausadosPorPlano(usuario._id);
    transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: usuario.email,
      subject: '🚀 Bem-vindo ao Notifica.ai Pro!',
      html: emailPremium(usuario.nome, usuario.plano.validoAte),
    }).catch((err) => console.error('[Assinatura] Falha ao enviar e-mail Premium:', err.message));

    return 'ativada';
  }

  if (assinatura.status === 'cancelled' || assinatura.status === 'paused') {
    // Só mexe se for a assinatura atual (ignora notificações de uma antiga)
    if (usuario.plano?.mpAssinaturaId !== id) return 'ignorada:assinatura-antiga';
    if (usuario.plano.status === 'cancelado') return 'ja-cancelada';

    // Mantém o Pro até o fim do período pago; o job diário faz o downgrade
    usuario.plano.status = 'cancelado';
    if (!usuario.plano.validoAte) usuario.plano.validoAte = new Date();
    await usuario.save();
    return 'cancelada';
  }

  return `ignorada:status-${assinatura.status}`; // pending etc.
}

module.exports = { sincronizarAssinatura, temAssinaturaPagaAtiva };
