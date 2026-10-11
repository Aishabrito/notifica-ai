import { useEffect, useState } from "react";
import api from "../services/Api";

type Modelo = { id: string; categoria: string; nome: string; descricao: string; url: string };

type Props = {
  monitoradas: Set<string>;
  ocupado: boolean;
  onMonitorar: (url: string) => Promise<void>;
};

// Galeria de páginas populares (ENEM, SISU, bancas...) para monitorar com 1 clique
export default function ModelosProntos({ monitoradas, ocupado, onMonitorar }: Props) {
  const [categorias, setCategorias] = useState<Record<string, string>>({});
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [aba, setAba] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/modelos")
      .then(({ data }) => {
        setCategorias(data.categorias ?? {});
        setModelos(data.modelos ?? []);
        setAba(Object.keys(data.categorias ?? {})[0] ?? null);
      })
      .catch(() => {});
  }, []);

  if (modelos.length === 0) return null;

  const monitorar = async (m: Modelo) => {
    setEnviando(m.id);
    try { await onMonitorar(m.url); } finally { setEnviando(null); }
  };

  return (
    <div className="mt-5 pt-5 border-t border-white/5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest hover:text-white transition-colors"
      >
        {aberto ? "▾" : "▸"} Ou escolha um modelo pronto (ENEM, SISU, bancas…)
      </button>

      {aberto && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(categorias).map(([id, nome]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={`font-mono text-[10px] px-3 py-1.5 rounded-full border transition-colors ${
                  aba === id ? "border-purple-500/50 bg-purple-500/10 text-purple-200" : "border-neutral-800 text-neutral-500 hover:text-white"
                }`}
              >
                {nome}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modelos.filter((m) => m.categoria === aba).map((m) => {
              const jaMonitora = monitoradas.has(m.url);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/30">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{m.nome}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{m.descricao}</p>
                  </div>
                  <button
                    type="button"
                    disabled={jaMonitora || ocupado}
                    onClick={() => monitorar(m)}
                    className={`shrink-0 font-mono text-[10px] px-3 py-1.5 rounded-md font-bold transition-colors ${
                      jaMonitora ? "text-emerald-400 border border-emerald-500/30" : "bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-50"
                    }`}
                  >
                    {jaMonitora ? "✓ ATIVO" : enviando === m.id ? "..." : "MONITORAR"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
