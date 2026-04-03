const mongoose = require('mongoose');

const alertaSchema = new mongoose.Schema({
  url:            { type: String, required: true },
  email:          { type: String, required: true },
  titulo:         { type: String },
  hashConteudo:   { type: String },
  status:         { type: String, enum: ['ativo', 'pausado', 'inativo'], default: 'ativo' },
  criadoEm:       { type: Date, default: Date.now },
  falhasSeguidas: { type: Number, default: 0 },
  ultimoErro:     { type: String, default: null },
  usuario:        { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
});

module.exports = mongoose.models.Alerta || mongoose.model('Alerta', alertaSchema);