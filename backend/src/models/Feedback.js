// src/models/Feedback.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  email: { type: String, required: true },
  mensagem: { type: String, required: true },
  lido: { type: Boolean, default: false }, 
  criadoEm: { type: Date, default: Date.now }
});

// Evita o erro de "Cannot overwrite model" no Node
module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);