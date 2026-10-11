import { useEffect, useState } from "react";
import api from "../services/Api";

interface Pasta { id: string; nome: string; descricao: string; copias: number; alertas: { id: string; titulo: string; url: string }[]; link: string | null }
type AlertaResumo = { _id: string; titulo: string };

// 📁 Pastas: junta alertas e gera um link para compartilhar com o grupo de estudo
export default function MinhasPastas({ alertas }: { alertas: AlertaResumo[] }) {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = () => api.get("/api/pastas").then(({ data }) => setPastas(data.pastas)).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    try {
      await api.post("/api/pastas", { nome, alertas: escolhidos });
      setNome(""); setEscolhidos([]); setCriando(false);
      carregar();
    } catch (err: any) {
      setErro(err.response?.data?.mensagem ?? "Não foi possível criar a pasta.");
    }
  };

  const atualizar = async (id: string, corpo: object) => {
    const { data } = await api.patch(`/api/pastas/${id}`, corpo);
    setPastas((ps) => ps.map((p) => (p.id === id ? data.pasta : p)));
    return data.pasta as Pasta;
  };

  const compartilhar = async (p: Pasta) => {
    const atual = p.link ? p : await atualizar(p.id, { compartilhar: true });
    await navigator.clipboard.writeText(atual.link!).catch(() => {});
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const apagar = async (id: string) => {
    if (!confirm("Apagar a pasta? Os alertas continuam.")) return;
    await api.delete(`/api/pastas/${id}`).catch(() => {});
    carregar();
  };

  if (alertas.length === 0 && pastas.length === 0) return null;
  const alternar = (id: string) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">📁 Pastas compartilháveis</h2>
        {!criando && alertas.length > 0 && <button onClick={() => setCriando(true)} className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300">[ + nova pasta ]</button>}
      </div>
      <p className="text-xs text-neutral-600 mb-4">Junte as páginas de um concurso e mande o link para o seu grupo de estudo: quem abrir monitora tudo com 1 clique.</p>

      {criando && (
        <form onSubmit={criar} className="border border-white/5 rounded-xl p-5 mb-4 space-y-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pasta (ex.: Concurso TJ-RJ 2026)" required
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400/60" />
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {alertas.map((a) => (
              <label key={a._id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={escolhidos.includes(a._id)} onChange={() => alternar(a._id)} className="accent-emerald-400" />
                <span className="truncate">{a.titulo}</span>
              </label>
            ))}
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-2">
            <button disabled={!escolhidos.length} className="font-mono text-xs bg-emerald-400 text-black font-bold px-4 py-2 rounded-lg disabled:opacity-50">Criar pasta</button>
            <button type="button" onClick={() => setCriando(false)} className="font-mono text-xs text-neutral-500 px-2">cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {pastas.map((p) => (
          <div key={p.id} className="border border-white/5 bg-neutral-900/30 rounded-xl p-4">
            <div className="flex justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold text-sm">📁 {p.nome}</p>
                <p className="font-mono text-[10px] text-neutral-500">
                  {p.alertas.length} página(s){p.link ? ` · compartilhada${p.copias ? ` · ${p.copias} cópia(s)` : ""}` : " · privada"}
                </p>
              </div>
              <div className="flex gap-3 items-start flex-wrap">
                <button onClick={() => compartilhar(p)} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300">
                  {copiado === p.id ? "[ link copiado ✓ ]" : p.link ? "[ copiar link ]" : "[ compartilhar ]"}
                </button>
                {p.link && (
                  <a href={`https://wa.me/?text=${encodeURIComponent(`📁 ${p.nome} — monitore tudo com 1 clique no Notifica.ai: ${p.link}`)}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300">[ whatsapp ]</a>
                )}
                {p.link && <button onClick={() => atualizar(p.id, { compartilhar: false })} className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white">[ tornar privada ]</button>}
                <button onClick={() => apagar(p.id)} className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400">[ apagar ]</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
