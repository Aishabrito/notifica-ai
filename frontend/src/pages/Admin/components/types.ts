
export interface Feedback {
  _id: string;
  email: string;
  mensagem: string;
  lido: boolean;
  criadoEm: string;
}

export interface UserRecord {
  _id: string;
  email: string;
  role: "user" | "admin";
  criadoEm: string;
  alertas: number;
  plano: "free" | "pro";
  planoOrigem: "mercadopago" | "cortesia" | null;
  planoValidoAte: string | null;
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
  radar?: { monitoresAtivos: number; ocorrencias30d: number };
  totalUsers: number;
  totalAlerts: number;
  alertasPausados: number;
  alertasComErro: number;
  feedbacks: Feedback[];
  users: UserRecord[];
  alertas: AlertRecord[];
  crawlerHealth: CrawlerHealth;
}