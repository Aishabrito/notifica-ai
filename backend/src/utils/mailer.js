require('dotenv').config();
const { Resend } = require('resend');

// O cliente só é criado no primeiro envio: sem RESEND_API_KEY o servidor
// precisa ligar mesmo assim (a aba Tarefas do admin avisa o que falta).
let cliente = null;
const obterCliente = () => {
  if (!cliente) cliente = new Resend(process.env.RESEND_API_KEY);
  return cliente;
};

// Limite de envio (429) e instabilidade do Resend (5xx) passam com uma nova tentativa
const TENTATIVAS = 3;
let esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const erroPassageiro = (error) => error?.statusCode === 429 || error?.statusCode >= 500
  || /rate_limit|internal_server_error|application_error/.test(String(error?.name));

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

  // attachments: [{ filename, content }] — content em Buffer ou string base64
  // headers: cabeçalhos extras (ex.: List-Unsubscribe)
  async sendMail({ from, to, subject, html, text, attachments, headers }) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(`RESEND_API_KEY não configurada: e-mail não enviado (destinatário: ${to}, assunto: ${subject})`);
    }
    const mensagem = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(attachments?.length ? { attachments } : {}),
      ...(headers ? { headers } : {}),
    };

    let error = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      let data = null;
      try {
        ({ data, error } = await obterCliente().emails.send(mensagem));
      } catch (err) {
        error = { name: 'application_error', message: err.message }; // falha de rede
      }
      if (!error) return data;
      if (!erroPassageiro(error) || tentativa === TENTATIVAS) break;
      await esperar(1000 * 2 ** (tentativa - 1)); // 1s, 2s
    }
    throw new Error(`Resend: ${error.message || 'erro desconhecido'} (destinatário: ${to}, assunto: ${subject})`);
  },

  // Só para testes
  _definirCliente(c, espera) { cliente = c; if (espera) esperar = espera; },
};

transportador.verify();

module.exports = transportador;
