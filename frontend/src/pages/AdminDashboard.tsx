// src/pages/AdminDashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Bell,
  BellOff,
  MessageSquare,
  LogOut,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/Api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feedback {
  _id: string;
  email: string;
  mensagem: string;
  lido: boolean;
  criadoEm: string;
}

interface DashboardDados {
  totalUsers: number;
  totalAlerts: number;
  alertasPausados: number;
  feedbacks: Feedback[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  accent?: "indigo" | "emerald" | "rose" | "violet";
}

const ACCENT_MAP = {
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  val: "text-indigo-700",  ring: "ring-indigo-100"  },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", val: "text-emerald-700", ring: "ring-emerald-100" },
  rose:    { bg: "bg-rose-50",    icon: "text-rose-500",    val: "text-rose-600",    ring: "ring-rose-100"    },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  val: "text-violet-700",  ring: "ring-violet-100"  },
};

function StatCard({ icon: Icon, label, value, accent = "indigo" }: StatCardProps) {
  const c = ACCENT_MAP[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start justify-between gap-4 hover:shadow-md transition-shadow duration-200">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-4xl font-bold mt-1 tracking-tight ${c.val}`}>
          {value ?? (
            <span className="inline-block w-14 h-9 bg-slate-100 rounded-lg animate-pulse" />
          )}
        </p>
      </div>
      <div className={`${c.bg} ${c.icon} p-2.5 rounded-xl ring-1 ${c.ring} shrink-0`}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2.5">
          <div className="h-3 w-24 bg-slate-100 rounded-full" />
          <div className="h-9 w-16 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-11 w-11 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-3 w-20 bg-slate-100 rounded-full" /></td>
      <td className="px-6 py-4"><div className="h-3 w-36 bg-slate-100 rounded-full" /></td>
      <td className="px-6 py-4"><div className="h-3 w-full max-w-xs bg-slate-100 rounded-full" /></td>
      <td className="px-6 py-4"><div className="h-5 w-12 bg-slate-100 rounded-full" /></td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate         = useNavigate();
  const { usuario, logout } = useAuth();

  const [dados, setDados]         = useState<DashboardDados | null>(null);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const fetchDados = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/api/admin/dashboard");
      if (data.sucesso) setDados(data.dados);
      else throw new Error("Resposta inesperada do servidor.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { mensagem?: string } } };
      setError(e.response?.data?.mensagem ?? "Não foi possível carregar os dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDados(); }, []);

  const handleLogout = (): void => { logout(); navigate("/login"); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

          {/* Logo */}
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

          {/* Ações */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
            >
              <ArrowLeft size={14} />
              Voltar ao App
            </button>
            <button
              onClick={fetchDados}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all"
              title="Atualizar dados"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-10">

        {/* Título */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral da plataforma em tempo real.
            {usuario?.email && (
              <span className="ml-1.5 text-slate-400">
                Logado como <span className="font-medium text-slate-600">{usuario?.email}</span>
              </span>
            )}
          </p>
        </div>

        {/* ── Erro ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-5">
            <AlertCircle size={18} className="text-rose-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-rose-700 text-sm">Erro ao carregar dados</p>
              <p className="text-rose-600 text-sm mt-0.5">{error}</p>
            </div>
            <button
              onClick={fetchDados}
              className="flex items-center gap-1.5 text-sm font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {loading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard icon={Users}         label="Usuários Cadastrados" value={dados?.totalUsers}                  accent="indigo"  />
              <StatCard icon={Bell}          label="Alertas Ativos"       value={dados?.totalAlerts}                 accent="emerald" />
              <StatCard icon={BellOff}       label="Pausados / Erro"      value={dados?.alertasPausados}             accent="rose"    />
              <StatCard icon={MessageSquare} label="Feedbacks Recebidos"  value={dados?.feedbacks?.length ?? 0}      accent="violet"  />
            </>
          )}
        </div>

        {/* ── Tabela de Feedbacks ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Cabeçalho da tabela */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Feedbacks dos Usuários</h2>
              {dados && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {dados.feedbacks.length} {dados.feedbacks.length === 1 ? "registro" : "registros"}
                </p>
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <MessageSquare size={14} className="text-violet-600" />
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Data", "E-mail", "Mensagem", "Status"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </div>
          )}

          {/* Vazio */}
          {!loading && !error && dados?.feedbacks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <MessageSquare size={20} className="text-slate-400" />
              </div>
              <p className="font-medium text-slate-500">Nenhum feedback encontrado</p>
              <p className="text-sm text-slate-400 mt-1">As mensagens dos usuários aparecerão aqui.</p>
            </div>
          )}

          {/* Tabela preenchida */}
          {!loading && dados && dados.feedbacks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">E-mail</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensagem</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dados.feedbacks.map((fb) => (
                    <>
                      <tr
                        key={fb._id}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                        onClick={() => setExpandido(expandido === fb._id ? null : fb._id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatDate(fb.criadoEm)}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{fb.email}</td>
                        <td className="px-6 py-4 text-slate-600 max-w-sm truncate">{fb.mensagem}</td>
                        <td className="px-6 py-4">
                          {fb.lido ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Lido
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                              Novo
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expansão da mensagem completa */}
                      {expandido === fb._id && (
                        <tr key={`${fb._id}-exp`} className="bg-indigo-50/30">
                          <td colSpan={4} className="px-6 py-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mensagem completa</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{fb.mensagem}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Notifica.ai © {new Date().getFullYear()} · Painel restrito a administradores
      </footer>
    </div>
  );
}