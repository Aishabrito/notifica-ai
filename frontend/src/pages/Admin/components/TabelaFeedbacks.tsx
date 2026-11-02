import { useMemo, useState } from "react";
import { MessageSquare, Send, Download } from "lucide-react";
import { Feedback, StatusFeedback, TipoFeedback } from "./types";
import api from "../../../services/Api";
import { baixarPlanilha, dataHoraBR } from "../../../utils/planilha";

const TIPO: Record<TipoFeedback, { rotulo: string; cor: string }> = {
  reclamacao: { rotulo: "😠 Reclamação", cor: "bg-rose-50 text-rose-700 border-rose-200" },
  sugestao:   { rotulo: "💡 Sugestão", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  elogio:     { rotulo: "💚 Elogio", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  duvida:     { rotulo: "❓ Dúvida", cor: "bg-sky-50 text-sky-700 border-sky-200" },
  outro:      { rotulo: "💬 Outro", cor: "bg-slate-50 text-slate-600 border-slate-200" },
};
const STATUS: Record<StatusFeedback, { rotulo: string; cor: string }> = {
  novo:           { rotulo: "novo", cor: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  "em-andamento": { rotulo: "em andamento", cor: "bg-amber-50 text-amber-700 border-amber-200" },
  resolvido:      { rotulo: "resolvido", cor: "bg-slate-100 text-slate-500 border-slate-200" },
};

const tipoDe = (f: Feedback): TipoFeedback => f.tipo ?? "outro";
const statusDe = (f: Feedback): StatusFeedback => f.status ?? (f.lido ? "em-andamento" : "novo");

function Selo({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cor}`}>{children}</span>;
}

export default function TabelaFeedbacks({ feedbacks, onRefresh }: { feedbacks: Feedback[]; onRefresh?: () => void }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoFeedback | "todos">("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusFeedback | "abertos" | "todos">("abertos");
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = useMemo(() => feedbacks.filter((f) => {
    if (filtroTipo !== "todos" && tipoDe(f) !== filtroTipo) return false;
    if (filtroStatus === "abertos") return statusDe(f) !== "resolvido";
    return filtroStatus === "todos" || statusDe(f) === filtroStatus;
  }), [feedbacks, filtroTipo, filtroStatus]);

  const contagem = (t: TipoFeedback) => feedbacks.filter((f) => tipoDe(f) === t && statusDe(f) !== "resolvido").length;

  const abrir = async (f: Feedback) => {
    const abrindo = aberto !== f._id;
    setAberto(abrindo ? f._id : null);
    setResposta(""); setErro(null);
    if (abrindo && !f.lido) await api.patch(`/api/feedbacks/${f._id}`, { lido: true }).then(() => onRefresh?.()).catch(() => {});
  };

  const mudarStatus = async (f: Feedback, status: StatusFeedback) => {
    await api.patch(`/api/feedbacks/${f._id}`, { status }).catch(() => window.alert("Não foi possível mudar o status."));
    onRefresh?.();
  };

  const responder = async (f: Feedback) => {
    setEnviando(true); setErro(null);
    try {
      await api.post(`/api/feedbacks/${f._id}/responder`, { resposta });
      setResposta("");
      onRefresh?.();
    } catch (err: unknown) {
      setErro((err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ?? "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  const baixar = () => baixarPlanilha(`mensagens-notifica-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Data", "Tipo", "Status", "E-mail", "Mensagem", "Página", "Resposta", "Respondida em"],
    ...lista.map((f) => [dataHoraBR(f.criadoEm), TIPO[tipoDe(f)].rotulo.replace(/^\S+ /, ""), STATUS[statusDe(f)].rotulo, f.email, f.mensagem, f.pagina ?? "", f.resposta ?? "", dataHoraBR(f.respondidoEm)]),
  ]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Reclamações e sugestões</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {contagem("reclamacao")} reclamação(ões) e {contagem("sugestao")} sugestão(ões) em aberto · a resposta vai por e-mail para a pessoa
          </p>
        </div>
        <button onClick={baixar} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg">
          <Download size={12} /> Baixar planilha
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 border-b border-slate-100">
        {(["todos", ...Object.keys(TIPO)] as (TipoFeedback | "todos")[]).map((t) => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${filtroTipo === t ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            {t === "todos" ? "Todos os tipos" : TIPO[t].rotulo}
          </button>
        ))}
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
          className="ml-auto text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white">
          <option value="abertos">Em aberto</option>
          <option value="novo">Novos</option>
          <option value="em-andamento">Em andamento</option>
          <option value="resolvido">Resolvidos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <MessageSquare size={16} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">Nenhuma mensagem aqui</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.map((f) => {
            const exp = aberto === f._id;
            const st = statusDe(f);
            return (
              <li key={f._id} className={exp ? "bg-indigo-50/20" : ""}>
                <button onClick={() => abrir(f)} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50/30 flex flex-wrap items-start gap-x-3 gap-y-1.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Selo cor={TIPO[tipoDe(f)].cor}>{TIPO[tipoDe(f)].rotulo}</Selo>
                    <Selo cor={STATUS[st].cor}>{STATUS[st].rotulo}</Selo>
                  </div>
                  <div className="min-w-0 flex-1 basis-60">
                    <p className={`text-xs ${exp ? "whitespace-pre-wrap" : "truncate"} ${f.lido ? "text-slate-600" : "text-slate-900 font-semibold"}`}>{f.mensagem}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{f.email} · {dataHoraBR(f.criadoEm)}{f.pagina ? ` · em ${f.pagina}` : ""}{f.usuario ? " · tem conta" : ""}</p>
                  </div>
                </button>
                {exp && (
                  <div className="px-5 pb-4 space-y-3">
                    {f.resposta && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Sua resposta · {dataHoraBR(f.respondidoEm)}</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{f.resposta}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(STATUS) as StatusFeedback[]).filter((s) => s !== st).map((s) => (
                        <button key={s} onClick={() => mudarStatus(f, s)} className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 hover:bg-white">
                          Marcar como {STATUS[s].rotulo}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider" htmlFor={`resp-${f._id}`}>
                        Responder para {f.email}
                      </label>
                      <textarea id={`resp-${f._id}`} value={resposta} onChange={(e) => setResposta(e.target.value)} rows={4} maxLength={4000}
                        placeholder="Oi! Obrigada por avisar..."
                        className="mt-1.5 w-full text-xs border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-indigo-300" />
                      {erro && <p className="text-[11px] text-rose-600 mt-1">{erro}</p>}
                      <div className="flex justify-end mt-2">
                        <button disabled={enviando || resposta.trim().length < 2} onClick={() => responder(f)}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40">
                          <Send size={12} /> {enviando ? "Enviando..." : "Enviar por e-mail e resolver"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
