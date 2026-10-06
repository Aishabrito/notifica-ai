const mongoose = require('mongoose');

const alertaSchema = new mongoose.Schema({
  url:               { type: String, required: true },
  email:             { type: String, required: true },
  titulo:            { type: String },
  seletorCss:        { type: String, default: null },
  hashConteudo:      { type: String },
  usuario:           { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  status:            { type: String, enum: ['ativo', 'pausado', 'inativo'], default: 'ativo' },
  // Por que o alerta foi pausado: 'falhas' (crawler), 'plano' (downgrade) ou 'admin'
  motivoPausa:       { type: String, enum: ['falhas', 'plano', 'admin', null], default: null },
  falhasSeguidas:    { type: Number, default: 0 },
  ultimoErro:        { type: String, default: null },
  ultimaVerificacao: { type: Date, default: null },
  ultimaNotificacao: { type: Date, default: null },
  // Frequência de checagem em horas (Free: 24 · Pro: 6, 1 ou 0.25 = 15min)
  intervaloHoras:     { type: Number, default: 24 },
  proximaVerificacao: { type: Date, default: Date.now },
  // Reserva do crawler: enquanto travadoAte > agora, só a instância que
  // reservou o alerta pode verificá-lo (ver service/agendador.js)
  travadoAte:         { type: Date, default: null },
  travaId:            { type: String, default: null },
  // Última versão do texto monitorado e links de PDF da página, usados para
  // descobrir O QUE mudou (resumo com IA). select:false: nunca vão para a API.
  ultimoConteudo:     { type: String, default: null, select: false },
  linksPdf:           { type: [String], default: undefined, select: false },
  tipoConteudo:       { type: String, enum: ['html', 'pdf', null], default: null },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

// Consulta do cron: alertas ativos com checagem vencida
alertaSchema.index({ status: 1, proximaVerificacao: 1 });
// Contagem de alertas por usuário (limite do plano)
alertaSchema.index({ usuario: 1, status: 1 });

module.exports = mongoose.models.Alerta || mongoose.model('Alerta', alertaSchema);