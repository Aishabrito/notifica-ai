const express   = require('express');
const axios     = require('axios');
const rateLimit = require('express-rate-limit');
const { validarUrlPublica } = require('../utils/urlPublica');
const { OPCOES_DOWNLOAD, interpretarResposta } = require('../utils/conteudoPagina');
const { gerarHeaders } = require('../service/crawler');

// ============================================
// 🧪 "TESTE AGORA" (página inicial, sem cadastro)
// ============================================
// Lê a página uma vez e diz se dá para vigiar. Responde só um resumo
// (título, tipo, o que parece ser), nunca o conteúdo: não serve de proxy.

const router = express.Router();
const msg = { sucesso: false, mensagem: 'Você testou muitas páginas seguidas. Crie sua conta grátis para continuar.' };
const porMinuto = rateLimit({ windowMs: 60 * 1000, max: 4, standardHeaders: true, legacyHeaders: false, message: msg });
const porHora   = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: msg });

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // url -> { em, resposta }

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SINAIS = [
  { tipo: 'lista-espera', rotulo: 'Lista de espera / chamadas', re: /lista de espera|chamada|convocad|classificad|aprovad|matricula/ },
  { tipo: 'edital',       rotulo: 'Edital / retificação',       re: /edital|retifica|inscric|cronograma/ },
  { tipo: 'resultado',    rotulo: 'Resultado / gabarito',        re: /resultado|gabarito|recurso|nota final/ },
  { tipo: 'diario',       rotulo: 'Diário Oficial',              re: /diario oficial|portaria|nomea|decreto/ },
];

function analisar(pagina, url) {
  const texto = normalizar(`${pagina.titulo ?? ''} ${pagina.texto.slice(0, 50000)}`);
  const palavras = pagina.texto.split(/\s+/).filter(Boolean).length;
  const nomeArquivo = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  return {
    titulo: (pagina.titulo || (pagina.tipo === 'pdf' && nomeArquivo) || new URL(url).hostname).slice(0, 140),
    tipo: pagina.tipo,
    palavras,
    pdfs: pagina.linksPdf.length,
    sinais: SINAIS.filter((s) => s.re.test(texto)).map(({ tipo, rotulo }) => ({ tipo, rotulo })),
    // Páginas que montam o conteúdo com JavaScript chegam quase vazias
    poucoTexto: pagina.tipo === 'html' && palavras < 40,
  };
}

router.post('/', porMinuto, porHora, async (req, res) => {
  const url = String(req.body?.url ?? '').trim();
  if (!url || url.length > 2000) return res.status(400).json({ sucesso: false, mensagem: 'Cole o link da página (começando com https://).' });

  const validacao = await validarUrlPublica(url);
  if (!validacao.valido) return res.status(400).json({ sucesso: false, mensagem: validacao.motivo });

  const guardado = cache.get(url);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return res.json(guardado.resposta);

  try {
    const resposta = await axios.get(url, { headers: gerarHeaders(), ...OPCOES_DOWNLOAD, timeout: 12000, maxContentLength: 8 * 1024 * 1024 });
    const pagina = await interpretarResposta(resposta, { url });
    const corpo = { sucesso: true, pagina: analisar(pagina, url) };
    if (cache.size > 500) cache.clear();
    cache.set(url, { em: Date.now(), resposta: corpo });
    return res.json(corpo);
  } catch (err) {
    console.error('[Teste agora] Falha ao ler:', err.code, err.message);
    return res.status(502).json({ sucesso: false, mensagem: 'Não conseguimos abrir esta página agora. Confira o link ou tente de novo em instantes.' });
  }
});

module.exports = router;
module.exports._limparCache = () => cache.clear();
