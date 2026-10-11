const axios = require('axios');
const LogCron = require('../models/LogCron');
const { OPCOES_DOWNLOAD, interpretarResposta } = require('../utils/conteudoPagina');
const { validarUrlPublica } = require('../utils/urlPublica');
const { abrirTarefa, resolverTarefa } = require('./tarefasAdmin');

// ============================================
// 🩺 SAÚDE DO SISTEMA
// ============================================
// Mostra num lugar só: configurações faltando, diários sem edição recente,
// rodadas do cron com erro e (sob demanda) se cada modelo pronto ainda abre
// e tem texto legível — sites de banca mudam de endereço sem aviso.
// Roda também todo dia de madrugada e vira tarefa no checklist do admin.

const DIAS_DIARIO_PARADO = 7;

async function verificarModelo(modelo) {
  const { gerarHeaders } = require('./crawler');
  const inicio = Date.now();
  try {
    const validacao = await validarUrlPublica(modelo.url);
    if (!validacao.valido) return { id: modelo.id, ok: false, erro: validacao.motivo };
    const resposta = await axios.get(modelo.url, { headers: gerarHeaders(), ...OPCOES_DOWNLOAD, timeout: 20000 });
    const pagina = await interpretarResposta(resposta, { url: modelo.url });
    const caracteres = pagina.texto.length;
    return {
      id: modelo.id, ok: caracteres >= 200, status: resposta.status, caracteres, ms: Date.now() - inicio,
      erro: caracteres < 200 ? 'Página quase sem texto (pode depender de JavaScript)' : null,
    };
  } catch (err) {
    return { id: modelo.id, ok: false, status: err.response?.status ?? null, erro: err.code || err.message, ms: Date.now() - inicio };
  }
}

const temVariaveis = (...nomes) => nomes.every((n) => Boolean(process.env[n]));

function verificarConfiguracoes() {
  const { iaConfigurada } = require('./ia');
  const { criptografiaConfigurada } = require('../utils/cripto');
  const { telegramConfigurado } = require('./telegram');
  return [
    { id: 'mp', item: 'Mercado Pago (pagamentos)', ok: temVariaveis('MP_ACCESS_TOKEN', 'MP_PUBLIC_KEY'), variaveis: 'MP_ACCESS_TOKEN, MP_PUBLIC_KEY' },
    { id: 'mp-webhook', item: 'Webhook do Mercado Pago', ok: temVariaveis('MP_WEBHOOK_SECRET'), variaveis: 'MP_WEBHOOK_SECRET' },
    { id: 'ia', item: 'IA (resumos)', ok: iaConfigurada(), variaveis: 'GEMINI_API_KEY' },
    { id: 'radar', item: 'Radar do Diário Oficial', ok: criptografiaConfigurada(), variaveis: 'DADOS_CHAVE' },
    { id: 'telegram', item: 'Telegram', ok: telegramConfigurado(), variaveis: 'TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET' },
    { id: 'push', item: 'Notificação no celular', ok: temVariaveis('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'), variaveis: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (gere com: npx web-push generate-vapid-keys)' },
    { id: 'email', item: 'E-mail (Resend)', ok: temVariaveis('RESEND_API_KEY', 'EMAIL_REMETENTE'), variaveis: 'RESEND_API_KEY, EMAIL_REMETENTE' },
  ];
}

async function verificarFontes() {
  const { cidadesDisponiveis } = require('../config/radar');
  const { DRIVERS } = require('./radar/radarService');
  return Promise.all(cidadesDisponiveis().map(async (cidade) => {
    const driver = DRIVERS.find((d) => d.suporta(cidade.id));
    let ultimaPublicacao = null, erro = null;
    try { ultimaPublicacao = driver?.ultimaPublicacao ? await driver.ultimaPublicacao(cidade.id) : null; } catch (e) { erro = e.message; }
    const dias = ultimaPublicacao ? Math.floor((Date.now() - Date.parse(ultimaPublicacao)) / 864e5) : null;
    const ok = !erro && (driver?.ultimaPublicacao ? dias !== null && dias <= DIAS_DIARIO_PARADO : Boolean(driver));
    return { id: cidade.id, nome: cidade.nome, fonte: driver?.nome ?? null, linkConsulta: driver?.linkConsulta ?? null, ultimaPublicacao, dias, ok, erro };
  }));
}

async function verificarSaude({ modelos = false } = {}) {
  const { MODELOS } = require('../config/modelos');
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [fontes, rodadas24h, rodadasComErro] = await Promise.all([
    verificarFontes(),
    LogCron.countDocuments({ dataExecucao: { $gte: desde } }),
    LogCron.find({ dataExecucao: { $gte: desde }, $or: [{ sucesso: false }, { alertasComErro: { $gt: 0 } }] }).sort({ dataExecucao: -1 }).limit(5).lean(),
  ]);

  let resultadoModelos = null;
  if (modelos) {
    resultadoModelos = [];
    for (let i = 0; i < MODELOS.length; i += 4) {
      resultadoModelos.push(...await Promise.all(MODELOS.slice(i, i + 4).map(verificarModelo)));
    }
  }

  return { configuracoes: verificarConfiguracoes(), fontes, cron: { rodadas24h, rodadasComErro }, modelos: resultadoModelos };
}

// Cron diário: transforma cada problema em tarefa (e fecha as que sumiram)
async function gerarTarefasDeSaude({ modelos = false } = {}) {
  const { MODELOS } = require('../config/modelos');
  const saude = await verificarSaude({ modelos });

  for (const c of saude.configuracoes) {
    const chave = `config:${c.id}`;
    if (c.ok) await resolverTarefa(chave, 'Resolvido: a configuração foi preenchida.');
    else await abrirTarefa({
      chave, tipo: 'configuracao', titulo: `Configurar: ${c.item}`,
      descricao: `Falta preencher no Render (Environment): ${c.variaveis}. Veja o passo a passo em backend/.env.example.`,
      link: 'https://dashboard.render.com/',
    });
  }

  for (const f of saude.fontes) {
    const chave = `diario:${f.id}`;
    if (f.ok) await resolverTarefa(chave, 'Resolvido: o diário voltou a ter edições na fonte.');
    else await abrirTarefa({
      chave, tipo: 'fonte-radar', prioridade: 'alta',
      titulo: `Diário sem edição recente: ${f.nome}`,
      descricao: f.erro
        ? `A fonte (${f.fonte}) deu erro: ${String(f.erro).slice(0, 200)}.`
        : `A última edição na fonte (${f.fonte}) é de ${f.ultimaPublicacao ? f.ultimaPublicacao.split('-').reverse().join('/') : 'data desconhecida'}. `
          + 'Confira no site da prefeitura se o diário continua saindo: se sim, a fonte parou de coletar e as buscas do Radar nesta cidade estão incompletas.',
      link: f.linkConsulta,
    });
  }

  for (const m of saude.modelos ?? []) {
    const chave = `modelo:${m.id}`;
    const modelo = MODELOS.find((x) => x.id === m.id);
    if (m.ok) await resolverTarefa(chave, 'Resolvido: o modelo voltou a abrir.');
    else await abrirTarefa({
      chave, tipo: 'modelo', titulo: `Modelo pronto quebrado: ${modelo?.nome ?? m.id}`,
      descricao: `${m.erro ?? 'Falhou'}${m.status ? ` (HTTP ${m.status})` : ''}. Ache o endereço novo da página e atualize backend/src/config/modelos.js (ou peça ao Claude).`,
      link: modelo?.url ?? null,
    });
  }
  return saude;
}

module.exports = { verificarSaude, gerarTarefasDeSaude, verificarModelo };
