require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const axios        = require('axios');
const cheerio      = require('cheerio');
const nodemailer   = require('nodemailer');
const mongoose     = require('mongoose');
const cookieParser = require('cookie-parser'); 
const cron         = require('node-cron');
const crypto       = require('crypto');

// Importação das rotas e serviços da nova pasta /src
const authRoutes = require('./src/routes/authRoutes');
const { executarMonitoramento } = require('./src/service/crawler');

const app = express();

// ============================================
// ⚙️ MIDDLEWARES
// ============================================
app.use(express.json());
app.use(cookieParser()); 

app.use(cors({
  origin: ['https://notifica-ai.vercel.app', 'http://localhost:5173'], 
  credentials: true, 
}));

// ============================================
// 🗄️ CONEXÃO MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB conectado com sucesso!');
    inicializarVigia();
  })
  .catch((err) => console.error('❌ Erro de conexão MongoDB:', err));

// ============================================
// 📋 MODELOS (Schema)
// ============================================
const alertaSchema = new mongoose.Schema({
  url:           { type: String, required: true },
  email:         { type: String, required: true },
  titulo:        { type: String },
  hashConteudo:  { type: String },
  status:        { type: String, default: 'ativo' },
  criadoEm:      { type: Date, default: Date.now },
});

const Alerta = mongoose.models.Alerta || mongoose.model('Alerta', alertaSchema);

// ============================================
// 🤖 FUNÇÃO DE INICIALIZAÇÃO
// ============================================
async function inicializarVigia() {
  try {
    const alertas = await Alerta.find({ status: 'ativo' });
    if (alertas.length > 0) {
      console.log(`🤖 Ronda inicial: Verificando ${alertas.length} alertas ativos...`);
      await executarMonitoramento(alertas);
    }
  } catch (err) {
    console.error('❌ Erro na inicialização do vigia:', err.message);
  }
}

// ============================================
// 📬 CONFIGURAÇÃO DE E-MAIL
// ============================================
const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
});

// ============================================
// 🛠️ FUNÇÕES AUXILIARES
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

function extrairConteudoLimpo(html) {
  const $ = cheerio.load(html);
  $('script, style, footer, noscript, iframe, head, nav, .ads, #footer, .sidebar').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

// ============================================
// 🛣️ ROTAS DA API
// ============================================
app.use('/api/auth', authRoutes);

app.get('/teste', (_req, res) => res.json({ online: true, timestamp: new Date() }));

app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;
  try {
    const resposta = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });

    const conteudoLimpo = extrairConteudoLimpo(resposta.data);
    const hashInicial = gerarHash(conteudoLimpo);
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text().trim() || url;

    const novoAlerta = await Alerta.create({ 
      url, 
      email, 
      titulo: tituloDoSite,
      hashConteudo: hashInicial 
    });

    const urlCancelamento = `${process.env.BASE_URL || 'https://notifica-ai.onrender.com'}/api/cancelar-alerta/${novoAlerta._id}`;

    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🚀 Monitoramento Iniciado — Notifica.ai',
      text: `Olá!\n\nSeu alerta para "${tituloDoSite}" foi criado.\n\nLink: ${url}\n\nPara cancelar: ${urlCancelamento}`,
    });

    res.json({ sucesso: true, titulo: tituloDoSite, id: novoAlerta._id });
  } catch (err) {
    res.status(400).json({ sucesso: false, mensagem: 'Não foi possível acessar o site.' });
  }
});

app.get('/api/alertas', async (_req, res) => {
  try {
    const alertas = await Alerta.find().sort({ criadoEm: -1 });
    res.json({ sucesso: true, alertas });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados.' });
  }
});

app.delete('/api/cancelar-alerta/:id', async (req, res) => {
  try {
    await Alerta.findByIdAndDelete(req.params.id);
    res.json({ sucesso: true, mensagem: 'Alerta removido!' });
  } catch (err) {
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
});

// ============================================
// 🤖 O VIGIA (Cron Job)
// ============================================
cron.schedule('0 * * * *', async () => {
  console.log('🤖 Vigia: Iniciando verificação de rotina...');
  const alertas = await Alerta.find({ status: 'ativo' });
  await executarMonitoramento(alertas);
  console.log('🤖 Vigia: Verificação concluída.');
});

// ============================================
// 🚀 LANÇAMENTO
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor voando na porta ${PORT}`);
});