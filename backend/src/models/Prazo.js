const mongoose = require('mongoose');

// Prazo de um candidato: inscrição, prova, recurso, matrícula...
// Vem da IA (datas achadas numa mudança de página) ou é criado à mão.
const prazoSchema = new mongoose.Schema({
  usuario:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  alerta:   { type: mongoose.Schema.Types.ObjectId, ref: 'Alerta', default: null },
  titulo:   { type: String, required: true, maxlength: 160 }, // "Prazo de recurso do gabarito"
  contexto: { type: String, default: null, maxlength: 200 },  // de onde veio (título da página)
  url:      { type: String, default: null },
  data:     { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // dia do prazo
  hora:     { type: String, default: null, match: /^\d{2}:\d{2}$/ },       // hora limite (opcional)
  tipo:     { type: String, enum: ['inscricao', 'prova', 'recurso', 'resultado', 'matricula', 'documentos', 'outro'], default: 'outro' },
  origem:   { type: String, enum: ['ia', 'manual'], default: 'manual' },
  // Evita duplicar o mesmo prazo quando a página muda de novo
  chave:    { type: String, default: null },
  concluidoEm: { type: Date, default: null },
  // Código Vermelho: marcos (em horas) cujo lembrete já foi enviado
  lembretes: { type: [Number], default: [] },
  checklist: [{
    item: { type: String, required: true, maxlength: 160 },
    feito: { type: Boolean, default: false },
  }],
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

prazoSchema.index({ usuario: 1, data: 1 });
prazoSchema.index({ concluidoEm: 1, data: 1 });
prazoSchema.index({ usuario: 1, chave: 1 }, { unique: true, partialFilterExpression: { chave: { $type: 'string' } } });

module.exports = mongoose.models.Prazo || mongoose.model('Prazo', prazoSchema);
