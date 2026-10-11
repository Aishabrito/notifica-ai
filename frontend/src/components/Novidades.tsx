import { useState } from "react";
import { Link } from "react-router-dom";
import { NOVIDADES } from "../config/novidades";

const CHAVE = "notifica:novidades-vistas";

function lerVistas(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); } catch { return []; }
}

// ✨ Quadro de novidades no painel: mostra o que a pessoa ainda não viu
export default function Novidades({ ehPro }: { ehPro: boolean }) {
  const [vistas, setVistas] = useState<string[]>(lerVistas);
  const [todas, setTodas] = useState(false);
  const novas = NOVIDADES.filter((n) => !vistas.includes(n.id));
  if (novas.length === 0) return null;

  const dispensar = () => {
    const ids = NOVIDADES.map((n) => n.id);
    try { localStorage.setItem(CHAVE, JSON.stringify(ids)); } catch { /* sem localStorage: só nesta visita */ }
    setVistas(ids);
  };
  const lista = todas ? novas : novas.slice(0, 3);

  return (
    <section className="mb-8 rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-mono text-[10px] text-purple-300 uppercase tracking-widest">✨ Novidades no Notifica.ai</h2>
        <button onClick={dispensar} className="font-mono text-[10px] text-neutral-500 hover:text-white">[ entendi ]</button>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {lista.map((n) => (
          <li key={n.id} className="rounded-xl border border-white/5 bg-neutral-900/40 p-4 flex flex-col">
            <p className="text-sm font-bold mb-1">
              <span aria-hidden>{n.emoji}</span> {n.titulo}
              {n.pro && !ehPro && <span className="ml-2 font-mono text-[9px] text-purple-300 border border-purple-400/30 rounded-full px-1.5 py-0.5 align-middle">PRO</span>}
            </p>
            <p className="text-xs text-neutral-400 flex-1">{n.texto}</p>
            {n.link && (
              <Link to={n.pro && !ehPro ? "/planos" : n.link} className="mt-3 font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300">
                {n.pro && !ehPro ? "Conhecer o Pro →" : `${n.acao ?? "Ver"} →`}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {novas.length > 3 && (
        <button onClick={() => setTodas((v) => !v)} className="mt-3 font-mono text-[10px] text-neutral-500 hover:text-white">
          {todas ? "mostrar menos" : `+ ${novas.length - 3} novidade(s)`}
        </button>
      )}
    </section>
  );
}
