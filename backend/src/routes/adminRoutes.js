// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const Usuario = require('../models/Usuario');
const Alerta  = require('../models/alertaModel');
const Feedback = require('../models/Feedback');
const Mudanca  = require('../models/Mudanca');
const LogCron  = require('../models/LogCron');

const { autenticar, isAdmin } = require('../middleware/authMiddleware');

// Rota: GET /api/admin/dashboard
router.get('/dashboard', autenticar, isAdmin, async (req, res) => {
  try {
    // 1. Buscamos as listas completas em vez de apenas contar
    const [usuarios, todosAlertas, feedbacks, logsRecentes] = await Promise.all([
      Usuario.find({}).select('-senha').lean(), // Traz todos sem a senha
      Alerta.find({}).lean(),
      Feedback.find({}).sort({ criadoEm: -1 }).limit(20).lean(),
      LogCron.find({}).sort({ dataExecucao: -1 }).limit(10).lean()
    ]);

    // 2. Calculamos as estatísticas para os StatCards
    const totalUsers = usuarios.length;
    const totalAlerts = todosAlertas.filter(a => a.status === 'ativo').length;
    const alertasPausados = todosAlertas.filter(a => a.status === 'pausado').length;
    const alertasComErro = todosAlertas.filter(a => a.status === 'erro').length;

    // 3. Montamos o objeto crawlerHealth com base nos logs reais
    const ultimoLog = logsRecentes[0];
    const crawlerHealth = {
      status: ultimoLog?.status === 'erro' ? 'degradado' : 'operacional',
      ultimaExecucao: ultimoLog?.dataExecucao || new Date(),
      proximaExecucao: new Date(Date.now() + 60 * 60 * 1000), // Ex: daqui a 1h
      totalVerificacoesHoje: ultimoLog?.totalVerificadas || 0,
      mudancasDetectadasHoje: ultimoLog?.totalMudancas || 0,
      emailsEnviadosHoje: ultimoLog?.totalEmailsEnviados || 0,
      taxaSucessoEmail: 100, // Você pode calcular isso se tiver o campo no log
      logs: logsRecentes.map(l => ({
        _id: l._id,
        tipo: l.status === 'sucesso' ? 'sucesso' : 'erro',
        mensagem: l.mensagem || `Execução finalizada: ${l.totalVerificadas} verificadas`,
        criadoEm: l.dataExecucao
      }))
    };

    // 4. Enviamos tudo com os nomes que o seu FRONTEND espera (em inglês)
    res.json({
      sucesso: true,
      dados: {
        totalUsers,
        totalAlerts,
        alertasPausados,
        alertasComErro,
        users: usuarios,      // O frontend espera 'users'
        alertas: todosAlertas, // O frontend espera 'alertas'
        feedbacks,
        crawlerHealth
      },
    });
  } catch (err) {
    console.error('Erro no Dashboard ADM:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar o painel do administrador.' });
  }
});

// Rota: GET /api/admin/cron-logs
router.get('/cron-logs', autenticar, isAdmin, async (req, res) => {
  try {
    const logs = await LogCron.find({}).sort({ dataExecucao: -1 }).limit(50);
    res.json({ sucesso: true, logs });
  } catch (err) {
    console.error('Erro ao buscar cron logs:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar logs do cron.' });
  }
});

// Rota: GET /api/admin/historico/:alertaId
router.get('/historico/:alertaId', autenticar, isAdmin, async (req, res) => {
  try {
    const mudancas = await Mudanca.find({ alertaId: req.params.alertaId })
      .sort({ detectadaEm: -1 })
      .limit(100);
    res.json({ sucesso: true, mudancas });
  } catch (err) {
    console.error('Erro ao buscar histórico:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar histórico de mudanças.' });
  }
});

module.exports = router;