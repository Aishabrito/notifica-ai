// src/routes/feedbackRoutes.js
const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');

// POST /api/feedbacks — Enviar feedback
router.post('/', async (req, res) => {
  try {
    const { email, mensagem } = req.body;

    if (!email || !mensagem)
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail e mensagem são obrigatórios.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail inválido.' });

    await Feedback.create({ email, mensagem });

    res.status(201).json({ sucesso: true, mensagem: 'Feedback enviado com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao salvar feedback:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar o feedback.' });
  }
});

module.exports = router;
