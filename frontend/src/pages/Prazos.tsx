import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

type Tipo = "inscricao" | "prova" | "recurso" | "resultado" | "matricula" | "documentos" | "outro";
interface Item { id: string; item: string; feito: boolean }
interface Prazo {
  id: string; titulo: string; contexto: string | null; url: string | null; data: string; hora: string | null;
  tipo: Tipo; origem: "ia" | "manual"; concluido: boolean; limite: string; checklist: Item[];
}
interface Estado { ehPro: boolean; agenda: string | null; prazos: Prazo[]; concluidos: Prazo[] }

const ROTULO: Record<Tipo, string> = {
  inscricao: "Inscrição", prova: "Prova", recurso: "Recurso", resultado: "Resultado",
  matricula: "Matrícula", documentos: "Documentos", outro: "Prazo",
};

const HORA = 3600e3;
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function falta(limite: string) {
  const h = (new Date(limite).getTime() - Date.now()) / HORA;
  if (h <= 0) return { texto: "encerrado", h };
  if (h < 1) return { texto: "menos de 1h", h };
  if (h < 48) return { texto: `${Math.floor(h)}h`, h };
  return { texto: `${Math.floor(h / 24)} dias`, h };
}

function mensagemErro(err: unknown, padrao: string) {
  return (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ?? padrao;
}

export default function Prazos() {
  const { usuario } = useAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ titulo: "", data: "", hora: "", tipo: "outro" as Tipo });
  const [novoItem, setNovoItem] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const [comChecklist, setComChecklist] = useState<Set<string>>(new Set());
  const [, setRelogio] = useState(0);

  const carregar = async () => {
    try {
      const { data } = await api.get("/api/prazos");
      setEstado(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível carregar os prazos."));
    }
  };

  useEffect(() => { carregar(); }, []);
  // contagem regressiva atualiza a cada minuto
  useEffect(() => { const t = setInterval(() => setRelogio((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  const salvar = async (id: string, corpo: object) => {
    setErro("");
    try {
      const { data } = await api.patch(`/api/prazos/${id}`, corpo);
      setEstado((e) => e && ({
        ...e,
        prazos: data.prazo.concluido ? e.prazos.filter((p) => p.id !== id) : e.prazos.map((p) => (p.id === id ? data.prazo : p)),
        concluidos: data.prazo.concluido ? [data.prazo, ...e.concluidos.filter((p) => p.id !== id)] : e.concluidos.filter((p) => p.id !== id),
      }));
      if (!data.prazo.concluido && !estado?.prazos.some((p) => p.id === id)) carregar();
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível salvar."));
    }
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    try {
      await api.post("/api/prazos", { ...form, hora: form.hora || undefined });
      setForm({ titulo: "", data: "", hora: "", tipo: "outro" });
      carregar();
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível criar o prazo."));
    }
  };

  const apagar = async (id: string) => {
    if (!confirm("Apagar este prazo?")) return;
    await api.delete(`/api/prazos/${id}`).catch(() => {});
    carregar();
  };

  const gerarAgenda = async () => {
    try {
      const { data } = await api.post("/api/prazos/agenda");
      setEstado((e) => e && { ...e, agenda: data.agenda });
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível gerar o link."));
    }
  };

  const copiar = async () => {
    if (!estado?.agenda) return;
    await navigator.clipboard.writeText(estado.agenda).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const webcal = estado?.agenda?.replace(/^https?:/, "webcal:");
  const vermelhos = estado?.prazos.filter((p) => { const { h } = falta(p.limite); return h > 0 && h <= 72; }) ?? [];
  const proximos = estado?.prazos.filter((p) => !vermelhos.includes(p)) ?? [];

  // função (não componente): assim o campo do checklist não perde o foco ao digitar
  const cartao = (p: Prazo) => {
    const f = falta(p.limite);
    const cor = p.concluido ? "border-white/5 opacity-60" : f.h > 0 && f.h <= 24 ? "border-red-500/50 bg-red-500/5" : f.h > 0 && f.h <= 72 ? "border-orange-400/40 bg-orange-400/5" : "border-white/5 bg-neutral-900/30";
    const feitos = p.checklist.filter((c) => c.feito).length;
    return (
      <div className={`border rounded-xl p-5 ${cor}`}>
        <div className="flex justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{ROTULO[p.tipo]}</span>
              {p.origem === "ia" && <span className="font-mono text-[10px] text-purple-400">· achado pela IA</span>}
            </div>
            <p className={`font-bold ${p.concluido ? "line-through" : ""}`}>{p.titulo}</p>
            <p className="font-mono text-[11px] text-neutral-500 mt-1">
              até {dataBR(p.data)}{p.hora && ` às ${p.hora}`}
              {p.contexto && <> · {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{p.contexto}</a> : p.contexto}</>}
            </p>
          </div>
          <div className="sm:text-right shrink-0 w-full sm:w-auto">
            {!p.concluido && <p className={`font-black text-lg ${f.h <= 24 ? "text-red-400" : f.h <= 72 ? "text-orange-400" : "text-white"}`}>{f.h > 0 ? `faltam ${f.texto}` : f.texto}</p>}
            <div className="flex gap-3 sm:justify-end mt-1">
              <button onClick={() => salvar(p.id, { concluido: !p.concluido })} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300">
                {p.concluido ? "[ reabrir ]" : "[ ✓ já fiz ]"}
              </button>
              <button onClick={() => apagar(p.id)} className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400">[ apagar ]</button>
            </div>
          </div>
        </div>

        {!p.concluido && estado?.ehPro && p.checklist.length === 0 && !comChecklist.has(p.id) && (
          <button onClick={() => setComChecklist((s) => new Set(s).add(p.id))} className="mt-3 font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-white">
            [ + checklist ]
          </button>
        )}

        {(p.checklist.length > 0 || comChecklist.has(p.id)) && (
          <div className="mt-4 pt-4 border-t border-white/5">
            {p.checklist.length > 0 && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Documentos · {feitos}/{p.checklist.length}</p>
            )}
            <ul className="space-y-1.5">
              {p.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm group">
                  <input type="checkbox" checked={c.feito} onChange={(e) => salvar(p.id, { checklistItem: { id: c.id, feito: e.target.checked } })} className="accent-emerald-400 w-4 h-4" />
                  <span className={c.feito ? "line-through text-neutral-500" : ""}>{c.item}</span>
                  <button onClick={() => salvar(p.id, { checklistItem: { id: c.id, remover: true } })} className="ml-auto text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs" aria-label="Remover item">✕</button>
                </li>
              ))}
            </ul>
            {!p.concluido && estado?.ehPro && (
              <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); const v = novoItem[p.id]?.trim(); if (v) { salvar(p.id, { novoItem: v }); setNovoItem((n) => ({ ...n, [p.id]: "" })); } }}>
                <input autoFocus={p.checklist.length === 0} value={novoItem[p.id] ?? ""} onChange={(e) => setNovoItem((n) => ({ ...n, [p.id]: e.target.value }))} placeholder="+ adicionar item (ex.: foto 3x4)"
                  className="flex-1 bg-transparent border-b border-neutral-800 text-xs py-1 outline-none focus:border-emerald-400" />
              </form>
            )}
          </div>
        )}
      </div>
    );
  };

  const campo = "bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60";

  return (
    <div className="bg-(--fundo) text-(--texto) min-h-screen font-sans antialiased"
      style={{ background: "radial-gradient(circle at 0% 0%, rgba(108,52,131,0.08) 0%, transparent 40%), var(--fundo)" }}>
      <Navbar logado={!!usuario} />
      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// prazos</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">Nenhum prazo perdido</h1>
        <p className="text-neutral-500 mb-8">
          Quando um site que você monitora publica datas (inscrição, prova, recurso do gabarito, matrícula), elas aparecem aqui sozinhas.
          No <strong className="text-red-400">Código Vermelho</strong> você recebe lembretes 72h, 24h e 3h antes até marcar "já fiz".
        </p>

        {erro && <p className="mb-6 text-sm text-red-400">{erro}</p>}
        {!estado ? <p className="font-mono text-xs text-neutral-500">Carregando…</p> : (
          <>
            {!estado.ehPro && (
              <section className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-black mb-2">Exclusivo do plano Pro 💎</h2>
                <p className="text-sm text-neutral-400 mb-4">A IA lê os editais, acha os prazos, monta o checklist de documentos e te lembra antes de cada um — no e-mail, no Telegram e na sua agenda.</p>
                <Link to="/planos" className="inline-block font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Ver planos →</Link>
              </section>
            )}

            {vermelhos.length > 0 && (
              <section className="mb-8 space-y-3">
                <h2 className="font-mono text-[10px] text-red-400 uppercase tracking-widest">🔴 Código Vermelho · próximas 72h</h2>
                {vermelhos.map((p) => <div key={p.id}>{cartao(p)}</div>)}
              </section>
            )}

            <section className="mb-8 space-y-3">
              <h2 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Próximos prazos</h2>
              {proximos.length === 0 && vermelhos.length === 0 && (
                <p className="text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl p-6 text-center">
                  Nenhum prazo por enquanto. {estado.ehPro ? "Assim que um edital monitorado publicar datas, elas aparecem aqui." : ""}
                </p>
              )}
              {proximos.map((p) => <div key={p.id}>{cartao(p)}</div>)}
            </section>

            {estado.ehPro && (
              <>
                <form onSubmit={criar} className="border border-white/5 rounded-2xl p-6 mb-8 space-y-3">
                  <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Adicionar prazo</h2>
                  <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Pagar a taxa de inscrição" required className={`w-full ${campo}`} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required className={campo} aria-label="Data" />
                    <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className={campo} aria-label="Hora limite (opcional)" />
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })} className={`col-span-2 sm:col-span-1 ${campo}`} aria-label="Tipo">
                      {Object.entries(ROTULO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                    </select>
                  </div>
                  <button className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Adicionar</button>
                </form>

                <section className="border border-white/5 rounded-2xl p-6 mb-8">
                  <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-2">📅 Agenda sincronizada</h2>
                  <p className="text-sm text-neutral-500 mb-4">Assine uma vez e os prazos entram sozinhos no Google Agenda, iPhone ou Outlook — com lembrete 1 dia e 3 horas antes. Prazos novos aparecem automaticamente.</p>
                  {!estado.agenda ? (
                    <button onClick={gerarAgenda} className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Gerar link da agenda</button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal ?? "")}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-lg">Google Agenda</a>
                        <a href={webcal} className="font-mono text-xs border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-lg">iPhone / Mac / Outlook</a>
                        <button onClick={copiar} className="font-mono text-xs border border-neutral-800 text-neutral-400 px-4 py-2 rounded-lg">{copiado ? "Copiado ✓" : "Copiar link"}</button>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        Quem tiver este link vê seus prazos. Compartilhou sem querer? <button onClick={gerarAgenda} className="underline hover:text-white">Gerar um link novo</button> (o antigo para de funcionar).
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}

            {estado.concluidos.length > 0 && (
              <details className="mb-8">
                <summary className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest cursor-pointer">Concluídos ({estado.concluidos.length})</summary>
                <div className="space-y-3 mt-3">{estado.concluidos.map((p) => <div key={p.id}>{cartao(p)}</div>)}</div>
              </details>
            )}

            <p className="text-[11px] text-neutral-600">As datas são lidas automaticamente dos sites: confira sempre no documento oficial.</p>
          </>
        )}
      </main>
    </div>
  );
}
