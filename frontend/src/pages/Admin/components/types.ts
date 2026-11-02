
export type TipoFeedback = "reclamacao" | "sugestao" | "elogio" | "duvida" | "outro";
export type StatusFeedback = "novo" | "em-andamento" | "resolvido";

export interface Feedback {
  _id: string;
  email: string;
  mensagem: string;
  tipo?: TipoFeedback;
  status?: StatusFeedback;
  pagina?: string | null;
  usuario?: string | null;
  resposta?: string | null;
  respondidoEm?: string | null;
  lido: boolean;
  criadoEm: string;
}

export interface UserRecord {
  _id: string;
  nome?: string;
  email: string;
  role: "user" | "admin";
  perfil?: "vestibulando" | "lista-espera" | "concurseiro" | "aprovado" | null;
  emailVerificado?: boolean;
  criadoEm: string;
  ultimoAcessoEm?: string | null;
  alertas: number;
  plano: "free" | "pro";
  planoOrigem: "mercadopago" | "pix" | "cortesia" | "teste" | null;
  planoStatus?: "ativo" | "cancelado" | null;
  planoValidoAte: string | null;
  totalPago?: number;
  pagamentos?: number;
  telegram?: boolean;
}

export interface Crescimento {
  cadastrosHoje: number;
  cadastros7d: number;
  cadastros30d: number;
  ativos7d: number;
  ativos30d: number;
  emailsConfirmados: number;
  feedbacksNovos: number;
  reclamacoesAbertas: number;
}

export interface Pagamento {
  _id: string;
  tipo: "pix" | "cobranca" | "assinatura";
  oferta: string;
  valor: number;
  pago: boolean;
  status: string;
  statusTexto: string;
  data: string;
  usuario: { id: string; nome: string; email: string } | null;
}

export interface ResumoPagamentos {
  totalRecebido: number;
  pagamentosAprovados: number;
  pessoasQuePagaram: number;
  meses: { mes: string; total: number }[];
}

export interface AlertRecord {
  _id: string;
  userId: string;
  email: string;
  url: string;
  status: "ativo" | "pausado" | "erro";
  criadoEm: string;
  ultimaVerificacao: string;
}

export interface CrawlerLog {
  _id: string;
  tipo: "sucesso" | "erro" | "info" | "aviso";
  mensagem: string;
  criadoEm: string;
}

export interface CrawlerHealth {
  status: "operacional" | "degradado" | "falha";
  ultimaExecucao: string;
  proximaExecucao: string;
  totalVerificacoesHoje: number;
  mudancasDetectadasHoje: number;
  emailsEnviadosHoje: number;
  taxaSucessoEmail: number;
  logs: CrawlerLog[];
}

export interface Receita {
  assinantesCartao: number;
  proPix: number;
  cortesias: number;
  mrrCartao: number;
  pixRecebido30d: number;
  conversao: number;
}

export interface DashboardDados {
  receita?: Receita;
  crescimento?: Crescimento;
  radar?: { monitoresAtivos: number; ocorrencias30d: number };
  tarefasAbertas?: number;
  totalUsers: number;
  totalAlerts: number;
  alertasPausados: number;
  alertasComErro: number;
  feedbacks: Feedback[];
  users: UserRecord[];
  alertas: AlertRecord[];
  crawlerHealth: CrawlerHealth;
}