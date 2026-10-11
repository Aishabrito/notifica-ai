import { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Save, X } from "lucide-react";
import api from "../../../services/Api";

type Evento = {
  id: string; titulo: string; publico: "vestibulando" | "concurseiro"; data: string; dataFim: string | null;
  previsao: boolean; descricao: string; link: string | null; publicado: boolean; interessados: number;
};
type Form = { titulo: string; publico: Evento["publico"]; data: string; dataFim: string; previsao: boolean; descricao: string; link: string };

const VAZIO: Form = { titulo: "", publico: "vestibulando", data: "", dataFim: "", previsao: false, descricao: "", link: "" };
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// 📅 A equipe mantém as datas do calendário público
export default function GerenciarCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = () => api.get("/api/calendario/admin").then(({ data }) => setEventos(data.eventos)).catch(() => setErro("Não foi possível carregar o calendário."));
  useEffect(() => { carregar(); }, []);

  const abrir = (e?: Evento) => {
    setErro("");
    setEditando(e?.id ?? null);
    setForm(e ? { titulo: e.titulo, publico: e.publico, data: e.data, dataFim: e.dataFim ?? "", previsao: e.previsao, descricao: e.descricao, link: e.link ?? "" } : VAZIO);
  };

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    setErro("");
    const corpo = { ...form, dataFim: form.dataFim || null, link: form.link || null };
    try {
      await (editando ? api.patch(`/api/calendario/admin/${editando}`, corpo) : api.post("/api/calendario/admin", corpo));
      setForm(null); setEditando(null); carregar();
    } catch (err: any) { setErro(err.response?.data?.mensagem ?? "Não foi possível salvar."); }
  };

  const alternarPublicado = async (e: Evento) => {
    await api.patch(`/api/calendario/admin/${e.id}`, { publicado: !e.publicado }).catch(() => {});
    carregar();
  };

  const campo = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Calendário público</h2>
          <p className="text-sm text-slate-500">Aparece em /calendario e na página inicial. Quem pediu aviso recebe e-mail e push 7 dias antes, na véspera e no dia. Datas em "previsão" não mandam aviso.</p>
        </div>
        <button onClick={() => abrir()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          <Plus size={16} /> Nova data
        </button>
      </div>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {form && (
        <form onSubmit={salvar} className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="ENEM 2026 — 1º dia de prova" className={campo} />
            <select value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value as Form["publico"] })} className={campo}>
              <option value="vestibulando">🎓 Vestibulando</option>
              <option value="concurseiro">📚 Concurseiro</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-500">Data<input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={`mt-1 ${campo}`} /></label>
            <label className="text-xs text-slate-500">Até (opcional)<input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} className={`mt-1 ${campo}`} /></label>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:mt-5">
              <input type="checkbox" checked={form.previsao} onChange={(e) => setForm({ ...form, previsao: e.target.checked })} /> Ainda é previsão (mostra só o mês)
            </label>
          </div>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={300} placeholder="Descrição curta (opcional)" className={campo} />
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://… (fonte oficial)" className={campo} />
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Save size={16} /> Salvar</button>
            <button type="button" onClick={() => { setForm(null); setEditando(null); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500"><X size={16} /> Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {eventos.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma data cadastrada.</p>}
        {eventos.map((e) => (
          <div key={e.id} className={`flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 last:border-0 ${e.publicado ? "" : "opacity-50"}`}>
            <span className="w-24 shrink-0 font-mono text-sm font-semibold">{dataBR(e.data)}{e.previsao && <span className="block text-[10px] font-normal text-amber-600">previsão</span>}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{e.titulo}</p>
              <p className="text-xs text-slate-500">{e.publico === "vestibulando" ? "🎓 Vestibulando" : "📚 Concurseiro"} · {e.interessados} pediram aviso{e.publicado ? "" : " · oculta"}</p>
            </div>
            <button onClick={() => abrir(e)} title="Editar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button>
            <button onClick={() => alternarPublicado(e)} title={e.publicado ? "Ocultar" : "Publicar"} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              {e.publicado ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
