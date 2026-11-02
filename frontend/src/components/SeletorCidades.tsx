import { useMemo, useState } from "react";

export interface CidadeRadar { id: string; nome: string; uf?: string; federal?: boolean }

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Escolha de cidades do Radar: com poucas, só os botões; com muitas, busca e
// grupos por estado (Federal primeiro, depois RJ, depois os outros em ordem)
export default function SeletorCidades({ cidades, escolhidas, alternar, estilo = "pilula" }: {
  cidades: CidadeRadar[];
  escolhidas: string[];
  alternar: (id: string) => void;
  estilo?: "pilula" | "quadrado";
}) {
  const [busca, setBusca] = useState("");
  const muitas = cidades.length > 10;

  const grupos = useMemo(() => {
    const q = sem(busca.trim());
    const filtradas = cidades.filter((c) => !q || sem(c.nome).includes(q) || sem(c.uf ?? "").includes(q) || escolhidas.includes(c.id));
    const porUf = new Map<string, CidadeRadar[]>();
    for (const c of filtradas) {
      const chave = c.federal ? "Federal" : c.uf ?? "";
      porUf.set(chave, [...(porUf.get(chave) ?? []), c]);
    }
    const ordem = (k: string) => (k === "Federal" ? "0" : k === "RJ" ? "1" : `2${k}`);
    return [...porUf.entries()].sort(([a], [b]) => ordem(a).localeCompare(ordem(b)));
  }, [cidades, busca, escolhidas]);

  const botao = (c: CidadeRadar) => {
    const ativo = escolhidas.includes(c.id);
    const forma = estilo === "pilula" ? "font-mono rounded-full" : "rounded-lg";
    return (
      <button type="button" key={c.id} onClick={() => alternar(c.id)} aria-pressed={ativo}
        className={`text-xs px-3 py-1.5 border ${forma} ${ativo ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "border-neutral-800 text-neutral-500 hover:border-neutral-600"}`}>
        {c.nome}
      </button>
    );
  };

  if (!muitas) return <div className="flex flex-wrap gap-2">{cidades.map(botao)}</div>;

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cidade ou UF"
        aria-label="Buscar cidade"
        className="w-full mb-3 bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/50"
      />
      <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
        {grupos.length === 0 && <p className="text-xs text-neutral-600">Nenhuma cidade com esse nome por enquanto.</p>}
        {grupos.map(([uf, lista]) => (
          <div key={uf}>
            <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest mb-1.5">{uf}</p>
            <div className="flex flex-wrap gap-2">{lista.map(botao)}</div>
          </div>
        ))}
      </div>
      {escolhidas.length > 0 && <p className="text-[11px] text-emerald-400/80 mt-2">{escolhidas.length} escolhida(s)</p>}
    </div>
  );
}
