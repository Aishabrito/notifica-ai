import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Plus, RotateCcw, Send, Link2, Play } from "lucide-react";
import api from "../../../services/Api";

type Tarefa = {
  id: string;
  tipo: string;
  prioridade: "alta" | "normal";
  titulo: string;
  descricao: string;
  link: string | null;
  status: "aberta" | "concluida";
  ocorrencias: number;
  criadaEm: string;
  ultimaOcorrenciaEm: string;
  concluidaEm: string | null;
  concluidaPor: string | null;
  nota: string | null;
  alerta: { id: string; url: string; titulo: string; status: string } | null;
  usuario: { id: string; nome: string; email: string } | null;
};

const ROTULO_TIPO: Record<string, string> = {
  "alerta-pausado": "Página",
  "fonte-radar": "Diário Oficial",
  ia: "IA",
  pagamento: "Pagamento",
  modelo: "Modelo pronto",
  configuracao: "Configuração",
  manual: "Lembrete",
};

const dataCurta = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

// Checklist do que o sistema não conseguiu resolver sozinho.
// O sistema abre as tarefas; a admin resolve e dá ok.
export default function ChecklistTarefas({ onMudou }: { onMudou?: (abertas: number) => void }) {
  const [status, setStatus] = useState<"aberta" | "concluida">("aberta");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);
  const [acao, setAcao] = useState<{ id: string; tipo: "avisar" | "url" } | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [link, setLink] = useState("");
  const [nota, setNota] = useState("");
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/api/admin/tarefas?status=${status}`);
      setTarefas(data.tarefas);
      onMudou?.(data.abertas);
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível carregar as tarefas." });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [status]);

  const executar = async (fn: () => Promise<{ data: { mensagem?: string } }>, sucesso: string) => {
    setAviso(null);
    try {
      const { data } = await fn();
      setAviso({ tipo: "ok", texto: data.mensagem ?? sucesso });
      setAcao(null); setMensagem(""); setLink(""); setNota("");
      await carregar();
    } catch (e: any) {
      setAviso({ tipo: "erro", texto: e.response?.data?.mensagem ?? "Algo deu errado." });
    }
  };

  const darOk = (t: Tarefa) => executar(() => api.patch(`/api/admin/tarefas/${t.id}`, { status: "concluida", nota: nota || undefined }), "Tarefa concluída.");
  const reabrir = (t: Tarefa) => executar(() => api.patch(`/api/admin/tarefas/${t.id}`, { status: "aberta" }), "Tarefa reaberta.");
  const criar = () => novo.trim().length >= 3 && executar(async () => { const r = await api.post("/api/admin/tarefas", { titulo: novo }); setNovo(""); return r; }, "Lembrete adicionado.");

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Tarefas para você</h3>
          <p className="text-xs text-slate-500 mt-0.5">O que o sistema não conseguiu resolver sozinho. Resolva e dê ok — algumas fecham sozinhas quando o problema some.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["aberta", "concluida"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md ${status === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
              {s === "aberta" ? "Pendentes" : "Concluídas"}
            </button>
          ))}
        </div>
      </div>

      {status === "aberta" && (
        <div className="flex gap-2 p-4 border-b border-slate-100">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && criar()}
            placeholder="Adicionar lembrete (ex.: conferir edital do IBGE na sexta)"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400" />
          <button onClick={criar} className="flex items-center gap-1 text-xs font-medium bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-700">
            <Plus size={13} /> Adicionar
          </button>
        </div>
      )}

      {aviso && (
        <p className={`mx-5 mt-4 text-xs rounded-lg px-3 py-2 ${aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{aviso.texto}</p>
      )}

      {carregando && tarefas.length === 0 ? (
        <div className="p-8 animate-pulse h-40" />
      ) : tarefas.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">{status === "aberta" ? "🎉 Nada pendente. O sistema está dando conta sozinho." : "Nenhuma tarefa concluída ainda."}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tarefas.map((t) => (
            <li key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => (t.status === "aberta" ? darOk(t) : reabrir(t))} title={t.status === "aberta" ? "Dar ok" : "Reabrir"} className="mt-0.5 shrink-0">
                  {t.status === "aberta"
                    ? <Circle size={18} className="text-slate-300 hover:text-emerald-500" />
                    : <CheckCircle2 size={18} className="text-emerald-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => setAberta(aberta === t.id ? null : t.id)} className="text-left w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.prioridade === "alta" && t.status === "aberta" && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">URGENTE</span>}
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{ROTULO_TIPO[t.tipo] ?? t.tipo}</span>
                      <span className={`text-sm font-medium ${t.status === "concluida" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titulo}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t.status === "aberta"
                        ? `Aberta ${dataCurta(t.criadaEm)}${t.ocorrencias > 1 ? ` · aconteceu ${t.ocorrencias}x (última ${dataCurta(t.ultimaOcorrenciaEm)})` : ""}`
                        : `Concluída ${dataCurta(t.concluidaEm)} por ${t.concluidaPor}`}
                    </p>
                  </button>

                  {aberta === t.id && (
                    <div className="mt-3 space-y-3 text-xs">
                      {t.descricao && <p className="text-slate-600 whitespace-pre-line">{t.descricao}</p>}
                      {t.usuario && <p className="text-slate-500">Pessoa: <strong>{t.usuario.nome}</strong> ({t.usuario.email})</p>}
                      {t.nota && <p className="text-slate-500 italic">Nota: {t.nota}</p>}

                      <div className="flex flex-wrap gap-2">
                        {t.link && (
                          <a href={t.link} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 font-medium text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50">
                            <ExternalLink size={12} /> Abrir para conferir
                          </a>
                        )}
                        {t.status === "aberta" && (t.usuario || t.alerta) && (
                          <button onClick={() => setAcao({ id: t.id, tipo: "avisar" })}
                            className="flex items-center gap-1 font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                            <Send size={12} /> Avisar a pessoa
                          </button>
                        )}
                        {t.status === "aberta" && t.alerta && (
                          <>
                            <button onClick={() => { setAcao({ id: t.id, tipo: "url" }); setLink(t.alerta!.url); }}
                              className="flex items-center gap-1 font-medium text-indigo-700 border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 rounded-lg">
                              <Link2 size={12} /> Trocar endereço
                            </button>
                            {t.alerta.status === "pausado" && (
                              <button onClick={() => executar(() => api.post(`/api/admin/tarefas/${t.id}/reativar-alerta`), "Reativado.")}
                                className="flex items-center gap-1 font-medium text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                                <Play size={12} /> Tentar de novo
                              </button>
                            )}
                          </>
                        )}
                        {t.status === "concluida" && (
                          <button onClick={() => reabrir(t)} className="flex items-center gap-1 font-medium text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                            <RotateCcw size={12} /> Reabrir
                          </button>
                        )}
                      </div>

                      {acao?.id === t.id && acao.tipo === "avisar" && (
                        <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                          <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3}
                            placeholder="Ex.: Saiu o edital! O site da banca está instável, então segue o link direto do PDF."
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400" />
                          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (opcional) — ex.: PDF do edital ou do Diário Oficial"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400" />
                          <div className="flex gap-2">
                            <button onClick={() => executar(() => api.post(`/api/admin/tarefas/${t.id}/avisar`, { mensagem, link }), "Aviso enviado.")}
                              className="font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg">Enviar por e-mail e dar ok</button>
                            <button onClick={() => setAcao(null)} className="text-slate-500 px-2">Cancelar</button>
                          </div>
                        </div>
                      )}

                      {acao?.id === t.id && acao.tipo === "url" && (
                        <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Novo endereço da página"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400" />
                          <div className="flex gap-2">
                            <button onClick={() => executar(() => api.post(`/api/admin/tarefas/${t.id}/trocar-url`, { url: link }), "Endereço trocado.")}
                              className="font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg">Salvar e voltar a monitorar</button>
                            <button onClick={() => setAcao(null)} className="text-slate-500 px-2">Cancelar</button>
                          </div>
                        </div>
                      )}

                      {t.status === "aberta" && !acao && (
                        <div className="flex gap-2">
                          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota ao dar ok (opcional)"
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 outline-none" />
                          <button onClick={() => darOk(t)} className="font-medium bg-slate-800 text-white px-3 py-1.5 rounded-lg">Dar ok</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
