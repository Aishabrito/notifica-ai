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

// Importação das rotas de autenticação que você já configurou
const authRoutes = require('./routes/authRoutes');

const app = express();

// ============================================
// ⚙️ MIDDLEWARES
// ============================================
app.use(cors({
  origin: ['https://notifica-ai.vercel.app', 'http://localhost:5173'],
  credentials: true, // Essencial para o sistema de login com cookies
}));
app.use(express.json());
app.use(cookieParser());

// ============================================
// 🗄️ CONEXÃO MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado com sucesso!'))
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
const Alerta = mongoose.model('Alerta', alertaSchema);

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
// 🛣️ ROTAS DA API
// ============================================

// Rotas de Autenticação
app.use('/api/auth', authRoutes);

// Rota de Teste
app.get('/teste', (_req, res) => res.json({ online: true, timestamp: new Date() }));

/**
 * POST: Cadastrar novo alerta e enviar e-mail de boas-vindas
 */
app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;
  try {
    const resposta = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
      timeout: 10000,
    });
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text().trim() || url;

    // Salva no Banco de Dados
    const novoAlerta = await Alerta.create({ url, email, titulo: tituloDoSite });

    const urlCancelamento = `${process.env.BASE_URL || 'https://notifica-ai.onrender.com'}/api/cancelar-alerta/${novoAlerta._id}`;

    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🚀 Monitoramento Iniciado — Notifica.ai',
      text: `Olá!\n\nSeu alerta para "${tituloDoSite}" foi criado.\n\nLink: ${url}\n\nPara parar de receber notificações, clique aqui: ${urlCancelamento}`,
    });

    res.json({ sucesso: true, titulo: tituloDoSite, id: novoAlerta._id });
  } catch (err) {
    console.error('Erro ao cadastrar:', err.message);
    res.status(400).json({ sucesso: false, mensagem: 'Não foi possível acessar o site.' });
  }
});

/**
 * GET: Listar todos os alertas (usado pelo Dashboard do React)
 */
app.get('/api/alertas', async (_req, res) => {
  try {
    const alertas = await Alerta.find().sort({ criadoEm: -1 });
    res.json({ sucesso: true, alertas });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados.' });
  }
});

/**
 * DELETE: Remover alerta via Dashboard
 */
app.delete('/api/cancelar-alerta/:id', async (req, res) => {
  try {
    await Alerta.findByIdAndDelete(req.params.id);
    res.json({ sucesso: true, mensagem: 'Alerta removido!' });
  } catch (err) {
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
});

/**
 * GET: Cancelar alerta via Link do E-mail (Retorna HTML)
 */
app.get('/api/cancelar-alerta/:id', async (req, res) => {
  try {
    await Alerta.findByIdAndDelete(req.params.id);
    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:white;">
          <h1 style="color:#10b981;">✅ Alerta removido com sucesso!</h1>
          <p style="color:#737373;">O Notifica.ai parou de monitorar este link para você.</p>
          <a href="https://notifica-ai.vercel.app" style="color:#10b981;text-decoration:none;">Voltar para o site</a>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send('Erro ao processar o cancelamento.');
  }
});

// ============================================
// 🤖 O VIGIA (Monitoramento Automático)
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

// Roda a cada 6 horas (0 */6 * * *)
cron.schedule('0 */6 * * *', async () => {
  console.log('🤖 Vigia: Iniciando verificação de rotina...');
  const alertas = await Alerta.find({ status: 'ativo' });

  for (const alerta of alertas) {
    try {
      const resposta = await axios.get(alerta.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
        timeout: 10000,
      });
      const $ = cheerio.load(resposta.data);
      // Focamos no texto do body para detectar mudanças reais de conteúdo
      const conteudo = $('body').text().replace(/\s+/g, ' ').trim();
      const hashAtual = gerarHash(conteudo);

      if (!alerta.hashConteudo) {
        // Primeira vez monitorando: salva o hash inicial
        alerta.hashConteudo = hashAtual;
        await alerta.save();
      } else if (alerta.hashConteudo !== hashAtual) {
        // Mudança detectada!
        console.log(`🚨 MUDANÇA DETECTADA: ${alerta.url}`);
        
        await transportador.sendMail({
          from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
          to: alerta.email,
          subject: '🚨 ATUALIZAÇÃO DETECTADA - Notifica.ai',
          text: `Atenção!\n\nIdentificamos uma mudança no site que você está monitorando:\n\n🔗 ${alerta.url}\n\nVerifique agora mesmo para não perder o prazo!`,
        });

        // Atualiza o hash para não repetir o alerta sem nova mudança
        alerta.hashConteudo = hashAtual;
        await alerta.save();
      }
    } catch (err) {
      console.error(`❌ Falha ao vigiar ${alerta.url}:`, err.message);
    }
  }
  console.log('🤖 Vigia: Verificação concluída.');
});

// ============================================
// 🚀 LANÇAMENTO
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor voando na porta ${PORT}`);
  console.log(`⚙️  Vigia programado para rodar a cada 6 horas.`);
});