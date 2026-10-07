const express   = require('express');
const rateLimit = require('express-rate-limit');
const mongoose  = require('mongoose');
const { autenticar } = require('../middleware/authMiddleware');
const MonitorRadar    = require('../models/MonitorRadar');
const OcorrenciaRadar = require('../models/OcorrenciaRadar');
const { cifrar, decifrar, criptografiaConfigurada } = require('../utils/cripto');
const { obterTipoPlanoEfetivo } = require('../config/planos');
const { cidadesDisponiveis, cidadeDisponivel, RADAR, cidadePorId, nomeDiario } = require('../config/radar');
const { processarMonitor, decifrarMonitor, DRIVERS } = require('../service/radar/radarService');

const router = express.Router();

const limiterRadar = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Muitas requisições. Tente novamente em breve.' },
});

// Busca manual: no máximo 5 por hora por usuário
const limiterBuscaManual = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.usuario._id), // a rota é autenticada antes do limite
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, mensagem: 'Você já fez várias buscas agora. A busca automática roda 2x por dia.' },
});

function exigirRadarDisponivel(_req, res, next) {
  if (!criptografiaConfigurada()) {
    return res.status(503).json({ sucesso: false, mensagem: 'O Radar ainda não está disponível. Tente mais tarde.' });
  }
  next();
}

// "Maria da Silva" → "Maria d* S****" (para listas e logs)
function mascararNome(nome) {
  return String(nome).split(' ').map((p, i) => (i === 0 || p.length <= 2 ? p : `${p[0]}${'*'.repeat(p.length - 1)}`)).join(' ');
}

function monitorParaApi(monitor) {
  const dados = decifrarMonitor(monitor);
  return {
    id: String(monitor._id),
    nome: dados.nome, // o dono vê o próprio nome completo
    inscricao: dados.inscricao,
    cpfParcial: dados.cpfMeio ? `***.${dados.cpfMeio.slice(0, 3)}.${dados.cpfMeio.slice(3)}-**` : null,
    cidades: monitor.cidades.map((id) => cidadePorId(id) ?? { id, nome: id }),
    ativo: monitor.ativo,
    motivoPausa: monitor.motivoPausa,
    ultimaBuscaEm: monitor.ultimaBuscaEm,
    criadoEm: monitor.criadoEm,
  };
}

// ─── ESTADO DO RADAR + MONITORES DO USUÁRIO ────────
router.get('/', limiterRadar, autenticar, async (req, res) => {
  try {
    const disponivel = criptografiaConfigurada();
    const monitores = disponivel ? await MonitorRadar.find({ usuario: req.usuario._id }).sort({ criadoEm: 1 }) : [];
    res.json({
      sucesso: true,
      disponivel,
      ehPro: obterTipoPlanoEfetivo(req.usuario) === 'pro',
      emailVerificado: Boolean(req.usuario.emailVerificado),
      limite: RADAR.maxNomesPorUsuario(),
      cidades: cidadesDisponiveis(),
      monitores: monitores.map(monitorParaApi),
    });
  } catch (err) {
    console.error('[Radar] Erro ao listar monitores:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar o Radar.' });
  }
});

// ─── CADASTRAR NOME ────────────────────────────────
// Body: { nome, inscricao?, cpf?, cidades: [ids], consentimento: true }
router.post('/', limiterRadar, autenticar, exigirRadarDisponivel, async (req, res) => {
  try {
    if (obterTipoPlanoEfetivo(req.usuario) !== 'pro') {
      return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: 'O Radar do Diário Oficial é exclusivo do plano Pro.' });
    }
    if (!req.usuario.emailVerificado) {
      return res.status(403).json({ sucesso: false, codigo: 'EMAIL_NAO_VERIFICADO', mensagem: 'Confirme seu e-mail antes de usar o Radar.' });
    }
    if (req.body?.consentimento !== true) {
      return res.status(400).json({ sucesso: false, mensagem: 'É preciso aceitar o termo de uso do Radar.' });
    }

    const nome = String(req.body?.nome ?? '').replace(/\s+/g, ' ').trim();
    if (nome.length < 6 || nome.length > 120 || nome.split(' ').length < 2 || !/^[\p{L}' .-]+$/u.test(nome)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe o nome completo (nome e sobrenome, só letras).' });
    }

    const inscricao = req.body?.inscricao ? String(req.body.inscricao).trim().slice(0, 40) : null;
    if (inscricao && !/^[\p{L}\d./ -]{4,40}$/u.test(inscricao)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Número de inscrição inválido.' });
    }

    // CPF: guardamos só os 6 dígitos do meio, que é o que os diários publicam
    let cpfMeio = null;
    if (req.body?.cpf) {
      const digitos = String(req.body.cpf).replace(/\D/g, '');
      if (digitos.length === 11) cpfMeio = digitos.slice(3, 9);
      else if (digitos.length === 6) cpfMeio = digitos;
      else return res.status(400).json({ sucesso: false, mensagem: 'Informe o CPF completo (11 dígitos) ou só os 6 do meio.' });
    }

    const cidades = Array.isArray(req.body?.cidades) ? [...new Set(req.body.cidades.map(String))] : [];
    if (cidades.length === 0 || cidades.some((id) => !cidadeDisponivel(id))) {
      return res.status(400).json({ sucesso: false, mensagem: 'Escolha ao menos uma cidade da lista.' });
    }

    const total = await MonitorRadar.countDocuments({ usuario: req.usuario._id });
    if (total >= RADAR.maxNomesPorUsuario()) {
      return res.status(403).json({ sucesso: false, mensagem: `Você pode monitorar até ${RADAR.maxNomesPorUsuario()} nome(s).` });
    }

    const monitor = await MonitorRadar.create({
      usuario: req.usuario._id,
      nomeCifrado: cifrar(nome),
      inscricaoCifrada: cifrar(inscricao),
      cpfMeioCifrado: cifrar(cpfMeio),
      cidades,
      consentimento: { aceitoEm: new Date(), versao: RADAR.versaoConsentimento },
    });

    console.log(`[Radar] Novo monitor ${monitor._id} (${mascararNome(nome)}) — ${cidades.length} cidade(s)`);
    res.status(201).json({ sucesso: true, monitor: monitorParaApi(monitor) });
  } catch (err) {
    console.error('[Radar] Erro ao cadastrar monitor:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar o nome.' });
  }
});

// ─── REMOVER NOME (apaga também as ocorrências — direito de exclusão) ─
router.delete('/:id', limiterRadar, autenticar, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
    const monitor = await MonitorRadar.findOneAndDelete({ _id: req.params.id, usuario: req.usuario._id });
    if (!monitor) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
    await OcorrenciaRadar.deleteMany({ monitor: monitor._id });
    res.json({ sucesso: true, mensagem: 'Nome removido do Radar, junto com o histórico.' });
  } catch (err) {
    console.error('[Radar] Erro ao remover monitor:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
});

// ─── BUSCAR AGORA (manual, limitado) ───────────────
router.post('/:id/buscar', autenticar, exigirRadarDisponivel, limiterBuscaManual, async (req, res) => {
  try {
    if (obterTipoPlanoEfetivo(req.usuario) !== 'pro') {
      return res.status(403).json({ sucesso: false, codigo: 'LIMITE_PLANO', mensagem: 'O Radar é exclusivo do plano Pro.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });
    const monitor = await MonitorRadar.findOne({ _id: req.params.id, usuario: req.usuario._id, ativo: true });
    if (!monitor) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });

    monitor.usuario = req.usuario; // já carregado: evita outra consulta
    const r = await processarMonitor(monitor, { manual: true });
    if (r.erros > 0 && r.resultados === 0) {
      return res.status(502).json({ sucesso: false, mensagem: 'A fonte de diários oficiais não respondeu. Tente mais tarde.' });
    }
    res.json({
      sucesso: true,
      novas: r.novas,
      mensagem: r.novas > 0
        ? `Encontramos ${r.novas} publicação(ões) nova(s)! Enviamos os detalhes por e-mail.`
        : 'Nenhuma publicação nova com seus dados por enquanto. Seguimos de olho 2x por dia.',
    });
  } catch (err) {
    console.error('[Radar] Erro na busca manual:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar agora.' });
  }
});

// ─── OCORRÊNCIAS ENCONTRADAS ───────────────────────
router.get('/ocorrencias', limiterRadar, autenticar, exigirRadarDisponivel, async (req, res) => {
  try {
    const ocorrencias = await OcorrenciaRadar.find({ usuario: req.usuario._id })
      .sort({ dataPublicacao: -1, criadoEm: -1 })
      .limit(100)
      .lean();
    res.json({
      sucesso: true,
      ocorrencias: ocorrencias.map((o) => ({
        id: String(o._id),
        monitorId: String(o.monitor),
        cidade: cidadePorId(o.cidadeId)?.nome ?? o.cidadeId,
        diario: nomeDiario(o.cidadeId),
        dataPublicacao: o.dataPublicacao,
        url: o.url,
        edicao: o.edicao,
        confirmacao: o.confirmacao,
        trechos: o.trechosCifrados ? JSON.parse(decifrar(o.trechosCifrados)) : [],
      })),
    });
  } catch (err) {
    console.error('[Radar] Erro ao listar ocorrências:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar as publicações.' });
  }
});

// ─── COBERTURA: qual cidade tem diário recente na fonte ─
let coberturaCache = { em: 0, dados: null };
router.get('/cobertura', limiterRadar, autenticar, async (_req, res) => {
  try {
    if (!coberturaCache.dados || Date.now() - coberturaCache.em > 6 * 60 * 60 * 1000) {
      const dados = [];
      for (const cidade of cidadesDisponiveis()) {
        const driver = DRIVERS.find((d) => d.suporta(cidade.id));
        let ultima = null;
        try { ultima = driver?.ultimaPublicacao ? await driver.ultimaPublicacao(cidade.id) : null; } catch { ultima = null; }
        dados.push({ ...cidade, fonte: driver?.nome ?? null, ultimaPublicacao: ultima });
      }
      coberturaCache = { em: Date.now(), dados };
    }
    res.json({ sucesso: true, cobertura: coberturaCache.dados });
  } catch (err) {
    console.error('[Radar] Erro na cobertura:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao consultar a cobertura.' });
  }
});

module.exports = router;
