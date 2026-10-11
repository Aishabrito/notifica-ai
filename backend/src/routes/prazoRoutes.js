const crypto    = require('crypto');
const express   = require('express');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const Prazo   = require('../models/Prazo');
const Usuario = require('../models/Usuario');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const { gerarFeedIcs, momentoLimite } = require('../utils/ics');
const { tokenFeitoValido, ROTULOS } = require('../service/prazos');
const { escaparHtml } = require('../utils/html');
const { pagina } = require('../utils/paginaSimples');

// ============================================
// ⏰ PRAZOS (Pro): lista, checklist, agenda assinável
// ============================================
const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas requisições. Tente novamente em breve.' },
});

const TIPOS = Object.keys(ROTULOS);
const MAX_PRAZOS = 300;

function exigirPro(req, res, next) {
  if (obterTipoPlanoEfetivo(req.usuario) !== 'pro') {
    return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: 'Prazos e Código Vermelho são do plano Pro.' });
  }
  next();
}

const linkAgenda = (token) => (token ? `${process.env.BASE_URL}/agenda/${token}.ics` : null);

function prazoParaApi(p) {
  return {
    id: String(p._id), titulo: p.titulo, contexto: p.contexto, url: p.url, data: p.data, hora: p.hora,
    tipo: p.tipo, origem: p.origem, concluido: Boolean(p.concluidoEm), concluidoEm: p.concluidoEm,
    limite: momentoLimite(p), alertaId: p.alerta ? String(p.alerta) : null,
    checklist: p.checklist.map((c) => ({ id: String(c._id), item: c.item, feito: c.feito })),
  };
}

function validarData(data, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? '')) || Number.isNaN(Date.parse(data))) return 'Data inválida.';
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return 'Hora inválida (use HH:MM).';
  return null;
}

async function carregarPrazo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ sucesso: false, mensagem: 'Prazo não encontrado.' }); return null; }
  const prazo = await Prazo.findOne({ _id: req.params.id, usuario: req.usuario._id });
  if (!prazo) { res.status(404).json({ sucesso: false, mensagem: 'Prazo não encontrado.' }); return null; }
  return prazo;
}

// Lista: abertos (do mais próximo ao mais distante) + concluídos recentes
router.get('/', limiter, autenticar, async (req, res) => {
  try {
    const ehPro = obterTipoPlanoEfetivo(req.usuario) === 'pro';
    const ontem = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [abertos, concluidos] = await Promise.all([
      Prazo.find({ usuario: req.usuario._id, concluidoEm: null, data: { $gte: ontem } }).sort({ data: 1, hora: 1 }).limit(200),
      Prazo.find({ usuario: req.usuario._id, concluidoEm: { $ne: null } }).sort({ concluidoEm: -1 }).limit(30),
    ]);
    res.json({
      sucesso: true,
      ehPro,
      agenda: ehPro ? linkAgenda(req.usuario.agendaToken) : null,
      prazos: abertos.map(prazoParaApi),
      concluidos: concluidos.map(prazoParaApi),
    });
  } catch (err) {
    console.error('[Prazos] Erro ao listar:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar os prazos.' });
  }
});

// Criar à mão (ex.: "pagar a taxa de inscrição")
router.post('/', limiter, autenticar, exigirPro, async (req, res) => {
  const titulo = String(req.body?.titulo ?? '').trim();
  const { data, hora } = req.body ?? {};
  if (titulo.length < 3) return res.status(400).json({ sucesso: false, mensagem: 'Descreva o prazo.' });
  const erro = validarData(data, hora);
  if (erro) return res.status(400).json({ sucesso: false, mensagem: erro });
  if (await Prazo.countDocuments({ usuario: req.usuario._id }) >= MAX_PRAZOS) {
    return res.status(400).json({ sucesso: false, mensagem: 'Limite de prazos atingido. Apague alguns antigos.' });
  }
  const prazo = await Prazo.create({
    usuario: req.usuario._id, titulo: titulo.slice(0, 160), data, hora: hora || null,
    tipo: TIPOS.includes(req.body?.tipo) ? req.body.tipo : 'outro', origem: 'manual',
  });
  res.status(201).json({ sucesso: true, prazo: prazoParaApi(prazo) });
});

// Editar: concluir/reabrir, mudar data, marcar itens do checklist
router.patch('/:id', limiter, autenticar, async (req, res) => {
  try {
    const prazo = await carregarPrazo(req, res);
    if (!prazo) return;
    const b = req.body ?? {};
    if (typeof b.concluido === 'boolean') prazo.concluidoEm = b.concluido ? new Date() : null;
    if (b.titulo !== undefined) {
      const t = String(b.titulo).trim();
      if (t.length < 3) return res.status(400).json({ sucesso: false, mensagem: 'Descreva o prazo.' });
      prazo.titulo = t.slice(0, 160);
    }
    if (b.data !== undefined || b.hora !== undefined) {
      const data = b.data ?? prazo.data;
      const hora = b.hora === undefined ? prazo.hora : (b.hora || null);
      const erro = validarData(data, hora);
      if (erro) return res.status(400).json({ sucesso: false, mensagem: erro });
      if (data !== prazo.data || hora !== prazo.hora) prazo.lembretes = []; // nova data: lembretes de novo
      prazo.data = data; prazo.hora = hora;
    }
    if (b.checklistItem) {
      const item = prazo.checklist.id(b.checklistItem.id);
      if (!item) return res.status(404).json({ sucesso: false, mensagem: 'Item não encontrado.' });
      if (typeof b.checklistItem.feito === 'boolean') item.feito = b.checklistItem.feito;
      if (b.checklistItem.remover) item.deleteOne();
    }
    if (b.novoItem) {
      const item = String(b.novoItem).trim().slice(0, 160);
      if (item && prazo.checklist.length < 40) prazo.checklist.push({ item, feito: false });
    }
    await prazo.save();
    res.json({ sucesso: true, prazo: prazoParaApi(prazo) });
  } catch (err) {
    console.error('[Prazos] Erro ao editar:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar.' });
  }
});

router.delete('/:id', limiter, autenticar, async (req, res) => {
  const prazo = await carregarPrazo(req, res);
  if (!prazo) return;
  await prazo.deleteOne();
  res.json({ sucesso: true });
});

// Gera (ou troca) o link da agenda; trocar invalida o link antigo
router.post('/agenda', limiter, autenticar, exigirPro, async (req, res) => {
  const token = crypto.randomBytes(24).toString('base64url');
  await Usuario.updateOne({ _id: req.usuario._id }, { $set: { agendaToken: token } });
  res.json({ sucesso: true, agenda: linkAgenda(token) });
});

router.delete('/agenda', limiter, autenticar, async (req, res) => {
  await Usuario.updateOne({ _id: req.usuario._id }, { $unset: { agendaToken: 1 } });
  res.json({ sucesso: true });
});

// ─── Público: feed .ics (o link é a senha) ─────────
const agendaPublicaRouter = express.Router();
const limiterAgenda = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

agendaPublicaRouter.get('/:token.ics', limiterAgenda, async (req, res) => {
  try {
    const token = String(req.params.token);
    const usuario = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await Usuario.findOne({ agendaToken: token }).select('plano nome') : null;
    if (!usuario) return res.status(404).type('text/plain').send('Agenda não encontrada. Gere um link novo em Prazos.');

    // Fora do Pro, a agenda continua válida mas fica vazia
    const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const prazos = obterTipoPlanoEfetivo(usuario) === 'pro'
      ? await Prazo.find({ usuario: usuario._id, data: { $gte: desde } }).sort({ data: 1 }).limit(500).lean()
      : [];
    res.set('Cache-Control', 'private, max-age=900');
    res.type('text/calendar; charset=utf-8').send(gerarFeedIcs(prazos, { baseUrl: process.env.FRONTEND_URL || '' }));
  } catch (err) {
    console.error('[Agenda] Erro no feed:', err.message);
    res.status(500).type('text/plain').send('Erro ao gerar a agenda.');
  }
});

// ─── Público: "já fiz" pelo link do e-mail ─────────
// O GET só confirma (leitores de e-mail abrem links sozinhos); o POST conclui.
const prazoFeitoRouter = express.Router();

async function prazoDoLink(req, res) {
  const { id, token } = req.params;
  if (!mongoose.isValidObjectId(id) || !tokenFeitoValido(id, token)) {
    res.status(400).send(pagina('Link inválido', '<h1>Link inválido</h1><p>Este link não é válido.</p>'));
    return null;
  }
  const prazo = await Prazo.findById(id);
  if (!prazo) {
    res.send(pagina('Prazo removido', '<h1>Prazo removido</h1><p>Este prazo não existe mais.</p>'));
    return null;
  }
  return prazo;
}

prazoFeitoRouter.get('/:id/:token', async (req, res) => {
  const prazo = await prazoDoLink(req, res);
  if (!prazo) return;
  if (prazo.concluidoEm) return res.send(pagina('Já concluído', `<h1>✅ Já está marcado como feito</h1><p>${escaparHtml(prazo.titulo)}</p>`));
  res.send(pagina('Marcar como feito', `
    <h1>Já fez?</h1>
    <p><strong>${escaparHtml(prazo.titulo)}</strong></p>
    <p>Marcando como feito, os lembretes do Código Vermelho param.</p>
    <form method="POST"><button type="submit" style="background:#10b981;color:#000">✅ Sim, já fiz</button></form>`));
});

prazoFeitoRouter.post('/:id/:token', async (req, res) => {
  const prazo = await prazoDoLink(req, res);
  if (!prazo) return;
  if (!prazo.concluidoEm) { prazo.concluidoEm = new Date(); await prazo.save(); }
  res.send(pagina('Feito!', `<h1>✅ Feito!</h1><p>${escaparHtml(prazo.titulo)}</p><p>Os lembretes deste prazo pararam. Boa sorte! 🍀</p>`));
});

module.exports = { prazoRouter: router, agendaPublicaRouter, prazoFeitoRouter };
