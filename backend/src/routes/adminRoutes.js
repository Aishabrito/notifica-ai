// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const Usuario = require('../models/Usuario'); 
const Alerta = require('../models/Alerta');   
const Feedback = require('../models/Feedback'); 

// Trocamos o verifyToken pelo seu autenticar!
const { autenticar, isAdmin } = require('../middleware/authMiddleware');

// Importando os Middlewares
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Rota: GET /api/admin/dashboard
router.get('/dashboard', verifyToken, isAdmin, async (req, res) => {
  try {
    // Busca todas as métricas ao mesmo tempo para ser mais rápido
    const [totalUsers, totalAlerts, feedbacks] = await Promise.all([
      Usuario.countDocuments({}),
      Alerta.countDocuments({ status: 'ativo' }),
      Feedback.find({}).sort({ criadoEm: -1 })
    ]);

    res.json({
      sucesso: true,
      dados: {
        totalUsers,
        totalAlerts,
        feedbacks
      }
    });
  } catch (err) {
    console.error('Erro no Dashboard ADM:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar o painel do administrador.' });
  }
});

module.exports = router;