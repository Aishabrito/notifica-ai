const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha:    { type: String, required: true, minlength: 8 },
  plano: {
    tipo:      { type: String, enum: ['free', 'pro'], default: 'free' },
    status:    { type: String, enum: ['ativo', 'cancelado'], default: 'ativo' },
    validoAte: { type: Date, default: null }, // null = sem expiração
  },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  criadoEm: { type: Date, default: Date.now },

  // Recuperação de senha via código OTP
  codigoReset:        { type: String, default: null },
  codigoResetExpira:  { type: Date,   default: null },
});

// Hash da senha antes de salvar (CORRIGIDO)
usuarioSchema.pre('save', async function () {
  // Se a senha não foi modificada, apenas sai da função (sem chamar nada)
  if (!this.isModified('senha')) return; 
  
  // Encripta a senha e o Mongoose segue a vida automaticamente!
  this.senha = await bcrypt.hash(this.senha, 12);
});

// Método para comparar senha no login
usuarioSchema.methods.verificarSenha = async function (senhaTexto) {
  return bcrypt.compare(senhaTexto, this.senha);
};

// Converte o formato antigo (plano: 'gratuito' | 'premium') para o objeto novo.
// Idempotente: só toca documentos em que plano ainda é string ou não existe.
usuarioSchema.statics.migrarPlanosLegados = async function () {
  const col = this.collection;
  const [premium, gratuito] = await Promise.all([
    col.updateMany(
      { plano: 'premium' },
      { $set: { plano: { tipo: 'pro', status: 'ativo', validoAte: null } } }
    ),
    col.updateMany(
      { $or: [{ plano: { $type: 'string' } }, { plano: { $exists: false } }] },
      { $set: { plano: { tipo: 'free', status: 'ativo', validoAte: null } } }
    ),
  ]);
  return premium.modifiedCount + gratuito.modifiedCount;
};

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);