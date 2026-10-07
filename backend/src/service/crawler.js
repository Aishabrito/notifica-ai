const axios         = require('axios');
const crypto        = require('crypto');
const transportador = require('../utils/mailer');
const { OPCOES_DOWNLOAD, interpretarResposta } = require('../utils/conteudoPagina');
const { escaparHtml } = require('../utils/html');
const { gerarIcs }    = require('../utils/ics');
const { resumirMudanca } = require('./resumoMudanca');
const { notificarMudanca } = require('./telegram');
const { validarUrlPublica } = require('../utils/urlPublica');
const Alerta        = require('../models/alertaModel');
const Mudanca       = require('../models/Mudanca');
const { intervaloEfetivo, obterTipoPlanoEfetivo } = require('../config/planos');
const { gerarLinkCancelamento } = require('../utils/linkCancelamento');

// ============================================
// ⚙️ CONFIGURAÇÕES
// ============================================
const LIMITE_FALHAS = 3;
const CONCORRENCIA  = 5; // verificações simultâneas por rodada
const MAX_SNAPSHOT  = 200000; // caracteres do texto guardado para comparar versões
const EMAIL_ADM     = process.env.EMAIL_REMETENTE;

// ============================================
// 🛠️ FUNÇÕES AUXILIARES
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
];

function gerarHeaders(seed) {
  // Usa seed (alerta._id) para escolher o mesmo UA sempre para o mesmo alerta,
  // evitando que sites sirvam HTML diferente por browser e causem falsos-positivos.
  let index;
  if (seed) {
    const hash = crypto.createHash('md5').update(String(seed)).digest('hex');
    index = parseInt(hash.slice(0, 8), 16) % USER_AGENTS.length;
  } else {
    index = Math.floor(Math.random() * USER_AGENTS.length);
  }
  const agenteAleatorio = USER_AGENTS[index];

  return {
    'User-Agent': agenteAleatorio,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
}

function jitter(minMs = 1000, maxMs = 5000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// 🌐 BUSCA DE PÁGINAS (uma rodada)
// ============================================
// Cada rodada cria um buscador próprio que:
//  - baixa cada URL uma vez só, mesmo que várias pessoas monitorem o mesmo link.
//    A chave inclui o User-Agent porque cada alerta usa sempre o mesmo UA
//    (ver gerarHeaders): compartilhar o HTML entre UAs diferentes poderia
//    gerar falsos positivos em sites que servem HTML diferente por navegador.
//  - espera um intervalo aleatório entre requisições ao MESMO site, mas
//    permite buscar sites diferentes em paralelo.
function criarBuscador() {
  const cache       = new Map(); // `${url}|${ua}` -> Promise<resposta>
  const filaPorHost = new Map(); // host -> Promise da última requisição

  return function buscarPagina(url, headers) {
    const chave = `${url}|${headers['User-Agent']}`;
    if (cache.has(chave)) return cache.get(chave);

    let host;
    try { host = new URL(url).hostname; } catch { host = url; }

    const anterior   = filaPorHost.get(host);
    const requisicao = (anterior ? anterior.then(() => jitter()) : Promise.resolve())
      .then(() => axios.get(url, { headers, ...OPCOES_DOWNLOAD }));

    // A fila segue mesmo se a requisição falhar
    filaPorHost.set(host, requisicao.catch(() => {}));
    cache.set(chave, requisicao);
    return requisicao;
  };
}

// Intercala os alertas por site (A1, B1, C1, A2, B2...) para que os
// workers não fiquem todos parados na fila do mesmo host.
function intercalarPorHost(alertas) {
  const grupos = new Map();
  for (const alerta of alertas) {
    let host;
    try { host = new URL(alerta.url).hostname; } catch { host = alerta.url; }
    if (!grupos.has(host)) grupos.set(host, []);
    grupos.get(host).push(alerta);
  }

  const filas = [...grupos.values()];
  const resultado = [];
  for (let i = 0; resultado.length < alertas.length; i++) {
    for (const fila of filas) if (fila[i]) resultado.push(fila[i]);
  }
  return resultado;
}

// ============================================
// 📧 E-MAIL DE MUDANÇA (para o usuário)
// ============================================
// resumo: gerado pela IA (só Pro). Sem resumo, vai o aviso genérico.
async function enviarEmailMudanca(alerta, { resumo = null, ehPro = false } = {}) {
  const urlCancelamento = gerarLinkCancelamento(alerta._id);
  const site = escaparHtml(alerta.titulo || alerta.url);
  const url  = escaparHtml(alerta.url);

  const corpoResumo = resumo ? `
    <h2>${escaparHtml(resumo.titulo)}</h2>
    <p style="font-size:15px;line-height:1.5;">${escaparHtml(resumo.resumo)}</p>
    ${resumo.datas.length ? `
      <p><b>📅 Datas importantes</b> (o arquivo anexo adiciona à sua agenda):</p>
      <ul>${resumo.datas.map((d) => `<li>${escaparHtml(new Date(`${d.data}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }))} — ${escaparHtml(d.descricao)}</li>`).join('')}</ul>` : ''}
    <p style="font-size:12px;color:#666;">Resumo gerado por IA. Confira sempre o documento oficial.</p>
  ` : `
    <h2>Mudança detectada!</h2>
    <p>O site que você está monitorando foi atualizado.</p>
    ${ehPro ? '' : '<p style="font-size:13px;color:#6b21a8;">💎 No plano Pro você recebe um resumo do que mudou, feito por IA, e as datas direto na sua agenda.</p>'}
  `;

  const attachments = resumo?.datas.length
    ? [{
        filename: 'prazos.ics',
        content: Buffer.from(gerarIcs(resumo.datas, {
          titulo: alerta.titulo || alerta.url,
          url: alerta.url,
          uidBase: `${alerta._id}-${Date.now()}`,
        })).toString('base64'),
      }]
    : undefined;

  try {
    await transportador.sendMail({
      from: `"Notifica.ai 🚀" <${process.env.EMAIL_REMETENTE}>`,
      to: alerta.email,
      subject: resumo
        ? `🚨 ${resumo.titulo} — ${alerta.titulo || alerta.url}`.slice(0, 180)
        : `🚨 Atualização detectada — ${alerta.titulo || alerta.url}`,
      html: `
        ${corpoResumo}
        <p><b>Site:</b> ${site}</p>
        <p><b>URL:</b> <a href="${url}">${url}</a></p>
        <hr>
        <p><small>Não quer mais receber? <a href="${urlCancelamento}">Cancelar monitoramento</a></small></p>
      `,
      attachments,
    });
    console.log(`[Crawler] 📧 E-mail enviado com sucesso para: ${alerta.email}`);
  } catch (erro) {
    console.error('[Crawler] ❌ Erro ao enviar email na função enviarEmailMudanca:', erro.message);
    throw erro;
  }
}

// ============================================
// 📧 E-MAIL DE ALERTA ADM (para a Aísha)
// ============================================
async function enviarEmailADM(alerta, erro) {
  await transportador.sendMail({
    from: `"Notifica.ai 🚀" <${process.env.EMAIL_REMETENTE}>`,
    to: EMAIL_ADM,
    subject: `⚠️ Alerta pausado automaticamente — ${alerta.url}`,
    html: `
      <h2>⚠️ Um alerta foi pausado por falhas repetidas</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">URL</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${alerta.url}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Usuário</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${alerta.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Erro</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #c0392b;">${erro}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Falhas seguidas</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${LIMITE_FALHAS}</td>
        </tr>
      </table>
      <br>
      <p>Para reativar: <code>PATCH ${process.env.BASE_URL}/api/reativar-alerta/${alerta._id}</code></p>
      <hr>
      <small>Notifica.ai — painel de controle interno</small>
    `,
  });
}

// ============================================
// 🤖 VERIFICAÇÃO DE UM ALERTA
// ============================================
async function verificarAlerta(alerta, buscarPagina) {
  try {
    const headers = gerarHeaders(alerta._id);
    const resposta = await buscarPagina(alerta.url, headers);
    const pagina = await interpretarResposta(resposta, { url: alerta.url, seletorCss: alerta.seletorCss });
    const hashAtual = gerarHash(pagina.texto);

    const hashAnterior    = alerta.hashConteudo;
    const textoAnterior   = alerta.ultimoConteudo;
    const linksAnteriores = alerta.linksPdf; // undefined = nunca guardados
    const tipoAnterior    = alerta.tipoConteudo;

    // ✅ SUCESSO — reseta falhas e guarda a versão atual para a próxima comparação
    if (alerta.falhasSeguidas > 0) console.log(`[Crawler] ✅ ${alerta.url} — contador de falhas resetado`);
    alerta.falhasSeguidas    = 0;
    alerta.ultimoErro        = null;
    alerta.ultimaVerificacao = new Date();
    alerta.hashConteudo      = hashAtual;
    alerta.ultimoConteudo    = pagina.texto.slice(0, MAX_SNAPSHOT);
    alerta.linksPdf          = pagina.linksPdf;
    alerta.tipoConteudo      = pagina.tipo;

    if (!hashAnterior) {
      await alerta.save();
      console.log(`[Crawler] 💾 Hash inicial salvo para: ${alerta.url}`);
      return 'ok';
    }

    if (hashAnterior === hashAtual) {
      await alerta.save();
      console.log(`[Crawler] ✔️  Sem mudanças em: ${alerta.url}`);
      return 'ok';
    }

    // PDFs monitorados antes desta versão tinham o hash calculado sobre os
    // bytes lidos como texto; a primeira leitura com o texto real só refaz a base.
    if (pagina.tipo === 'pdf' && tipoAnterior !== 'pdf' && !textoAnterior) {
      await alerta.save();
      console.log(`[Crawler] 💾 Base de PDF atualizada para: ${alerta.url}`);
      return 'ok';
    }

    // 🔔 MUDANÇA
    console.log(`[Crawler] 🔔 Mudança detectada em: ${alerta.url}`);
    const ehPro = obterTipoPlanoEfetivo(alerta.usuario) === 'pro';

    let resumo = null;
    let linksNovos = [];
    if (ehPro) {
      linksNovos = Array.isArray(linksAnteriores)
        ? pagina.linksPdf.filter((link) => !linksAnteriores.includes(link))
        : [];
      resumo = await resumirMudanca({
        textoAnterior,
        textoAtual: pagina.texto,
        hashAnterior,
        hashNovo: hashAtual,
        titulo: alerta.titulo,
        url: alerta.url,
        linksNovos,
        baixarTextoPdf: async (link) => {
          // O link veio do HTML da página monitorada: pode apontar para qualquer lugar
          const validacao = await validarUrlPublica(link);
          if (!validacao.valido) throw new Error(`link ignorado (${validacao.motivo})`);
          const p = await interpretarResposta(await buscarPagina(link, headers), { url: link });
          return p.tipo === 'pdf' ? p.texto : null;
        },
      });
    }

    await alerta.save();

    // Pro: a IA classificou como irrelevante (contador, banner...) → não incomoda
    const notificar = !(resumo && resumo.relevante === false);
    let emailEnviado = false;

    if (notificar) {
      try {
        await enviarEmailMudanca(alerta, { resumo, ehPro });
        emailEnviado = true;
        alerta.ultimaNotificacao = new Date();
        await alerta.save();
      } catch (erroEmail) {
        console.error('[Crawler] ❌ Falha ao enviar e-mail de mudança:', erroEmail.message);
      }
      // Telegram (Pro que conectou): não bloqueia nem depende do e-mail
      notificarMudanca(alerta.usuario, alerta, resumo).catch(() => {});
    } else {
      console.log(`[Crawler] 🔕 Mudança irrelevante em ${alerta.url} — sem e-mail`);
    }

    // Salva registro no histórico de mudanças
    try {
      await Mudanca.create({
        alertaId:        alerta._id,
        hashAnterior,
        hashNovo:        hashAtual,
        emailNotificado: alerta.email,
        emailEnviado,
        resumo:          resumo ?? undefined,
        pdfsNovos:       linksNovos.length ? linksNovos : undefined,
      });
    } catch (erroMudanca) {
      console.error('[Crawler] ❌ Falha ao salvar histórico de mudança:', erroMudanca.message);
    }

    return 'mudanca';

  } catch (erro) {
    // ❌ FALHA — incrementa contador
    const mensagemErro = erro.response
      ? `HTTP ${erro.response.status} — ${erro.response.statusText}`
      : erro.message;

    alerta.falhasSeguidas += 1;
    alerta.ultimoErro      = mensagemErro;

    console.warn(
      `[Crawler] ⚠️  ${alerta.url} — falha ${alerta.falhasSeguidas}/${LIMITE_FALHAS}: ${mensagemErro}`
    );

    // 🔴 REGRA DE 3: pausa e avisa a ADM
    if (alerta.falhasSeguidas >= LIMITE_FALHAS) {
      alerta.status = 'pausado';
      alerta.motivoPausa = 'falhas';
      console.error(`[Crawler] 🔴 ${alerta.url} — PAUSADO após ${LIMITE_FALHAS} falhas seguidas`);

      try {
        await enviarEmailADM(alerta, mensagemErro);
        console.log('[Crawler] 📧 E-mail de alerta enviado para a ADM.');
      } catch (erroEmail) {
        console.error('[Crawler] ❌ Falha ao enviar e-mail ADM:', erroEmail.message);
      }
    }

    await alerta.save();
    return 'erro';
  }
}

// ============================================
// 🚀 EXECUÇÃO DO MONITORAMENTO
// ============================================
async function executarMonitoramento(alertas, { concorrencia = CONCORRENCIA } = {}) {
  if (!alertas || alertas.length === 0) {
    console.log('[Crawler] Nenhum alerta ativo para verificar.');
    return { alertasVerificados: 0, alertasComMudanca: 0, alertasComErro: 0 };
  }

  console.log(`[Crawler] Iniciando verificação de ${alertas.length} alerta(s)...`);

  const buscarPagina = criarBuscador();
  const fila = intercalarPorHost(alertas);
  let alertasComMudanca = 0;
  let alertasComErro    = 0;

  async function worker() {
    while (fila.length > 0) {
      const alerta = fila.shift();

      // Agenda a próxima checagem e libera a reserva antes de verificar:
      // todos os caminhos de verificarAlerta salvam o documento, então os
      // campos são persistidos junto. alerta.usuario vem populado pelo
      // agendador (pode ser null em alertas antigos).
      const horas = intervaloEfetivo(alerta, alerta.usuario);
      alerta.proximaVerificacao = new Date(Date.now() + horas * 60 * 60 * 1000);
      alerta.travadoAte = null;

      let resultado;
      try {
        resultado = await verificarAlerta(alerta, buscarPagina);
      } catch (err) {
        // Falha inesperada (ex: banco fora do ar ao salvar): não derruba a rodada.
        // A reserva expira sozinha e o alerta volta a ser verificado depois.
        console.error(`[Crawler] ❌ Erro inesperado em ${alerta.url}:`, err.message);
        resultado = 'erro';
      }
      if (resultado === 'mudanca') alertasComMudanca += 1;
      if (resultado === 'erro')    alertasComErro    += 1;
    }
  }

  const workers = Math.max(1, Math.min(concorrencia, fila.length));
  await Promise.all(Array.from({ length: workers }, worker));

  console.log('[Crawler] ✅ Verificação concluída.');
  return { alertasVerificados: alertas.length, alertasComMudanca, alertasComErro };
}

module.exports = { executarMonitoramento, gerarHeaders };
