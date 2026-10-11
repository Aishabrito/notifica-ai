const mongoose = require('mongoose');

// Cada tentativa de assinatura no cartão ou de pagamento Pix.
// externalReference é único e vai para o Mercado Pago para reconciliação;
// processadoEm garante que um Pix aprovado só estenda o plano uma vez,
// mesmo com notificações repetidas.
const transacaoSchema = new mongoose.Schema({
  tipo:              { type: String, enum: ['assinatura', 'pix'], required: true },
  usuario:           { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  externalReference: { type: String, required: true, unique: true },
  oferta:            { type: String, required: true },
  valor:             { type: Number, required: true },
  dias:              { type: Number, default: null }, // Pix: dias de Pro comprados
  mpId:              { type: String, default: null, index: true },
  status:            { type: String, default: 'criada' },
  processadoEm:      { type: Date, default: null },
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

module.exports = mongoose.models.Transacao || mongoose.model('Transacao', transacaoSchema);
