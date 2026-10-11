import { useEffect, useState } from "react";
import api from "../services/Api";

interface Resumo {
  codigo: string; link: string; cadastros: number; convertidos: number;
  diasGanhos: number; creditoDias: number; diasPorIndicacao: number; diasExtraAmigo: number;
}

// 🎁 Indique e ganhe: link de convite + quanto a pessoa já ganhou
export default function IndiqueGanhe() {
  const [r, setR] = useState<Resumo | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { api.get("/api/conta/indicacao").then(({ data }) => setR(data)).catch(() => {}); }, []);
  if (!r) return null;

  const mensagem = `Uso o Notifica.ai para não perder edital, lista de espera e prazo de concurso. Cria a conta pelo meu link e ganha ${r.diasExtraAmigo} dias a mais de Pro grátis: ${r.link}`;
  const copiar = async () => {
    await navigator.clipboard.writeText(r.link).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <section className="border border-emerald-400/20 bg-emerald-400/5 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-1">🎁 Indique e ganhe</h2>
        <p className="text-sm text-neutral-400">
          Cada amigo que assinar o Pro pelo seu link vale <strong className="text-white">{r.diasPorIndicacao} dias de Pro</strong> para você.
          Seu amigo ganha {r.diasExtraAmigo} dias a mais no teste grátis.
        </p>
      </div>
      <div className="flex gap-2">
        <input readOnly value={r.link} className="flex-1 min-w-0 bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 font-mono text-xs" aria-label="Seu link de convite" onFocus={(e) => e.target.select()} />
        <button onClick={copiar} className="font-mono text-xs bg-emerald-400 text-black font-bold px-4 rounded-lg shrink-0">{copiado ? "Copiado ✓" : "Copiar"}</button>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"
        className="inline-block font-mono text-xs border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-lg">Enviar no WhatsApp</a>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[["cadastros", r.cadastros], ["assinaram", r.convertidos], ["dias ganhos", r.diasGanhos]].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="border border-white/5 rounded-xl py-3">
            <p className="text-2xl font-black">{valor}</p>
            <p className="font-mono text-[10px] text-neutral-500 uppercase">{rotulo}</p>
          </div>
        ))}
      </div>
      {r.creditoDias > 0 && (
        <p className="text-xs text-neutral-400">Você tem <strong className="text-white">{r.creditoDias} dias</strong> guardados: eles entram sozinhos quando sua assinatura no cartão acabar.</p>
      )}
    </section>
  );
}
