const express = require('express');
const mongoose = require('mongoose');
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

    // Receita: assinaturas no cartão convertidas para valor por mês
    // (semestral ÷ 6, anual ÷ 12) + Pix recebido nos últimos 30 dias
    let precoMensal = 0;
    try { precoMensal = SUBSCRIPTION_OFFERS()['pro-mensal'].amount; } catch { /* preço mal configurado */ }
    const proPorOrigem = { mercadopago: 0, pix: 0, cortesia: 0, teste: 0 };
    let mrrCartao = 0;
    for (const u of usuariosRaw) {
      if (obterTipoPlanoEfetivo(u) !== 'pro') continue;
      const origem = u.plano?.origem;
      if (origem === 'mercadopago' && u.plano?.status !== 'ativo') continue; // cancelada: sem próxima cobrança
      if (origem in proPorOrigem) proPorOrigem[origem] += 1;
      if (origem === 'mercadopago') {
        mrrCartao += u.plano?.valorCobranca ? u.plano.valorCobranca / (u.plano.periodoMeses || 1) : precoMensal;
      }
    }
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
      mrrCartao: Math.round(mrrCartao * 100) / 100,
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
        tarefasAbertas: await require('../models/TarefaAdmin').countDocuments({ status: 'aberta' }),
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
// 🩺 SAÚDE DO SISTEMA
// ============================================================
router.get('/saude', autenticar, isAdmin, async (req, res) => {
  try {
    const { verificarSaude } = require('../service/saudeSistema');
    res.json({ sucesso: true, ...(await verificarSaude({ modelos: req.query.modelos === '1' })) });
  } catch (err) {
    console.error('[Admin] Erro na saúde do sistema:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao verificar a saúde do sistema.' });
  }
});

// ============================================================
// 📋 TAREFAS (checklist do que precisa de uma pessoa)
// ============================================================
const TarefaAdmin = require('../models/TarefaAdmin');

function tarefaParaApi(t) {
  return {
    id: String(t._id), chave: t.chave, tipo: t.tipo, prioridade: t.prioridade, titulo: t.titulo, descricao: t.descricao,
    link: t.link, status: t.status, ocorrencias: t.ocorrencias, criadaEm: t.criadaEm, ultimaOcorrenciaEm: t.ultimaOcorrenciaEm,
    concluidaEm: t.concluidaEm, concluidaPor: t.concluidaPor, nota: t.nota,
    alerta: t.alerta && t.alerta._id ? { id: String(t.alerta._id), url: t.alerta.url, titulo: t.alerta.titulo, status: t.alerta.status } : null,
    usuario: t.usuario && t.usuario._id ? { id: String(t.usuario._id), nome: t.usuario.nome, email: t.usuario.email } : null,
  };
}

async function carregarTarefa(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ sucesso: false, mensagem: 'Tarefa não encontrada.' }); return null; }
  const tarefa = await TarefaAdmin.findById(req.params.id);
  if (!tarefa) { res.status(404).json({ sucesso: false, mensagem: 'Tarefa não encontrada.' }); return null; }
  return tarefa;
}

function concluir(tarefa, req, nota) {
  tarefa.status = 'concluida';
  tarefa.concluidaEm = new Date();
  tarefa.concluidaPor = req.usuario.email;
  if (nota) tarefa.nota = String(nota).slice(0, 1000);
}

router.get('/tarefas', autenticar, isAdmin, async (req, res) => {
  try {
    const status = req.query.status === 'concluida' ? 'concluida' : 'aberta';
    const [tarefas, abertas] = await Promise.all([
      TarefaAdmin.find({ status })
        .sort(status === 'aberta' ? { prioridade: 1, ultimaOcorrenciaEm: -1 } : { concluidaEm: -1 })
        .limit(200)
        .populate('alerta', 'url titulo status')
        .populate('usuario', 'nome email'),
      TarefaAdmin.countDocuments({ status: 'aberta' }),
    ]);
    res.json({ sucesso: true, abertas, tarefas: tarefas.map(tarefaParaApi) });
  } catch (err) {
    console.error('[Admin] Erro ao listar tarefas:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar tarefas.' });
  }
});

// Tarefa criada à mão (lembrete da própria admin)
router.post('/tarefas', autenticar, isAdmin, async (req, res) => {
  const titulo = String(req.body?.titulo ?? '').trim();
  if (titulo.length < 3) return res.status(400).json({ sucesso: false, mensagem: 'Escreva o que precisa ser feito.' });
  const tarefa = await TarefaAdmin.create({
    tipo: 'manual', titulo: titulo.slice(0, 200), descricao: String(req.body?.descricao ?? '').slice(0, 2000),
    link: /^https?:\/\//.test(req.body?.link ?? '') ? String(req.body.link).slice(0, 500) : null,
    prioridade: req.body?.prioridade === 'alta' ? 'alta' : 'normal',
  });
  res.status(201).json({ sucesso: true, tarefa: tarefaParaApi(tarefa) });
});

// Dar ok (ou reabrir)
router.patch('/tarefas/:id', autenticar, isAdmin, async (req, res) => {
  try {
    const tarefa = await carregarTarefa(req, res);
    if (!tarefa) return;
    if (req.body?.status === 'aberta') {
      // Só reabre se não houver outra aberta com a mesma chave
      if (tarefa.chave && await TarefaAdmin.exists({ chave: tarefa.chave, status: 'aberta', _id: { $ne: tarefa._id } })) {
        return res.status(409).json({ sucesso: false, mensagem: 'Já existe uma tarefa aberta para este problema.' });
      }
      tarefa.status = 'aberta';
      tarefa.concluidaEm = null;
      tarefa.concluidaPor = null;
    } else {
      concluir(tarefa, req, req.body?.nota);
    }
    await tarefa.save();
    res.json({ sucesso: true, tarefa: tarefaParaApi(tarefa) });
  } catch (err) {
    console.error('[Admin] Erro ao atualizar tarefa:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar a tarefa.' });
  }
});

// Avisar a pessoa manualmente (ex.: "o edital saiu, está aqui o link")
// O aviso também entra no histórico do alerta, como uma mudança.
router.post('/tarefas/:id/avisar', autenticar, isAdmin, async (req, res) => {
  try {
    const tarefa = await carregarTarefa(req, res);
    if (!tarefa) return;
    const mensagem = String(req.body?.mensagem ?? '').trim().slice(0, 2000);
    const link = String(req.body?.link ?? '').trim();
    if (mensagem.length < 5) return res.status(400).json({ sucesso: false, mensagem: 'Escreva a mensagem para a pessoa.' });
    if (link && !/^https?:\/\/\S+$/.test(link)) return res.status(400).json({ sucesso: false, mensagem: 'Link inválido (use http:// ou https://).' });

    const alerta = tarefa.alerta ? await Alerta.findById(tarefa.alerta) : null;
    const usuario = tarefa.usuario ? await Usuario.findById(tarefa.usuario) : (alerta?.usuario ? await Usuario.findById(alerta.usuario) : null);
    const email = usuario?.email ?? alerta?.email;
    if (!email) return res.status(400).json({ sucesso: false, mensagem: 'Esta tarefa não está ligada a nenhuma pessoa.' });

    const transportador = require('../utils/mailer');
    const { escaparHtml } = require('../utils/html');
    const sobre = alerta ? (alerta.titulo || alerta.url) : null;
    await transportador.sendMail({
      from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
      to: email,
      subject: sobre ? `📌 Atualização sobre: ${sobre}` : '📌 Atualização da equipe Notifica.ai',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
          <h2 style="margin-top:0">Uma atualização da equipe Notifica.ai</h2>
          ${sobre ? `<p style="color:#555">Sobre o que você monitora: <strong>${escaparHtml(sobre)}</strong></p>` : ''}
          <p style="white-space: pre-line">${escaparHtml(mensagem)}</p>
          ${link ? `<p><a href="${escaparHtml(link)}" style="background:#10b981;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Abrir</a></p><p style="font-size:12px;color:#666">${escaparHtml(link)}</p>` : ''}
        </div>`,
    });

    if (alerta) {
      await Mudanca.create({
        alertaId: alerta._id, emailNotificado: email, emailEnviado: true,
        resumo: { relevante: true, titulo: 'Atualização da equipe', resumo: link ? `${mensagem}\n${link}` : mensagem, datas: [] },
      });
    }
    if (usuario) {
      const telegram = require('../service/telegram');
      await telegram.notificarMudanca(usuario, alerta ?? { url: link || '', titulo: 'Notifica.ai' }, { titulo: 'Atualização da equipe', resumo: mensagem, datas: [] }).catch(() => {});
    }

    if (req.body?.concluir !== false) concluir(tarefa, req, `Pessoa avisada por e-mail: ${mensagem.slice(0, 200)}`);
    await tarefa.save();
    res.json({ sucesso: true, mensagem: `Aviso enviado para ${email}.`, tarefa: tarefaParaApi(tarefa) });
  } catch (err) {
    console.error('[Admin] Erro ao avisar usuário:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar o aviso.' });
  }
});

// A página mudou de endereço: troca a URL do alerta e volta a monitorar
router.post('/tarefas/:id/trocar-url', autenticar, isAdmin, async (req, res) => {
  try {
    const tarefa = await carregarTarefa(req, res);
    if (!tarefa) return;
    const alerta = tarefa.alerta ? await Alerta.findById(tarefa.alerta) : null;
    if (!alerta) return res.status(400).json({ sucesso: false, mensagem: 'Esta tarefa não está ligada a um alerta.' });
    const url = String(req.body?.url ?? '').trim();
    const { validarUrlPublica } = require('../utils/urlPublica');
    const validacao = await validarUrlPublica(url);
    if (!validacao.valido) return res.status(400).json({ sucesso: false, mensagem: validacao.motivo });

    const urlAntiga = alerta.url;
    alerta.url = url;
    alerta.hashConteudo = null; // a próxima leitura vira a nova base, sem alarme falso
    alerta.ultimoConteudo = null;
    alerta.linksPdf = undefined;
    alerta.status = 'ativo';
    alerta.motivoPausa = null;
    alerta.falhasSeguidas = 0;
    alerta.ultimoErro = null;
    alerta.tarefaAberta = false;
    alerta.proximaVerificacao = new Date();
    await alerta.save();

    concluir(tarefa, req, `URL trocada: ${urlAntiga} → ${url}`);
    await tarefa.save();
    res.json({ sucesso: true, mensagem: 'Endereço atualizado. O alerta volta a ser verificado na próxima rodada.', tarefa: tarefaParaApi(tarefa) });
  } catch (err) {
    console.error('[Admin] Erro ao trocar URL:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao trocar o endereço.' });
  }
});

// Tentar de novo sem mudar nada (ex.: o site estava fora do ar e voltou).
// A tarefa fecha sozinha quando a próxima leitura der certo.
router.post('/tarefas/:id/reativar-alerta', autenticar, isAdmin, async (req, res) => {
  try {
    const tarefa = await carregarTarefa(req, res);
    if (!tarefa) return;
    const r = await Alerta.updateOne(
      { _id: tarefa.alerta, motivoPausa: 'falhas' },
      { $set: { status: 'ativo', motivoPausa: null, falhasSeguidas: 0, proximaVerificacao: new Date() } }
    );
    if (!r.modifiedCount) return res.status(400).json({ sucesso: false, mensagem: 'Este alerta não está pausado por falhas.' });
    res.json({ sucesso: true, mensagem: 'Alerta reativado. Se a página abrir na próxima rodada, a tarefa fecha sozinha.' });
  } catch (err) {
    console.error('[Admin] Erro ao reativar alerta:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao reativar.' });
  }
});

module.exports = router;