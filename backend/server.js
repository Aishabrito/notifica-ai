require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const axios         = require('axios');
const mongoose      = require('mongoose');
const cookieParser  = require('cookie-parser');
const cron          = require('node-cron');
const crypto        = require('crypto');
const rateLimit     = require('express-rate-limit');
const { URL }       = require('url');

const transportador             = require('./src/utils/mailer');
const { OPCOES_DOWNLOAD, interpretarResposta } = require('./src/utils/conteudoPagina');
const authRoutes                = require('./src/routes/authRoutes');
const { autenticar }            = require('./src/middleware/authMiddleware');
const { gerarHeaders }          = require('./src/service/crawler');
const { executarRodada }        = require('./src/service/agendador');
const Usuario                   = require('./src/models/Usuario');
const planoRoutes               = require('./src/routes/planoRoutes');
const cancelamentoRoutes        = require('./src/routes/cancelamentoRoutes');
const verificacaoRoutes         = require('./src/routes/verificacaoRoutes');
const radarRoutes               = require('./src/routes/radarRoutes');
const { executarRadar, aoEncontrarOcorrencias } = require('./src/service/radar/radarService');
const { telegramRouter, webhookTelegramRouter } = require('./src/routes/telegramRoutes');
const telegram                  = require('./src/service/telegram');
const { assinaturaRouter, webhookRouter, mpConfigHandler } = require('./src/routes/assinaturaRoutes');
const { gerarLinkCancelamento } = require('./src/utils/linkCancelamento');
const { processarPlanosExpirados, enviarLembretesRenovacao } = require('./src/service/planoService');
const { obterRegrasPlano }      = require('./src/config/planos');
const {
  verificarLimitePlano,
  checarLimiteAlertas,
  validarIntervalo,
} = require('./src/middleware/planoMiddleware');
const Alerta                    = require('./src/models/alertaModel');
const Mudanca                   = require('./src/models/Mudanca');
const adminRoutes               = require('./src/routes/adminRoutes');
const feedbackRoutes            = require('./src/routes/feedbackRoutes');

const app = express();

app.set('trust proxy', 1);

// ============================================
// ⚙️ MIDDLEWARES
// ============================================
app.use(express.json());
app.use(cookieParser());

// Link de cancelamento dos e-mails: página servida pelo próprio backend.
// Fica antes do CORS porque o POST do formulário vem da origem do backend,
// que não está na lista de origens do frontend.
app.use('/cancelar', cancelamentoRoutes);
app.use('/verificar-email', verificacaoRoutes);

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      'https://notifica.dev.br',
      'https://www.notifica.dev.br',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// 🗄️ CONEXÃO MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
})
  .then(async () => {
    console.log('MongoDB conectado com sucesso.');
    telegram.configurarWebhook();
    try {
      const migrados = await Usuario.migrarPlanosLegados();
      if (migrados > 0) console.log(`[Plano] ${migrados} usuário(s) migrados para o novo formato de plano.`);
    } catch (errMigracao) {
      console.error('[Plano] Falha na migração de planos legados:', errMigracao.message);
    }
  })
  .catch((err) => {
    console.error('Erro de conexão MongoDB:', err.message);
  });

// ============================================
// 🚦 RATE LIMITERS
// ============================================
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
const PRIVATE_IPV4_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.0\.0\.0)/;
const PRIVATE_IPV6_REGEX = /^(::1$|fe[89ab][0-9a-f]:|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;

function isPrivateAddress(address) {
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

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    isPrivateAddress(hostname)
  ) {
    return { valido: false, motivo: 'URLs internas ou de rede privada não são permitidas.' };
  }

  return { valido: true };
}

// ============================================
// 🛠️ FUNÇÕES AUXILIARES
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

// ============================================
// 🛣️ ROTAS DA API
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/plano', planoRoutes);
app.use('/api/radar', radarRoutes);
app.get('/api/mp-config', mpConfigHandler);
app.use('/api/assinatura', assinaturaRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/webhooks', webhookTelegramRouter);
app.use('/api/telegram', telegramRouter);

// Publicações do Radar também vão para o Telegram de quem conectou
aoEncontrarOcorrencias(telegram.notificarOcorrencias);

app.get('/teste', (_req, res) => res.json({ online: true, timestamp: new Date() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Cadastrar alerta (protegido)
app.post('/api/cadastrar-alerta', limiterCadastrarAlerta, autenticar, verificarLimitePlano, async (req, res) => {
  const { url, seletorCss } = req.body;
  const email = req.usuario.email;

  if (!url) {
    return res.status(400).json({ sucesso: false, mensagem: 'URL é obrigatória.' });
  }

  const validacao = await validarUrlPublica(url);
  if (!validacao.valido) {
    return res.status(400).json({ sucesso: false, mensagem: validacao.motivo });
  }

  // verificarLimitePlano já validou intervaloHoras contra o plano, se enviado
  const intervaloHoras = req.body.intervaloHoras !== undefined
    ? Number(req.body.intervaloHoras)
    : obterRegrasPlano(req.usuario).intervaloPadrao;

  try {
    const resposta = await axios.get(url, { headers: gerarHeaders(), ...OPCOES_DOWNLOAD });

    const seletorLimpo  = seletorCss ? seletorCss.trim() : null;
    const pagina        = await interpretarResposta(resposta, { url, seletorCss: seletorLimpo });
    const hashInicial   = gerarHash(pagina.texto);
    const nomeArquivo   = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const tituloDoSite  = pagina.titulo || (pagina.tipo === 'pdf' && nomeArquivo) || url;

    const novoAlerta = await Alerta.create({
      url,
      email,
      titulo: tituloDoSite,
      seletorCss: seletorLimpo,
      hashConteudo: hashInicial,
      // Primeira versão guardada: a próxima mudança já pode ser resumida
      ultimoConteudo: pagina.texto.slice(0, 200000),
      linksPdf: pagina.linksPdf,
      tipoConteudo: pagina.tipo,
      usuario: req.usuario._id,
      intervaloHoras,
      proximaVerificacao: new Date(Date.now() + intervaloHoras * 60 * 60 * 1000),
    });

    const urlCancelamento = gerarLinkCancelamento(novoAlerta._id);

    transportador.sendMail({
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
    }).catch((erroEmail) => {
      console.error('Erro ao enviar email de confirmação:', erroEmail.message);
    });

    const { ultimoConteudo, linksPdf, ...alertaPublico } = novoAlerta.toObject();
    return res.json({ sucesso: true, titulo: tituloDoSite, alerta: alertaPublico });

  } catch (err) {
    console.error('[Cadastro] Falha na requisição ao site monitorado:', err.code, err.message);
    const status = err.code === 'ERR_INVALID_URL' ? 400 : 502;
    return res.status(status).json({
      sucesso: false,
      mensagem: 'Não foi possível ler este site. Verifique se a URL está correta e acessível.'
    });
  }
});

// Listar alertas do usuário logado (protegido)
app.get('/api/alertas', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const alertas = await Alerta.find({ usuario: req.usuario._id }).sort({ criadoEm: -1 });
    return res.json({ sucesso: true, alertas });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados.' });
  }
});

// Cancelar alerta (protegido)
app.delete('/api/cancelar-alerta/:id', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!alerta) {
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });
    }

    await alerta.deleteOne();
    return res.json({ sucesso: true, mensagem: 'Alerta removido!' });
  } catch (err) {
    return res.status(400).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
});

// Reativar alerta pausado (protegido)
app.patch('/api/reativar-alerta/:id', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!alerta) {
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });
    }

    if (alerta.status !== 'ativo') {
      const erroLimite = await checarLimiteAlertas(req.usuario);
      if (erroLimite) {
        return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: erroLimite });
      }
    }

    alerta.status = 'ativo';
    alerta.motivoPausa = null;
    alerta.proximaVerificacao = new Date();
    alerta.falhasSeguidas = 0;
    alerta.ultimoErro = null;
    await alerta.save();

    return res.json({ sucesso: true, mensagem: 'Alerta reativado!' });
  } catch (err) {
    return res.status(400).json({ sucesso: false, mensagem: 'Erro ao reativar.' });
  }
});

// Histórico de mudanças de um alerta (protegido) — com o resumo da IA quando houver
app.get('/api/alertas/:id/historico', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id }).select('_id').lean();
    if (!alerta) {
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });
    }
    const mudancas = await Mudanca.find({ alertaId: alerta._id })
      .sort({ detectadaEm: -1 })
      .limit(50)
      .select('detectadaEm emailEnviado resumo pdfsNovos')
      .lean();
    return res.json({ sucesso: true, mudancas });
  } catch (err) {
    return res.status(400).json({ sucesso: false, mensagem: 'Erro ao buscar histórico.' });
  }
});

// Alterar frequência de checagem (protegido) — opções dependem do plano
app.patch('/api/alertas/:id/frequencia', limiterAlertasGeral, autenticar, async (req, res) => {
  try {
    const { intervaloHoras } = req.body;
    const erroIntervalo = validarIntervalo(req.usuario, intervaloHoras);
    if (erroIntervalo) return res.status(403).json(erroIntervalo);

    const alerta = await Alerta.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!alerta) {
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });
    }

    alerta.intervaloHoras = Number(intervaloHoras);
    const base = alerta.ultimaVerificacao ? alerta.ultimaVerificacao.getTime() : Date.now();
    alerta.proximaVerificacao = new Date(base + alerta.intervaloHoras * 60 * 60 * 1000);
    await alerta.save();

    return res.json({ sucesso: true, mensagem: 'Frequência atualizada!', alerta });
  } catch (err) {
    return res.status(400).json({ sucesso: false, mensagem: 'Erro ao atualizar frequência.' });
  }
});

// ============================================
// 🤖 CRON JOB — a cada 5 min, verifica alertas com checagem vencida
// ============================================
cron.schedule('*/5 * * * *', executarRodada, { timezone: 'America/Sao_Paulo' });

// ============================================
// 📰 CRON DO RADAR — 07h40 e 19h40 (Brasília)
// ============================================
// Diários costumam sair de madrugada/manhã; a 2ª rodada pega edições extras.
cron.schedule('40 7,19 * * *', async () => {
  try {
    await executarRadar();
  } catch (err) {
    console.error('[Radar] Erro na rodada agendada:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ============================================
// 💎 CRON DE PLANOS — 03h (Brasília): rebaixa assinaturas vencidas
// ============================================
cron.schedule('0 3 * * *', async () => {
  try {
    await processarPlanosExpirados();
  } catch (err) {
    console.error('[Plano] Erro no job de planos expirados:', err.message);
  }
  try {
    await enviarLembretesRenovacao();
  } catch (err) {
    console.error('[Plano] Erro no job de lembretes de renovação:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ============================================
// 🚀 INICIALIZAÇÃO
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});