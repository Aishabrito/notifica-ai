import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/Api';
import { buscarCalendario, faltaTexto, quandoEvento, type EventoCalendario } from '../utils/calendario';
import type { Publico } from '../components/landing/PublicoAlvo';

const ABAS: { id: Publico; rotulo: string }[] = [
  { id: 'vestibulando', rotulo: '🎓 ENEM e SISU' },
  { id: 'concurseiro', rotulo: '📚 Concursos' },
];

// 📅 Calendário público: as datas que importam + "Me avise"
export default function Calendario() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Publico>('vestibulando');
  const [eventos, setEventos] = useState<EventoCalendario[] | null>(null);
  const [meus, setMeus] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');

  useEffect(() => { buscarCalendario().then(setEventos).catch(() => setEventos([])); }, []);
  useEffect(() => {
    if (!usuario) return;
    api.get('/api/calendario/meus').then(({ data }) => setMeus(new Set(data.eventos))).catch(() => {});
  }, [usuario]);

  const alternar = async (e: EventoCalendario) => {
    if (!usuario) return navigate(`/cadastro?perfil=${e.publico}`);
    setErro('');
    const ativo = meus.has(e.id);
    try {
      await (ativo ? api.delete(`/api/calendario/${e.id}/lembrar`) : api.post(`/api/calendario/${e.id}/lembrar`));
      const prox = new Set(meus); if (ativo) prox.delete(e.id); else prox.add(e.id);
      setMeus(prox);
    } catch { setErro('Não foi possível salvar agora. Tente de novo.'); }
  };

  const lista = (eventos ?? []).filter((e) => e.publico === aba);

  return (
    <div className="bg-(--fundo) text-(--texto) min-h-screen font-sans">
      <Navbar />
      <main className="px-6 md:px-20 pt-28 md:pt-36 pb-20 max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3">// calendário</p>
        <h1 className="font-black text-4xl md:text-6xl tracking-tighter leading-[0.95] mb-4">As datas que <span className="text-emerald-400">não dá pra perder.</span></h1>
        <p className="text-neutral-400 mb-8 max-w-xl">Toque em <strong className="text-(--texto)">Me avise</strong> e a gente lembra 7 dias antes, na véspera e no dia, por e-mail e no celular. Grátis.</p>

        <div role="tablist" className="inline-flex flex-wrap p-1 rounded-2xl border border-white/10 bg-neutral-900/60 mb-8">
          {ABAS.map((a) => (
            <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${aba === a.id ? 'bg-emerald-400 text-black' : 'text-neutral-400 hover:text-white'}`}>
              {a.rotulo}
            </button>
          ))}
        </div>

        {erro && <p role="alert" className="text-sm text-red-400 mb-4">{erro}</p>}
        {eventos === null && <p className="text-neutral-500">Carregando…</p>}

        <ol className="space-y-3">
          {lista.map((e) => {
            const ativo = meus.has(e.id);
            return (
              <li key={e.id} className="rounded-2xl border border-white/5 bg-neutral-900/30 p-4 md:p-5 flex gap-4 items-start">
                <div className={`shrink-0 w-24 text-center rounded-xl py-2 ${e.previsao ? 'border border-dashed border-white/15' : 'bg-emerald-400/10 border border-emerald-400/20'}`}>
                  <p className="font-black text-lg leading-tight">{quandoEvento(e)}</p>
                  <p className={`text-[10px] font-mono uppercase tracking-wider ${e.previsao ? 'text-amber-400' : 'text-emerald-400'}`}>{faltaTexto(e)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-snug">{e.titulo}</p>
                  {e.descricao && <p className="text-sm text-neutral-500 mt-1">{e.descricao}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 items-center">
                    <button onClick={() => alternar(e)}
                      className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-lg ${ativo ? 'bg-emerald-400 text-black font-bold' : 'border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10'}`}>
                      {ativo ? '✓ vou ser avisado(a)' : '🔔 me avise'}
                    </button>
                    {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-neutral-500 hover:text-white">fonte oficial ↗</a>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {eventos && lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="font-bold mb-1">Ainda não há datas confirmadas aqui.</p>
            <p className="text-sm text-neutral-500 mb-4">Enquanto isso, o Radar de editais avisa quando abrir concurso para o cargo e a região que você escolher.</p>
            <Link to={usuario ? '/radar' : `/cadastro?perfil=${aba}`} className="font-mono text-xs text-emerald-400 border-b border-emerald-400/40">quero ser avisado(a) →</Link>
          </div>
        )}

        <p className="text-[11px] text-neutral-600 mt-8">Datas tiradas dos editais e páginas oficiais. "Previsão" quer dizer que o órgão ainda não confirmou. Sempre confira na fonte oficial.</p>
      </main>
      <Footer />
    </div>
  );
}
