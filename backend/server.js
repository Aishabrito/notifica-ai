require('dotenv').config();

console.log("🕵️ Lendo Email do Cofre:", process.env.EMAIL_REMETENTE);
console.log("🕵️ Lendo Senha do Cofre:", process.env.SENHA_APP ? "Achei a senha!" : "SENHA VAZIA!");
console.log("🕵️ Lendo MongoDB:", process.env.MONGODB_URI ? "String encontrada!" : "URI VAZIA!");

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // 🗄️ Nosso conector com o banco

const app = express();
app.use(cors());
app.use(express.json());
app.get('/teste', (req, res) => {
  res.json({ ok: true });
});

// ============================================
// 🗄️ 1. CONECTAR AO MONGODB ATLAS
// ============================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado com sucesso!'))
  .catch((erro) => console.error('❌ Erro ao conectar no MongoDB:', erro));

// ============================================
// 📋 2. MODELO DO ALERTA (estrutura da tabela)
// ============================================
const alertaSchema = new mongoose.Schema({
  url:       { type: String, required: true },
  email:     { type: String, required: true },
  titulo:    { type: String },
  status:    { type: String, default: 'ativo' }, // 'ativo' ou 'pausado'
  criadoEm: { type: Date, default: Date.now }
});

const Alerta = mongoose.model('Alerta', alertaSchema);

// ============================================
// 📬 3. CONFIGURANDO O CARTEIRO (Nodemailer)
// ============================================
const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP
  }
});

// ============================================
// 🛣️ 4. ROTAS DA API
// ============================================

// POST — Cadastrar novo alerta
app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;
  console.log(`\n🤖 Novo alerta recebido! Destino: ${email}`);

  try {
    // Lê o site
    const resposta = await axios.get(url);
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text();
    console.log(`✅ Site lido com sucesso: "${tituloDoSite}"`);

    // 💾 Salva no MongoDB
    const novoAlerta = new Alerta({ url, email, titulo: tituloDoSite });
    await novoAlerta.save();
    console.log(`💾 Alerta salvo no banco! ID: ${novoAlerta._id}`);

    // Envia e-mail de confirmação
    await transportador.sendMail({
      from: process.env.EMAIL_REMETENTE,
      to: email,
      subject: '🚀 Bem-vindo ao Notifica.ai!',
      text: `Olá!\n\nSeu alerta foi criado com sucesso.\n\nVamos monitorar: "${tituloDoSite}" (${url})\n\nID do seu alerta: ${novoAlerta._id}`
    });
    console.log(`📧 E-mail enviado para ${email}!`);

    res.json({
      sucesso: true,
      mensagem: 'Alerta criado e e-mail enviado!',
      titulo: tituloDoSite,
      id: novoAlerta._id
    });

  } catch (erro) {
    console.error('❌ Erro no processo:', erro);
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao processar o alerta.' });
  }
});

// GET — Listar todos os alertas (útil para o painel futuro)
app.get('/api/alertas', async (req, res) => {
  try {
    const alertas = await Alerta.find().sort({ criadoEm: -1 }); // mais recentes primeiro
    res.json({ sucesso: true, alertas });
  } catch (erro) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar alertas.' });
  }
});

// Liga o servidor
app.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000 (Com MongoDB, E-mail e Segurança!)');
});