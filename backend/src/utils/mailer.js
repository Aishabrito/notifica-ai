require('dotenv').config();
const nodemailer = require('nodemailer');

const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
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