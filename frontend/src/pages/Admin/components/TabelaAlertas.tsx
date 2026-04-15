import { useState, useMemo } from "react";
import { Search, Filter, Bell, ExternalLink } from "lucide-react";
import { AlertRecord } from "./types";

// ─── Helpers Locais ───────────────────────────────────────────────────────────
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });

const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700", "bg-pink-100 text-pink-700", "bg-amber-100 text-amber-700"];
const avatarColor = (email: string) => AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
const initials = (email: string) => email.slice(0, 2).toUpperCase();

function Avatar({ email }: { email: string }) {
  return (
    <div className={`w-7 h-7 text-[10px] rounded-full flex items-center justify-center font-medium shrink-0 ${avatarColor(email)}`}>
      {initials(email)}
    </div>
  );
}

function StatusBadge({ status }: { status: AlertRecord["status"] }) {
  // A tipagem mágica que o TypeScript estava pedindo:
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
export default function AlertsTable({ alerts }: { alerts: AlertRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertRecord["status"]>("all");

 const filtered = useMemo(() => {
  return (alerts ?? []).filter(a => {
    const matchQ = !query || a.email.toLowerCase().includes(query.toLowerCase()) || a.url.toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === "all" || a.status === statusFilter;
    return matchQ && matchS;
  });
}, [alerts, query, statusFilter]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white transition-colors w-48"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter size={11} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-600 py-1.5 px-2 outline-none focus:border-indigo-300"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">ativo</option>
              <option value="pausado">pausado</option>
              <option value="erro">erro</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Bell size={16} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">Nenhum alerta encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">URL monitorada</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Criado em</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Última verificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(a => (
                <tr key={a._id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar email={a.email} />
                      <span className="text-xs text-slate-600 max-w-35 truncate">{a.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 max-w-60">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 truncate"
                      title={a.url}
                    >
                      <span className="truncate">{a.url}</span>
                      <ExternalLink size={9} className="shrink-0" />
                    </a>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-xs text-slate-500">{fmtDate(a.criadoEm)}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-xs text-slate-500">{fmt(a.ultimaVerificacao)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}