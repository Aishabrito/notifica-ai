const express   = require('express');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const Feedback  = require('../models/Feedback');
const { TIPOS, STATUS } = require('../models/Feedback');
const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');
const { autenticar, isAdmin, identificarSeLogado } = require('../middleware/authMiddleware');

// 💬 Reclamações e sugestões: o botão do site envia, a dona lê e responde no admin
const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Rota pública: limite por IP para não virar caixa de spam
const limiterEnvio = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.' } });
const naoEncontrado = (res) => res.status(404).json({ sucesso: false, mensagem: 'Mensagem não encontrada.' });

// POST / — enviar (público; se estiver logado, liga à conta)
router.post('/', limiterEnvio, identificarSeLogado, async (req, res) => {
  const email = req.usuario?.email ?? (typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '');
  const mensagem = typeof req.body.mensagem === 'string' ? req.body.mensagem.trim() : '';
  const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : 'outro';
  const pagina = typeof req.body.pagina === 'string' ? req.body.pagina.slice(0, 200) : null;

  if (!EMAIL_RE.test(email)) return res.status(400).json({ sucesso: false, mensagem: 'Informe um e-mail válido para a gente responder.' });
  if (mensagem.length < 3) return res.status(400).json({ sucesso: false, mensagem: 'Escreva a sua mensagem.' });
  if (mensagem.length > 2000) return res.status(400).json({ sucesso: false, mensagem: 'A mensagem pode ter até 2.000 caracteres.' });

  try {
    await Feedback.create({ email, mensagem, tipo, pagina, usuario: req.usuario?._id ?? null });
    res.status(201).json({ sucesso: true });
  } catch (err) {
    console.error('Erro ao salvar feedback:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar feedback.' });
  }
});

// GET / — listar (admin)
router.get('/', autenticar, isAdmin, async (_req, res) => {
  const feedbacks = await Feedback.find({}).sort({ criadoEm: -1 }).populate('usuario', 'nome plano.tipo').lean();
  res.json({ sucesso: true, feedbacks });
});

// PATCH /:id — mudar status/tipo ou marcar como lido (admin)
router.patch('/:id', autenticar, isAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  const mudar = {};
  if (STATUS.includes(req.body.status)) mudar.status = req.body.status;
  if (TIPOS.includes(req.body.tipo)) mudar.tipo = req.body.tipo;
  if (typeof req.body.lido === 'boolean') mudar.lido = req.body.lido;
  if (!Object.keys(mudar).length) return res.status(400).json({ sucesso: false, mensagem: 'Nada para alterar.' });
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, mudar, { new: true });
  if (!feedback) return naoEncontrado(res);
  res.json({ sucesso: true, feedback });
});

// Compatibilidade com o painel antigo
router.patch('/:id/lido', autenticar, isAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { lido: true }, { new: true });
  if (!feedback) return naoEncontrado(res);
  res.json({ sucesso: true, feedback });
});

// POST /:id/responder — responde por e-mail e marca como resolvido (admin)
router.post('/:id/responder', autenticar, isAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  const resposta = typeof req.body.resposta === 'string' ? req.body.resposta.trim() : '';
  if (resposta.length < 2 || resposta.length > 4000) return res.status(400).json({ sucesso: false, mensagem: 'Escreva a resposta (até 4.000 caracteres).' });
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) return naoEncontrado(res);

  const paragrafos = (t) => escaparHtml(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  try {
    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: feedback.email,
      subject: 'Resposta à sua mensagem no Notifica.ai',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
          ${paragrafos(resposta)}
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="font-size:12px;color:#666">Você escreveu em ${feedback.criadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}:</p>
          <blockquote style="font-size:13px;color:#555;border-left:3px solid #ddd;margin:0;padding-left:12px">${paragrafos(feedback.mensagem)}</blockquote>
        </div>`,
    });
  } catch (err) {
    console.error('[Feedback] Falha ao responder:', err.message);
    return res.status(502).json({ sucesso: false, mensagem: 'Não foi possível enviar o e-mail agora. A resposta não foi salva.' });
  }
  Object.assign(feedback, { resposta, respondidoEm: new Date(), status: 'resolvido', lido: true });
  await feedback.save();
  res.json({ sucesso: true, feedback });
});

module.exports = router;
