const mongoose = require('mongoose');

// Um nome (e dados opcionais) que o usuário pediu para procurarmos nos
// diários oficiais. Tudo que identifica a pessoa fica cifrado (utils/cripto).
const monitorRadarSchema = new mongoose.Schema({
  usuario:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nomeCifrado:      { type: String, required: true },
  inscricaoCifrada: { type: String, default: null },
  // Só os 6 dígitos do meio do CPF — é o que os diários publicam (***.456.789-**)
  cpfMeioCifrado:   { type: String, default: null },
  cidades:          { type: [String], required: true },
  ativo:            { type: Boolean, default: true },
  motivoPausa:      { type: String, enum: ['plano', null], default: null },
  ultimaBuscaEm:    { type: Date, default: null },
  // Última busca bem-sucedida em cada fonte (ex.: 'querido-diario', 'dou'):
  // se uma fonte cair, as outras continuam avançando normalmente
  buscasPorFonte:   { type: Map, of: Date, default: undefined },
  consentimento: {
    aceitoEm: { type: Date, required: true },
    versao:   { type: String, required: true },
  },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

module.exports = mongoose.models.MonitorRadar || mongoose.model('MonitorRadar', monitorRadarSchema);
