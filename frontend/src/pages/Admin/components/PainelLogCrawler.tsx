import { CheckCircle, XCircle, AlertTriangle, Activity } from "lucide-react";
import type { ReactElement } from "react";
import { CrawlerLog } from "./types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

function LogTag({ tipo }: { tipo: CrawlerLog["tipo"] }) {
  const map: Record<CrawlerLog["tipo"], string> = {
    sucesso: "bg-emerald-50 text-emerald-700",
    erro:    "bg-rose-50 text-rose-700",
    info:    "bg-indigo-50 text-indigo-700",
    aviso:   "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${map[tipo]} shrink-0`}>
      {tipo}
    </span>
  );
}

export default function PainelLogCrawler({ logs }: { logs: CrawlerLog[] | undefined }) {
  const iconMap: Record<CrawlerLog["tipo"], ReactElement> = {
    sucesso: <CheckCircle   size={13} className="text-emerald-500 mt-0.5 shrink-0" />,
    erro:    <XCircle       size={13} className="text-rose-500 mt-0.5 shrink-0" />,
    aviso:   <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />,
    info:    <Activity      size={13} className="text-indigo-400 mt-0.5 shrink-0" />,
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Log de atividade</span>
        </div>
        {logs && <span className="text-[11px] text-slate-400">{logs.length} entradas</span>}
      </div>

      {!logs && (
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-slate-100 rounded-full animate-pulse" style={{ width: `${75 + (i % 3) * 10}%` }} />
          ))}
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
          {logs.map(log => (
            <div key={log._id} className="flex items-start gap-3 px-5 py-3">
              {iconMap[log.tipo]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <LogTag tipo={log.tipo} />
                  <span className="text-[10px] text-slate-400">{fmt(log.criadoEm)}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{log.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}