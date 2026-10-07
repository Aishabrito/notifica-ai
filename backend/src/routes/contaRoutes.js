const express   = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const transportador   = require('../utils/mailer');
const Usuario         = require('../models/Usuario');
const Alerta          = require('../models/alertaModel');
const Mudanca         = require('../models/Mudanca');
const MonitorRadar    = require('../models/MonitorRadar');
const OcorrenciaRadar = require('../models/OcorrenciaRadar');
const LogRadar        = require('../models/LogRadar');
const Feedback        = require('../models/Feedback');
const mp = require('../service/mercadoPago');
const telegram = require('../service/telegram');
const { temAssinaturaPagaAtiva } = require('../service/assinaturaService');
const { gerarLinkVerificacao } = require('../utils/verificacaoEmail');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde alguns minutos.' },
});

const EMAIL_REGEX = /^[^\s@]+@[^@.\s]+(?:\.[^@.\s]+)+$/;

// Confere a senha atual (o middleware carrega o usuário sem a senha)
async function senhaConfere(usuarioId, senha) {
  if (!senha) return false;
  const usuario = await Usuario.findById(usuarioId);
  return Boolean(usuario) && usuario.verificarSenha(String(senha));
}

// ─── DADOS DA CONTA ────────────────────────────────
router.get('/', autenticar, async (req, res) => {
  const u = req.usuario;
  res.json({
    sucesso: true,
    conta: {
      nome: u.nome,
      email: u.email,
      emailVerificado: Boolean(u.emailVerificado),
      criadoEm: u.criadoEm,
      plano: u.plano?.tipo ?? 'free',
      origemPlano: u.plano?.origem ?? null,
      telegramConectado: Boolean(u.telegram?.chatId),
    },
  });
});

// ─── TROCAR NOME ───────────────────────────────────
router.patch('/', limiter, autenticar, async (req, res) => {
  const nome = String(req.body?.nome ?? '').replace(/\s+/g, ' ').trim();
  if (nome.length < 2 || nome.length > 80) {
    return res.status(400).json({ sucesso: false, mensagem: 'Informe um nome entre 2 e 80 caracteres.' });
  }
  await Usuario.updateOne({ _id: req.usuario._id }, { nome });
  res.json({ sucesso: true, mensagem: 'Nome atualizado.' });
});

// ─── TROCAR SENHA ──────────────────────────────────
router.post('/senha', limiter, autenticar, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body ?? {};
    if (!novaSenha || String(novaSenha).length < 8) {
      return res.status(400).json({ sucesso: false, mensagem: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    }
    if (!(await senhaConfere(req.usuario._id, senhaAtual))) {
      return res.status(403).json({ sucesso: false, mensagem: 'Senha atual incorreta.' });
    }
    const usuario = await Usuario.findById(req.usuario._id);
    usuario.senha = String(novaSenha); // o hook do modelo faz o hash
    await usuario.save();
    res.json({ sucesso: true, mensagem: 'Senha alterada.' });
  } catch (err) {
    console.error('[Conta] Erro ao trocar senha:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível trocar a senha agora.' });
  }
});

// ─── TROCAR E-MAIL ─────────────────────────────────
// O novo e-mail precisa ser confirmado de novo; os alertas passam a ir para ele.
router.post('/email', limiter, autenticar, async (req, res) => {
  try {
    const novoEmail = String(req.body?.novoEmail ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(novoEmail)) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });
    }
    if (!(await senhaConfere(req.usuario._id, req.body?.senha))) {
      return res.status(403).json({ sucesso: false, mensagem: 'Senha incorreta.' });
    }
    if (novoEmail === req.usuario.email) {
      return res.status(400).json({ sucesso: false, mensagem: 'Esse já é o seu e-mail.' });
    }
    if (await Usuario.exists({ email: novoEmail })) {
      return res.status(409).json({ sucesso: false, mensagem: 'Esse e-mail já está em uso.' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.usuario._id,
      { email: novoEmail, emailVerificado: false, emailVerificadoEm: null },
      { new: true }
    );
    await Alerta.updateMany({ usuario: usuario._id }, { email: novoEmail });

    transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: novoEmail,
      subject: 'Confirme seu novo e-mail no Notifica.ai',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Confirme seu novo e-mail</h2>
          <p>Seus alertas agora vão para este endereço. Confirme que ele é seu (o link vale por 48 horas):</p>
          <p><a href="${gerarLinkVerificacao(usuario)}" style="display:inline-block;background:#10b981;color:#000;padding:12px 20px;border-radius:8px;font-weight:bold;text-decoration:none;">Confirmar e-mail</a></p>
        </div>`,
    }).catch((err) => console.error('[Conta] Falha ao enviar confirmação do novo e-mail:', err.message));

    res.json({ sucesso: true, mensagem: 'E-mail alterado. Enviamos um link de confirmação para o novo endereço.' });
  } catch (err) {
    console.error('[Conta] Erro ao trocar e-mail:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível trocar o e-mail agora.' });
  }
});

// ─── EXCLUIR CONTA (LGPD) ──────────────────────────
// Body: { senha, confirmacao: 'EXCLUIR' }
// Apaga alertas, histórico, Radar e feedbacks. Registros de pagamento
// (Transacao) são mantidos sem dados pessoais além do id, por obrigação fiscal.
router.delete('/', limiter, autenticar, async (req, res) => {
  try {
    if (req.body?.confirmacao !== 'EXCLUIR') {
      return res.status(400).json({ sucesso: false, mensagem: 'Digite EXCLUIR para confirmar.' });
    }
    if (!(await senhaConfere(req.usuario._id, req.body?.senha))) {
      return res.status(403).json({ sucesso: false, mensagem: 'Senha incorreta.' });
    }

    const usuario = req.usuario;

    // Primeiro cancela a cobrança recorrente: se falhar, não apaga nada
    // (senão a pessoa continuaria sendo cobrada sem ter conta)
    if (temAssinaturaPagaAtiva(usuario) && usuario.plano.mpAssinaturaId) {
      try {
        await mp.cancelarAssinatura(usuario.plano.mpAssinaturaId);
      } catch (err) {
        console.error('[Conta] Falha ao cancelar assinatura antes de excluir conta:', err.message);
        return res.status(502).json({
          sucesso: false,
          mensagem: 'Não conseguimos cancelar sua assinatura no Mercado Pago agora. Tente de novo em alguns minutos — nada foi apagado.',
        });
      }
    }

    if (usuario.telegram?.chatId) {
      await telegram.enviarMensagem(usuario.telegram.chatId, 'Sua conta do Notifica.ai foi excluída. Você não vai mais receber mensagens aqui.');
    }

    const alertas = await Alerta.find({ usuario: usuario._id }).select('_id').lean();
    const monitores = await MonitorRadar.find({ usuario: usuario._id }).select('_id').lean();
    await Promise.all([
      Mudanca.deleteMany({ alertaId: { $in: alertas.map((a) => a._id) } }),
      Alerta.deleteMany({ usuario: usuario._id }),
      OcorrenciaRadar.deleteMany({ usuario: usuario._id }),
      LogRadar.deleteMany({ usuario: usuario._id }),
      MonitorRadar.deleteMany({ _id: { $in: monitores.map((m) => m._id) } }),
      Feedback.deleteMany({ email: usuario.email }),
    ]);
    await Usuario.deleteOne({ _id: usuario._id });

    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    console.log(`[Conta] Conta ${usuario._id} excluída a pedido do usuário.`);
    res.json({ sucesso: true, mensagem: 'Sua conta e seus dados foram excluídos.' });
  } catch (err) {
    console.error('[Conta] Erro ao excluir conta:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível excluir a conta agora.' });
  }
});

module.exports = router;
