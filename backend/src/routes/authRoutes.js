const express    = require('express');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const Usuario    = require('../models/Usuario');
const { emailBoasVindas } = require('../utils/emailBoasVindas');

const router = express.Router();

const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const gerarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ─── CADASTRO ──────────────────────────────────────
router.post('/cadastro', async (req, res) => {
  console.log('📬 Recebi tentativa de cadastro:', req.body.email);
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha)
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos.' });

    const emailExiste = await Usuario.findOne({ email });
    if (emailExiste)
      return res.status(409).json({ sucesso: false, mensagem: 'E-mail já cadastrado.' });

    const usuario = await Usuario.create({ nome, email, senha });
    const token   = gerarToken(usuario._id);

    // E-mail de boas-vindas em HTML (dispara sem bloquear a resposta)
    transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🎉 Bem-vinda ao Notifica.ai!',
      html: emailBoasVindas(nome),
    }).catch(err => console.error('[EMAIL BOAS-VINDAS]', err.message));

    res.cookie('token', token, COOKIE_OPTS);
    console.log('✅ Usuário cadastrado com sucesso!');

    res.status(201).json({
      sucesso: true,
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano, role: usuario.role ?? 'user' },
    });
  } catch (err) {
    console.error('❌ ERRO NO CADASTRO:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
  }
});

// ─── LOGIN ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  console.log('🔑 Tentativa de login:', req.body.email);
  try {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email });

    if (!usuario || !(await usuario.verificarSenha(senha))) {
      return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha incorretos.' });
    }

    const token = gerarToken(usuario._id);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({
      sucesso: true,
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano, role: usuario.role ?? 'user' },
    });
  } catch (err) {
    console.error('❌ ERRO NO LOGIN:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao entrar.' });
  }
});

// ─── LOGOUT ────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ sucesso: true });
});

// ─── ME (VERIFICAR SESSÃO) ──────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ sucesso: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-senha');
    if (!usuario) return res.status(401).json({ sucesso: false });

    res.json({
      sucesso: true,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        plano: usuario.plano,
        role: usuario.role ?? 'user',
      },
    });
  } catch {
    res.status(401).json({ sucesso: false });
  }
});

// ─── ESQUECI MINHA SENHA ────────────────────────────────────────────────────
const recuperacaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});

router.post('/forgot-password', recuperacaoLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string')
    return res.status(400).json({ sucesso: false, mensagem: 'Informe o e-mail.' });

  // Validate email format to prevent NoSQL injection
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });

  const emailSanitizado = email.toLowerCase().trim();

  try {
    const usuario = await Usuario.findOne({ email: emailSanitizado });

    // Always return success to avoid user enumeration
    if (!usuario) {
      return res.json({
        sucesso: true,
        mensagem: 'Se esse e-mail estiver cadastrado, você receberá as instruções em breve.',
      });
    }

    // Generate a signed reset token valid for 1 hour
    const resetToken = jwt.sign(
      { id: usuario._id, finalidade: 'reset-senha' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetUrl = `${process.env.BASE_URL ?? 'https://notifica-ai.vercel.app'}/redefinir-senha?token=${resetToken}`;

    await transportador.sendMail({
      from: `"Notifica.ai 🔐" <${process.env.EMAIL_REMETENTE}>`,
      to: emailSanitizado,
      subject: '🔑 Redefinição de senha — Notifica.ai',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0a0a0a;color:#f5f2eb;padding:32px;border-radius:12px;border:1px solid #1a1a1a">
          <h2 style="color:#a855f7;margin:0 0 8px">Redefinição de senha</h2>
          <p style="color:#737373;font-size:13px;margin:0 0 24px">Olá, <strong style="color:#f5f2eb">${usuario.nome}</strong>! Recebemos uma solicitação para redefinir sua senha.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:13px">
            Redefinir minha senha →
          </a>
          <p style="color:#525252;font-size:11px;margin-top:24px">Este link expira em <strong>1 hora</strong>. Se você não solicitou, ignore este e-mail.</p>
          <hr style="border:none;border-top:1px solid #1a1a1a;margin:24px 0"/>
          <p style="color:#404040;font-size:10px">© 2025 Notifica.ai</p>
        </div>
      `,
    });

    res.json({
      sucesso: true,
      mensagem: 'Se esse e-mail estiver cadastrado, você receberá as instruções em breve.',
    });
  } catch (err) {
    console.error('❌ ERRO NO FORGOT-PASSWORD:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao processar a solicitação.' });
  }
});

module.exports = router;