import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Publico } from './PublicoAlvo';
import { guardarUrlPendente } from '../../utils/urlPendente';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

type Resultado = { titulo: string; tipo: 'html' | 'pdf'; pdfs: number; sinais: { tipo: string; rotulo: string }[]; poucoTexto: boolean };

const EXEMPLOS: Record<Publico, string> = {
  vestibulando: 'https://… (página da lista de espera, do SISU ou da faculdade)',
  concurseiro: 'https://… (página do concurso na banca ou no órgão)',
};

// 🧪 Cola o link e vê, sem cadastro, se a gente consegue vigiar
export default function TesteAgora({ publico }: { publico: Publico }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [estado, setEstado] = useState<'livre' | 'lendo' | 'ok' | 'erro'>('livre');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');

  const testar = async (e: React.FormEvent) => {
    e.preventDefault();
    let alvo = url.trim();
    if (alvo && !/^https?:\/\//i.test(alvo)) alvo = `https://${alvo}`;
    setEstado('lendo'); setErro(''); setResultado(null);
    try {
      const r = await fetch(`${API_URL}/api/testar-pagina`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: alvo }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.sucesso) throw new Error(d?.mensagem ?? 'Não conseguimos abrir esta página agora.');
      setUrl(alvo); setResultado(d.pagina); setEstado('ok');
    } catch (err) {
      setErro(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sem conexão com o servidor. Tente de novo em instantes.');
      setEstado('erro');
    }
  };

  const continuar = () => {
    guardarUrlPendente(url);
    navigate(`/cadastro?perfil=${publico}`);
  };

  return (
    <section id="teste-agora" className="px-6 md:px-20 py-16 md:py-20 border-t border-white/5 scroll-mt-16">
      <div className="max-w-3xl mx-auto text-center">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3">// teste agora, sem cadastro</p>
        <h2 className="font-black text-3xl md:text-5xl tracking-tighter mb-3">Cola o link. A gente diz se dá pra vigiar.</h2>
        <p className="text-neutral-500 mb-8">Leva uns 5 segundos. Não precisa criar conta para testar.</p>

        <form onSubmit={testar} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text" inputMode="url" required value={url} onChange={(e) => { setUrl(e.target.value); if (estado !== 'lendo') setEstado('livre'); }}
            placeholder={EXEMPLOS[publico]} aria-label="Link da página"
            className="flex-1 min-w-0 bg-neutral-900/60 border border-white/10 rounded-xl px-4 py-4 text-sm outline-none focus:border-emerald-400/60"
          />
          <button disabled={estado === 'lendo'} className="bg-emerald-400 text-black font-black text-sm px-7 py-4 rounded-xl hover:bg-emerald-300 disabled:opacity-60 uppercase tracking-widest whitespace-nowrap">
            {estado === 'lendo' ? 'Lendo…' : 'Testar'}
          </button>
        </form>

        {estado === 'erro' && <p role="alert" className="mt-4 text-sm text-red-400">{erro}</p>}

        {estado === 'ok' && resultado && (
          <div className="mt-6 text-left rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5" style={{ animation: 'slideIn 0.4s ease forwards' }}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 mb-1">✓ Conseguimos ler esta página</p>
            <p className="font-bold text-lg leading-snug mb-3 break-words">{resultado.titulo}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs border border-white/10 rounded-full px-3 py-1">{resultado.tipo === 'pdf' ? '📄 PDF' : '🌐 Página'}</span>
              {resultado.sinais.map((s) => <span key={s.tipo} className="text-xs border border-white/10 rounded-full px-3 py-1">Parece: {s.rotulo}</span>)}
              {resultado.pdfs > 0 && <span className="text-xs border border-white/10 rounded-full px-3 py-1">📎 {resultado.pdfs === 1 ? '1 PDF linkado' : `${resultado.pdfs} PDFs linkados`}: também vigiamos</span>}
            </div>
            {resultado.poucoTexto && (
              <p className="text-xs text-amber-400 mb-4">⚠️ Esta página veio quase sem texto (ela carrega o conteúdo depois). Funciona melhor com o link direto da lista ou do PDF.</p>
            )}
            <button onClick={continuar} className="w-full sm:w-auto bg-emerald-400 text-black font-black text-sm px-7 py-3.5 rounded-xl hover:bg-emerald-300 uppercase tracking-widest">
              Me avise quando mudar →
            </button>
            <p className="text-[11px] text-neutral-500 mt-2">Grátis. Depois do cadastro, a página já vem pronta para monitorar.</p>
          </div>
        )}
      </div>
    </section>
  );
}
