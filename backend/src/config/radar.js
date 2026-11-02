// ============================================
// 📰 RADAR DO DIÁRIO OFICIAL — CONFIGURAÇÃO
// ============================================
// Cidades que o Radar sabe atender (código IBGE de 7 dígitos).
// - "sempre": conferidas à mão, aparecem sempre.
// - As demais (capitais e cidades grandes) só aparecem para escolha quando a
//   fonte tem diário recente — conferido sozinho todo dia (service/radar/cobertura.js).
// RADAR_CIDADES (ids separados por vírgula) restringe a lista. Ex.: só o Rio
// e o DOU → RADAR_CIDADES=3304557,DOU. Sem a variável, vale a lista toda.

const TODAS_CIDADES = [
  { id: '3304557', nome: 'Rio de Janeiro', uf: 'RJ', preposicao: 'do', sempre: true },
  { id: '3303302', nome: 'Niterói', uf: 'RJ', sempre: true },
  { id: '3304904', nome: 'São Gonçalo', uf: 'RJ', sempre: true },
  { id: '3301702', nome: 'Duque de Caxias', uf: 'RJ', sempre: true },
  { id: '3303500', nome: 'Nova Iguaçu', uf: 'RJ', sempre: true },
  { id: '3302700', nome: 'Maricá', uf: 'RJ', sempre: true },
  // Federal: nomeações, posses e resultados de concursos federais
  { id: 'DOU', nome: 'Diário Oficial da União', uf: 'BR', federal: true, sempre: true },

  // Mais cidades do RJ
  { id: '3300456', nome: 'Belford Roxo', uf: 'RJ' },
  { id: '3305109', nome: 'São João de Meriti', uf: 'RJ' },
  { id: '3303906', nome: 'Petrópolis', uf: 'RJ' },
  { id: '3301009', nome: 'Campos dos Goytacazes', uf: 'RJ' },
  { id: '3306305', nome: 'Volta Redonda', uf: 'RJ' },
  { id: '3302403', nome: 'Macaé', uf: 'RJ' },

  // Capitais
  { id: '3550308', nome: 'São Paulo', uf: 'SP' },
  { id: '3106200', nome: 'Belo Horizonte', uf: 'MG' },
  { id: '3205309', nome: 'Vitória', uf: 'ES' },
  { id: '4106902', nome: 'Curitiba', uf: 'PR' },
  { id: '4205407', nome: 'Florianópolis', uf: 'SC' },
  { id: '4314902', nome: 'Porto Alegre', uf: 'RS' },
  { id: '2927408', nome: 'Salvador', uf: 'BA' },
  { id: '2611606', nome: 'Recife', uf: 'PE' },
  { id: '2304400', nome: 'Fortaleza', uf: 'CE' },
  { id: '2408102', nome: 'Natal', uf: 'RN' },
  { id: '2507507', nome: 'João Pessoa', uf: 'PB' },
  { id: '2704302', nome: 'Maceió', uf: 'AL' },
  { id: '2800308', nome: 'Aracaju', uf: 'SE' },
  { id: '2211001', nome: 'Teresina', uf: 'PI' },
  { id: '2111300', nome: 'São Luís', uf: 'MA' },
  { id: '1501402', nome: 'Belém', uf: 'PA' },
  { id: '1302603', nome: 'Manaus', uf: 'AM' },
  { id: '1600303', nome: 'Macapá', uf: 'AP' },
  { id: '1400100', nome: 'Boa Vista', uf: 'RR' },
  { id: '1100205', nome: 'Porto Velho', uf: 'RO' },
  { id: '1200401', nome: 'Rio Branco', uf: 'AC' },
  { id: '1721000', nome: 'Palmas', uf: 'TO' },
  { id: '5208707', nome: 'Goiânia', uf: 'GO' },
  { id: '5103403', nome: 'Cuiabá', uf: 'MT' },
  { id: '5002704', nome: 'Campo Grande', uf: 'MS' },

  // Cidades grandes de SP
  { id: '3509502', nome: 'Campinas', uf: 'SP' },
  { id: '3518800', nome: 'Guarulhos', uf: 'SP' },
];

const RADAR = {
  maxNomesPorUsuario: () => Number(process.env.RADAR_MAX_NOMES || 2),
  diasBuscaInicial: 30,   // 1ª busca olha os últimos 30 dias
  diasSobreposicao: 3,    // buscas seguintes repetem 3 dias (diários publicados com atraso)
  versaoConsentimento: 'radar-v1',
};

// Cidades permitidas pela RADAR_CIDADES (sem olhar a cobertura)
function cidadesAtendidas() {
  const escolhidas = String(process.env.RADAR_CIDADES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const validas = TODAS_CIDADES.filter((c) => escolhidas.includes(c.id));
  return validas.length ? validas : TODAS_CIDADES;
}

// As que dependem da conferência automática de cobertura
const candidatas = () => cidadesAtendidas().filter((c) => !c.sempre);

// O que aparece para escolher no site: as conferidas à mão + as com diário recente
function cidadesDisponiveis() {
  const { temCobertura } = require('../service/radar/cobertura');
  return cidadesAtendidas()
    .filter((c) => c.sempre || temCobertura(c.id))
    .map(({ sempre, ...c }) => c); // eslint-disable-line no-unused-vars
}

// Nome de qualquer cidade conhecida (mesmo que não esteja mais disponível,
// para monitores antigos continuarem mostrando o nome)
const cidadePorId = (id) => TODAS_CIDADES.find((c) => c.id === id) ?? null;
const cidadeDisponivel = (id) => cidadesDisponiveis().some((c) => c.id === id);
// Quem já monitora uma cidade continua sendo buscado nela, mesmo se a
// conferência de cobertura falhar um dia
const cidadeAtendida = (id) => cidadesAtendidas().some((c) => c.id === id);

// "Diário Oficial de Niterói" / "Diário Oficial da União"
function nomeDiario(id) {
  const fonte = cidadePorId(id);
  if (!fonte) return `Diário Oficial (${id})`;
  return fonte.federal ? fonte.nome : `Diário Oficial ${fonte.preposicao ?? 'de'} ${fonte.nome}`;
}

module.exports = { TODAS_CIDADES, cidadesDisponiveis, cidadesAtendidas, candidatas, cidadeDisponivel, cidadeAtendida, RADAR, cidadePorId, nomeDiario };
