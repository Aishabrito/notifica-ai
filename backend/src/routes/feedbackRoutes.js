const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/feedbacks — envia um feedback
router.post('/', async (req, res) => {
  try {
    const email    = (req.body.email    || '').trim();
    const mensagem = (req.body.mensagem || '').trim();

    if (!email || !mensagem)
      return res.status(400).json({ sucesso: false, mensagem: 'Email e mensagem são obrigatórios.' });

    if (!EMAIL_REGEX.test(email))
      return res.status(400).json({ sucesso: false, mensagem: 'Email inválido.' });

    const feedback = await Feedback.create({ email, mensagem });
    res.status(201).json({ sucesso: true, feedback });
  } catch (err) {
    console.error('❌ Erro ao salvar feedback:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar o feedback.' });
  }
});

module.exports = router;
