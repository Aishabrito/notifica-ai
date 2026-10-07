const axios = require('axios');

// ============================================
// 🚚 DRIVER: QUERIDO DIÁRIO (Open Knowledge Brasil)
// ============================================
// API pública que reúne diários oficiais municipais com busca textual.
// Cada fonte de diário oficial é um "driver" com a mesma interface:
//   buscar({ termo, cidades, desde }) → [{ data, url, cidadeId, edicao, trechos }]
// Para outras fontes (DOU, DOERJ...), basta criar outro driver.

const ID = 'querido-diario';
const API = () => process.env.QUERIDO_DIARIO_API || 'https://api.queridodiario.ok.org.br';

async function buscar({ termo, cidades, desde }) {
  const params = new URLSearchParams();
  cidades.forEach((id) => params.append('territory_ids', id));
  // Aspas = frase exata na sintaxe "simple query string" do OpenSearch
  params.set('querystring', `"${String(termo).replace(/["\\]/g, ' ').trim()}"`);
  params.set('published_since', desde);
  params.set('excerpt_size', '300');
  params.set('number_of_excerpts', '3');
  params.set('size', '50');
  params.set('sort_by', 'descending_date');

  const { data } = await axios.get(`${API()}/gazettes?${params}`, {
    timeout: 30000,
    headers: { 'User-Agent': 'Notifica.ai/1.0 (radar de diario oficial; contato: noreply@notifica.dev.br)' },
  });

  return (data?.gazettes ?? []).map((g) => ({
    data: String(g.date).slice(0, 10),
    url: g.url,
    cidadeId: String(g.territory_id),
    edicao: g.edition ? `${g.edition}${g.is_extra_edition ? ' (extra)' : ''}` : (g.is_extra_edition ? 'extra' : null),
    trechos: (g.excerpts ?? []).map((t) => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean),
  }));
}

// Data do diário mais recente de uma cidade (para a página de cobertura)
async function ultimaPublicacao(cidadeId) {
  const params = new URLSearchParams({ size: '1', sort_by: 'descending_date' });
  params.append('territory_ids', cidadeId);
  const { data } = await axios.get(`${API()}/gazettes?${params}`, { timeout: 30000 });
  return data?.gazettes?.[0]?.date ? String(data.gazettes[0].date).slice(0, 10) : null;
}

module.exports = { id: ID, nome: 'Querido Diário', buscar, ultimaPublicacao };
