const axios   = require('axios');
const cheerio = require('cheerio');

// ============================================
// 🚚 DRIVER: DIÁRIO OFICIAL DA UNIÃO (in.gov.br)
// ============================================
// Usa a busca pública do portal da Imprensa Nacional — a mesma que o projeto
// Ro-DOU, do governo federal, usa (github.com/gestaogovbr/Ro-dou). Os
// resultados vêm num JSON dentro de uma tag <script> da página de busca.
// Nomeações, posses e resultados de concursos FEDERAIS saem aqui.

const ID = 'dou';
const URL_BUSCA = () => process.env.DOU_BUSCA_URL || 'https://www.in.gov.br/consulta/-/buscar/dou';
const URL_MATERIA = () => process.env.DOU_MATERIA_URL || 'https://www.in.gov.br/web/dou/-/';
const ID_SCRIPT = '_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params';
const SECOES = { DO1: 'Seção 1', DO2: 'Seção 2', DO3: 'Seção 3', DO1E: 'Edição Extra', DO2E: 'Edição Extra', DO3E: 'Edição Extra' };

const suporta = (cidadeId) => cidadeId === 'DOU';

// "2026-10-07" → "07-10-2026" (formato da busca) e "07/10/2026" → "2026-10-07"
const paraBusca = (iso) => iso.split('-').reverse().join('-');
const deDataBR = (br) => {
  const [d, m, a] = String(br ?? '').split(/[/-]/);
  return a && m && d ? `${a.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null;
};
const semHtml = (html) => cheerio.load(`<div>${html ?? ''}</div>`)('div').text().replace(/\s+/g, ' ').trim();

async function buscar({ termo, cidades, desde }) {
  if (!cidades.some(suporta)) return [];

  const params = new URLSearchParams({
    q: `"${String(termo).replace(/["\\]/g, ' ').trim()}"`,
    s: 'todos',
    exactDate: 'personalizado',
    publishFrom: paraBusca(desde),
    publishTo: paraBusca(new Date().toISOString().slice(0, 10)),
    sortType: '0',
  });

  const { data: html } = await axios.get(`${URL_BUSCA()}?${params}`, {
    timeout: 30000,
    responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Notifica.ai/1.0; radar de diario oficial)' },
  });

  const bruto = cheerio.load(html)(`#${ID_SCRIPT}`).html();
  if (!bruto) throw new Error('Formato da página de busca do DOU mudou (script de resultados não encontrado).');
  const itens = JSON.parse(bruto)?.jsonArray ?? [];

  return itens
    .map((item) => ({
      data: deDataBR(item.pubDate),
      url: `${URL_MATERIA()}${item.urlTitle}`,
      cidadeId: 'DOU',
      edicao: SECOES[String(item.pubName ?? '').toUpperCase()] ?? item.pubName ?? null,
      trechos: [semHtml(item.title), semHtml(item.content)].filter(Boolean),
    }))
    .filter((p) => p.data && p.url);
}

module.exports = { id: ID, nome: 'Diário Oficial da União', suporta, buscar };
