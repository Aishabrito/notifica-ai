const mongoose = require('mongoose');

// Radar de editais: um cargo/área que a pessoa quer acompanhar
// ("técnico de enfermagem", "analista de TI") e onde procurar.
const interesseEditalSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  termo:   { type: String, required: true, maxlength: 80 },
  cidades: { type: [String], default: [] }, // ids do config/radar (IBGE ou "DOU")
  ativo:   { type: Boolean, default: true },
  ultimaBuscaEm: { type: Date, default: null },
  // janela de busca por fonte (como no Radar de nomes)
  buscasPorFonte: { type: Map, of: Date, default: undefined },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: false } });

const editalEncontradoSchema = new mongoose.Schema({
  interesse: { type: mongoose.Schema.Types.ObjectId, ref: 'InteresseEdital', required: true },
  usuario:   { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  chave:     { type: String, required: true },
  driver:    { type: String, required: true },
  cidadeId:  { type: String, required: true },
  dataPublicacao: { type: String, required: true },
  url:       { type: String, required: true },
  trechos:   { type: [String], default: [] },
  notificadoEm: { type: Date, default: null },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: false } });

editalEncontradoSchema.index({ interesse: 1, chave: 1 }, { unique: true });

module.exports = {
  InteresseEdital: mongoose.models.InteresseEdital || mongoose.model('InteresseEdital', interesseEditalSchema),
  EditalEncontrado: mongoose.models.EditalEncontrado || mongoose.model('EditalEncontrado', editalEncontradoSchema),
};
