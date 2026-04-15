import { Activity, Clock, Zap, TrendingUp, CheckCircle } from "lucide-react";
import { CrawlerHealth } from "./types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

export default function PainelSaudeCrawler({ health }: { health: CrawlerHealth | undefined }) {
  if (!health) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse h-64" />
  );

  const statusConfig = {
    operacional: { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50", label: "operacional" },
    degradado:   { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",   label: "degradado"   },
    falha:       { dot: "bg-rose-400",    text: "text-rose-700",    bg: "bg-rose-50",    label: "falha"       },
  };
  const sc = statusConfig[health.status];

  const bars = [
    { label: "Verificações", value: health.totalVerificacoesHoje, max: 300, color: "bg-indigo-400" },
    { label: "Mudanças",     value: health.mudancasDetectadasHoje, max: 20,  color: "bg-emerald-400" },
    { label: "E-mails",      value: health.emailsEnviadosHoje,     max: 20,  color: "bg-violet-400" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Saúde do Crawler</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
        <div className="p-4">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><Clock size={10} />Última execução</p>
          <p className="text-sm font-medium text-slate-700">{fmt(health.ultimaExecucao)}</p>
        </div>
        <div className="p-4">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><Zap size={10} />Próxima execução</p>
          <p className="text-sm font-medium text-slate-700">{fmt(health.proximaExecucao)}</p>
        </div>
        <div className="p-4">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><TrendingUp size={10} />Taxa de sucesso (email)</p>
          <p className="text-sm font-medium text-slate-700">{health.taxaSucessoEmail}%</p>
        </div>
        <div className="p-4">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><CheckCircle size={10} />Mudanças hoje</p>
          <p className="text-sm font-medium text-slate-700">{health.mudancasDetectadasHoje} detectadas</p>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">Atividade de hoje</p>
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-3 mb-2.5 last:mb-0">
            <span className="text-[11px] text-slate-400 w-20 text-right shrink-0">{b.label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${b.color} transition-all duration-700`}
                style={{ width: `${Math.min(100, Math.round((b.value / b.max) * 100))}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 w-8 text-right shrink-0">{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}