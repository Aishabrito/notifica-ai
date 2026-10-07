const mongoose = require('mongoose');

// Uma publicação em diário oficial onde o nome monitorado apareceu.
const ocorrenciaRadarSchema = new mongoose.Schema({
  monitor:        { type: mongoose.Schema.Types.ObjectId, ref: 'MonitorRadar', required: true },
  usuario:        { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  chave:          { type: String, required: true }, // evita avisar 2x da mesma publicação
  driver:         { type: String, required: true },
  cidadeId:       { type: String, required: true },
  dataPublicacao: { type: String, required: true }, // AAAA-MM-DD
  url:            { type: String, required: true },
  edicao:         { type: String, default: null },
  trechosCifrados: { type: String, default: null }, // JSON cifrado: o trecho cita o nome
  confirmacao:    { type: String, enum: ['nome', 'nome+documento', 'inscricao'], default: 'nome' },
  notificadoEm:   { type: Date, default: null },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: false } });

ocorrenciaRadarSchema.index({ monitor: 1, chave: 1 }, { unique: true });

module.exports = mongoose.models.OcorrenciaRadar || mongoose.model('OcorrenciaRadar', ocorrenciaRadarSchema);
