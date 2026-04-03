const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha:    { type: String, required: true, minlength: 8 },
  plano:    { type: String, enum: ['gratuito', 'premium'], default: 'gratuito' },
  role:     { type: String, default: 'user', enum: ['user', 'admin'] }, // <-- ADICIONE APENAS ESTA LINHA
  criadoEm: { type: Date, default: Date.now },
});

// Hash da senha antes de salvar
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 12);
  next();
});

// Método para comparar senha no login
usuarioSchema.methods.verificarSenha = async function (senhaTexto) {
  return bcrypt.compare(senhaTexto, this.senha);
};

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);