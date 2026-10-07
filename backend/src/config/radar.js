// ============================================
// 📰 RADAR DO DIÁRIO OFICIAL — CONFIGURAÇÃO
// ============================================
// Cidades atendidas (código IBGE de 7 dígitos). Começamos pela região
// metropolitana do Rio; para incluir outra cidade basta adicioná-la aqui
// (e conferir em GET /api/radar/cobertura se o Querido Diário tem os diários).

const CIDADES_RADAR = [
  { id: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
  { id: '3303302', nome: 'Niterói', uf: 'RJ' },
  { id: '3304904', nome: 'São Gonçalo', uf: 'RJ' },
  { id: '3301702', nome: 'Duque de Caxias', uf: 'RJ' },
  { id: '3303500', nome: 'Nova Iguaçu', uf: 'RJ' },
  { id: '3302700', nome: 'Maricá', uf: 'RJ' },
];

const RADAR = {
  maxNomesPorUsuario: () => Number(process.env.RADAR_MAX_NOMES || 2),
  diasBuscaInicial: 30,   // 1ª busca olha os últimos 30 dias
  diasSobreposicao: 3,    // buscas seguintes repetem 3 dias (diários publicados com atraso)
  versaoConsentimento: 'radar-v1',
};

const cidadePorId = (id) => CIDADES_RADAR.find((c) => c.id === id) ?? null;

module.exports = { CIDADES_RADAR, RADAR, cidadePorId };
