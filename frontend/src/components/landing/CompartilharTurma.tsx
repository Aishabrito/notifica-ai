import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/Api';
import type { Publico } from './PublicoAlvo';

const SITE = 'https://notifica-ai.vercel.app';
const MENSAGEM: Record<Publico, string> = {
  vestibulando: 'Achei um site que avisa no celular quando sai chamada da lista de espera (SISU, ProUni, faculdade). É grátis, para de ficar dando F5:',
  concurseiro: 'Achei um site que vigia a banca e o Diário Oficial e avisa quando sai retificação, resultado ou nomeação. É grátis para começar:',
};

// 📲 "Manda pra sua turma": WhatsApp com o link (de convite, se a pessoa estiver logada)
export default function CompartilharTurma({ publico }: { publico: Publico }) {
  const { usuario } = useAuth();
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    api.get('/api/conta/indicacao').then(({ data }) => setLinkConvite(data.link ?? null)).catch(() => {});
  }, [usuario]);

  const link = linkConvite ?? `${SITE}/${publico === 'vestibulando' ? 'vestibular' : 'concursos'}`;
  const texto = `${MENSAGEM[publico]} ${link}`;
  const copiar = async () => {
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <section className="px-6 md:px-20 py-14 border-t border-white/5">
      <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 p-6 md:p-10 flex flex-col md:flex-row gap-6 md:items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.08) 0%, rgba(108,52,131,0.08) 100%)' }}>
        <div>
          <p className="font-black text-2xl md:text-3xl tracking-tight mb-2">{publico === 'vestibulando' ? 'Sua turma inteira está na mesma lista.' : 'Seu grupo de estudos também precisa saber.'}</p>
          <p className="text-sm text-neutral-400 max-w-md">
            Manda o Notifica no grupo e ninguém perde a chamada.
            {linkConvite && ' Vai com o seu link de convite: quem assinar o Pro te dá dias grátis.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer"
            className="text-center bg-[#25D366] text-black font-black text-sm px-6 py-3.5 rounded-xl hover:brightness-110 transition"
          >
            Manda pra sua turma no WhatsApp
          </a>
          <button onClick={copiar} className="font-mono text-xs border border-white/15 rounded-xl px-4 py-3 hover:border-white/30">
            {copiado ? '✓ copiado' : 'copiar link'}
          </button>
        </div>
      </div>
    </section>
  );
}
