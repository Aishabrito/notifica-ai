import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Users } from "lucide-react";
import { UserRecord, AlertRecord } from "./types";

// ─── Helpers ───────────────────────────────────────────────────────────
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

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
  const map: Record<AlertRecord["status"], string> = {
    ativo:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    pausado: "bg-slate-100 text-slate-500 border-slate-200",
    erro:    "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function TabelaUsuarios({ users, alerts }: { users: UserRecord[]; alerts: AlertRecord[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // O filtro deve ficar AQUI dentro, logo após os useStates
  const filtered = useMemo(() => {
    const listaSegura = users ?? []; // Evita o erro de undefined
    return listaSegura.filter((u: UserRecord) => {
      return !query || u.email.toLowerCase().includes(query.toLowerCase());
    });
  }, [users, query]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-slate-900">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Usuários cadastrados</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} registros encontrados</p>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por e-mail..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-indigo-300 w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Usuário</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Alertas</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400 text-xs">
                  Nenhum usuário encontrado para esta busca.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const isExp = expanded === user._id;
                const userAlerts = (alerts ?? []).filter((a) => a.userId === user._id);
                return (
                  <React.Fragment key={user._id}>
                    <tr 
                      onClick={() => setExpanded(isExp ? null : user._id)} 
                      className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${isExp ? "bg-indigo-50/20" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar email={user.email} />
                          <span className="text-xs font-medium text-slate-700">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{user.alertas}</td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={3} className="px-5 py-3">
                          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-2">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Monitoramentos ativos</p>
                            {userAlerts.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Nenhum alerta configurado.</p>
                            ) : (
                              userAlerts.map((a) => (
                                <div key={a._id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <StatusBadge status={a.status} />
                                  <span className="text-[11px] truncate text-indigo-600 flex-1">{a.url}</span>
                                  <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink size={10} className="text-slate-400 hover:text-indigo-600" />
                                  </a>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}