

const alertaSchema = new mongoose.Schema({

  // ... seus campos existentes (url, email, seletor, etc) ...

  status: {
    type: String,
    enum: ['ativo', 'pausado', 'inativo'],
    default: 'ativo',
  },

  // contador de falhas consecutivas
  falhasSeguidas: {
    type: Number,
    default: 0,
  },

  //registro do último erro (útil para debug)
  ultimoErro: {
    type: String,
    default: null,
  },

});