require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const axios         = require('axios');
const cheerio       = require('cheerio');
const mongoose      = require('mongoose');
const cookieParser  = require('cookie-parser');
const cron          = require('node-cron');
const crypto        = require('crypto');
const rateLimit     = require('express-rate-limit');
const { URL }       = require('url');
const dns           = require('dns').promises;

const transportador             = require('./src/utils/mailer');
const authRoutes                = require('./src/routes/authRoutes');
const { autenticar }            = require('./src/middleware/authMiddleware');
const { executarMonitoramento } = require('./src/service/crawler');
const Alerta                    = require('./src/models/alertaModel');
const LogCron                   = require('./src/models/LogCron');
const adminRoutes               = require('./src/routes/adminRoutes');
const feedbackRoutes            = require('./src/routes/feedbackRoutes');

const app = express();

app.set('trust proxy', 1);

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
    // 1. Permite requisições de servidores, Postman ou Health Checks do Render (sem origem)
    if (!origin) return callback(null, true);
    
    // 2. Permite requisições da Vercel e do Localhost
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    
    // 3. Bloqueia qualquer outro site "impostor" tentando acessar sua API
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
    // Aguarda 2 minutos antes de iniciar o monitoramento para não bloquear
    // o servidor durante o boot (evita timeout no primeiro acesso do usuário)
    setTimeout(inicializarVigia, 15 * 1000);
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
// 🚦 RATE LIMITERS
// ============================================
const LIMITE_MAX_ALERTAS = 5;

const limiterCadastrarAlerta = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas requisições. Aguarde 15 minutos e tente novamente.' },
});

const limiterAlertasGeral = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas requisições. Tente novamente em breve.' },
});

// ============================================
// 🛡️ VALIDAÇÃO DE URL (anti-SSRF)
// ============================================

// IPv4 private / loopback ranges
const PRIVATE_IPV4_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.0\.0\.0)/;

// IPv6 private / loopback / link-local / ULA ranges
const PRIVATE_IPV6_REGEX = /^(::1$|fe[89ab][0-9a-f]:|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;

function isPrivateAddress(address) {
  // Detect IPv6 addresses (contain ':')
  if (address.includes(':')) return PRIVATE_IPV6_REGEX.test(address);
  return PRIVATE_IPV4_REGEX.test(address);
}

async function validarUrlPublica(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valido: false, motivo: 'URL inválida.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valido: false, motivo: 'Apenas URLs http:// e https:// são permitidas.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block obvious private/loopback hostnames without DNS lookup
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    isPrivateAddress(hostname)
  ) {
    return { valido: false, motivo: 'URLs internas ou de rede privada não são permitidas.' };
  }

  // Resolve DNS and check resulting IPs
  try {
    const result = await dns.lookup(hostname, { all: true });
    for (const { address } of result) {
      if (isPrivateAddress(address)) {
        return { valido: false, motivo: 'URLs internas ou de rede privada não são permitidas.' };
      }
    }
  } catch {
    return { valido: false, motivo: 'Não foi possível resolver o domínio da URL.' };
  }

  return { valido: true };
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Cadastrar alerta (protegido)
app.post('/api/cadastrar-alerta', limiterCadastrarAlerta, autenticar, async (req, res) => {
  const { url } = req.body;
  const email   = req.usuario.email;

  if (!url)
    return res.status(400).json({ sucesso: false, mensagem: 'URL é obrigatória.' });

  // ── Valida URL pública (anti-SSRF) ────────────────────────────────────────
  const validacao = await validarUrlPublica(url);
  if (!validacao.valido)
    return res.status(400).json({ sucesso: false, mensagem: validacao.motivo });

  // ── Limite de alertas por usuário ─────────────────────────────────────────
  const totalAlertas = await Alerta.countDocuments({ usuario: req.usuario._id });
  if (totalAlertas >= LIMITE_MAX_ALERTAS)
    return res.status(429).json({
      sucesso: false,
      mensagem: `Limite de ${LIMITE_MAX_ALERTAS} alertas atingido. Remova um alerta antes de adicionar outro.`,
    });

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

       try {
      await transportador.sendMail({
        from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
        to: email,
        subject: `✅ Alerta Criado: ${tituloDoSite}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Seu alerta está ativo!</h2>
            <p>Estamos vigiando o site: <br><strong><a href="${url}">${tituloDoSite}</a></strong></p>
            <p>Vamos te avisar por e-mail assim que detectarmos qualquer alteração.</p>
            <br>
            <p style="font-size: 12px; color: #666;">
              Se quiser parar de receber alertas deste site, 
              <a href="${urlCancelamento}">clique aqui para cancelar</a>.
            </p>
          </div>
        `
      });
    } catch (erroEmail) {
      console.error('❌ Erro ao enviar email de confirmação:', erroEmail);
      // Desfaz a criação do alerta se o e-mail falhar
      await Alerta.findByIdAndDelete(novoAlerta._id);
      return res.status(400).json({ 
        sucesso: false, 
        mensagem: 'Erro ao enviar e-mail de confirmação. O alerta não foi salvo.' 
      });
    }

    res.json({ sucesso: true, alerta: novoAlerta });

  } catch (err) {
    
    // Esse catch vai pegar erros do axios.get (se o site do CEFET estiver fora do ar)
    console.error('Erro no cadastro do alerta:', err);
    res.status(400).json({ sucesso: false, mensagem: 'Não foi possível ler este site. Verifique se a URL está correta.' });
  }
});
// Listar alertas do usuário logado (protegido)
app.get('/api/alertas', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const alertas = await Alerta.find({ usuario: req.usuario._id }).sort({ criadoEm: -1 });
    res.json({ sucesso: true, alertas });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados.' });
  }
});

// Cancelar alerta (protegido — só o dono pode cancelar)
app.delete('/api/cancelar-alerta/:id', limiterAlertasGeral, autenticar, async (req, res) => {
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
app.patch('/api/reativar-alerta/:id', limiterAlertasGeral, autenticar, async (req, res) => {
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