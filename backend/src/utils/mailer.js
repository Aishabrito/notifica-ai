require('dotenv').config();
const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // false para porta 587
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
  tls: {
    rejectUnauthorized: false // Ajuda a evitar bloqueios de rede do Render
  }
});
// Verifica conexão ao iniciar
transportador.verify((erro) => {
  if (erro) {
    console.error('[Mailer] ❌ Falha na conexão:', erro.message);
  } else {
    console.log('[Mailer] ✅ Pronto para enviar e-mails.');
  }
});

module.exports = transportador;