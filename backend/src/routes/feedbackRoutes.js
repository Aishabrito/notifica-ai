// src/routes/feedbackRoutes.js
const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');

// POST /api/feedbacks
router.post('/', async (req, res) => {
  try {
    const { email, mensagem } = req.body;

    if (!email || !mensagem)
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos.' });

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido)
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });

    await Feedback.create({ email, mensagem });
    res.json({ sucesso: true, mensagem: 'Feedback enviado!' });
  } catch (err) {
    console.error('❌ Erro ao salvar feedback:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar feedback.' });
  }
});

module.exports = router;
