import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/Api";

interface Cidade { id: string; nome: string }
interface Interesse { id: string; termo: string; cidades: Cidade[]; ultimaBuscaEm: string | null }
interface Encontrado { id: string; interesseId: string; diario: string; dataPublicacao: string; url: string; trechos: string[] }

const SUGESTOES = ["técnico de enfermagem", "analista de TI", "professor", "assistente administrativo", "guarda municipal"];
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// 📢 Radar de editais: a pessoa diz o cargo/área e avisamos quando sair
// concurso ou seleção nos diários escolhidos.
export default function RadarEditais({ cidades, ehPro }: { cidades: Cidade[]; ehPro: boolean }) {
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [encontrados, setEncontrados] = useState<Encontrado[]>([]);
  const [limite, setLimite] = useState(5);
  const [termo, setTermo] = useState("");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | ""; texto: string }>({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    const { data } = await api.get("/api/radar/editais");
    setInteresses(data.interesses);
    setEncontrados(data.encontrados);
    setLimite(data.limite);
  };
  useEffect(() => { carregar().catch(() => {}); }, []);

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setMsg({ tipo: "", texto: "" });
    try {
      const { data } = await api.post("/api/radar/editais", { termo, cidades: escolhidas });
      setTermo("");
      setMsg({ tipo: "ok", texto: data.encontrados ? `Pronto! Já achamos ${data.encontrados} publicação(ões) dos últimos 7 dias.` : "Pronto! Avisamos por e-mail quando sair edital." });
      await carregar();
    } catch (err: any) {
      setMsg({ tipo: "erro", texto: err.response?.data?.mensagem ?? "Não foi possível cadastrar." });
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Parar de acompanhar este cargo?")) return;
    await api.delete(`/api/radar/editais/${id}`).catch(() => {});
    carregar();
  };

  const alternar = (id: string) => setEscolhidas((l) => (l.includes(id) ? l.filter((c) => c !== id) : [...l, id]));

  return (
    <section className="mt-14 pt-10 border-t border-white/5">
      <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// radar de editais</p>
      <h2 className="text-3xl font-black tracking-tighter mb-2">Saiu concurso para o seu cargo?</h2>
      <p className="text-neutral-500 mb-6">Diga o cargo ou a área e avisamos quando um diário oficial publicar concurso ou processo seletivo com ele.</p>

      {!ehPro ? (
        <div className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-6">
          <p className="text-sm text-neutral-400 mb-4">Exclusivo do plano Pro 💎 — acompanhe até {limite} cargos ou áreas.</p>
          <Link to="/planos" className="inline-block font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Ver planos →</Link>
        </div>
      ) : (
        <>
          {interesses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {interesses.map((i) => (
                <span key={i.id} className="inline-flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/5 rounded-full pl-3 pr-2 py-1 text-sm">
                  {i.termo}
                  <span className="font-mono text-[10px] text-neutral-500">{i.cidades.map((c) => c.nome).join(", ")}</span>
                  <button onClick={() => remover(i.id)} className="text-neutral-500 hover:text-red-400 text-xs" aria-label={`Remover ${i.termo}`}>✕</button>
                </span>
              ))}
            </div>
          )}

          {interesses.length < limite && (
            <form onSubmit={cadastrar} className="border border-white/5 rounded-2xl p-6 mb-8 space-y-4">
              <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Cargo ou área (ex.: técnico de enfermagem)" required
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400/60" />
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button type="button" key={s} onClick={() => setTermo(s)} className="font-mono text-[10px] border border-neutral-800 text-neutral-500 hover:text-white rounded-full px-3 py-1">{s}</button>
                ))}
              </div>
              <div>
                <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Onde procurar</p>
                <div className="flex flex-wrap gap-2">
                  {cidades.map((c) => (
                    <button type="button" key={c.id} onClick={() => alternar(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${escolhidas.includes(c.id) ? "border-emerald-400 text-emerald-400" : "border-neutral-800 text-neutral-500"}`}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>
              <button disabled={enviando || !escolhidas.length} className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
                {enviando ? "Procurando…" : "Acompanhar"}
              </button>
              {msg.texto && <p className={`text-xs ${msg.tipo === "erro" ? "text-red-400" : "text-emerald-400"}`}>{msg.texto}</p>}
            </form>
          )}

          {interesses.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Publicações encontradas</h3>
              {encontrados.length === 0 ? (
                <p className="text-sm text-neutral-600 border border-dashed border-neutral-800 rounded-xl p-6 text-center">Nada por enquanto. Procuramos 2x por dia.</p>
              ) : encontrados.map((e) => (
                <article key={e.id} className="border-l-2 border-purple-500/40 bg-neutral-900/30 rounded-r-xl p-4">
                  <p className="font-bold text-sm mb-1">
                    {e.diario} · {dataBR(e.dataPublicacao)}
                    <span className="font-mono text-[10px] text-purple-400 font-normal ml-2">{interesses.find((i) => i.id === e.interesseId)?.termo}</span>
                  </p>
                  {e.trechos.slice(0, 2).map((t, i) => <p key={i} className="text-xs text-neutral-400 bg-black/30 rounded p-2 mb-1">…{t}…</p>)}
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-emerald-400 hover:underline">abrir a publicação →</a>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
