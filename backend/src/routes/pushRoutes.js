const express   = require('express');
const rateLimit = require('express-rate-limit');
const { autenticar } = require('../middleware/authMiddleware');
const { PushInscricao, pushConfigurado, enviarPush } = require('../service/push');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Chave pública para o navegador criar a inscrição
router.get('/chave', (_req, res) => {
  res.json({ sucesso: true, disponivel: pushConfigurado(), chave: pushConfigurado() ? process.env.VAPID_PUBLIC_KEY : null });
});

// Body: a PushSubscription do navegador ({ endpoint, keys: { p256dh, auth } })
router.post('/inscrever', limiter, autenticar, async (req, res) => {
  if (!pushConfigurado()) return res.status(503).json({ sucesso: false, mensagem: 'Notificações indisponíveis no momento.' });
  const { endpoint, keys } = req.body ?? {};
  if (!/^https:\/\/\S{10,600}$/.test(String(endpoint ?? '')) || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ sucesso: false, mensagem: 'Inscrição inválida.' });
  }
  // O mesmo aparelho pode trocar de conta: a inscrição passa a ser de quem está logado
  await PushInscricao.updateOne(
    { endpoint },
    { $set: { usuario: req.usuario._id, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, aparelho: String(req.headers['user-agent'] ?? '').slice(0, 200), falhas: 0 } },
    { upsert: true }
  );
  if (await PushInscricao.countDocuments({ usuario: req.usuario._id }) > 10) {
    const antigas = await PushInscricao.find({ usuario: req.usuario._id }).sort({ atualizadoEm: 1 }).limit(1);
    await PushInscricao.deleteMany({ _id: { $in: antigas.map((a) => a._id) } });
  }
  await enviarPush(req.usuario._id, { titulo: '🔔 Notificações ativadas!', corpo: 'Você vai receber os avisos do Notifica.ai aqui na hora.', url: '/dashboard', tag: 'boas-vindas' });
  res.json({ sucesso: true });
});

router.post('/desinscrever', limiter, autenticar, async (req, res) => {
  await PushInscricao.deleteOne({ endpoint: String(req.body?.endpoint ?? ''), usuario: req.usuario._id });
  res.json({ sucesso: true });
});

router.get('/status', limiter, autenticar, async (req, res) => {
  res.json({ sucesso: true, disponivel: pushConfigurado(), aparelhos: await PushInscricao.countDocuments({ usuario: req.usuario._id }) });
});

module.exports = router;
