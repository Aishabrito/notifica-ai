// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario'); 

// O seu middleware original (intacto!)
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

// O novo segurança: Verifica se a role é 'admin'
const isAdmin = async (req, res, next) => {
  try {
    // Como o 'autenticar' roda antes, nós já temos o req.usuario pronto aqui!
    if (req.usuario && req.usuario.role === 'admin') {
      next(); // Pode passar, é a chefe!
    } else {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso bloqueado. Área exclusiva para Administradores.' });
    }
  } catch (err) {
    console.error('Erro no middleware isAdmin:', err.message);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao verificar permissões.' });
  }
};

module.exports = { autenticar, isAdmin };