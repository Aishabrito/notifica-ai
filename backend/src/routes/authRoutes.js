const express    = require('express');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const transportador = require('../utils/mailer');
const Usuario    = require('../models/Usuario');
const { emailBoasVindas } = require('../utils/emailBoasVindas');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
};

const gerarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Safe email validation that avoids ReDoS — domain labels cannot contain dots
const EMAIL_REGEX = /^[^\s@]+@[^@.\s]+(?:\.[^@.\s]+)+$/;

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
  // Pega todas as regras do COOKIE_OPTS, mas "joga fora" o maxAge
  const { maxAge, ...opcoesDeLogout } = COOKIE_OPTS; 
  
  res.clearCookie('token', opcoesDeLogout);
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
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});

router.post('/forgot-password', recuperacaoLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string')
    return res.status(400).json({ sucesso: false, mensagem: 'Informe o e-mail.' });

  if (!EMAIL_REGEX.test(email))
    return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });

  const emailSanitizado = email.toLowerCase().trim();

  try {
    const usuario = await Usuario.findOne({ email: emailSanitizado });

    // Always return success to avoid user enumeration
    if (!usuario) {
      return res.json({
        sucesso: true,
        mensagem: 'Se esse e-mail estiver cadastrado, você receberá o código em breve.',
      });
    }

    // Generate 6-digit OTP and store its SHA-256 hash
    const codigo = String(crypto.randomInt(100000, 1000000));
    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
    const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    usuario.codigoReset       = codigoHash;
    usuario.codigoResetExpira = expira;
    await usuario.save();

    await transportador.sendMail({
      from: `"Notifica.ai 🔐" <${process.env.EMAIL_REMETENTE}>`,
      to: emailSanitizado,
      subject: '🔑 Seu código de redefinição de senha — Notifica.ai',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0a0a0a;color:#f5f2eb;padding:32px;border-radius:12px;border:1px solid #1a1a1a">
          <h2 style="color:#a855f7;margin:0 0 8px">Redefinição de senha</h2>
          <p style="color:#737373;font-size:13px;margin:0 0 24px">Olá, <strong style="color:#f5f2eb">${usuario.nome}</strong>! Use o código abaixo para redefinir sua senha.</p>
          <div style="text-align:center;margin:0 0 24px">
            <div style="display:inline-block;background:#18181b;border:2px solid #a855f7;border-radius:12px;padding:20px 40px">
              <span style="font-family:monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#a855f7">${codigo}</span>
            </div>
          </div>
          <p style="color:#525252;font-size:12px;margin:0 0 8px">➜ Acesse <a href="${process.env.BASE_URL ?? 'https://notifica.dev.br'}/redefinir-senha" style="color:#a855f7">notifica.dev.br/redefinir-senha</a>, informe seu e-mail e esse código.</p>
          <p style="color:#525252;font-size:11px;margin:0 0 24px">Este código expira em <strong style="color:#f5f2eb">15 minutos</strong>. Se você não solicitou, ignore este e-mail.</p>
          <hr style="border:none;border-top:1px solid #1a1a1a;margin:0 0 16px"/>
          <p style="color:#404040;font-size:10px;margin:0">© 2025 Notifica.ai</p>
        </div>
      `,
    });

    res.json({
      sucesso: true,
      mensagem: 'Se esse e-mail estiver cadastrado, você receberá o código em breve.',
    });
  } catch (err) {
    console.error('❌ ERRO NO FORGOT-PASSWORD:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao processar a solicitação.' });
  }
});

// ─── REDEFINIR SENHA ─────────────────────────────────────────────────────────
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas tentativas. Aguarde 15 minutos.' },
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { email, codigo, novaSenha } = req.body;

  if (!email || !codigo || !novaSenha)
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos.' });

  if (!EMAIL_REGEX.test(email))
    return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });

  if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo))
    return res.status(400).json({ sucesso: false, mensagem: 'Código inválido. Deve ter 6 dígitos.' });

  if (typeof novaSenha !== 'string' || novaSenha.length < 8)
    return res.status(400).json({ sucesso: false, mensagem: 'A nova senha deve ter pelo menos 8 caracteres.' });

  try {
    const emailSanitizado = email.toLowerCase().trim();
    const usuario = await Usuario.findOne({ email: emailSanitizado });

    const erroGenerico = { sucesso: false, mensagem: 'Código inválido ou expirado.' };

    if (!usuario || !usuario.codigoReset || !usuario.codigoResetExpira)
      return res.status(400).json(erroGenerico);

    if (usuario.codigoResetExpira < new Date())
      return res.status(400).json(erroGenerico);

    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');
    if (codigoHash !== usuario.codigoReset)
      return res.status(400).json(erroGenerico);

    // Valid — update password and clear OTP fields
    usuario.senha             = novaSenha;
    usuario.codigoReset       = null;
    usuario.codigoResetExpira = null;
    await usuario.save();

    console.log('🔑 Senha redefinida com sucesso para:', emailSanitizado);
    res.json({ sucesso: true, mensagem: 'Senha redefinida com sucesso! Faça login com sua nova senha.' });
  } catch (err) {
    console.error('❌ ERRO NO RESET-PASSWORD:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao redefinir a senha.' });
  }
});

module.exports = router;