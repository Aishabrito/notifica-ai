const express   = require('express');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const Prazo = require('../models/Prazo');
const { Concurso, concursoParaApi, sincronizarPrazoValidade } = require('../service/nomeacao');

// 🏛️ Concursos em que a pessoa foi aprovada: contagem da validade
const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const MAX = 10;

function validar(b, atual = {}) {
  const nome = String(b.nome ?? atual.nome ?? '').trim();
  const homologadoEm = String(b.homologadoEm ?? atual.homologadoEm ?? '');
  const validadeAnos = Number(b.validadeAnos ?? atual.validadeAnos ?? 2);
  const classificacao = b.classificacao === undefined ? (atual.classificacao ?? null) : (b.classificacao ? Number(b.classificacao) : null);
  if (nome.length < 3 || nome.length > 120) return { erro: 'Escreva o nome do concurso (ex.: TJ-RJ 2025 — Analista).' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(homologadoEm) || Number.isNaN(Date.parse(homologadoEm)) || homologadoEm > new Date().toISOString().slice(0, 10)) {
    return { erro: 'Informe a data da homologação do resultado (não pode ser no futuro).' };
  }
  if (![1, 2].includes(validadeAnos)) return { erro: 'A validade é de 1 ou 2 anos (veja no edital).' };
  if (classificacao !== null && (!Number.isInteger(classificacao) || classificacao < 1 || classificacao > 99999)) return { erro: 'Classificação inválida.' };
  return { nome, homologadoEm, validadeAnos, classificacao, prorrogado: typeof b.prorrogado === 'boolean' ? b.prorrogado : Boolean(atual.prorrogado) };
}

router.get('/', limiter, autenticar, async (req, res) => {
  const lista = await Concurso.find({ usuario: req.usuario._id }).sort({ criadoEm: 1 });
  res.json({ sucesso: true, concursos: lista.map(concursoParaApi) });
});

router.post('/', limiter, autenticar, async (req, res) => {
  const v = validar(req.body ?? {});
  if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
  if (await Concurso.countDocuments({ usuario: req.usuario._id }) >= MAX) return res.status(400).json({ sucesso: false, mensagem: `Limite de ${MAX} concursos.` });
  const c = await Concurso.create({ usuario: req.usuario._id, ...v });
  await sincronizarPrazoValidade(c);
  res.status(201).json({ sucesso: true, concurso: concursoParaApi(c) });
});

router.patch('/:id', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
  const c = await Concurso.findOne({ _id: req.params.id, usuario: req.usuario._id });
  if (!c) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
  const v = validar(req.body ?? {}, c.toObject());
  if (v.erro) return res.status(400).json({ sucesso: false, mensagem: v.erro });
  const mudouFim = v.prorrogado !== c.prorrogado || v.homologadoEm !== c.homologadoEm || v.validadeAnos !== c.validadeAnos;
  Object.assign(c, v);
  if (mudouFim) c.lembretes = []; // nova data final: lembretes de novo
  await c.save();
  await sincronizarPrazoValidade(c);
  res.json({ sucesso: true, concurso: concursoParaApi(c) });
});

router.delete('/:id', limiter, autenticar, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
  const c = await Concurso.findOneAndDelete({ _id: req.params.id, usuario: req.usuario._id });
  if (!c) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
  await Prazo.deleteOne({ usuario: req.usuario._id, chave: `validade:${c._id}` });
  res.json({ sucesso: true });
});

module.exports = router;
