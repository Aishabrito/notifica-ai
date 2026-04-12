const express    = require('express');
const jwt        = require('jsonwebtoken');
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

// ─── ESQUECI MINHA SENHA ────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail é obrigatório.' });

    const usuario = await Usuario.findOne({ email });
    // Sempre retorna sucesso para não revelar se o e-mail existe
    if (!usuario)
      return res.json({ sucesso: true, mensagem: 'Se esse e-mail estiver cadastrado, você receberá um link de recuperação.' });

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    usuario.resetToken = token;
    usuario.resetTokenExpira = expira;
    await usuario.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'https://notifica-ai.vercel.app'}/reset-password?token=${token}`;

    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🔑 Recuperação de senha — Notifica.ai',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8" /></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                <tr><td style="padding-bottom:32px;">
                  <span style="font-size:22px;font-weight:900;color:#f5f2eb;letter-spacing:-1px;">
                    Notifica<span style="color:#10b981;">.ai</span>
                  </span>
                </td></tr>
                <tr><td style="background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(108,52,131,0.04));border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:40px;">
                  <p style="font-family:monospace;font-size:10px;color:#a855f7;text-transform:uppercase;letter-spacing:4px;margin:0 0 16px;">// recuperação de senha</p>
                  <h1 style="font-size:24px;font-weight:900;color:#f5f2eb;margin:0 0 16px;letter-spacing:-1px;">Redefinir sua senha</h1>
                  <p style="font-size:14px;color:#737373;line-height:1.7;margin:0 0 24px;">
                    Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link é válido por <strong style="color:#f5f2eb;">1 hora</strong>.
                  </p>
                  <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#000;font-weight:700;font-size:13px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                    Redefinir senha →
                  </a>
                  <p style="font-size:12px;color:#525252;margin:24px 0 0;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
                </td></tr>
                <tr><td style="padding-top:24px;">
                  <p style="font-family:monospace;font-size:10px;color:#404040;margin:0;">© 2025 Notifica.ai · Feito por Aisha Brito · UFRJ</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    res.json({ sucesso: true, mensagem: 'Se esse e-mail estiver cadastrado, você receberá um link de recuperação.' });
  } catch (err) {
    console.error('❌ ERRO NO FORGOT-PASSWORD:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
  }
});

module.exports = router;