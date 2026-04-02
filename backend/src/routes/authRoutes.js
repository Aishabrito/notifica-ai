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
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano },
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
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano },
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

    res.json({ sucesso: true, usuario });
  } catch {
    res.status(401).json({ sucesso: false });
  }
});

module.exports = router;