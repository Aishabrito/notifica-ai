
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Users, Bell, BellOff, MessageSquare, LogOut, ArrowLeft, RefreshCw, AlertCircle, Wallet, TrendingUp, Gem, Newspaper, ListChecks, CalendarDays, UserPlus, MousePointerClick, MailCheck, CircleDollarSign } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/Api";
import { DashboardDados } from "./components/types"; 

// ─── Importação dos Componentes Filhos ────────────────────────────────────────
import StatCard from "./components/StatCard";
import PainelSaudeCrawler from "./components/PainelSaudeCrawler";
import PainelLogCrawler from "./components/PainelLogCrawler";
import PainelSaudeSistema from "./components/PainelSaudeSistema";
import ChecklistTarefas from "./components/ChecklistTarefas";
import GerenciarCalendario from "./components/GerenciarCalendario";
import TabelaUsuarios from "./components/TabelaUsuarios";
import TabelaAlertas from "./components/TabelaAlertas";
import TabelaFeedbacks from "./components/TabelaFeedbacks";
import TabelaPagamentos from "./components/TabelaPagamentos";

type Tab = "tarefas" | "visao-geral" | "usuarios" | "pagamentos" | "alertas" | "feedbacks" | "calendario";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [dados, setDados] = useState<DashboardDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tarefas");
  const [tarefasAbertas, setTarefasAbertas] = useState<number | null>(null);

  const fetchDados = async () => {
    // Se já temos dados, não mostramos o skeleton de loading pesado, 
    // apenas o ícone de girar no botão "Atualizar"
    if (!dados) setLoading(true); 
    
    setError(null);
    try {
      const { data } = await api.get("/api/admin/dashboard");
      if (data.sucesso) {
        setDados(data.dados);
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
    } catch (err: any) {
      setError(err.response?.data?.mensagem ?? "Não foi possível carregar os dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "tarefas",     label: `Tarefas${(tarefasAbertas ?? dados?.tarefasAbertas) ? ` (${tarefasAbertas ?? dados?.tarefasAbertas})` : ""}`, icon: ListChecks },
    { id: "visao-geral", label: "Visão geral", icon: Activity },
    { id: "usuarios",    label: "Usuários",    icon: Users },
    { id: "pagamentos",  label: "Pagamentos",  icon: CircleDollarSign },
    { id: "feedbacks",   label: `Reclamações e sugestões${dados?.crescimento?.feedbacksNovos ? ` (${dados.crescimento.feedbacksNovos})` : ""}`, icon: MessageSquare },
    { id: "alertas",     label: "Alertas",     icon: Bell },
    { id: "calendario",  label: "Calendário",  icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">N</span>
            </div>
            <span className="font-bold text-slate-800 tracking-tight">
              Notifica<span className="text-indigo-600">.ai</span>
            </span>
            <span className="hidden sm:inline text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate("/dashboard")} aria-label="Voltar ao app" 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
            >
              <ArrowLeft size={13} /> <span className="hidden sm:inline">Voltar ao app</span>
            </button>
            <button 
              onClick={fetchDados} aria-label="Atualizar"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button 
              onClick={handleLogout} aria-label="Sair" 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all"
            >
              <LogOut size={13} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        
        {/* ── Título ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão da plataforma em tempo real. 
            {usuario?.email && (
              <span className="ml-1.5 text-slate-400">
                Logado como <span className="font-medium text-slate-600">{usuario.email}</span>
              </span>
            )}
          </p>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-rose-700 text-sm">Erro de carregamento</p>
              <p className="text-rose-600 text-xs mt-0.5">{error}</p>
            </div>
            <button 
              onClick={fetchDados} 
              className="text-xs font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading && !dados ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse h-24" />
            ))
          ) : (
            <>
              <StatCard 
                icon={Users} label="Usuários" value={dados?.totalUsers} 
                accent="text-indigo-700" iconBg="bg-indigo-50 text-indigo-500" 
                sub={dados?.crescimento ? `+${dados.crescimento.cadastrosHoje} hoje · +${dados.crescimento.cadastros7d} em 7 dias` : `${dados?.users?.filter(u => u.role === "admin").length ?? 0} admins`} 
              />
              <StatCard 
                icon={Bell} label="Alertas ativos" value={dados?.totalAlerts} 
                accent="text-emerald-700" iconBg="bg-emerald-50 text-emerald-500" 
                sub="monitorando agora" 
              />
              <StatCard 
                icon={BellOff} label="Pausados / erro" value={(dados?.alertasPausados ?? 0) + (dados?.alertasComErro ?? 0)} 
                accent="text-rose-700" iconBg="bg-rose-50 text-rose-400" 
                sub={`${dados?.alertasComErro ?? 0} com erro`} 
              />
              <StatCard 
                icon={MessageSquare} label="Mensagens novas" value={dados?.crescimento?.feedbacksNovos ?? dados?.feedbacks?.filter(f => !f.lido).length ?? 0} 
                accent="text-violet-700" iconBg="bg-violet-50 text-violet-500" 
                sub={`${dados?.crescimento?.reclamacoesAbertas ?? 0} reclamação(ões) em aberto`} 
              />
            </>
          )}
        </div>

        {/* ── Cadastros e uso ── */}
        {dados?.crescimento && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={UserPlus} label="Contas novas (30 dias)" value={dados.crescimento.cadastros30d}
              accent="text-indigo-700" iconBg="bg-indigo-50 text-indigo-500"
              sub={`${dados.crescimento.cadastros7d} nos últimos 7 dias`}
            />
            <StatCard
              icon={MousePointerClick} label="Usaram (7 dias)" value={dados.crescimento.ativos7d}
              accent="text-emerald-700" iconBg="bg-emerald-50 text-emerald-500"
              sub={`${dados.crescimento.ativos30d} nos últimos 30 dias`}
            />
            <StatCard
              icon={MailCheck} label="E-mail confirmado" value={dados.crescimento.emailsConfirmados}
              accent="text-sky-700" iconBg="bg-sky-50 text-sky-500"
              sub={`de ${dados.totalUsers} conta(s)`}
            />
            <StatCard
              icon={CircleDollarSign} label="Já pagaram" value={dados.users.filter((u) => (u.totalPago ?? 0) > 0).length}
              accent="text-emerald-700" iconBg="bg-emerald-50 text-emerald-500"
              sub="pessoas · detalhes em Pagamentos"
            />
          </div>
        )}

        {/* ── Receita e Pro ── */}
        {dados?.receita && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Wallet} label="Receita recorrente" value={Math.round(dados.receita.mrrCartao)}
              accent="text-emerald-700" iconBg="bg-emerald-50 text-emerald-500"
              sub={`R$/mês · ${dados.receita.assinantesCartao} assinante(s) no cartão`}
            />
            <StatCard
              icon={Gem} label="Pix (30 dias)" value={Math.round(dados.receita.pixRecebido30d)}
              accent="text-sky-700" iconBg="bg-sky-50 text-sky-500"
              sub={`R$ · ${dados.receita.proPix} Pro via Pix ativos`}
            />
            <StatCard
              icon={TrendingUp} label="Conversão" value={dados.receita.conversao}
              accent="text-violet-700" iconBg="bg-violet-50 text-violet-500"
              sub={`% pagantes · ${dados.receita.cortesias} cortesia(s)`}
            />
            <StatCard
              icon={Newspaper} label="Radar DO" value={dados.radar?.monitoresAtivos ?? 0}
              accent="text-amber-700" iconBg="bg-amber-50 text-amber-500"
              sub={`nomes ativos · ${dados.radar?.ocorrencias30d ?? 0} publicações em 30 dias`}
            />
          </div>
        )}

        {/* ── Seleção de Abas ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 max-w-full w-fit overflow-x-auto mb-6 shadow-sm">
          {TABS.map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id)} 
              className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── Conteúdo das Abas com Proteção de Dados ── */}
        {tab === "tarefas" && <ChecklistTarefas onMudou={setTarefasAbertas} />}
        {tab === "calendario" && <GerenciarCalendario />}
        {tab === "pagamentos" && <TabelaPagamentos />}

        {tab === "visao-geral" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PainelSaudeSistema />
            <PainelSaudeCrawler health={dados?.crawlerHealth} />
            <PainelLogCrawler logs={dados?.crawlerHealth?.logs ?? []} />
          </div>
        )}

        {tab === "usuarios" && dados && (
          <TabelaUsuarios 
            users={dados.users ?? []} 
            alerts={dados.alertas ?? []} 
            onRefresh={fetchDados} 
          />
        )}

        {tab === "alertas" && dados && (
          <TabelaAlertas 
            alerts={dados.alertas ?? []} 
            onRefresh={fetchDados} 
          />
        )}

        {tab === "feedbacks" && dados && (
          <TabelaFeedbacks 
            feedbacks={dados.feedbacks ?? []} 
            onRefresh={fetchDados} 
          />
        )}

        {/* Loading State para abas */}
        {tab !== "visao-geral" && tab !== "tarefas" && tab !== "calendario" && loading && !dados && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-pulse h-64" />
        )}

      </main>

      <footer className="mt-12 border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Notifica.ai © {new Date().getFullYear()} · Painel restrito a administradores
      </footer>
    </div>
  );
}