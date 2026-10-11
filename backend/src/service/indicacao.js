const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');
const { obterTipoPlanoEfetivo } = require('../config/planos');

// ============================================
// 🎁 INDIQUE E GANHE
// ============================================
// Quem indica ganha 30 dias de Pro quando a pessoa indicada PAGA (Pix aprovado
// ou primeira cobrança aprovada no cartão) — cadastro sozinho não conta.
// Quem foi indicado ganha 7 dias a mais no teste grátis.

const DIA_MS = 24 * 60 * 60 * 1000;
const diasBonus = () => Number(process.env.INDICACAO_DIAS_BONUS) > 0 ? Number(process.env.INDICACAO_DIAS_BONUS) : 30;
const DIAS_EXTRA_TESTE = 7;
const MAX_RECOMPENSAS_ANO = 12;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

function novoCodigo() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

async function obterCodigo(usuario) {
  if (usuario.codigoIndicacao) return usuario.codigoIndicacao;
  for (let i = 0; i < 5; i++) {
    const codigo = novoCodigo();
    try {
      const r = await Usuario.findOneAndUpdate(
        { _id: usuario._id, codigoIndicacao: { $exists: false } },
        { $set: { codigoIndicacao: codigo } },
        { new: true }
      );
      if (r) return r.codigoIndicacao;
      return (await Usuario.findById(usuario._id).select('codigoIndicacao')).codigoIndicacao; // outra requisição gerou antes
    } catch (err) {
      if (err.code !== 11000) throw err; // código repetido: tenta outro
    }
  }
  throw new Error('Não foi possível gerar o código de indicação.');
}

// No cadastro: guarda quem indicou (código inválido é ignorado em silêncio)
async function vincularIndicacao(novoUsuario, codigo) {
  const limpo = String(codigo ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(limpo)) return false;
  const quemIndicou = await Usuario.findOne({ codigoIndicacao: limpo }).select('_id email');
  if (!quemIndicou || String(quemIndicou._id) === String(novoUsuario._id)) return false;
  if (quemIndicou.email === novoUsuario.email) return false;
  await Usuario.updateOne({ _id: novoUsuario._id, indicadoPor: null }, { $set: { indicadoPor: quemIndicou._id } });
  return true;
}

const diasExtraTeste = (usuario) => (usuario?.indicadoPor ? DIAS_EXTRA_TESTE : 0);

// Aplica os dias de bônus em quem indicou
async function aplicarBonus(quemIndicou, dias) {
  const { reativarAlertasPausadosPorPlano } = require('./planoService');
  const plano = quemIndicou.plano ?? {};
  const efetivo = obterTipoPlanoEfetivo(quemIndicou);
  const cartaoAtivo = plano.origem === 'mercadopago' && plano.status === 'ativo' && efetivo === 'pro';

  if (cartaoAtivo || (efetivo === 'pro' && !plano.validoAte)) {
    // Cartão (o MP continuaria cobrando) ou Pro sem prazo: guarda os dias
    await Usuario.updateOne({ _id: quemIndicou._id }, { $inc: { creditoDias: dias } });
    return 'credito';
  }
  if (efetivo === 'pro') {
    await Usuario.updateOne({ _id: quemIndicou._id }, { $set: { 'plano.validoAte': new Date(new Date(plano.validoAte).getTime() + dias * DIA_MS) } });
    return 'estendido';
  }
  await Usuario.updateOne({ _id: quemIndicou._id }, {
    $set: { plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + dias * DIA_MS), origem: 'cortesia', mpAssinaturaId: null, lembreteRenovacaoEm: null } },
  });
  await reativarAlertasPausadosPorPlano(quemIndicou._id);
  return 'ativado';
}

// Chamado quando um pagamento é aprovado. Idempotente: só a 1ª vez conta.
async function recompensarIndicacao(usuarioPaganteId) {
  const pagante = await Usuario.findOneAndUpdate(
    { _id: usuarioPaganteId, indicadoPor: { $ne: null }, indicacaoRecompensadaEm: null },
    { $set: { indicacaoRecompensadaEm: new Date() } },
    { new: true }
  );
  if (!pagante) return null;

  const quemIndicou = await Usuario.findById(pagante.indicadoPor).select('-senha');
  if (!quemIndicou) return null;
  const noAno = await Usuario.countDocuments({ indicadoPor: quemIndicou._id, indicacaoRecompensadaEm: { $gte: new Date(Date.now() - 365 * DIA_MS) } });
  if (noAno > MAX_RECOMPENSAS_ANO) return 'limite';

  const dias = diasBonus();
  const como = await aplicarBonus(quemIndicou, dias);
  const primeiroNome = escaparHtml(String(pagante.nome || 'Uma pessoa').split(' ')[0]);
  transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: quemIndicou.email,
    subject: `🎁 Você ganhou ${dias} dias de Pro!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
        <h2>🎁 Obrigado por indicar o Notifica.ai!</h2>
        <p>${primeiroNome} assinou o Pro pelo seu link — e você ganhou <strong>${dias} dias de Pro</strong>.</p>
        <p>${como === 'credito'
          ? 'Como você já paga no cartão, os dias ficam guardados e entram automaticamente quando seu plano acabar.'
          : 'Os dias já foram somados ao seu plano.'}</p>
        <p>Quer mais? Cada amigo que assinar vale mais ${dias} dias.</p>
      </div>`,
  }).catch((err) => console.error('[Indicação] Falha no e-mail:', err.message));
  return como;
}

async function resumoIndicacao(usuario) {
  const codigo = await obterCodigo(usuario);
  const [cadastros, convertidos] = await Promise.all([
    Usuario.countDocuments({ indicadoPor: usuario._id }),
    Usuario.countDocuments({ indicadoPor: usuario._id, indicacaoRecompensadaEm: { $ne: null } }),
  ]);
  const atual = await Usuario.findById(usuario._id).select('creditoDias');
  const frontend = process.env.FRONTEND_URL || 'https://notifica.dev.br';
  return {
    codigo,
    link: `${frontend}/cadastro?ref=${codigo}`,
    cadastros,
    convertidos,
    diasGanhos: convertidos * diasBonus(),
    creditoDias: atual?.creditoDias ?? 0,
    diasPorIndicacao: diasBonus(),
    diasExtraAmigo: DIAS_EXTRA_TESTE,
  };
}

module.exports = { obterCodigo, vincularIndicacao, recompensarIndicacao, resumoIndicacao, diasExtraTeste };
