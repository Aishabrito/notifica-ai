const mongoose      = require('mongoose');
const transportador = require('../utils/mailer');
const Usuario       = require('../models/Usuario');
const Transacao     = require('../models/Transacao');
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

// external_reference: "<usuarioId>:<tipo>:<uuid>" (formato atual) ou só
// "<usuarioId>" (assinaturas criadas antes desta versão)
function usuarioDaReferencia(referencia) {
  const id = String(referencia ?? '').split(':')[0];
  return mongoose.isValidObjectId(id) ? id : null;
}

function enviarEmailBoasVindasPro(usuario) {
  transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: usuario.email,
    subject: '🚀 Bem-vindo ao Notifica.ai Pro!',
    html: emailPremium(usuario.nome, usuario.plano.validoAte, { renovaSozinho: usuario.plano.origem === 'mercadopago' }),
  }).catch((err) => console.error('[Assinatura] Falha ao enviar e-mail Premium:', err.message));
}

// ============================================
// 🔄 SINCRONIZA O PLANO COM A ASSINATURA NO MP
// ============================================
// Sempre recebe o objeto vindo da API do MP (nunca o corpo do webhook),
// então é idempotente: processar a mesma notificação 2x dá o mesmo resultado.
// Estados do MP: pending → authorized → paused / cancelled (a API usa
// "cancelled"; aceitamos também a grafia "canceled").
async function sincronizarAssinatura(assinatura) {
  const usuarioId = usuarioDaReferencia(assinatura?.external_reference);
  if (!usuarioId) return 'ignorada:sem-usuario';

  const usuario = await Usuario.findById(usuarioId).select('-senha');
  if (!usuario) return 'ignorada:usuario-inexistente';

  const id = String(assinatura.id);
  await Transacao.updateOne({ tipo: 'assinatura', mpId: id }, { status: assinatura.status });

  if (assinatura.status === 'authorized') {
    const anteriorId = usuario.plano?.mpAssinaturaId;
    const jaEraEssa  = anteriorId === id && temAssinaturaPagaAtiva(usuario);
    const outraAtiva = anteriorId && anteriorId !== id && temAssinaturaPagaAtiva(usuario);
    const eraPro     = obterTipoPlanoEfetivo(usuario) === 'pro';

    usuario.plano = {
      tipo: 'pro',
      status: 'ativo',
      validoAte: calcularValidoAte(assinatura),
      origem: 'mercadopago',
      mpAssinaturaId: id,
      lembreteRenovacaoEm: null,
    };
    await usuario.save();

    // Duas assinaturas autorizadas (ex.: formulário enviado 2x): cancela a
    // antiga para o usuário não ser cobrado em dobro.
    if (outraAtiva) {
      mp.cancelarAssinatura(anteriorId).catch((err) =>
        console.error(`[Assinatura] Falha ao cancelar assinatura duplicada ${anteriorId}:`, err.message)
      );
    }

    if (jaEraEssa) return 'renovada';

    await reativarAlertasPausadosPorPlano(usuario._id);
    if (!eraPro) enviarEmailBoasVindasPro(usuario);
    return 'ativada';
  }

  if (['cancelled', 'canceled', 'paused'].includes(assinatura.status)) {
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

// ============================================
// ⚡ PIX APROVADO → ESTENDE O PRO
// ============================================
// Também idempotente: a transação é marcada como processada de forma
// atômica, então o mesmo pagamento nunca soma dias duas vezes (webhook
// repetido + consulta do frontend ao mesmo tempo, por exemplo).
async function processarPagamentoPix(pagamento) {
  const referencia = String(pagamento?.external_reference ?? '');
  if (!referencia.includes(':pix:')) return 'ignorada:nao-e-pix';

  const transacao = await Transacao.findOne({ externalReference: referencia, tipo: 'pix' });
  if (!transacao) return 'ignorada:transacao-inexistente';

  // Confere se o pagamento é mesmo o desta transação e no valor certo
  if (transacao.mpId && transacao.mpId !== String(pagamento.id)) return 'ignorada:pagamento-diferente';
  if (Number(pagamento.transaction_amount) + 0.001 < transacao.valor) return 'ignorada:valor-divergente';

  if (pagamento.status !== 'approved') {
    await Transacao.updateOne({ _id: transacao._id, processadoEm: null }, { status: pagamento.status });
    return `pendente:${pagamento.status}`;
  }

  const marcada = await Transacao.findOneAndUpdate(
    { _id: transacao._id, processadoEm: null },
    { processadoEm: new Date(), status: 'approved', mpId: String(pagamento.id) },
    { new: true }
  );
  if (!marcada) return 'ja-processado';

  const usuario = await Usuario.findById(transacao.usuario).select('-senha');
  if (!usuario) return 'ignorada:usuario-inexistente';

  const eraPro = obterTipoPlanoEfetivo(usuario) === 'pro';
  // Pro sem prazo (cortesia vitalícia): não há o que estender — e trocar
  // por "N dias" seria tirar algo da pessoa. A rota de Pix já bloqueia isso.
  if (eraPro && !usuario.plano?.validoAte) return 'ignorada:pro-sem-prazo';
  const atual  = usuario.plano?.validoAte ? new Date(usuario.plano.validoAte).getTime() : 0;
  // Dias comprados somam ao que ainda resta de Pro (Pix ou cortesia com prazo)
  const base   = eraPro && atual > Date.now() ? atual : Date.now();

  // Assinatura no cartão ativa: o Pix só soma dias, sem trocar a origem
  if (temAssinaturaPagaAtiva(usuario)) {
    usuario.plano.validoAte = new Date(base + transacao.dias * DIA_MS);
  } else {
    usuario.plano = {
      tipo: 'pro',
      status: 'ativo',
      validoAte: new Date(base + transacao.dias * DIA_MS),
      origem: 'pix',
      mpAssinaturaId: null,
      lembreteRenovacaoEm: null,
    };
  }
  await usuario.save();

  if (!eraPro) {
    await reativarAlertasPausadosPorPlano(usuario._id);
    enviarEmailBoasVindasPro(usuario);
    return 'ativada';
  }
  return 'estendida';
}

module.exports = {
  sincronizarAssinatura,
  processarPagamentoPix,
  temAssinaturaPagaAtiva,
  usuarioDaReferencia,
};
