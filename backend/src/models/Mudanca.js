const mongoose = require('mongoose');

const mudancaSchema = new mongoose.Schema({
  alertaId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Alerta', required: true },
  hashAnterior:   { type: String },
  hashNovo:       { type: String },
  emailNotificado: { type: String, required: true, lowercase: true },
  emailEnviado:   { type: Boolean, default: false },
  detectadaEm:    { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'detectadaEm', updatedAt: 'atualizadoEm' } });

module.exports = mongoose.models.Mudanca || mongoose.model('Mudanca', mudancaSchema);
