const mongoose = require('mongoose');

const logCronSchema = new mongoose.Schema({
  alertasVerificados: { type: Number, default: 0 },
  alertasComMudanca:  { type: Number, default: 0 },
  alertasComErro:     { type: Number, default: 0 },
  dataExecucao:       { type: Date, default: Date.now },
  tempoDuracao:       { type: Number, default: 0 }, // duração em milissegundos
});

module.exports = mongoose.models.LogCron || mongoose.model('LogCron', logCronSchema);
