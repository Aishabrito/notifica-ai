const mongoose = require('mongoose');

// Auditoria: cada consulta feita a uma fonte oficial em nome de um usuário.
// Não guarda o nome buscado. Expira sozinho depois de 180 dias.
const logRadarSchema = new mongoose.Schema({
  monitor:     { type: mongoose.Schema.Types.ObjectId, ref: 'MonitorRadar', required: true },
  usuario:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  driver:      { type: String, required: true },
  cidades:     { type: [String], default: [] },
  desde:       { type: String, default: null },
  resultados:  { type: Number, default: 0 },
  novas:       { type: Number, default: 0 },
  sucesso:     { type: Boolean, default: true },
  erro:        { type: String, default: null },
  manual:      { type: Boolean, default: false },
  executadoEm: { type: Date, default: Date.now },
});

logRadarSchema.index({ executadoEm: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.models.LogRadar || mongoose.model('LogRadar', logRadarSchema);
