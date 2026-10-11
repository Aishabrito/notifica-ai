const express   = require('express');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const { autenticar, isAdmin } = require('../middleware/authMiddleware');
const Prazo = require('../models/Prazo');
const {
  EventoCalendario, LembreteCalendario, proximosEventos, eventoParaApi, validarEvento, lembrarEvento, aoAlterarEvento,
} = require('../service/calendario');

// 📅 Calendário público (ENEM, SISU, concursos) + "Me avise"
const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const naoEncontrado = (res) => res.status(404).json({ sucesso: false, mensagem: 'Data não encontrada.' });

router.get('/', limiter, async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ sucesso: true, eventos: await proximosEventos() });
});

// Quais datas a pessoa já pediu para lembrar
router.get('/meus', limiter, autenticar, async (req, res) => {
  const lista = await LembreteCalendario.find({ usuario: req.usuario._id }).select('evento');
  res.json({ sucesso: true, eventos: lista.map((l) => String(l.evento)) });
});

router.post('/:id/lembrar', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  const evento = await EventoCalendario.findOne({ _id: req.params.id, publicado: true });
  if (!evento) return naoEncontrado(res);
  await lembrarEvento(req.usuario._id, evento);
  res.json({ sucesso: true });
});

router.delete('/:id/lembrar', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  await LembreteCalendario.deleteOne({ usuario: req.usuario._id, evento: req.params.id });
  await Prazo.deleteOne({ usuario: req.usuario._id, chave: `calendario:${req.params.id}` });
  res.json({ sucesso: true });
});

// ─── Admin: a equipe mantém as datas ───────────────
router.get('/admin', autenticar, isAdmin, async (_req, res) => {
  const lista = await EventoCalendario.find({}).sort({ data: 1 });
  const contagem = await LembreteCalendario.aggregate([{ $group: { _id: '$evento', n: { $sum: 1 } } }]);
  const porEvento = new Map(contagem.map((c) => [String(c._id), c.n]));
  res.json({ sucesso: true, eventos: lista.map((e) => ({ ...eventoParaApi(e), publicado: e.publicado, interessados: porEvento.get(String(e._id)) ?? 0 })) });
});

router.post('/admin', autenticar, isAdmin, async (req, res) => {
  const v = validarEvento(req.body ?? {});
  if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
  const e = await EventoCalendario.create(v.valor);
  res.status(201).json({ sucesso: true, evento: eventoParaApi(e) });
});

router.patch('/admin/:id', autenticar, isAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return naoEncontrado(res);
  const e = await EventoCalendario.findById(req.params.id);
  if (!e) return naoEncontrado(res);
  const v = validarEvento(req.body ?? {}, e.toObject());
  if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
  const mudouData = v.valor.data !== e.data || v.valor.previsao !== e.previsao;
  Object.assign(e, v.valor);
  await e.save();
  await aoAlterarEvento(e, mudouData);
  res.json({ sucesso: true, evento: eventoParaApi(e) });
});

module.exports = router;
