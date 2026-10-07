const express = require('express');
const Alerta  = require('../models/alertaModel');
const { autenticar } = require('../middleware/authMiddleware');
const { obterTipoPlanoEfetivo, obterRegrasPlano } = require('../config/planos');
const { telegramConfigurado } = require('../service/telegram');

const router = express.Router();

// ─── STATUS DO PLANO + USO (para a UI) ─────────────
router.get('/', autenticar, async (req, res) => {
  try {
    const usuario = req.usuario;
    const regras  = obterRegrasPlano(usuario);

    const [alertasAtivos, alertasTotal] = await Promise.all([
      Alerta.countDocuments({ usuario: usuario._id, status: 'ativo' }),
      Alerta.countDocuments({ usuario: usuario._id }),
    ]);

    res.json({
      sucesso: true,
      plano: {
        tipo:      usuario.plano?.tipo ?? 'free',
        status:    usuario.plano?.status ?? 'ativo',
        validoAte: usuario.plano?.validoAte ?? null,
        efetivo:   obterTipoPlanoEfetivo(usuario),
        nome:      regras.nome,
        origem:    usuario.plano?.origem ?? null, // mercadopago (cartão) | pix | cortesia | teste
        assinaturaId: usuario.plano?.origem === 'mercadopago' ? usuario.plano.mpAssinaturaId : null,
      },
      uso: {
        alertasAtivos,
        alertasTotal,
        limiteAlertas: regras.maxAlertasAtivos, // null = ilimitado
      },
      testeGratis: {
        disponivel: !usuario.testeGratisUsadoEm && obterTipoPlanoEfetivo(usuario) === 'free',
        dias: Math.min(30, Math.max(1, Number(process.env.TESTE_GRATIS_DIAS || 7))),
        exigeEmailVerificado: !usuario.emailVerificado,
      },
      canais: {
        telegram: { disponivel: telegramConfigurado(), conectado: Boolean(usuario.telegram?.chatId) },
      },
      recursos: {
        intervalosPermitidos: regras.intervalosPermitidos,
        intervaloPadrao:      regras.intervaloPadrao,
      },
    });
  } catch (err) {
    console.error('[Plano] Erro ao buscar plano:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar dados do plano.' });
  }
});

module.exports = router;
