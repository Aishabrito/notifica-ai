require('dotenv').config();
const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000
});

transportador.verify((erro) => {
  if (erro) {
    console.error('[Mailer] ❌ Falha na conexão:', erro.message);
  } else {
    console.log('[Mailer] ✅ Pronto para enviar e-mails.');
  }
});

module.exports = transportador;