const mongoose = require('mongoose');

// Checklist da administração: o que o sistema não conseguiu resolver sozinho.
// Tarefas automáticas têm "chave" (ex.: "alerta:<id>") para não duplicar:
// se o mesmo problema volta enquanto a tarefa está aberta, só conta mais uma ocorrência.
const tarefaAdminSchema = new mongoose.Schema({
  chave:      { type: String, default: null },
  tipo:       { type: String, enum: ['alerta-pausado', 'fonte-radar', 'ia', 'pagamento', 'modelo', 'configuracao', 'manual'], required: true },
  prioridade: { type: String, enum: ['alta', 'normal'], default: 'normal' },
  titulo:     { type: String, required: true, maxlength: 200 },
  descricao:  { type: String, default: '', maxlength: 2000 },
  link:       { type: String, default: null }, // onde conferir manualmente
  alerta:     { type: mongoose.Schema.Types.ObjectId, ref: 'Alerta', default: null },
  usuario:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  status:     { type: String, enum: ['aberta', 'concluida'], default: 'aberta' },
  ocorrencias:        { type: Number, default: 1 },
  ultimaOcorrenciaEm: { type: Date, default: Date.now },
  concluidaEm:  { type: Date, default: null },
  concluidaPor: { type: String, default: null }, // e-mail da admin ou "sistema"
  nota:         { type: String, default: null, maxlength: 1000 },
}, { timestamps: { createdAt: 'criadaEm', updatedAt: 'atualizadaEm' } });

// No máximo uma tarefa aberta por chave
tarefaAdminSchema.index({ chave: 1 }, { unique: true, partialFilterExpression: { status: 'aberta', chave: { $type: 'string' } } });
tarefaAdminSchema.index({ status: 1, prioridade: 1, ultimaOcorrenciaEm: -1 });

module.exports = mongoose.models.TarefaAdmin || mongoose.model('TarefaAdmin', tarefaAdminSchema);
