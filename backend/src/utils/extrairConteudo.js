const cheerio = require('cheerio');

/**
 * Extrai apenas o conteúdo textual relevante de uma página HTML,
 * removendo anúncios, banners, pop-ups, cookie notices, navegação
 * e outros elementos que não fazem parte do conteúdo principal.
 *
 * @param {string} html  – HTML bruto da página
 * @param {string|null} seletorCss – seletor CSS opcional para focar em um bloco específico
 * @returns {string} texto limpo e normalizado
 */
function extrairConteudoLimpo(html, seletorCss) {
  const $ = cheerio.load(html);

  // Se um seletor CSS foi informado, extrai apenas o conteúdo alvo
  const $alvo = seletorCss ? $(seletorCss) : $('body');

  // ── Remove tags HTML que nunca carregam conteúdo real ──
  $alvo.find(
    'script, style, noscript, iframe, svg, link, meta, img, input, button, form, video, audio, canvas, object, embed'
  ).remove();

  // ── Remove áreas de layout/navegação que não são conteúdo principal ──
  $alvo.find('header, footer, nav, aside').remove();

  // ── Remove anúncios, banners, pop-ups, cookie notices e elementos dinâmicos ──
  const seletoresLixo = [
    // Anúncios
    '.ads', '.ad', '.advert', '.advertisement', '.ad-banner', '.ad-container',
    '.ad-slot', '.ad-wrapper', '.adsbygoogle', '[id^="ad-"]', '[class*="ad-"]',
    '[id*="google_ads"]', '[id*="banner"]', '.banner', '.sponsored',
    '.promoted', '.promo',
    // Barras laterais e widgets
    '.sidebar', '#sidebar', '.widget', '.widgets',
    // Pop-ups, modais, cookie notices
    '.popup', '.modal', '.overlay', '.cookie', '.cookie-banner',
    '.cookie-notice', '.cookie-consent', '.consent-banner',
    '#cookie-banner', '#cookie-notice', '[class*="cookie"]',
    '.lgpd', '#lgpd', '[class*="lgpd"]',
    // Redes sociais e compartilhamento
    '.social', '.share', '.sharing', '.social-links', '.social-share',
    // Newsletters e CTAs
    '.newsletter', '.subscribe', '.cta',
    // Comentários
    '.comments', '#comments', '.comment-section',
    // Navegação breadcrumb e paginação
    '.breadcrumb', '.breadcrumbs', '.pagination',
  ].join(', ');

  $alvo.find(seletoresLixo).remove();

  // ── Remove atributos dinâmicos que mudam a cada requisição ──
  $alvo.find('[data-token], [data-nonce], [data-csrf], [nonce]').removeAttr('data-token data-nonce data-csrf nonce');

  // ── Remove comentários HTML ──
  $alvo.contents().filter(function () { return this.type === 'comment'; }).remove();

  return $alvo.text().replace(/\s+/g, ' ').trim();
}

module.exports = { extrairConteudoLimpo };
