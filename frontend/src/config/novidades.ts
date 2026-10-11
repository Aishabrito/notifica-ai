// ✨ Novidades mostradas no painel. Para anunciar algo novo, adicione no TOPO
// com um id novo (o painel mostra o que a pessoa ainda não viu).
export interface Novidade { id: string; emoji: string; titulo: string; texto: string; link?: string; acao?: string; pro?: boolean }

export const NOVIDADES: Novidade[] = [
  { id: "2026-10-nomeacao", emoji: "🏛️", titulo: "Aprovado(a)? Não perca a nomeação", texto: "Acompanhe a validade do concurso e, com o Radar, receba aviso urgente na nomeação — com o prazo de posse e o checklist de documentos.", link: "/radar", acao: "Cadastrar meu concurso" },
  { id: "2026-10-chamadas", emoji: "📊", titulo: "Quantas chamadas faltam até você", texto: "Registre as chamadas da lista de espera e veja quanto falta até a sua posição — a IA registra sozinha no Pro.", link: "/dashboard", acao: "Ver minha lista" },
  { id: "2026-10-push", emoji: "📲", titulo: "Avisos no celular, na hora", texto: "Ative as notificações e receba o aviso na tela do celular assim que algo mudar — mais rápido que o e-mail.", link: "/conta", acao: "Ativar notificações" },
  { id: "2026-10-prazos", emoji: "⏰", titulo: "Prazos e Código Vermelho", texto: "A IA acha as datas do edital (até o prazo de recurso do gabarito) e te lembra 72h, 24h e 3h antes. Dá para colocar tudo na sua agenda.", link: "/prazos", acao: "Ver meus prazos", pro: true },
  { id: "2026-10-posicao", emoji: "📍", titulo: "Sua posição na lista de espera", texto: "Diga como seu nome aparece na lista e avisamos quando você subir — ou quando for chamado(a).", link: "/dashboard", acao: "Ativar em um alerta" },
  { id: "2026-10-editais", emoji: "📢", titulo: "Radar de editais", texto: "Escolha seu cargo e saiba quando sair concurso para ele no Diário Oficial.", link: "/radar", acao: "Escolher meu cargo", pro: true },
  { id: "2026-10-pastas", emoji: "📁", titulo: "Pastas para o grupo de estudo", texto: "Junte as páginas de um concurso e mande o link: quem abrir monitora tudo com 1 clique.", link: "/dashboard", acao: "Criar uma pasta" },
  { id: "2026-10-indique", emoji: "🎁", titulo: "Indique e ganhe 30 dias de Pro", texto: "Cada amigo que assinar pelo seu link vale 30 dias de Pro para você.", link: "/conta", acao: "Pegar meu link" },
  { id: "2026-10-modelos", emoji: "⚡", titulo: "Modelos prontos", texto: "ENEM, SISU, ProUni, Fies e as principais bancas para monitorar com 1 clique.", link: "/dashboard", acao: "Ver modelos" },
  { id: "2026-10-aparencia", emoji: "🎨", titulo: "Tema claro e cores", texto: "Achou o site escuro demais? Troque para o tema claro ou mude a cor no botão 🎨.", link: "/conta", acao: "Mudar aparência" },
];
