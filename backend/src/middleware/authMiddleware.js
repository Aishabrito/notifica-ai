const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const UMA_HORA = 60 * 60 * 1000;

const autenticar = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;
    if (!token)
      return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-senha');
    if (!usuario)
      return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });

    req.usuario = usuario; // disponível em req.usuario nas rotas protegidas
    // "Quem usou" no painel da dona: grava no máximo 1x por hora, sem atrasar a resposta
    if (!usuario.ultimoAcessoEm || Date.now() - usuario.ultimoAcessoEm.getTime() > UMA_HORA) {
      Usuario.updateOne({ _id: usuario._id }, { ultimoAcessoEm: new Date() }).catch(() => {});
    }
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

// Rotas públicas que aproveitam o login quando existe (ex.: feedback)
const identificarSeLogado = async (req, _res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    const token = req.cookies?.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    if (token) req.usuario = await Usuario.findById(jwt.verify(token, process.env.JWT_SECRET).id).select('-senha');
  } catch { /* visitante */ }
  next();
};

module.exports = { autenticar, isAdmin, identificarSeLogado };