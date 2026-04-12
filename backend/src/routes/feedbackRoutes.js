// src/routes/feedbackRoutes.js
const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');
const { autenticar, isAdmin } = require('../middleware/authMiddleware');

// POST / — Enviar feedback (público)
router.post('/', async (req, res) => {
  const { email, mensagem } = req.body;

  if (!email || !mensagem)
    return res.status(400).json({ sucesso: false, mensagem: 'E-mail e mensagem são obrigatórios.' });

  try {
    const feedback = await Feedback.create({ email, mensagem });
    res.status(201).json({ sucesso: true, feedback });
  } catch (err) {
    console.error('Erro ao salvar feedback:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar feedback.' });
  }
});

// GET / — Listar todos os feedbacks (admin)
router.get('/', autenticar, isAdmin, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({}).sort({ criadoEm: -1 });
    res.json({ sucesso: true, feedbacks });
  } catch (err) {
    console.error('Erro ao buscar feedbacks:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar feedbacks.' });
  }
});

// PATCH /:id/lido — Marcar feedback como lido (admin)
router.patch('/:id/lido', autenticar, isAdmin, async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { lido: true },
      { new: true }
    );
    if (!feedback)
      return res.status(404).json({ sucesso: false, mensagem: 'Feedback não encontrado.' });

    res.json({ sucesso: true, feedback });
  } catch (err) {
    console.error('Erro ao marcar feedback como lido:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar feedback.' });
  }
});

module.exports = router;
