const cheerio = require('cheerio');
const { PDFParse } = require('pdf-parse');
const { extrairConteudoLimpo } = require('./extrairConteudo');

const MAX_LINKS_PDF = 200;

// Opções do axios para baixar páginas: sempre como bytes, para conseguir
// tratar HTML e PDF (que chega corrompido se for decodificado como texto).
const OPCOES_DOWNLOAD = {
  responseType: 'arraybuffer',
  timeout: 20000,
  maxContentLength: 25 * 1024 * 1024,
};

function ehPdf(resposta, buffer) {
  const tipo = String(resposta.headers?.['content-type'] ?? '').toLowerCase();
  return tipo.includes('application/pdf') || buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

// Reproduz exatamente o que o axios fazia com responseType padrão
// (utf-8, remove BOM e tenta JSON.parse), para o texto extraído —
// e portanto o hash — das páginas HTML não mudar com esta versão.
function decodificarComoAxios(buffer) {
  let texto = buffer.toString('utf8');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  try { return JSON.parse(texto); } catch { return texto; }
}

function extrairLinksPdf(html, url, seletorCss) {
  const $ = cheerio.load(html);
  const $escopo = seletorCss ? $(seletorCss) : $.root();
  const links = new Set();
  $escopo.find('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!/\.pdf(?:[?#]|$)/i.test(href)) return;
    try { links.add(new URL(href, url).href); } catch { /* href inválido */ }
  });
  return [...links].slice(0, MAX_LINKS_PDF);
}

// pdf-parse 2.x: a 1.x devolvia o texto do PDF anterior quando lia vários
// em sequência no mesmo processo. pageJoiner vazio tira o marcador
// "-- 1 of N --", que mudaria em todas as páginas quando o PDF ganha uma página.
async function extrairTextoPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText({ pageJoiner: '' });
    return String(text ?? '').replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
}

/**
 * Interpreta a resposta (axios, responseType arraybuffer) de uma página monitorada.
 * @returns {Promise<{ tipo: 'html'|'pdf', texto: string, titulo: string|null, linksPdf: string[] }>}
 */
async function interpretarResposta(resposta, { url, seletorCss = null }) {
  const buffer = Buffer.from(resposta.data);

  if (ehPdf(resposta, buffer)) {
    return { tipo: 'pdf', texto: await extrairTextoPdf(buffer), titulo: null, linksPdf: [] };
  }

  const html = decodificarComoAxios(buffer);
  const texto = extrairConteudoLimpo(html, seletorCss, url);
  const htmlTexto = typeof html === 'string' ? html : '';
  const titulo = htmlTexto ? cheerio.load(htmlTexto)('title').text().trim() || null : null;
  const linksPdf = htmlTexto ? extrairLinksPdf(htmlTexto, url, seletorCss) : [];

  return { tipo: 'html', texto, titulo, linksPdf };
}

module.exports = { OPCOES_DOWNLOAD, interpretarResposta, extrairTextoPdf };
