const axios         = require('axios');
const cheerio       = require('cheerio');
const crypto        = require('crypto');
const transportador = require('../utils/mailer');
const Alerta        = require('../models/alertaModel');
const Mudanca       = require('../models/Mudanca');

// ============================================
// ⚙️ CONFIGURAÇÕES
// ============================================
const LIMITE_FALHAS = 3;
const EMAIL_ADM     = process.env.EMAIL_REMETENTE;

// ============================================
// 🛠️ FUNÇÕES AUXILIARES
// ============================================
function gerarHash(texto) {
  return crypto.createHash('md5').update(texto).digest('hex');
}

function extrairConteudoLimpo(html) {
  const $ = cheerio.load(html);
  $('script, style, footer, noscript, iframe, head, nav, .ads, #footer, .sidebar').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
];

function gerarHeaders() {
  // Sorteia um navegador aleatório da lista acima
  const agenteAleatorio = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  return {
    'User-Agent': agenteAleatorio,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    // Esses headers extras simulam ainda mais o comportamento de um navegador real:
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
// 📧 E-MAIL DE MUDANÇA (para o usuário)
// ============================================
async function enviarEmailMudanca(alerta) {
  const urlCancelamento = `${process.env.BASE_URL}/api/cancelar-alerta/${alerta._id}`;

  try {
      await transportador.sendMail({
        from: `"Notifica.ai 🚀" <${process.env.EMAIL_REMETENTE}>`,
        to: alerta.email,
        subject: `🚨 Atualização detectada — ${alerta.titulo || alerta.url}`,
        html: `
          <h2>Mudança detectada!</h2>
          <p>O site que você está monitorando foi atualizado.</p>
          <p><b>Site:</b> ${alerta.titulo || alerta.url}</p>
          <p><b>URL:</b> <a href="${alerta.url}">${alerta.url}</a></p>
          <hr>
          <p><small>Não quer mais receber? <a href="${urlCancelamento}">Cancelar monitoramento</a></small></p>
        `,
      });
      console.log(`[Crawler] 📧 E-mail enviado com sucesso para: ${alerta.email}`);
  } catch (erro) {
      console.error(`[Crawler] ❌ Erro ao enviar email na função enviarEmailMudanca:`, erro);
      throw erro; // Repassa o erro para ser pego pelo bloco catch lá embaixo
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
async function verificarAlerta(alerta) {
  try {
    const resposta = await axios.get(alerta.url, {
      headers: gerarHeaders(),
      timeout: 15000,
    });

    const conteudoLimpo = extrairConteudoLimpo(resposta.data);
    const hashAtual     = gerarHash(conteudoLimpo);

    // ✅ SUCESSO — reseta contador de falhas
    if (alerta.falhasSeguidas > 0) {
      alerta.falhasSeguidas = 0;
      alerta.ultimoErro     = null;
      await alerta.save();
      console.log(`[Crawler] ✅ ${alerta.url} — contador de falhas resetado`);
    }

    // Verifica se houve mudança de conteúdo
    if (alerta.hashConteudo && alerta.hashConteudo !== hashAtual) {
      console.log(`[Crawler] 🔔 Mudança detectada em: ${alerta.url}`);

      const hashAnterior  = alerta.hashConteudo;
      alerta.hashConteudo = hashAtual;
      alerta.ultimaVerificacao = new Date();
      await alerta.save();

      let emailEnviado = false;

      try {
        await enviarEmailMudanca(alerta);
        emailEnviado = true;
        console.log(`[Crawler] 📧 E-mail enviado para: ${alerta.email}`);
      } catch (erroEmail) {
        console.error('[Crawler] ❌ Falha ao enviar e-mail de mudança:', erroEmail.message);
      }

      // Salva registro no histórico de mudanças
      try {
        await Mudanca.create({
          alertaId:        alerta._id,
          hashAnterior,
          hashNovo:        hashAtual,
          emailNotificado: alerta.email,
          emailEnviado,
        });
      } catch (erroMudanca) {
        console.error('[Crawler] ❌ Falha ao salvar histórico de mudança:', erroMudanca.message);
      }

      return 'mudanca';

    } else if (!alerta.hashConteudo) {
      // Primeiro acesso — salva o hash inicial
      alerta.hashConteudo = hashAtual;
      alerta.ultimaVerificacao = new Date();
      await alerta.save();
      console.log(`[Crawler] 💾 Hash inicial salvo para: ${alerta.url}`);
    } else {
      alerta.ultimaVerificacao = new Date();
      await alerta.save();
      console.log(`[Crawler] ✔️  Sem mudanças em: ${alerta.url}`);
    }

    return 'ok';

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
async function executarMonitoramento(alertas) {
  if (!alertas || alertas.length === 0) {
    console.log('[Crawler] Nenhum alerta ativo para verificar.');
    return { alertasVerificados: 0, alertasComMudanca: 0, alertasComErro: 0 };
  }

  console.log(`[Crawler] Iniciando verificação de ${alertas.length} alerta(s)...`);

  let alertasComMudanca = 0;
  let alertasComErro    = 0;

  for (const alerta of alertas) {
    const resultado = await verificarAlerta(alerta);
    if (resultado === 'mudanca') alertasComMudanca += 1;
    if (resultado === 'erro')    alertasComErro    += 1;
    await jitter(); // delay aleatório entre 1s e 4s para evitar bloqueios
  }

  console.log('[Crawler] ✅ Verificação concluída.');
  return { alertasVerificados: alertas.length, alertasComMudanca, alertasComErro };
}

module.exports = { executarMonitoramento };