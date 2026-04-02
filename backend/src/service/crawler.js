const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getHeaders } = require('../utils/headers');
const { wait } = require('../utils/jitter');

// Configuração do transporte de e-mail 
const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
});

function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

function extrairConteudoLimpo(html) {
  const $ = cheerio.load(html);
  $('script, style, footer, noscript, iframe, head, nav, .ads, #footer, .sidebar').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function executarMonitoramento(listaDeAlertas) {
  for (const alerta of listaDeAlertas) {
    await wait(3000, 8000); // O nosso Jitter

    try {
      const resposta = await axios.get(alerta.url, { 
        headers: getHeaders(),
        timeout: 15000 
      });

      const conteudoLimpo = extrairConteudoLimpo(resposta.data);
      const hashAtual = gerarHash(conteudoLimpo);

      if (alerta.hashConteudo !== hashAtual) {
        console.log(`🚨 MUDANÇA DETECTADA: ${alerta.url}`);
        
        // Envio de e-mail
        await transportador.sendMail({
          from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
          to: alerta.email,
          subject: '🚨 ATUALIZAÇÃO DETECTADA - Notifica.ai',
          text: `Mudança detectada no site: ${alerta.url}`,
        });

        alerta.hashConteudo = hashAtual;
        await alerta.save();
      }
    } catch (err) {
      console.error(`❌ Erro ao vigiar ${alerta.url}:`, err.message);
    }
  }
}

module.exports = { executarMonitoramento };