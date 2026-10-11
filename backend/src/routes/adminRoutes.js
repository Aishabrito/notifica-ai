const express = require('express');
const router = express.Router();

const Usuario = require('../models/Usuario');
const Alerta  = require('../models/alertaModel');
const Feedback = require('../models/Feedback');
const Mudanca  = require('../models/Mudanca');
const LogCron  = require('../models/LogCron');
const MonitorRadar    = require('../models/MonitorRadar');
const OcorrenciaRadar = require('../models/OcorrenciaRadar');
const Transacao       = require('../models/Transacao');
const { SUBSCRIPTION_OFFERS } = require('../config/ofertas');

const { autenticar, isAdmin } = require('../middleware/authMiddleware');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const { aplicarDowngrade, reativarAlertasPausadosPorPlano } = require('../service/planoService');

// Meia-noite de hoje no horário de Brasília (UTC-3, sem horário de verão desde 2019)
function inicioDoDiaBrasilia() {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new Date(`${ymd}T00:00:00-03:00`);
}

// ============================================================
// 📊 DASHBOARD PRINCIPAL
// ============================================================
router.get('/dashboard', autenticar, isAdmin, async (req, res) => {
  try {
    const hoje = inicioDoDiaBrasilia();
    const [usuariosRaw, alertasRaw, alertasPausados, alertasComErro, feedbacks, logsRecentes, totaisHoje, emailsHoje] = await Promise.all([
      Usuario.find({}).select('-senha -codigoReset -codigoResetExpira').sort({ criadoEm: -1 }).lean(),
      Alerta.find({}).sort({ criadoEm: -1 }).lean(),
      Alerta.countDocuments({ status: 'pausado' }),
      Alerta.countDocuments({ falhasSeguidas: { $gt: 0 }, status: { $ne: 'pausado' } }),
      Feedback.find({}).sort({ criadoEm: -1 }).lean(),
      LogCron.find({}).sort({ dataExecucao: -1 }).limit(10).lean(),
      // O cron roda a cada 5 min: os totais do dia são a soma de todas as rodadas
      LogCron.aggregate([
        { $match: { dataExecucao: { $gte: hoje } } },
        { $group: { _id: null, verificados: { $sum: '$alertasVerificados' }, mudancas: { $sum: '$mudancasDetectadas' } } },
      ]),
      Mudanca.aggregate([
        { $match: { detectadaEm: { $gte: hoje } } },
        { $group: { _id: null, total: { $sum: 1 }, enviados: { $sum: { $cond: ['$emailEnviado', 1, 0] } } } },
      ]),
    ]);

    // 1. Próxima execução: o cron roda a cada 5 minutos
    const CINCO_MIN = 5 * 60 * 1000;
    const proxima = new Date(Math.ceil((Date.now() + 1) / CINCO_MIN) * CINCO_MIN);

    // --- Processamento dos dados para o Front ---
    const contagemPorUsuario = {};
    for (const a of alertasRaw) {
      const uid = String(a.usuario);
      contagemPorUsuario[uid] = (contagemPorUsuario[uid] ?? 0) + 1;
    }

    const users = usuariosRaw.map((u) => ({
      _id:      String(u._id),
      email:    u.email,
      role:     u.role,
      plano:    obterTipoPlanoEfetivo(u),
      planoOrigem:    u.plano?.origem ?? null,
      planoValidoAte: u.plano?.validoAte ?? null,
      criadoEm: u.criadoEm,
      alertas:  contagemPorUsuario[String(u._id)] ?? 0,
    }));

    const alertas = alertasRaw.map((a) => ({
      _id:               String(a._id),
      userId:            String(a.usuario),
      email:             a.email,
      url:               a.url,
      status:            a.status,
      intervaloHoras:    a.intervaloHoras ?? 24,
      proximaVerificacao: a.proximaVerificacao ?? null,
      criadoEm:          a.criadoEm ?? a.createdAt,
      ultimaVerificacao: a.ultimaVerificacao,
    }));

    const ultimoLog = logsRecentes[0];
    const crawlerHealth = {
      status: ultimoLog?.sucesso === false ? 'degradado' : 'operacional',
      ultimaExecucao: ultimoLog?.dataExecucao || new Date(),
      proximaExecucao: proxima,
      totalVerificacoesHoje: totaisHoje[0]?.verificados ?? 0,
      mudancasDetectadasHoje: totaisHoje[0]?.mudancas ?? 0,
      emailsEnviadosHoje: emailsHoje[0]?.enviados ?? 0,
      taxaSucessoEmail: emailsHoje[0]?.total
        ? Math.round((emailsHoje[0].enviados / emailsHoje[0].total) * 100)
        : 100,
      logs: logsRecentes.map(l => ({
        _id: String(l._id),
        tipo: l.sucesso ? 'sucesso' : 'erro',
        mensagem: l.erroGlobal || `Execução: ${l.alertasVerificados} verificados, ${l.mudancasDetectadas} mudanças`,
        criadoEm: l.dataExecucao
      }))
    };

    // Receita: assinantes no cartão × preço mensal + Pix recebido nos últimos 30 dias
    const proPorOrigem = { mercadopago: 0, pix: 0, cortesia: 0, teste: 0 };
    for (const u of usuariosRaw) {
      if (obterTipoPlanoEfetivo(u) !== 'pro') continue;
      const origem = u.plano?.origem;
      if (origem === 'mercadopago' && u.plano?.status !== 'ativo') continue; // cancelada: sem próxima cobrança
      if (origem in proPorOrigem) proPorOrigem[origem] += 1;
    }
    let precoMensal = 0;
    try { precoMensal = SUBSCRIPTION_OFFERS()['pro-mensal'].amount; } catch { /* preço mal configurado */ }
    const pix30d = await Transacao.aggregate([
      { $match: { tipo: 'pix', processadoEm: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: null, total: { $sum: '$valor' }, quantidade: { $sum: 1 } } },
    ]);
    const pagantes = proPorOrigem.mercadopago + proPorOrigem.pix;
    const receita = {
      assinantesCartao: proPorOrigem.mercadopago,
      proPix: proPorOrigem.pix,
      cortesias: proPorOrigem.cortesia,
      emTesteGratis: proPorOrigem.teste,
      mrrCartao: Math.round(proPorOrigem.mercadopago * precoMensal * 100) / 100,
      pixRecebido30d: Math.round((pix30d[0]?.total ?? 0) * 100) / 100,
      conversao: usuariosRaw.length ? Math.round((pagantes / usuariosRaw.length) * 1000) / 10 : 0,
    };

    const [radarMonitores, radarOcorrencias30d] = await Promise.all([
      MonitorRadar.countDocuments({ ativo: true }),
      OcorrenciaRadar.countDocuments({ criadoEm: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    ]);

    res.json({
      sucesso: true,
      dados: {
        // Só contagens: nomes monitorados são dados sensíveis e não aparecem aqui
        radar: { monitoresAtivos: radarMonitores, ocorrencias30d: radarOcorrencias30d },
        receita,
        totalUsers:      usuariosRaw.length,
        totalAlerts:     alertasRaw.filter((a) => a.status === 'ativo').length,
        alertasPausados,
        alertasComErro,
        feedbacks,
        users,
        alertas,
        crawlerHealth
      },
    });
  } catch (err) {
    console.error('Erro no Dashboard ADM:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar o painel do administrador.' });
  }
});

// ============================================================
// ⚡ CONTROLE DE ALERTAS (ATIVAR/DESATIVAR)
// ============================================================
router.patch('/alertas/:id/status', autenticar, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['ativo', 'pausado'].includes(status)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Status inválido.' });
    }

    const alerta = await Alerta.findByIdAndUpdate(
      req.params.id,
      { status, motivoPausa: status === 'pausado' ? 'admin' : null },
      { new: true }
    );

    if (!alerta) {
      return res.status(404).json({ sucesso: false, mensagem: 'Alerta não encontrado.' });
    }

    res.json({ 
      sucesso: true, 
      mensagem: `Alerta marcado como ${status}!`, 
      alerta 
    });
  } catch (err) {
    console.error('Erro ao atualizar status do alerta:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar alerta.' });
  }
});

// ============================================================
// 💎 OVERRIDE DE PLANO (Pro de cortesia / beta testers)
// ============================================================
// Body: { tipo: 'pro', dias?: number }  → Pro de cortesia (sem "dias" = sem expiração)
//       { tipo: 'free' }                → volta para o Free e pausa o excedente
router.patch('/usuarios/:id/plano', autenticar, isAdmin, async (req, res) => {
  try {
    const { tipo, dias } = req.body;
    if (!['free', 'pro'].includes(tipo)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Tipo de plano inválido.' });
    }
    if (dias !== undefined && dias !== null && !(Number.isInteger(dias) && dias > 0)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dias deve ser um número inteiro positivo.' });
    }

    const usuario = await Usuario.findById(req.params.id).select('-senha');
    if (!usuario) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    if (tipo === 'free') {
      // Não mexe em assinatura paga: ela precisa ser cancelada no Mercado Pago
      if (['mercadopago', 'pix'].includes(usuario.plano?.origem) && obterTipoPlanoEfetivo(usuario) === 'pro') {
        return res.status(409).json({
          sucesso: false,
          mensagem: 'Este usuário tem um plano pago ativo (cartão ou Pix). Cancele pelo Mercado Pago ou aguarde o vencimento.',
        });
      }
      const { alertasPausados } = await aplicarDowngrade(usuario, { notificar: false });
      return res.json({ sucesso: true, mensagem: `Plano alterado para Free. ${alertasPausados} alerta(s) pausado(s).` });
    }

    if (['mercadopago', 'pix'].includes(usuario.plano?.origem) && obterTipoPlanoEfetivo(usuario) === 'pro') {
      return res.status(409).json({ sucesso: false, mensagem: 'Este usuário já tem um plano pago ativo (cartão ou Pix).' });
    }

    usuario.plano = {
      tipo: 'pro',
      status: 'ativo',
      validoAte: dias ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000) : null,
      origem: 'cortesia',
      mpAssinaturaId: null,
    };
    await usuario.save();
    const reativados = await reativarAlertasPausadosPorPlano(usuario._id);

    res.json({
      sucesso: true,
      mensagem: `Pro de cortesia concedido${dias ? ` por ${dias} dia(s)` : ''}. ${reativados} alerta(s) reativado(s).`,
    });
  } catch (err) {
    console.error('Erro ao alterar plano:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao alterar plano.' });
  }
});

// ============================================================
// 📜 LOGS E HISTÓRICO
// ============================================================
router.get('/cron-logs', autenticar, isAdmin, async (req, res) => {
  try {
    const logs = await LogCron.find({}).sort({ dataExecucao: -1 }).limit(50);
    res.json({ sucesso: true, logs });
  } catch (err) {
    console.error('Erro ao buscar cron logs:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar logs do cron.' });
  }
});

router.get('/historico/:alertaId', autenticar, isAdmin, async (req, res) => {
  try {
    const mudancas = await Mudanca.find({ alertaId: req.params.alertaId })
      .sort({ detectadaEm: -1 })
      .limit(100);
    res.json({ sucesso: true, mudancas });
  } catch (err) {
    console.error('Erro ao buscar histórico:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar histórico de mudanças.' });
  }
});

// ============================================================
// 🩺 SAÚDE DO SISTEMA (o que precisa de atenção manual)
// ============================================================
// Mostra num lugar só: configurações faltando, fontes do Radar paradas,
// rodadas do cron com erro e, com ?modelos=1, se cada modelo pronto ainda
// abre e tem texto legível (sites de banca mudam de endereço sem aviso).
async function verificarModelo(modelo) {
  const axios = require('axios');
  const { OPCOES_DOWNLOAD, interpretarResposta } = require('../utils/conteudoPagina');
  const { validarUrlPublica } = require('../utils/urlPublica');
  const { gerarHeaders } = require('../service/crawler');
  const inicio = Date.now();
  try {
    const validacao = await validarUrlPublica(modelo.url);
    if (!validacao.valido) return { id: modelo.id, ok: false, erro: validacao.motivo };
    const resposta = await axios.get(modelo.url, { headers: gerarHeaders(), ...OPCOES_DOWNLOAD, timeout: 20000 });
    const pagina = await interpretarResposta(resposta, { url: modelo.url });
    const caracteres = pagina.texto.length;
    return { id: modelo.id, ok: caracteres >= 200, status: resposta.status, caracteres, ms: Date.now() - inicio,
      erro: caracteres < 200 ? 'Página quase sem texto (pode depender de JavaScript)' : null };
  } catch (err) {
    return { id: modelo.id, ok: false, status: err.response?.status ?? null, erro: err.code || err.message, ms: Date.now() - inicio };
  }
}

router.get('/saude', autenticar, isAdmin, async (req, res) => {
  try {
    const { MODELOS } = require('../config/modelos');
    const { iaConfigurada } = require('../service/ia');
    const { criptografiaConfigurada } = require('../utils/cripto');
    const { telegramConfigurado } = require('../service/telegram');
    const { cidadesDisponiveis } = require('../config/radar');
    const { DRIVERS } = require('../service/radar/radarService');

    const configuracoes = [
      { item: 'Mercado Pago (pagamentos)', ok: Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_PUBLIC_KEY), variaveis: 'MP_ACCESS_TOKEN, MP_PUBLIC_KEY' },
      { item: 'Webhook do Mercado Pago', ok: Boolean(process.env.MP_WEBHOOK_SECRET), variaveis: 'MP_WEBHOOK_SECRET' },
      { item: 'IA (resumos)', ok: iaConfigurada(), variaveis: 'GEMINI_API_KEY' },
      { item: 'Radar do Diário Oficial', ok: criptografiaConfigurada(), variaveis: 'DADOS_CHAVE' },
      { item: 'Telegram', ok: telegramConfigurado(), variaveis: 'TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET' },
      { item: 'E-mail (Resend)', ok: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE), variaveis: 'RESEND_API_KEY, EMAIL_REMETENTE' },
    ];

    // Diário sem edição há mais de 7 dias = fonte provavelmente parada
    const fontes = await Promise.all(cidadesDisponiveis().map(async (cidade) => {
      const driver = DRIVERS.find((d) => d.suporta(cidade.id));
      let ultimaPublicacao = null, erro = null;
      try { ultimaPublicacao = driver?.ultimaPublicacao ? await driver.ultimaPublicacao(cidade.id) : null; } catch (e) { erro = e.message; }
      const dias = ultimaPublicacao ? Math.floor((Date.now() - Date.parse(ultimaPublicacao)) / 864e5) : null;
      return { id: cidade.id, nome: cidade.nome, fonte: driver?.nome ?? null, ultimaPublicacao, ok: !erro && (dias === null ? !driver?.ultimaPublicacao : dias <= 7), erro };
    }));

    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [rodadas24h, rodadasComErro] = await Promise.all([
      LogCron.countDocuments({ dataExecucao: { $gte: desde } }),
      LogCron.find({ dataExecucao: { $gte: desde }, $or: [{ sucesso: false }, { alertasComErro: { $gt: 0 } }] }).sort({ dataExecucao: -1 }).limit(5).lean(),
    ]);

    const modelos = req.query.modelos === '1'
      ? await (async () => { const r = []; for (let i = 0; i < MODELOS.length; i += 4) r.push(...await Promise.all(MODELOS.slice(i, i + 4).map(verificarModelo))); return r; })()
      : null;

    res.json({ sucesso: true, configuracoes, fontes, cron: { rodadas24h, rodadasComErro }, modelos });
  } catch (err) {
    console.error('[Admin] Erro na saúde do sistema:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao verificar a saúde do sistema.' });
  }
});

module.exports = router;