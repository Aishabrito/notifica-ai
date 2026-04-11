const mongoose = require('mongoose');

const logCronSchema = new mongoose.Schema({
  sucesso:            { type: Boolean, default: true },
  erroGlobal:         { type: String, default: null },
  alertasVerificados: { type: Number, default: 0 },
  mudancasDetectadas: { type: Number, default: 0 },
  falhas:             { type: Number, default: 0 },
  dataExecucao:       { type: Date, default: Date.now },
  iniciadoEm:         { type: Date, default: Date.now },
  finalizadoEm:       { type: Date, default: null },
  tempoDuracao:       { type: Number, default: 0 }, // duração em milissegundos
});

module.exports = mongoose.models.LogCron || mongoose.model('LogCron', logCronSchema);
