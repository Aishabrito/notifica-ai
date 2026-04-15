import React, { useState } from "react";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { Feedback } from "./types";
import api from "../../../services/Api"; // Garanta que o caminho do axios/api esteja correto

// ─── Helpers Locais ───────────────────────────────────────────────────────────
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

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

// ─── Componente Principal ─────────────────────────────────────────────────────
// Adicionada a prop onRefresh para sincronizar com o Dashboard
export default function FeedbacksTable({ 
  feedbacks, 
  onRefresh 
}: { 
  feedbacks: Feedback[]; 
  onRefresh?: () => void 
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = async (fb: Feedback) => {
    const isOpening = expanded !== fb._id;
    setExpanded(isOpening ? fb._id : null);

    // Se estiver abrindo um feedback que ainda não foi lido, marca como lido no back
    if (isOpening && !fb.lido) {
      try {
        // Ajuste esta rota conforme seu backend (ex: PATCH /api/admin/feedbacks/:id/lido)
        await api.patch(`/api/admin/feedbacks/${fb._id}/lido`);
        if (onRefresh) onRefresh(); 
      } catch (err) {
        console.error("Erro ao marcar como lido:", err);
      }
    }
  };

  if (feedbacks.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <MessageSquare size={16} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-500">Nenhum feedback encontrado</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Feedbacks dos usuários</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{feedbacks.length} {feedbacks.length === 1 ? "registro" : "registros"}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
          <MessageSquare size={13} className="text-violet-600" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mensagem</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {feedbacks.map(fb => {
              const isExp = expanded === fb._id;
              return (
                <React.Fragment key={fb._id}>
                  <tr
                    onClick={() => toggle(fb)}
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${isExp ? "bg-indigo-50/20" : ""}`}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-slate-500">{fmt(fb.criadoEm)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar email={fb.email} />
                        <span className="text-xs font-medium text-slate-700">{fb.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-sm">
                      <span className={`text-xs block truncate ${fb.lido ? "text-slate-400" : "text-slate-600 font-medium"}`}>
                        {fb.mensagem}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {fb.lido ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          <CheckCircle2 size={10} /> lido
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm animate-pulse">
                          novo
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExp && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={4} className="px-5 py-3">
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-1">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mensagem completa</p>
                          <p className="text-xs text-slate-700 leading-relaxed italic">"{fb.mensagem}"</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}