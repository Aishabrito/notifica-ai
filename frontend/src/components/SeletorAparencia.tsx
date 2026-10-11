import { useEffect, useRef, useState } from "react";
import { DESTAQUES, lerAparencia, salvarAparencia, type Aparencia, type Tema } from "../utils/aparencia";

const TEMAS: { id: Tema; nome: string; icone: string }[] = [
  { id: "escuro", nome: "Escuro", icone: "🌙" },
  { id: "claro", nome: "Claro", icone: "☀️" },
  { id: "auto", nome: "Automático", icone: "🖥️" },
];

// Controles de aparência: usados no menu (compacto) e em Minha conta
export function ControlesAparencia() {
  const [a, setA] = useState<Aparencia>(lerAparencia);
  const mudar = (parcial: Partial<Aparencia>) => { const nova = { ...a, ...parcial }; setA(nova); salvarAparencia(nova); };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Tema</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMAS.map((t) => (
            <button key={t.id} onClick={() => mudar({ tema: t.id })}
              className={`text-xs px-2 py-2 rounded-lg border transition-colors ${a.tema === t.id ? "border-emerald-400 text-emerald-400" : "border-neutral-800 text-neutral-400 hover:text-white"}`}>
              <span className="block text-base">{t.icone}</span>{t.nome}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Cor de destaque</p>
        <div className="flex gap-2">
          {DESTAQUES.map((d) => (
            <button key={d.id} onClick={() => mudar({ destaque: d.id })} title={d.nome} aria-label={d.nome}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${a.destaque === d.id ? "border-white scale-110" : "border-transparent"}`}
              style={{ backgroundColor: d.cor }} />
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
        <input type="checkbox" checked={a.suave} onChange={(e) => mudar({ suave: e.target.checked })} className="accent-emerald-400" />
        Visual mais leve (sem animações e brilhos)
      </label>
    </div>
  );
}

// Botão do menu que abre os controles num painel
export default function SeletorAparencia() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto((v) => !v)} title="Aparência" aria-label="Mudar cores"
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 hover:text-white transition-colors">
        🎨
      </button>
      {aberto && (
        <div className="absolute right-0 top-10 w-72 p-4 rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl z-50">
          <ControlesAparencia />
        </div>
      )}
    </div>
  );
}
