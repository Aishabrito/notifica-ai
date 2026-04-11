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
    const [totalUsers, totalAlerts, alertasPausados, feedbacks] = await Promise.all([
      Usuario.countDocuments({}),
      Alerta.countDocuments({ status: 'ativo' }),
      Alerta.countDocuments({ status: 'pausado' }),
      Feedback.find({}).sort({ criadoEm: -1 }),
    ]);

    res.json({
      sucesso: true,
      dados: {
        totalUsers,
        totalAlerts,
        alertasPausados,
        feedbacks,
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
    const mudancas = await Mudanca.find({ alerta: req.params.alertaId })
      .sort({ criadoEm: -1 })
      .limit(100);
    res.json({ sucesso: true, mudancas });
  } catch (err) {
    console.error('Erro ao buscar histórico:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar histórico de mudanças.' });
  }
});

module.exports = router;