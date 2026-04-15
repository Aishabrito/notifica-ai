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
    const [usuariosRaw, alertasRaw, alertasPausados, alertasComErro, feedbacks, logsRecentes] = await Promise.all([
      Usuario.find({}).select('-senha -codigoReset -codigoResetExpira').sort({ criadoEm: -1 }).lean(),
      Alerta.find({}).sort({ criadoEm: -1 }).lean(),
      Alerta.countDocuments({ status: 'pausado' }),
      Alerta.countDocuments({ falhasSeguidas: { $gt: 0 }, status: { $ne: 'pausado' } }),
      Feedback.find({}).sort({ criadoEm: -1 }).lean(),
      LogCron.find({}).sort({ dataExecucao: -1 }).limit(10).lean()
    ]);

    // Conta quantos alertas cada usuário tem
    const contagemPorUsuario = {};
    for (const a of alertasRaw) {
      const uid = String(a.usuario);
      contagemPorUsuario[uid] = (contagemPorUsuario[uid] ?? 0) + 1;
    }

    // Força String() nos ObjectIds para garantir serialização JSON correta
    const users = usuariosRaw.map((u) => ({
      _id:      String(u._id),
      email:    u.email,
      role:     u.role,
      criadoEm: u.criadoEm,
      alertas:  contagemPorUsuario[String(u._id)] ?? 0,
    }));

    // Mapeia campo `usuario` (ObjectId) → `userId` esperado pelo frontend
    const alertas = alertasRaw.map((a) => ({
      _id:               String(a._id),
      userId:            String(a.usuario),
      email:             a.email,
      url:               a.url,
      status:            a.status,
      criadoEm:          a.criadoEm ?? a.createdAt,
      ultimaVerificacao: a.ultimaVerificacao,
    }));

    // Monta o objeto crawlerHealth com os campos corretos do modelo LogCron
    const ultimoLog = logsRecentes[0];
    const crawlerHealth = {
      status: ultimoLog?.sucesso === false ? 'degradado' : 'operacional',
      ultimaExecucao: ultimoLog?.dataExecucao || new Date(),
      proximaExecucao: new Date(Date.now() + 60 * 60 * 1000),
      totalVerificacoesHoje: ultimoLog?.alertasVerificados || 0,
      mudancasDetectadasHoje: ultimoLog?.mudancasDetectadas || 0,
      emailsEnviadosHoje: 0, // não rastreado no LogCron — campo reservado para futura implementação
      taxaSucessoEmail: 100,
      logs: logsRecentes.map(l => ({
        _id: String(l._id),
        tipo: l.sucesso ? 'sucesso' : 'erro',
        mensagem: l.erroGlobal || `Execução: ${l.alertasVerificados} verificados, ${l.mudancasDetectadas} mudanças`,
        criadoEm: l.dataExecucao
      }))
    };

    res.json({
      sucesso: true,
      dados: {
        totalUsers:      usuariosRaw.length,
        totalAlerts:     alertasRaw.filter((a) => a.status === 'ativo').length,
        alertasPausados,
        alertasComErro,
        feedbacks,
        users,
        alertas,
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