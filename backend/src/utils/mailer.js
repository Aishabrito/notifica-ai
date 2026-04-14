require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Interface compatível com nodemailer para não precisar alterar
// nenhuma chamada sendMail() já existente no projeto.
const transportador = {
  verify(callback) {
    if (!process.env.RESEND_API_KEY) {
      const erro = new Error('RESEND_API_KEY não configurada. Acesse resend.com, crie uma conta gratuita e adicione a chave nas variáveis de ambiente.');
      console.error('[Mailer] ❌ Falha na conexão:', erro.message);
      if (callback) callback(erro);
      return;
    }
    console.log('[Mailer] ✅ Pronto para enviar e-mails via Resend.');
    if (callback) callback(null, true);
  },

  async sendMail({ from, to, subject, html, text }) {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(`Resend: ${error.message || 'erro desconhecido'} (destinatário: ${to}, assunto: ${subject})`);
    }

    return data;
  },
};

transportador.verify();

module.exports = transportador;