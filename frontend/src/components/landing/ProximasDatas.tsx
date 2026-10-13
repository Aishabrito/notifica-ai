import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buscarCalendario, faltaTexto, quandoEvento, type EventoCalendario } from '../../utils/calendario';
import type { Publico } from './PublicoAlvo';

// Prévia do calendário na página inicial: as 3 próximas datas do público escolhido
export default function ProximasDatas({ publico }: { publico: Publico }) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  useEffect(() => { buscarCalendario().then(setEventos).catch(() => {}); }, []);
  const lista = eventos.filter((e) => e.publico === publico).slice(0, 3);
  if (lista.length === 0) return null;

  return (
    <section className="px-6 md:px-20 py-16 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
          <div>
            <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// próximas datas</p>
            <h2 className="font-black text-3xl md:text-4xl tracking-tighter">Anota aí.</h2>
          </div>
          <Link to="/calendario" className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 border-b border-emerald-400/40 pb-1">calendário completo →</Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {lista.map((e) => (
            <Link key={e.id} to="/calendario" className="rounded-2xl border border-white/5 bg-neutral-900/30 p-4 sm:p-5 hover:border-emerald-400/30 transition-colors flex sm:block gap-4 items-center">
              <div className="shrink-0 w-24 sm:w-auto">
                <p className="font-black text-2xl sm:text-3xl tracking-tight">{quandoEvento(e)}</p>
                <p className={`font-mono text-[10px] uppercase tracking-widest sm:mb-3 ${e.previsao ? 'text-amber-400' : 'text-emerald-400'}`}>{faltaTexto(e)}</p>
              </div>
              <div>
                <p className="font-bold text-sm leading-snug">{e.titulo}</p>
                <p className="text-xs text-neutral-500 mt-1 sm:mt-2">🔔 Toque para ser avisado(a)</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
