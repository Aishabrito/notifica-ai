require('dotenv').config(); // 🔐 Puxa as senhas secretas do arquivo .env
// 👇 Adicione estas duas linhas para o nosso teste:
console.log("🕵️ Lendo Email do Cofre:", process.env.EMAIL_REMETENTE);
console.log("🕵️ Lendo Senha do Cofre:", process.env.SENHA_APP ? "Achei a senha!" : "SENHA VAZIA!");

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer'); // 📦 O nosso Carteiro

const app = express();
app.use(cors());
app.use(express.json());

// 🔧 Configurando o Carteiro com as senhas secretas do .env
const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE, // 👈 Pega do cofre (.env)
    pass: process.env.SENHA_APP        // 👈 Pega do cofre (.env)
  }
});

// Rota que o React chama
app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;

  console.log(`\n🤖 Novo alerta recebido! Destino: ${email}`);

  try {
    // 1. O robô lê o site
    const resposta = await axios.get(url);
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text();

    console.log(`✅ Site lido com sucesso: "${tituloDoSite}"`);

    // 2. Preparando a carta (e-mail)
    const opcoesEmail = {
      from: process.env.EMAIL_REMETENTE, 
      to: email,                       
      subject: '🚀 Bem-vindo ao Notifica.ai!',
      text: `Olá!\n\nSeu alerta foi criado com sucesso.\n\nNós vamos monitorar o site: "${tituloDoSite}" (${url}) e te avisaremos quando houver novidades!`
    };

    // 3. Enviando o e-mail de verdade
    await transportador.sendMail(opcoesEmail);
    console.log(`📧 SUCESSO! E-mail de confirmação enviado para ${email}!`);

    // 4. Avisa o Front-end que deu tudo certo
    res.json({ 
      sucesso: true, 
      mensagem: 'Alerta criado e e-mail enviado!',
      titulo: tituloDoSite 
    });

  } catch (erro) {
    console.error('❌ Erro no processo:', erro);
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao processar o alerta. O site pode estar bloqueando robôs.' });
  }
});

// Liga o servidor
app.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000 (Com E-mail e Segurança!)');
});