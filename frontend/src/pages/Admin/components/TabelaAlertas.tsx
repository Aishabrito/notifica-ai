import { useState, useMemo } from "react";
import { Search, Filter, Bell, ExternalLink, Play, Pause, RefreshCw } from "lucide-react";
import { AlertRecord } from "./types";
import api from "../../../services/Api"; // Ajuste o caminho conforme sua estrutura

// ─── Helpers Locais ───────────────────────────────────────────────────────────
const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }) : "--";

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  }) : "--";

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700", "bg-pink-100 text-pink-700", "bg-amber-100 text-amber-700"];
const avatarColor = (email: string) => AVATAR_COLORS[(email?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (email: string) => (email || "??").slice(0, 2).toUpperCase();

function Avatar({ email }: { email: string }) {
  return (
    <div className={`w-7 h-7 text-[10px] rounded-full flex items-center justify-center font-medium shrink-0 ${avatarColor(email)}`}>
      {initials(email)}
    </div>
  );
}

function StatusBadge({ status }: { status: AlertRecord["status"] }) {
  const map: Record<AlertRecord["status"], string> = {
    ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pausado: "bg-slate-100 text-slate-500 border-slate-200",
    erro: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
// Adicionei a prop onRefresh para atualizar o dashboard após a ação
export default function AlertsTable({ alerts, onRefresh }: { alerts: AlertRecord[], onRefresh?: () => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertRecord["status"]>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return (alerts ?? []).filter(a => {
      const email = a.email?.toLowerCase() || "";
      const url = a.url?.toLowerCase() || "";
      const search = query.toLowerCase();
      const matchQ = !query || email.includes(search) || url.includes(search);
      const matchS = statusFilter === "all" || a.status === statusFilter;
      return matchQ && matchS;
    });
  }, [alerts, query, statusFilter]);

  const toggleStatus = async (alerta: AlertRecord) => {
    const novoStatus = alerta.status === 'ativo' ? 'pausado' : 'ativo';
    setLoadingId(alerta._id);
    
    try {
      const { data } = await api.patch(`/api/admin/alertas/${alerta._id}/status`, { status: novoStatus });
      if (data.sucesso && onRefresh) {
        onRefresh(); // Chama o fetchDados do pai para atualizar tudo sem reload
      }
    } catch (err) {
      console.error("Erro ao alternar status:", err);
      alert("Não foi possível alterar o status do alerta.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* ... (Cabeçalho da tabela permanece igual) ... */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Todos os alertas</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} de {alerts.length} registros</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="E-mail ou URL..."
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none focus:border-indigo-300 w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-600 py-1.5 px-2 outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="erro">Erro</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Bell size={16} className="text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum alerta encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase">Usuário</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase">URL</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase">Ações</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(a => (
                <tr key={a._id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-2">
                    <Avatar email={a.email} />
                    <span className="text-xs text-slate-600 truncate max-w-30">{a.email}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-50">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 flex items-center gap-1 truncate">
                      {a.url} <ExternalLink size={9} />
                    </a>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleStatus(a)}
                      disabled={loadingId === a._id}
                      className={`p-1.5 rounded-lg border transition-all ${
                        a.status === 'ativo' 
                          ? "text-amber-600 border-amber-100 hover:bg-amber-50" 
                          : "text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                      } disabled:opacity-50`}
                    >
                      {loadingId === a._id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : a.status === 'ativo' ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} fill="currentColor" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{fmtDate(a.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}