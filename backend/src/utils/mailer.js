require('dotenv').config();
const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Fica false para porta 587
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
  tls: {
    rejectUnauthorized: false
  },
  // Timeouts explícitos para evitar travamento silencioso no Render.
  // O padrão do Nodemailer é 2 min (conexão) e 10 min (socket) — inaceitável.
  connectionTimeout: 10000,  // 10s para estabelecer a conexão TCP
  greetingTimeout:   10000,  // 10s para receber o SMTP greeting (EHLO/HELO)
  socketTimeout:     30000,  // 30s de inatividade no socket (cobre STARTTLS + AUTH)
});

transportador.verify((erro) => {
  if (erro) {
    console.error('[Mailer] ❌ Falha na conexão:', erro.message);
  } else {
    console.log('[Mailer] ✅ Pronto para enviar e-mails.');
  }
});

module.exports = transportador;