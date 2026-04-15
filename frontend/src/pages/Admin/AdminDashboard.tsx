
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, Users, Bell, BellOff, MessageSquare, 
  LogOut, ArrowLeft, RefreshCw, AlertCircle 
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/Api";
import { DashboardDados } from "./components/types"; 

// ─── Importação dos Componentes Filhos ────────────────────────────────────────
import StatCard from "./components/StatCard";
import PainelSaudeCrawler from "./components/PainelSaudeCrawler";
import PainelLogCrawler from "./components/PainelLogCrawler";
import TabelaUsuarios from "./components/TabelaUsuarios";
import TabelaAlertas from "./components/TabelaAlertas";
import TabelaFeedbacks from "./components/TabelaFeedbacks";

type Tab = "visao-geral" | "usuarios" | "alertas" | "feedbacks";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [dados, setDados] = useState<DashboardDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("visao-geral");

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
    { id: "visao-geral", label: "Visão geral", icon: Activity },
    { id: "usuarios",    label: "Usuários",    icon: Users },
    { id: "alertas",     label: "Alertas",     icon: Bell },
    { id: "feedbacks",   label: "Feedbacks",   icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">N</span>
            </div>
            <span className="font-bold text-slate-800 tracking-tight">
              Notifica<span className="text-indigo-600">.ai</span>
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate("/dashboard")} 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
            >
              <ArrowLeft size={13} /> Voltar ao app
            </button>
            <button 
              onClick={fetchDados} 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        
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
                sub={`${dados?.users?.filter(u => u.role === "admin").length ?? 0} admins`} 
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
                icon={MessageSquare} label="Feedbacks" value={dados?.feedbacks?.length ?? 0} 
                accent="text-violet-700" iconBg="bg-violet-50 text-violet-500" 
                sub={`${dados?.feedbacks?.filter(f => !f.lido).length ?? 0} não lidos`} 
              />
            </>
          )}
        </div>

        {/* ── Seleção de Abas ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit mb-6 shadow-sm">
          {TABS.map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id)} 
              className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg transition-all ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── Conteúdo das Abas com Proteção de Dados ── */}
        {tab === "visao-geral" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
        {tab !== "visao-geral" && loading && !dados && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-pulse h-64" />
        )}

      </main>

      <footer className="mt-12 border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Notifica.ai © {new Date().getFullYear()} · Painel restrito a administradores
      </footer>
    </div>
  );
}