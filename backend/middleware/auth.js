const jwt     = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const autenticar = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token)
      return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-senha');
    if (!usuario)
      return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });

    req.usuario = usuario;
    next();
  } catch {
    res.status(401).json({ sucesso: false, mensagem: 'Token inválido ou expirado.' });
  }
};

module.exports = { autenticar };