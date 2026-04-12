const mongoose = require('mongoose');

const logCronSchema = new mongoose.Schema({
  alertasVerificados: { type: Number, default: 0 },
  mudancasDetectadas: { type: Number, default: 0 },
  alertasComErro:     { type: Number, default: 0 },
  dataExecucao:       { type: Date, default: Date.now },
  tempoDuracao:       { type: Number, default: 0 }, // duração em milissegundos
  sucesso:            { type: Boolean, default: true },
  erroGlobal:         { type: String, default: null },
  iniciadoEm:         { type: Date, default: Date.now },
  finalizadoEm:       { type: Date, default: null },
});

module.exports = mongoose.models.LogCron || mongoose.model('LogCron', logCronSchema);
