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

module.exports = { localizarPosicao, atualizarPosicao, avisarMudancaPosicao, posicaoParaApi, normalizar };
