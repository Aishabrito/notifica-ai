const transportador = require('../utils/mailer');
const { escaparHtml } = require('../utils/html');
const { cifrar, decifrar } = require('../utils/cripto');

// ============================================
// 📍 MINHA POSIÇÃO NA LISTA
// ============================================
// A pessoa informa como o nome (ou a inscrição) aparece na lista. A cada
// mudança da página procuramos esse texto e tentamos ler a posição.
// Só afirmamos um número com padrões seguros ("15º", "classificação: 15",
// número colado antes do nome); senão mostramos o trecho onde ele aparece.

const MAX_HISTORICO = 30;

// "João  da Silva" → "JOAO DA SILVA" (sem acento, maiúsculas, espaços simples)
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ORD = '(?:º|°|ª|O\\b)?'; // 15º, 15°, 15ª, 15O (OCR de PDF)

function lerNumero(antes, depois) {
  // 1) rótulo explícito logo depois do nome: "... CLASSIFICACAO: 15" / "15º LUGAR"
  const rotulo = depois.match(/^\D{0,40}?(?:CLASSIFICACAO|COLOCACAO|POSICAO|CLASSIF\.?|CLASS\.)\s*:?\s*(\d{1,5})\b/);
  if (rotulo) return Number(rotulo[1]);
  const lugar = depois.match(/^\D{0,25}?\b(\d{1,5})\s*(?:º|°|ª)\s*(?:LUGAR|COLOCAD[OA]|CLASSIFICAD[OA])\b/);
  if (lugar) return Number(lugar[1]);

  // 2) número colado antes do nome: "15 JOAO", "15º - JOAO", "15. JOAO"
  //    Se o número colado tem 6+ dígitos (inscrição), olha o anterior: "15 123456 JOAO"
  const colado = antes.match(new RegExp(`(?:^|\\s)(\\d{1,7})\\s*${ORD}\\s*[-–.)|:]?\\s*$`));
  if (colado) {
    if (colado[1].length <= 5) return Number(colado[1]);
    const anterior = antes.slice(0, antes.length - colado[0].length)
      .match(new RegExp(`(?:^|\\s)(\\d{1,5})\\s*${ORD}\\s*[-–.)|:]?\\s*$`));
    if (anterior) return Number(anterior[1]);
  }
  return null;
}

/**
 * @returns {{ encontrado: boolean, numero: number|null, trecho: string|null, ocorrencias: number }}
 */
function localizarPosicao(texto, identificador) {
  const alvo = normalizar(identificador);
  const base = normalizar(texto);
  if (alvo.length < 3 || !base) return { encontrado: false, numero: null, trecho: null, ocorrencias: 0 };

  // Palavra inteira: "JOAO SILVA" não casa com "JOAO SILVANO"
  const re = new RegExp(`(?<![A-Z0-9])${escaparRegex(alvo)}(?![A-Z0-9])`, 'g');
  const achados = [...base.matchAll(re)];
  if (!achados.length) return { encontrado: false, numero: null, trecho: null, ocorrencias: 0 };

  const i = achados[0].index;
  const antes = base.slice(Math.max(0, i - 40), i);
  const depois = base.slice(i + alvo.length, i + alvo.length + 80);
  return {
    encontrado: true,
    // Nome repetido na página (ex.: ampla concorrência e cotas): não arrisca número
    numero: achados.length === 1 ? lerNumero(antes, depois) : null,
    trecho: `…${base.slice(Math.max(0, i - 60), i + alvo.length + 60).trim()}…`,
    ocorrencias: achados.length,
  };
}

// Aplica o resultado no alerta e diz o que mudou (para avisar)
function atualizarPosicao(alerta, texto) {
  const p = alerta.posicao;
  if (!p?.identificadorCifrado) return null;
  const identificador = decifrar(p.identificadorCifrado);
  if (!identificador) return null;

  const r = localizarPosicao(texto, identificador);
  const primeiraVez = !p.verificadoEm;
  const mudou = !primeiraVez && (r.encontrado !== p.encontrado || r.numero !== p.numero);

  p.verificadoEm = new Date();
  if (primeiraVez || mudou) {
    const anterior = { encontrado: p.encontrado, numero: p.numero };
    p.encontrado = r.encontrado;
    p.numero = r.numero;
    p.trechoCifrado = r.trecho ? cifrar(r.trecho) : null;
    p.mudouEm = new Date();
    p.historico = [...(p.historico ?? []), { encontrado: r.encontrado, numero: r.numero, em: new Date() }].slice(-MAX_HISTORICO);
    alerta.markModified('posicao');
    return mudou ? { anterior, atual: { encontrado: r.encontrado, numero: r.numero } } : null;
  }
  alerta.markModified('posicao');
  return null;
}

function descreverMudanca({ anterior, atual }) {
  if (!anterior.encontrado && atual.encontrado) {
    return { titulo: atual.numero ? `Seu nome apareceu na lista — posição ${atual.numero}` : 'Seu nome apareceu na lista!', emoji: '🎉' };
  }
  if (anterior.encontrado && !atual.encontrado) {
    return { titulo: 'Seu nome não aparece mais nesta página', emoji: '⚠️' };
  }
  if (anterior.numero && atual.numero) {
    const diff = anterior.numero - atual.numero;
    return diff > 0
      ? { titulo: `Você subiu ${diff} posiç${diff === 1 ? 'ão' : 'ões'}: agora é ${atual.numero}º`, emoji: '📈' }
      : { titulo: `Sua posição mudou: de ${anterior.numero}º para ${atual.numero}º`, emoji: '📍' };
  }
  return { titulo: atual.numero ? `Sua posição agora: ${atual.numero}º` : 'Sua posição na lista mudou', emoji: '📍' };
}

async function avisarMudancaPosicao(alerta, mudanca) {
  const { titulo, emoji } = descreverMudanca(mudanca);
  const site = alerta.titulo || alerta.url;
  const trecho = alerta.posicao?.trechoCifrado ? decifrar(alerta.posicao.trechoCifrado) : null;
  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: alerta.email,
    subject: `${emoji} ${titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
        <h2 style="margin-top:0">${emoji} ${escaparHtml(titulo)}</h2>
        <p style="color:#555">Em: <a href="${escaparHtml(alerta.url)}">${escaparHtml(site)}</a></p>
        ${trecho ? `<p style="background:#f4f4f5;padding:12px;border-radius:8px;font-family:monospace;font-size:13px">${escaparHtml(trecho)}</p>` : ''}
        <p style="font-size:12px;color:#888">A posição é lida automaticamente da página: confira sempre na lista oficial.</p>
      </div>`,
  });
  const usuario = alerta.usuario;
  await require('./push').enviarPush(usuario?._id ?? usuario, { titulo: `${emoji} ${titulo}`, corpo: site, url: '/dashboard', tag: `posicao-${alerta._id}`, urgente: true });
  if (usuario?.telegram?.chatId) {
    const telegram = require('./telegram');
    if (telegram.telegramConfigurado()) {
      await telegram.enviarMensagem(usuario.telegram.chatId, `${emoji} <b>${escaparHtml(titulo)}</b>\n${escaparHtml(site)}\n${escaparHtml(alerta.url)}`).catch(() => {});
    }
  }
}

// Visão para a API (só para o dono do alerta)
function posicaoParaApi(alerta) {
  const p = alerta.posicao;
  if (!p?.identificadorCifrado) return null;
  return {
    identificador: decifrar(p.identificadorCifrado),
    encontrado: Boolean(p.encontrado),
    numero: p.numero ?? null,
    trecho: p.trechoCifrado ? decifrar(p.trechoCifrado) : null,
    verificadoEm: p.verificadoEm ?? null,
    mudouEm: p.mudouEm ?? null,
    historico: (p.historico ?? []).map((h) => ({ encontrado: h.encontrado, numero: h.numero, em: h.em })),
  };
}

// ─── Histórico das chamadas ─────────────────────────
const MAX_CHAMADAS = 30;

// Posição atual ou, se o nome saiu da lista (ex.: foi chamado), a última conhecida
function minhaPosicao(alerta) {
  const p = alerta.posicao;
  if (!p) return null;
  return p.numero ?? [...(p.historico ?? [])].reverse().find((h) => h.numero)?.numero ?? null;
}

// Registra "a Nª chamada foi até a posição X". Ignora repetição (mesma
// chamada ou mesmo 'até'). Devolve true quando a posição da pessoa foi alcançada.
function registrarChamada(alerta, { numero = null, ate }, origem = 'manual') {
  const lista = alerta.chamadas ?? [];
  const repetida = lista.some((c) => c.ate === ate || (numero && c.numero === numero));
  if (repetida) return { registrada: false, alcancou: false };
  alerta.chamadas = [...lista, { numero, ate, em: new Date(), origem }].sort((a, b) => a.ate - b.ate).slice(-MAX_CHAMADAS);
  const minha = minhaPosicao(alerta);
  const jaChegou = lista.some((c) => minha && c.ate >= minha);
  return { registrada: true, alcancou: Boolean(minha && ate >= minha && !jaChegou) };
}

// Ritmo das chamadas e estimativa de quantas faltam (null se não der para estimar)
function estimarChamadas(chamadas, minhaPosicao) {
  const ordenadas = [...(chamadas ?? [])].sort((a, b) => a.ate - b.ate);
  if (!ordenadas.length || !minhaPosicao) return null;
  const ultima = ordenadas[ordenadas.length - 1].ate;
  if (ultima >= minhaPosicao) return { faltamPosicoes: 0, chamadasEstimadas: 0, ritmo: null };
  const ritmo = ordenadas.length === 1 ? ultima : (ultima - ordenadas[0].ate) / (ordenadas.length - 1);
  return {
    faltamPosicoes: minhaPosicao - ultima,
    ritmo: ritmo > 0 ? Math.round(ritmo) : null,
    chamadasEstimadas: ritmo > 0 ? Math.ceil((minhaPosicao - ultima) / ritmo) : null,
  };
}

async function avisarPosicaoAlcancada(alerta, ate) {
  const site = alerta.titulo || alerta.url;
  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: alerta.email,
    subject: `🎉 A chamada chegou na sua posição! (até ${ate}º)`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
        <h2 style="margin-top:0">🎉 A chamada chegou na sua posição!</h2>
        <p>A última chamada em <a href="${escaparHtml(alerta.url)}">${escaparHtml(site)}</a> foi até a posição <strong>${ate}</strong> — e você estava em <strong>${minhaPosicao(alerta)}º</strong>.</p>
        <p><strong>Confira a lista oficial agora</strong> e veja o prazo de matrícula ou de entrega de documentos.</p>
        <p style="font-size:12px;color:#888">A posição é lida automaticamente: confira sempre na publicação oficial.</p>
      </div>`,
  }).catch((err) => console.error('[Chamadas] Falha no e-mail:', err.message));
  await require('./push').enviarPush(alerta.usuario?._id ?? alerta.usuario, {
    titulo: '🎉 A chamada chegou na sua posição!', corpo: `${site}: chamada até a ${ate}ª posição. Confira agora!`, url: alerta.url, tag: `chamada-${alerta._id}`, urgente: true,
  });
}

module.exports = { minhaPosicao, registrarChamada, estimarChamadas, avisarPosicaoAlcancada, localizarPosicao, atualizarPosicao, avisarMudancaPosicao, posicaoParaApi, normalizar };
