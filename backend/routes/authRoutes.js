const express = require('express');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,                              // JS não consegue ler — protege contra XSS
  secure: process.env.NODE_ENV === 'production', // HTTPS em prod, HTTP em dev
  sameSite: 'strict',                          // Protege contra CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000,            // 7 dias
};

const gerarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ─── POST /api/auth/cadastro ──────────────────────────────────────────────────
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha)
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos.' });

    if (senha.length < 8)
      return res.status(400).json({ sucesso: false, mensagem: 'Senha deve ter no mínimo 8 caracteres.' });

    const emailExiste = await Usuario.findOne({ email });
    if (emailExiste)
      return res.status(409).json({ sucesso: false, mensagem: 'E-mail já cadastrado.' });

    const usuario = await Usuario.create({ nome, email, senha });
    const token = gerarToken(usuario._id);

    res.cookie('token', token, COOKIE_OPTS);
    res.status(201).json({
      sucesso: true,
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano },
    });
  } catch (err) {
    console.error('[CADASTRO]', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno. Tente novamente.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha)
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha e-mail e senha.' });

    const usuario = await Usuario.findOne({ email });
    if (!usuario)
      return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha incorretos.' });

    const senhaCorreta = await usuario.verificarSenha(senha);
    if (!senhaCorreta)
      return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha incorretos.' });

    const token = gerarToken(usuario._id);

    res.cookie('token', token, COOKIE_OPTS);
    res.json({
      sucesso: true,
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, plano: usuario.plano },
    });
  } catch (err) {
    console.error('[LOGIN]', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno. Tente novamente.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ sucesso: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
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