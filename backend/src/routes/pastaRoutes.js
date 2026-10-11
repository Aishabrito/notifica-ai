const crypto    = require('crypto');
const express   = require('express');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const Pasta   = require('../models/Pasta');
const Alerta  = require('../models/alertaModel');
const { obterRegrasPlano } = require('../config/planos');
const { validarUrlPublica } = require('../utils/urlPublica');

// ============================================
// 📁 PASTAS COMPARTILHÁVEIS
// ============================================
const router = express.Router();
const limiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas requisições. Tente novamente em breve.' },
});

const MAX_PASTAS = 20;
const MAX_ITENS = 50;
const linkPublico = (token) => (token ? `${process.env.FRONTEND_URL || 'https://notifica.dev.br'}/p/${token}` : null);

function pastaParaApi(p) {
  return {
    id: String(p._id), nome: p.nome, descricao: p.descricao, copias: p.copias,
    alertas: p.alertas.map((a) => (a?._id ? { id: String(a._id), titulo: a.titulo, url: a.url } : String(a))),
    link: linkPublico(p.token),
  };
}

// Só aceita alertas que são da própria pessoa
async function alertasDoUsuario(usuarioId, ids) {
  const validos = (Array.isArray(ids) ? ids : []).filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_ITENS);
  const encontrados = await Alerta.find({ _id: { $in: validos }, usuario: usuarioId }).select('_id');
  const permitidos = new Set(encontrados.map((a) => String(a._id)));
  return validos.filter((id) => permitidos.has(String(id)));
}

function validarTexto(b) {
  const nome = String(b?.nome ?? '').trim();
  if (nome.length < 2 || nome.length > 80) return { erro: 'Dê um nome para a pasta (até 80 caracteres).' };
  return { nome, descricao: String(b?.descricao ?? '').trim().slice(0, 300) };
}

router.get('/', limiter, autenticar, async (req, res) => {
  const pastas = await Pasta.find({ usuario: req.usuario._id }).sort({ criadoEm: 1 }).populate('alertas', 'titulo url');
  res.json({ sucesso: true, pastas: pastas.map(pastaParaApi) });
});

router.post('/', limiter, autenticar, async (req, res) => {
  const v = validarTexto(req.body);
  if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
  if (await Pasta.countDocuments({ usuario: req.usuario._id }) >= MAX_PASTAS) {
    return res.status(400).json({ sucesso: false, mensagem: `Limite de ${MAX_PASTAS} pastas.` });
  }
  const pasta = await Pasta.create({ usuario: req.usuario._id, nome: v.nome, descricao: v.descricao, alertas: await alertasDoUsuario(req.usuario._id, req.body?.alertas) });
  await pasta.populate('alertas', 'titulo url');
  res.status(201).json({ sucesso: true, pasta: pastaParaApi(pasta) });
});

// Body: { nome?, descricao?, alertas?, compartilhar?: true|false|'novo' }
router.patch('/:id', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Pasta não encontrada.' });
  const pasta = await Pasta.findOne({ _id: req.params.id, usuario: req.usuario._id });
  if (!pasta) return res.status(404).json({ sucesso: false, mensagem: 'Pasta não encontrada.' });
  if (req.body?.nome !== undefined || req.body?.descricao !== undefined) {
    const v = validarTexto({ nome: req.body.nome ?? pasta.nome, descricao: req.body.descricao ?? pasta.descricao });
    if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
    pasta.nome = v.nome; pasta.descricao = v.descricao;
  }
  if (req.body?.alertas !== undefined) pasta.alertas = await alertasDoUsuario(req.usuario._id, req.body.alertas);
  const c = req.body?.compartilhar;
  if (c === true && !pasta.token) pasta.token = crypto.randomBytes(9).toString('base64url');
  if (c === 'novo') pasta.token = crypto.randomBytes(9).toString('base64url'); // revoga o link antigo
  if (c === false) pasta.token = undefined;
  await pasta.save();
  await pasta.populate('alertas', 'titulo url');
  res.json({ sucesso: true, pasta: pastaParaApi(pasta) });
});

router.delete('/:id', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Pasta não encontrada.' });
  const r = await Pasta.deleteOne({ _id: req.params.id, usuario: req.usuario._id });
  if (!r.deletedCount) return res.status(404).json({ sucesso: false, mensagem: 'Pasta não encontrada.' });
  res.json({ sucesso: true, mensagem: 'Pasta apagada (os alertas continuam).' });
});

// ─── Público: ver a pasta pelo link ─────────────────
async function pastaPublica(token) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(token))) return null;
  return Pasta.findOne({ token }).populate('alertas', 'titulo url').populate('usuario', 'nome');
}

router.get('/publica/:token', limiter, async (req, res) => {
  const pasta = await pastaPublica(req.params.token);
  if (!pasta) return res.status(404).json({ sucesso: false, mensagem: 'Esta pasta não existe ou deixou de ser compartilhada.' });
  res.json({
    sucesso: true,
    pasta: {
      nome: pasta.nome,
      descricao: pasta.descricao,
      // Só o primeiro nome de quem criou; nunca e-mail
      autor: String(pasta.usuario?.nome ?? '').split(' ')[0] || null,
      copias: pasta.copias,
      itens: pasta.alertas.filter(Boolean).map((a) => ({ titulo: a.titulo, url: a.url })),
    },
  });
});

// Copiar para a minha conta: cria os alertas que faltam, até o limite do plano.
// A primeira checagem de cada um guarda a versão base (sem alarme falso).
router.post('/publica/:token/copiar', limiter, autenticar, async (req, res) => {
  try {
    const pasta = await pastaPublica(req.params.token);
    if (!pasta) return res.status(404).json({ sucesso: false, mensagem: 'Esta pasta não existe ou deixou de ser compartilhada.' });

    const regras = obterRegrasPlano(req.usuario);
    const meus = await Alerta.find({ usuario: req.usuario._id }).select('url status');
    const jaTenho = new Set(meus.map((a) => a.url));
    let ativos = meus.filter((a) => a.status === 'ativo').length;
    const r = { copiados: 0, jaMonitorados: 0, semEspaco: 0, invalidos: 0 };

    for (const item of pasta.alertas.filter(Boolean)) {
      if (jaTenho.has(item.url)) { r.jaMonitorados += 1; continue; }
      if (regras.maxAlertasAtivos !== null && ativos >= regras.maxAlertasAtivos) { r.semEspaco += 1; continue; }
      const validacao = await validarUrlPublica(item.url);
      if (!validacao.valido) { r.invalidos += 1; continue; }
      await Alerta.create({
        url: item.url, email: req.usuario.email, titulo: item.titulo || item.url, usuario: req.usuario._id,
        intervaloHoras: regras.intervaloPadrao, proximaVerificacao: new Date(),
      });
      jaTenho.add(item.url);
      ativos += 1;
      r.copiados += 1;
    }
    if (r.copiados && String(pasta.usuario?._id) !== String(req.usuario._id)) await Pasta.updateOne({ _id: pasta._id }, { $inc: { copias: 1 } });

    const partes = [];
    if (r.copiados) partes.push(`${r.copiados} página(s) adicionada(s)`);
    if (r.jaMonitorados) partes.push(`${r.jaMonitorados} você já monitorava`);
    if (r.semEspaco) partes.push(`${r.semEspaco} não couberam no seu plano`);
    res.json({ sucesso: true, ...r, mensagem: partes.join(' · ') || 'Nada para copiar.' });
  } catch (err) {
    console.error('[Pastas] Erro ao copiar:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao copiar a pasta.' });
  }
});

module.exports = router;
