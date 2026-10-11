const mongoose = require('mongoose');

// Pasta compartilhável: um conjunto de páginas monitoradas ("Concurso TJ-RJ")
// que pode virar um link público para outras pessoas copiarem.
const pastaSchema = new mongoose.Schema({
  usuario:   { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nome:      { type: String, required: true, maxlength: 80 },
  descricao: { type: String, default: '', maxlength: 300 },
  alertas:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alerta' }],
  // Link público: só existe enquanto a pasta estiver compartilhada
  token:     { type: String },
  copias:    { type: Number, default: 0 },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

pastaSchema.index({ token: 1 }, { unique: true, partialFilterExpression: { token: { $type: 'string' } } });

module.exports = mongoose.models.Pasta || mongoose.model('Pasta', pastaSchema);
