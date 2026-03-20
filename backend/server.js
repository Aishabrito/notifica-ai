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
// 🛠️ FUNÇÕES AUXILIARES DE MONITORAMENTO
// ============================================

/**
 * Gera um hash MD5 a partir de um texto
 */
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

/**
 * Extrai apenas o conteúdo semântico relevante do HTML.
 * Remove tags que mudam constantemente (scripts, anúncios, contadores no rodapé).
 */
function extrairConteudoLimpo(html) {
  const $ = cheerio.load(html);
  
  // Remove elementos lixo que geram falsos positivos
  $('script, style, footer, noscript, iframe, head, nav, .ads, .anuncios, #footer, .sidebar').remove();
  
  // Retorna o texto limpo, removendo quebras de linha e espaços excessivos
  return $('body').text().replace(/\s+/g, ' ').trim();
}

// ============================================
// 🛣️ ROTAS DA API
// ============================================

app.use('/api/auth', authRoutes);

app.get('/teste', (_req, res) => res.json({ online: true, timestamp: new Date() }));

/**
 * POST: Cadastrar novo alerta
 */
app.post('/api/cadastrar-alerta', async (req, res) => {
  const { url, email } = req.body;
  try {
    const resposta = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
      timeout: 10000,
    });

    // 1. Limpa o conteúdo e gera o hash inicial
    const conteudoLimpo = extrairConteudoLimpo(resposta.data);
    const hashInicial = gerarHash(conteudoLimpo);

    // 2. Captura o título para exibição no painel
    const $ = cheerio.load(resposta.data);
    const tituloDoSite = $('title').text().trim() || url;

    // 3. Salva o alerta já com o hash populado para evitar o alerta falso no primeiro ciclo do cron
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
      text: `Olá!\n\nSeu alerta para "${tituloDoSite}" foi criado.\n\nLink: ${url}\n\nPara parar de receber notificações, clique aqui: ${urlCancelamento}`,
    });

    res.json({ sucesso: true, titulo: tituloDoSite, id: novoAlerta._id });
  } catch (err) {
    console.error('Erro ao cadastrar:', err.message);
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

cron.schedule('0 */6 * * *', async () => {
  console.log('🤖 Vigia: Iniciando verificação de rotina...');
  const alertas = await Alerta.find({ status: 'ativo' });

  for (const alerta of alertas) {
    try {
      const resposta = await axios.get(alerta.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai bot)' },
        timeout: 10000,
      });

      // Aplica a mesma limpeza do cadastro para comparação justa
      const conteudoLimpo = extrairConteudoLimpo(resposta.data);
      const hashAtual = gerarHash(conteudoLimpo);

      if (!alerta.hashConteudo) {
        // Fallback caso algum alerta antigo esteja sem hash
        alerta.hashConteudo = hashAtual;
        await alerta.save();
      } else if (alerta.hashConteudo !== hashAtual) {
        console.log(`🚨 MUDANÇA REAL DETECTADA: ${alerta.url}`);
        
        await transportador.sendMail({
          from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
          to: alerta.email,
          subject: '🚨 ATUALIZAÇÃO DETECTADA - Notifica.ai',
          text: `Atenção!\n\nIdentificamos uma mudança relevante no conteúdo do site que você está monitorando:\n\n🔗 ${alerta.url}\n\nVerifique agora mesmo para não perder o prazo!`,
        });

        // Atualiza o hash para a nova versão limpa
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
  console.log(`🔑 JWT_SECRET presente: ${process.env.JWT_SECRET ? '✅ Sim' : '❌ Não'}`);
});