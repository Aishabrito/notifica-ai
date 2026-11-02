const mongoose = require('mongoose');

// Reclamações, sugestões, elogios e dúvidas enviadas pelo botão do site
const TIPOS = ['reclamacao', 'sugestao', 'elogio', 'duvida', 'outro'];
const STATUS = ['novo', 'em-andamento', 'resolvido'];

const feedbackSchema = new mongoose.Schema({
  email:    { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
  mensagem: { type: String, required: true, maxlength: 2000 },
  tipo:     { type: String, enum: TIPOS, default: 'outro' },
  status:   { type: String, enum: STATUS, default: 'novo' },
  usuario:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }, // quando enviado logado
  pagina:   { type: String, default: null, maxlength: 200 }, // onde a pessoa estava
  lido:     { type: Boolean, default: false },
  resposta:     { type: String, default: null, maxlength: 4000 },
  respondidoEm: { type: Date, default: null },
  criadoEm: { type: Date, default: Date.now },
});

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
module.exports.TIPOS = TIPOS;
module.exports.STATUS = STATUS;
