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

const authRoutes = require('./routes/authRoutes');

const app = express();

// ============================================
// ⚙️ MIDDLEWARES
// ============================================
app.use(cors({
  origin: ['https://notifica-ai.vercel.app', 'http://localhost:5173'],
  credentials: true, // necessário para enviar/receber cookies
}));
app.use(express.json());
app.use(cookieParser());

// ============================================
// 🗄️ CONECTAR AO MONGODB ATLAS
// ============================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado!'))
  .catch((err) => console.error('❌ Erro MongoDB:', err));

// ============================================
// 📋 MODELOS
// ============================================
const alertaSchema = new mongoose.Schema({
  url:          { type: String, required: true },
  email:        { type: String, required: true },
  titulo:       { type: String },
  hashConteudo: { type: String },
  status:       { type: String, default: 'ativo' },
  criadoEm:     { type: Date, default: Date.now },
});
const Alerta = mongoose.model('Alerta', alertaSchema);

// ============================================
// 📬 NODEMAILER
// ============================================
const transportador = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.SENHA_APP,
  },
});

// ============================================
// 🛣️ ROTAS
// ============================================

app.get('/teste', (_req, res) => res.json({ ok: true }));

// Auth (cadastro, login, logout, /me)
app.use('/api/auth', authRoutes);

// POST — Cadastrar novo alerta
app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;
  try {
    const resposta = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
      timeout: 10000,
    });
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text().trim() || url;

    const novoAlerta = await Alerta.create({ url, email, titulo: tituloDoSite });

    const urlCancelamento = `${process.env.BASE_URL || 'https://notifica-ai.onrender.com'}/api/cancelar-alerta/${novoAlerta._id}`;

    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🚀 Alerta criado — Notifica.ai',
      text: `Olá!\n\nSeu alerta foi criado com sucesso.\n\nMonitorando: "${tituloDoSite}"\n${url}\n\nPara cancelar: ${urlCancelamento}`,
    });

    res.json({ sucesso: true, titulo: tituloDoSite, id: novoAlerta._id });
  } catch (err) {
    console.error('[cadastrar-alerta]', err.message);
    res.status(400).json({ sucesso: false, mensagem: 'Não foi possível ler o site. Verifique o link.' });
  }
});

// GET — Listar alertas
app.get('/api/alertas', async (_req, res) => {
  try {
    const alertas = await Alerta.find().sort({ criadoEm: -1 });
    res.json({ sucesso: true, alertas });
  } catch {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar alertas.' });
  }
});

// GET — Cancelar alerta
app.get('/api/cancelar-alerta/:id', async (req, res) => {
  try {
    await Alerta.findByIdAndDelete(req.params.id);
    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:white;">
          <h1 style="color:#34d399;">✅ Alerta cancelado!</h1>
          <p style="color:#94a3b8;">Você não receberá mais notificações para esse site.</p>
        </body>
      </html>
    `);
  } catch {
    res.status(400).send('Erro ao cancelar alerta.');
  }
});

// ============================================
// 🤖 VIGIA — cron a cada 6 horas
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

cron.schedule('0 */6 * * *', async () => {
  console.log('\n🤖 Vigia acordou!');
  const alertas = await Alerta.find({ status: 'ativo' });

  for (const alerta of alertas) {
    try {
      const resposta = await axios.get(alerta.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
        timeout: 10000,
      });
      const $ = cheerio.load(resposta.data);
      const conteudo = $('body').text().replace(/\s+/g, ' ').trim();
      const hashAtual = gerarHash(conteudo);

      if (!alerta.hashConteudo) {
        alerta.hashConteudo = hashAtual;
        await alerta.save();
      } else if (alerta.hashConteudo !== hashAtual) {
        console.log(`🚨 Mudança em: ${alerta.url}`);
        await transportador.sendMail({
          from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
          to: alerta.email,
          subject: '🚨 Notifica.ai — Mudança detectada!',
          text: `Detectamos uma atualização em:\n\n🔗 ${alerta.url}\n\nAcesse agora para ver o que mudou!`,
        });
        alerta.hashConteudo = hashAtual;
        await alerta.save();
      }
    } catch (err) {
      console.error(`❌ Erro ao checar ${alerta.url}:`, err.message);
    }
  }
  console.log('🤖 Vigia dormiu.\n');
});

// ============================================
// 🚀 INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));