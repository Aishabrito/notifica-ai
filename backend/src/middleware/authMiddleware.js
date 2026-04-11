const jwt = require('jsonwebtoken');
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

    req.usuario = usuario; // disponível em req.usuario nas rotas protegidas
    next();
  } catch {
    res.status(401).json({ sucesso: false, mensagem: 'Token inválido ou expirado.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso restrito a administradores.' });
  }
  next();
};

module.exports = { autenticar, isAdmin };