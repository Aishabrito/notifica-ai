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
  hashConteudo: { type: String },
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
    // DEPOIS
text: `Olá!\n\nSeu alerta foi criado com sucesso.\n\nVamos monitorar: "${tituloDoSite}" (${url})\n\nPara cancelar esse alerta a qualquer momento, clique aqui:\nhttp://localhost:3000/api/cancelar-alerta/${novoAlerta._id}\n\nID do seu alerta: ${novoAlerta._id}`
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
const cron = require('node-cron');
const crypto = require('crypto'); // já vem no Node, não precisa instalar

// Função que gera uma "impressão digital" do conteúdo do site
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

// 🤖 O VIGIA — roda a cada 6 horas
cron.schedule('0 */6 * * *', async () => {
  console.log('\n🤖 Vigia acordou! Checando alertas...');

  const alertas = await Alerta.find({ status: 'ativo' });
  console.log(`📋 ${alertas.length} alertas para checar`);

  for (const alerta of alertas) {
    try {
      // Lê o site atual
      const resposta = await axios.get(alerta.url);
      const $ = cheerio.load(resposta.data);
      const conteudoAtual = $('body').text().replace(/\s+/g, ' ').trim();
      const hashAtual = gerarHash(conteudoAtual);

      // Compara com o hash salvo
      if (!alerta.hashConteudo) {
        // Primeira vez — só salva o hash, não avisa
        alerta.hashConteudo = hashAtual;
        await alerta.save();
        console.log(`💾 Hash inicial salvo para: ${alerta.url}`);

      } else if (alerta.hashConteudo !== hashAtual) {
        // MUDOU! Avisa o usuário
        console.log(`🚨 MUDANÇA DETECTADA em: ${alerta.url}`);

        await transportador.sendMail({
          from: process.env.EMAIL_REMETENTE,
          to: alerta.email,
          subject: '🚨 Notifica.ai — Mudança detectada!',
          text: `Olá!\n\nDetectamos uma atualização no site que você está monitorando:\n\n🔗 ${alerta.url}\n\nAcesse agora para ver o que mudou!`
        });

        // Atualiza o hash no banco
        alerta.hashConteudo = hashAtual;
        await alerta.save();
        console.log(`📧 E-mail de alerta enviado para ${alerta.email}!`);

      } else {
        console.log(`✅ Sem mudanças em: ${alerta.url}`);
      }

    } catch (erro) {
      console.error(`❌ Erro ao checar ${alerta.url}:`, erro.message);
    }
  }

  console.log('🤖 Vigia voltou a dormir!\n');
});
// DELETE — Cancelar alerta pelo ID
app.get('/api/cancelar-alerta/:id', async (req, res) => {
  try {
    await Alerta.findByIdAndDelete(req.params.id);
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
          <h1 style="color: #34d399;">✅ Alerta cancelado!</h1>
          <p style="color: #94a3b8;">Você não receberá mais notificações para esse site.</p>
        </body>
      </html>
    `);
  } catch (erro) {
    res.status(400).send('Erro ao cancelar alerta.');
  }
});
// Liga o servidor
app.listen(3000, () => {
  console.log('🚀 Servidor rodando na porta 3000 (Com MongoDB, E-mail e Segurança!)');
});