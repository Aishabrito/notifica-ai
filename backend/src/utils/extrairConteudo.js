const cheerio      = require('cheerio');
const { JSDOM }    = require('jsdom');
const { Readability } = require('@mozilla/readability');

/**
 * Extrai apenas o conteúdo textual relevante de uma página HTML.
 *
 * Estratégia de extração (em ordem de prioridade):
 *  1. Se o usuário definiu um seletorCss → usa Cheerio para recortar apenas aquele bloco.
 *  2. Sem seletor → usa @mozilla/readability (o mesmo algoritmo do "Modo de Leitura"
 *     do Firefox) para detectar automaticamente o artigo/conteúdo principal da página,
 *     ignorando menus, rodapés, anúncios e banners por design.
 *  3. Se o Readability não conseguir identificar o conteúdo principal (ex.: páginas
 *     muito simples ou listas puras) → cai no Cheerio como fallback.
 *
 * @param {string}      html       – HTML bruto da página
 * @param {string|null} seletorCss – seletor CSS opcional para focar em um bloco específico
 * @param {string}      [url='']   – URL da página (ajuda o Readability a resolver links relativos)
 * @returns {string} texto limpo e normalizado
 */
function extrairConteudoLimpo(html, seletorCss, url = '') {
  // ── Caminho 1: seletor CSS fornecido pelo usuário ─────────────────────────
  if (seletorCss) {
    return normalizarTextoMonitorado(extrairComCheerio(html, seletorCss));
  }

  // ── Caminho 2: Readability (detecção automática do conteúdo principal) ────
  try {
    const dom    = new JSDOM(html, { url: url || 'about:blank' });
    const reader = new Readability(dom.window.document);
    const artigo = reader.parse();

    if (artigo && artigo.textContent) {
      const texto = normalizarTextoMonitorado(artigo.textContent);
      if (texto.length > 0) {
        return texto;
      }
    }
  } catch (erroReadability) {
    console.warn('[extrairConteudo] Readability falhou, usando fallback Cheerio:', erroReadability.message);
  }

  // ── Caminho 3: fallback Cheerio (página sem artigo detectável) ───────────
  return normalizarTextoMonitorado(extrairComCheerio(html, null));
}

/**
 * Extração de texto via Cheerio com limpeza de elementos irrelevantes.
 * Usado como caminho direto (seletorCss) ou fallback quando o Readability
 * não consegue identificar o conteúdo principal.
 */
function extrairComCheerio(html, seletorCss) {
  const $ = cheerio.load(html);
  const $alvo = seletorCss ? $(seletorCss) : $('body');

  // Remove tags que nunca carregam conteúdo relevante
  $alvo.find(
    'script, style, noscript, template, iframe, svg, link, meta, img, input, button, form, video, audio, canvas, object, embed'
  ).remove();

  // Remove áreas de layout/navegação
  $alvo.find('header, footer, nav, aside').remove();

  // Remove elementos com conteúdo dinâmico que muda a cada requisição
  // (timestamps relativos, contadores de views/shares, regiões live)
  $alvo.find('time').remove();
  $alvo.find('[aria-live]').remove();

  // Remove anúncios, banners, pop-ups, cookie notices e widgets dinâmicos
  const seletoresLixo = [
    '.ads', '.ad', '.advert', '.advertisement', '.ad-banner', '.ad-container',
    '.ad-slot', '.ad-wrapper', '.adsbygoogle', '[id^="ad-"]', '[class*="ad-"]',
    '[id*="google_ads"]', '[id*="banner"]', '.banner', '.sponsored', '.promoted', '.promo',
    '.sidebar', '#sidebar', '.widget', '.widgets',
    '.popup', '.modal', '.overlay', '.cookie', '.cookie-banner',
    '.cookie-notice', '.cookie-consent', '.consent-banner',
    '#cookie-banner', '#cookie-notice', '[class*="cookie"]',
    '.lgpd', '#lgpd', '[class*="lgpd"]',
    '.social', '.share', '.sharing', '.social-links', '.social-share',
    '.newsletter', '.subscribe', '.cta',
    '.comments', '#comments', '.comment-section',
    '.breadcrumb', '.breadcrumbs', '.pagination',
    '[class*="count"]', '[class*="views"]', '[class*="counter"]',
  ].join(', ');

  $alvo.find(seletoresLixo).remove();

  // Remove atributos dinâmicos e comentários HTML
  $alvo.find('[data-token], [data-nonce], [data-csrf], [nonce]').removeAttr('data-token data-nonce data-csrf nonce');
  $alvo.contents().filter(function () { return this.type === 'comment'; }).remove();

  return $alvo.text().replace(/\s+/g, ' ').trim();
}

function normalizarTextoMonitorado(texto = '') {
  return texto
    // Metadados voláteis comuns em portais:
    // "Última atualização em ...", "Atualizado em ...", "Acessos: 12345"
    .replace(
      /\b(?:última\s+atualiza(?:ção|cao)|atualizado\s+em)\b\s*:?\s*(?:[a-zà-úç]{3,12},\s*)?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:,\s*\d{1,2}h\d{2})?/giu,
      ' '
    )
    .replace(
      /\b(?:última\s+atualiza(?:ção|cao)|atualizado\s+em)\b\s*:?\s*(?:[a-zà-úç]{3,12},\s*)?\d{1,2}\s+de\s+[a-zà-úç]{3,20}\s+de\s+\d{4}(?:,\s*\d{1,2}h\d{2})?/giu,
      ' '
    )
    .replace(/\bacess(?:o|os)\s*:\s*\d+\b/gi, ' ')
    .replace(/\bvisualiza(?:ção|coes|ções)\s*:\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { extrairConteudoLimpo };
