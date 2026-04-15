const mongoose = require('mongoose');

const alertaSchema = new mongoose.Schema({
  url:               { type: String, required: true },
  email:             { type: String, required: true },
  titulo:            { type: String },
  seletorCss:        { type: String, default: null },
  hashConteudo:      { type: String },
  usuario:           { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  status:            { type: String, enum: ['ativo', 'pausado', 'inativo'], default: 'ativo' },
  falhasSeguidas:    { type: Number, default: 0 },
  ultimoErro:        { type: String, default: null },
  ultimaVerificacao: { type: Date, default: null },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

module.exports = mongoose.models.Alerta || mongoose.model('Alerta', alertaSchema);