import { useEffect, useState } from "react";
import api from "../services/Api";

interface Concurso { id: string; nome: string; homologadoEm: string; validadeAnos: number; prorrogado: boolean; classificacao: number | null; validadeAte: string; diasRestantes: number }

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
function tempoRestante(dias: number) {
  if (dias < 0) return "validade encerrada";
  if (dias < 60) return `faltam ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses >= 12 ? `faltam ${Math.floor(meses / 12)} ano(s) e ${meses % 12} mês(es)` : `faltam ${meses} meses`;
}

// 🏛️ Aprovado(a) aguardando nomeação: validade do concurso
export default function MeusConcursos({ ehPro }: { ehPro: boolean }) {
  const [lista, setLista] = useState<Concurso[]>([]);
  const [form, setForm] = useState({ nome: "", homologadoEm: "", validadeAnos: "2", classificacao: "" });
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = () => api.get("/api/concursos").then(({ data }) => setLista(data.concursos)).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro("");
    try {
      await api.post("/api/concursos", { ...form, validadeAnos: Number(form.validadeAnos), classificacao: form.classificacao ? Number(form.classificacao) : undefined });
      setForm({ nome: "", homologadoEm: "", validadeAnos: "2", classificacao: "" }); setAberto(false); carregar();
    } catch (err: any) { setErro(err.response?.data?.mensagem ?? "Não foi possível salvar."); }
  };
  const prorrogar = async (c: Concurso) => { await api.patch(`/api/concursos/${c.id}`, { prorrogado: !c.prorrogado }); carregar(); };
  const apagar = async (c: Concurso) => { if (confirm(`Parar de acompanhar ${c.nome}?`)) { await api.delete(`/api/concursos/${c.id}`); carregar(); } };
  const campo = "bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60";

  return (
    <section className="mb-12">
      <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// aprovados</p>
      <h2 className="text-3xl font-black tracking-tighter mb-2">Passou? Não perca a nomeação.</h2>
      <p className="text-neutral-500 mb-5">
        Acompanhe a validade do concurso — perto do fim é quando mais se convoca. {ehPro
          ? "E com o Radar abaixo, se seu nome sair numa nomeação, você recebe um aviso urgente com o prazo de posse e o checklist de documentos."
          : "No Pro, o Radar também vigia seu nome no Diário Oficial e avisa na hora da nomeação."}
      </p>

      <div className="space-y-3 mb-4">
        {lista.map((c) => {
          const total = c.validadeAnos * (c.prorrogado ? 2 : 1) * 365;
          const pct = Math.max(0, Math.min(100, Math.round(((total - c.diasRestantes) / total) * 100)));
          const alerta = c.diasRestantes <= 90;
          return (
            <div key={c.id} className={`border rounded-xl p-4 ${alerta ? "border-orange-400/40 bg-orange-400/5" : "border-white/5 bg-neutral-900/30"}`}>
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold">🏛️ {c.nome}</p>
                  <p className="font-mono text-[11px] text-neutral-500">
                    homologado em {dataBR(c.homologadoEm)}{c.classificacao && ` · você: ${c.classificacao}º`} · vale até <strong className="text-neutral-300">{dataBR(c.validadeAte)}</strong>{c.prorrogado && " (prorrogado)"}
                  </p>
                </div>
                <p className={`font-black ${alerta ? "text-orange-400" : "text-white"}`}>{tempoRestante(c.diasRestantes)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-3"><div className={`h-full ${alerta ? "bg-orange-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} /></div>
              <div className="flex gap-4 mt-3">
                <button onClick={() => prorrogar(c)} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300">
                  {c.prorrogado ? "[ desfazer prorrogação ]" : "[ saiu a prorrogação ]"}
                </button>
                <button onClick={() => apagar(c)} className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400">[ remover ]</button>
              </div>
            </div>
          );
        })}
      </div>

      {!aberto ? (
        <button onClick={() => setAberto(true)} className="font-mono text-xs border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-lg">+ Fui aprovado(a) em um concurso</button>
      ) : (
        <form onSubmit={salvar} className="border border-white/5 rounded-xl p-5 space-y-3">
          <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Concurso e cargo (ex.: TJ-RJ 2025 — Analista)" className={`w-full ${campo}`} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-[11px] text-neutral-500">Homologação do resultado
              <input type="date" required value={form.homologadoEm} onChange={(e) => setForm({ ...form, homologadoEm: e.target.value })} className={`w-full mt-1 ${campo}`} />
            </label>
            <label className="text-[11px] text-neutral-500">Validade (edital)
              <select value={form.validadeAnos} onChange={(e) => setForm({ ...form, validadeAnos: e.target.value })} className={`w-full mt-1 ${campo}`}>
                <option value="2">2 anos</option><option value="1">1 ano</option>
              </select>
            </label>
            <label className="text-[11px] text-neutral-500">Sua classificação (opcional)
              <input inputMode="numeric" value={form.classificacao} onChange={(e) => setForm({ ...form, classificacao: e.target.value.replace(/\D/g, "") })} placeholder="ex.: 37" className={`w-full mt-1 ${campo}`} />
            </label>
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-2">
            <button className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Acompanhar validade</button>
            <button type="button" onClick={() => setAberto(false)} className="font-mono text-xs text-neutral-500 px-2">cancelar</button>
          </div>
          <p className="text-[10px] text-neutral-600">A data da homologação está no Diário Oficial ou no site da banca. Avisamos 6 meses, 3 meses e 1 mês antes do fim.</p>
        </form>
      )}
    </section>
  );
}
