// ============================================
// 📰 RADAR DO DIÁRIO OFICIAL — CONFIGURAÇÃO
// ============================================
// Cidades que o Radar sabe atender (código IBGE de 7 dígitos). Para incluir
// outra, adicione aqui e confira em GET /api/radar/cobertura se a fonte tem
// os diários dela.
// Quais ficam DISPONÍVEIS para os usuários é escolhido em RADAR_CIDADES
// (ids separados por vírgula). Ex.: só o Rio → RADAR_CIDADES=3304557.
// Sem a variável, todas as da lista ficam disponíveis.

const TODAS_CIDADES = [
  { id: '3304557', nome: 'Rio de Janeiro', uf: 'RJ', preposicao: 'do' },
  { id: '3303302', nome: 'Niterói', uf: 'RJ' },
  { id: '3304904', nome: 'São Gonçalo', uf: 'RJ' },
  { id: '3301702', nome: 'Duque de Caxias', uf: 'RJ' },
  { id: '3303500', nome: 'Nova Iguaçu', uf: 'RJ' },
  { id: '3302700', nome: 'Maricá', uf: 'RJ' },
  // Federal: nomeações, posses e resultados de concursos federais
  { id: 'DOU', nome: 'Diário Oficial da União', uf: 'BR', federal: true },
];

const RADAR = {
  maxNomesPorUsuario: () => Number(process.env.RADAR_MAX_NOMES || 2),
  diasBuscaInicial: 30,   // 1ª busca olha os últimos 30 dias
  diasSobreposicao: 3,    // buscas seguintes repetem 3 dias (diários publicados com atraso)
  versaoConsentimento: 'radar-v1',
};

function cidadesDisponiveis() {
  const escolhidas = String(process.env.RADAR_CIDADES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const validas = TODAS_CIDADES.filter((c) => escolhidas.includes(c.id));
  return validas.length ? validas : TODAS_CIDADES;
}

// Nome de qualquer cidade conhecida (mesmo que não esteja mais disponível,
// para monitores antigos continuarem mostrando o nome)
const cidadePorId = (id) => TODAS_CIDADES.find((c) => c.id === id) ?? null;
const cidadeDisponivel = (id) => cidadesDisponiveis().some((c) => c.id === id);

// "Diário Oficial de Niterói" / "Diário Oficial da União"
function nomeDiario(id) {
  const fonte = cidadePorId(id);
  if (!fonte) return `Diário Oficial (${id})`;
  return fonte.federal ? fonte.nome : `Diário Oficial ${fonte.preposicao ?? 'de'} ${fonte.nome}`;
}

module.exports = { TODAS_CIDADES, cidadesDisponiveis, cidadeDisponivel, RADAR, cidadePorId, nomeDiario };
