// ============================================
// 📌 MODELOS PRONTOS ("monitorar com 1 clique")
// ============================================
// Páginas oficiais mais procuradas por vestibulandos e concurseiros.
// Depois do deploy, confira no painel admin (GET /api/admin/modelos/verificar)
// se cada uma responde e tem texto legível — sites que só montam o conteúdo
// com JavaScript não funcionam com o monitor e devem sair da lista.

const CATEGORIAS = {
  vestibular: 'ENEM e vestibulares',
  bolsas: 'SISU, ProUni e Fies',
  bancas: 'Bancas de concurso',
  orgaos: 'Órgãos e instituições',
};

const MODELOS = [
  { id: 'enem', categoria: 'vestibular', nome: 'ENEM (Inep)', descricao: 'Notícias, editais e cronograma do ENEM', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem' },
  { id: 'enem-gabaritos', categoria: 'vestibular', nome: 'ENEM — provas e gabaritos', descricao: 'Avisa quando sai o gabarito oficial', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos' },
  { id: 'uerj', categoria: 'vestibular', nome: 'Vestibular UERJ', descricao: 'Editais, resultados e reclassificações', url: 'https://www.vestibular.uerj.br/' },
  { id: 'fuvest', categoria: 'vestibular', nome: 'Fuvest (USP)', descricao: 'Vestibular da USP', url: 'https://www.fuvest.br/' },
  { id: 'unicamp', categoria: 'vestibular', nome: 'Comvest (Unicamp)', descricao: 'Vestibular da Unicamp', url: 'https://www.comvest.unicamp.br/' },

  { id: 'sisu', categoria: 'bolsas', nome: 'SISU', descricao: 'Cronograma, chamada regular e lista de espera', url: 'https://acessounico.mec.gov.br/sisu' },
  { id: 'prouni', categoria: 'bolsas', nome: 'ProUni', descricao: 'Bolsas em faculdades particulares', url: 'https://acessounico.mec.gov.br/prouni' },
  { id: 'fies', categoria: 'bolsas', nome: 'Fies', descricao: 'Financiamento estudantil', url: 'https://acessounico.mec.gov.br/fies' },

  { id: 'cebraspe', categoria: 'bancas', nome: 'Cebraspe', descricao: 'Concursos abertos e em andamento', url: 'https://www.cebraspe.org.br/concursos' },
  { id: 'fgv', categoria: 'bancas', nome: 'FGV Conhecimento', descricao: 'Concursos organizados pela FGV', url: 'https://conhecimento.fgv.br/concursos' },
  { id: 'cesgranrio', categoria: 'bancas', nome: 'Cesgranrio', descricao: 'Concursos organizados pela Cesgranrio', url: 'https://www.cesgranrio.org.br/concursos' },
  { id: 'vunesp', categoria: 'bancas', nome: 'Vunesp', descricao: 'Concursos e vestibulares da Vunesp', url: 'https://www.vunesp.com.br/' },

  { id: 'ibge', categoria: 'orgaos', nome: 'IBGE — trabalhe conosco', descricao: 'Concursos e processos seletivos do IBGE', url: 'https://www.ibge.gov.br/acesso-informacao/trabalhe-conosco.html' },
  { id: 'cefet-rj', categoria: 'orgaos', nome: 'CEFET/RJ', descricao: 'Avisos, concursos e processos seletivos', url: 'https://www.cefet-rj.br/' },
];

const modeloPorId = (id) => MODELOS.find((m) => m.id === id) ?? null;

module.exports = { CATEGORIAS, MODELOS, modeloPorId };
