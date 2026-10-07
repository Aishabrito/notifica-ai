const mongoose = require('mongoose');

const mudancaSchema = new mongoose.Schema({
  alertaId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Alerta', required: true },
  hashAnterior:    { type: String },
  hashNovo:        { type: String },
  emailNotificado: { type: String, required: true, lowercase: true },
  emailEnviado:    { type: Boolean, default: false },
  // Resumo gerado por IA (plano Pro)
  resumo: {
    type: new mongoose.Schema({
      relevante: Boolean,
      titulo:    String,
      resumo:    String,
      datas:     [{ _id: false, data: String, descricao: String }],
    }, { _id: false }),
    default: undefined,
  },
  pdfsNovos:        { type: [String], default: undefined },
}, { timestamps: { createdAt: 'detectadaEm', updatedAt: 'atualizadoEm' } });

// Reaproveitar o resumo quando outra pessoa monitora a mesma página
mudancaSchema.index({ hashAnterior: 1, hashNovo: 1 });

module.exports = mongoose.models.Mudanca || mongoose.model('Mudanca', mudancaSchema);
