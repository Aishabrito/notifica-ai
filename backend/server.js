require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const axios         = require('axios');
const cheerio       = require('cheerio');
const mongoose      = require('mongoose');
const cookieParser  = require('cookie-parser');
const cron          = require('node-cron');
const crypto        = require('crypto');

const transportador             = require('./src/utils/mailer');
const authRoutes                = require('./src/routes/authRoutes');
const { autenticar }            = require('./src/middleware/authMiddleware');
const { executarMonitoramento } = require('./src/service/crawler');
const Alerta                    = require('./src/models/alertaModel');
const LogCron                   = require('./src/models/LogCron');
const adminRoutes               = require('./src/routes/adminRoutes');
const feedbackRoutes            = require('./src/routes/feedbackRoutes');

const app = express();

// ============================================
// ⚙️ MIDDLEWARES
// ============================================
app.use(express.json());
app.use(cookieParser());
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      'https://notifica-ai.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin only in non-production (e.g. curl, local dev)
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`🚫 CORS bloqueou origem: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

console.log('🌐 CORS_ORIGINS permitidas:', ALLOWED_ORIGINS);

// ============================================
// 🗄️ CONEXÃO MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000
})
  .then(() => {
    console.log('✅ MongoDB conectado com sucesso!');
    inicializarVigia();
  })
  .catch((err) => console.error('❌ Erro de conexão MongoDB:', err));

// ============================================
// 🤖 INICIALIZAÇÃO DO VIGIA
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

// 👑 ROTA DO PAINEL ADM ADICIONADA AQUI!
app.use('/api/admin', adminRoutes);

// 💬 ROTAS DE FEEDBACK
app.use('/api/feedbacks', feedbackRoutes);

app.get('/teste', (_req, res) => res.json({ online: true, timestamp: new Date() }));

// Cadastrar alerta (protegido)
app.post('/api/cadastrar-alerta', autenticar, async (req, res) => {
  const { url } = req.body;
  const email   = req.usuario.email;

  if (!url)
    return res.status(400).json({ sucesso: false, mensagem: 'URL é obrigatória.' });

  try {
    const resposta = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });

    const conteudoLimpo = extrairConteudoLimpo(resposta.data);
    const hashInicial   = gerarHash(conteudoLimpo);
    const $             = cheerio.load(resposta.data);
    const tituloDoSite  = $('title').text().trim() || url;

    const novoAlerta = await Alerta.create({
      url,
      email,
      titulo: tituloDoSite,
      hashConteudo: hashInicial,
      usuario: req.usuario._id,
    });

    const urlCancelamento = `${process.env.BASE_URL}/api/cancelar-alerta/${novoAlerta._id}`;

    await transportador.sendMail({
      from: `"Notifica.ai 🚀" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: '🚀 Monitoramento Iniciado — Notifica.ai',
      html: `
        <h2>Monitoramento ativado!</h2>
        <p>Seu alerta para <b>${tituloDoSite}</b> foi criado com sucesso.</p>
        <p><b>URL monitorada:</b> <a href="${url}">${url}</a></p>
        <p>Você receberá um e-mail assim que detectarmos uma mudança.</p>
        <hr>
        <p><small>Não quer mais receber? <a href="${urlCancelamento}">Cancelar monitoramento</a></small></p>
      `,
    });

    res.json({ sucesso: true, titulo: tituloDoSite, id: novoAlerta._id });
  } catch (err) {
    console.error('❌ Erro ao cadastrar alerta:', err.message);
    res.status(400).json({ sucesso: false, mensagem: 'Não foi possível acessar o site.' });
  }
});

// Listar alertas do usuário logado (protegido)
app.get('/api/alertas', autenticar, async (req, res) => {
  try {
    const alertas = await Alerta.find({ usuario: req.usuario._id }).sort({ criadoEm: -1 });
    res.json({ sucesso: true, alertas });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados.' });
  }
});

// Cancelar alerta (protegido — só o dono pode cancelar)
app.delete('/api/cancelar-alerta/:id', autenticar, async (req, res) => {
  try {
    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!alerta)
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });

    await alerta.deleteOne();
    res.json({ sucesso: true, mensagem: 'Alerta removido!' });
  } catch (err) {
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
});

// Reativar alerta pausado (protegido)
app.patch('/api/reativar-alerta/:id', autenticar, async (req, res) => {
  try {
    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!alerta)
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });

    alerta.status         = 'ativo';
    alerta.falhasSeguidas = 0;
    alerta.ultimoErro     = null;
    await alerta.save();

    res.json({ sucesso: true, mensagem: 'Alerta reativado!' });
  } catch (err) {
    res.status(400).json({ sucesso: false, mensagem: 'Erro ao reativar.' });
  }
});

// ============================================
// 🤖 CRON JOB — roda a cada hora
// ============================================
cron.schedule('0 * * * *', async () => {
  const iniciadoEm = new Date();
  console.log('🤖 Vigia: Iniciando verificação de rotina...');

  let metricas = { alertasVerificados: 0, alertasComMudanca: 0, alertasComErro: 0 };
  let sucesso   = true;
  let erroGlobal = null;

  try {
    const alertas = await Alerta.find({ status: 'ativo' });
    metricas = await executarMonitoramento(alertas);
  } catch (errExec) {
    sucesso    = false;
    erroGlobal = errExec.message;
    console.error('❌ Erro durante o monitoramento:', errExec.message);
  }

  const finalizadoEm = new Date();
  const tempoDuracao = finalizadoEm - iniciadoEm;

  try {
    await LogCron.create({
      alertasVerificados: metricas.alertasVerificados,
      mudancasDetectadas: metricas.alertasComMudanca,
      alertasComErro:     metricas.alertasComErro,
      tempoDuracao,
      sucesso,
      erroGlobal,
      iniciadoEm,
      finalizadoEm,
    });
  } catch (errLog) {
    console.error('❌ Erro ao salvar log do cron:', errLog.message);
  }

  console.log('🤖 Vigia: Verificação concluída.');
});

// ============================================
// 🚀 LANÇAMENTO
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor voando na porta ${PORT}`);
});