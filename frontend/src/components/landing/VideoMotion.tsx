import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Publico } from './PublicoAlvo';

// Vídeo de 15 s (9:16) para cada público, seguindo o "Eu sou" da página.
// Toca sem som quando aparece na tela e pausa quando sai (não pesa no resto
// da página). Quem pediu menos movimento no sistema vê a capa e um botão de play.
const VIDEOS: Record<Publico, { src: string; capa: string; titulo: ReactNode; texto: ReactNode; descricao: string; cta: string }> = {
  vestibulando: {
    src: '/video/notifica-vestibulando.mp4',
    capa: '/video/notifica-vestibulando.jpg',
    titulo: <>Você, esperando<br />a <span className="text-red-400">4ª chamada</span>.</>,
    texto: <>1ª, 2ª, 3ª chamada, reclassificação, matrícula até amanhã. O Vigia acompanha cada chamada da sua lista e avisa <strong className="text-(--texto)">quando chega a sua vez</strong>.</>,
    descricao: 'Vídeo de 15 segundos: alguém aperta F5 esperando a lista de espera; o Notifica.ai acompanha as chamadas e avisa quando a 4ª chamada passa da sua posição.',
    cta: 'Acompanhar minha lista →',
  },
  concurseiro: {
    src: '/video/notifica-concurseiro.mp4',
    capa: '/video/notifica-concurseiro.jpg',
    titulo: <>Cadastro reserva<br />chama <span className="text-red-400">2 anos depois</span>.</>,
    texto: <>Validade, prorrogação, nomeação, prazo de posse. O Vigia lê o Diário Oficial todo dia e avisa <strong className="text-(--texto)">no dia em que seu nome sair</strong>.</>,
    descricao: 'Vídeo de 15 segundos: alguém aperta F5 dois anos depois da prova; o Notifica.ai lê o Diário Oficial e avisa da nomeação.',
    cta: 'Vigiar meu nome →',
  },
};

export default function VideoMotion({ publico, onTrocar }: { publico: Publico; onTrocar: (p: Publico) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [comSom, setComSom] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [poucoMovimento] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const v = VIDEOS[publico];

  useEffect(() => {
    setComSom(false);
    const video = ref.current;
    if (!video || poucoMovimento || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.45 });
    obs.observe(video);
    return () => obs.disconnect();
  }, [poucoMovimento, publico]);

  const alternarSom = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setComSom(!video.muted);
    if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}); }
  };

  return (
    <section className="px-6 md:px-20 py-16 md:py-24 border-t border-white/5">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[minmax(0,320px)_1fr] gap-10 md:gap-16 items-center">
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="rounded-[2.2rem] border-[6px] border-neutral-800 bg-black overflow-hidden shadow-[0_0_60px_rgba(52,211,153,0.12)] aspect-[9/16]">
            <video
              key={publico}
              ref={ref}
              src={v.src}
              poster={v.capa}
              muted
              loop
              playsInline
              preload="none"
              onPlay={() => setTocando(true)}
              onPause={() => setTocando(false)}
              aria-label={v.descricao}
              className="w-full h-full object-cover"
            />
          </div>
          {!tocando && poucoMovimento && (
            <button onClick={() => ref.current?.play().catch(() => {})} aria-label="Tocar o vídeo"
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-emerald-400 text-black text-2xl font-black flex items-center justify-center shadow-lg">
              ▶
            </button>
          )}
          <button
            onClick={alternarSom}
            aria-pressed={comSom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest bg-black/70 backdrop-blur text-white border border-white/20 px-3 py-1.5 rounded-full hover:border-emerald-400/60"
          >
            {comSom ? '🔊 som ligado' : '🔇 ligar o som'}
          </button>
        </div>

        <div className="text-center md:text-left">
          <div className="inline-flex gap-1 p-1 rounded-full border border-white/10 mb-5" role="group" aria-label="Ver o vídeo de">
            {(['vestibulando', 'concurseiro'] as Publico[]).map((p) => (
              <button key={p} onClick={() => onTrocar(p)} aria-pressed={publico === p}
                className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${publico === p ? 'bg-emerald-400 text-black font-bold' : 'text-neutral-500 hover:text-(--texto)'}`}>
                {p === 'vestibulando' ? '🎓 vestibular' : '📚 concurso'}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3">// em 15 segundos</p>
          <h2 className="font-black text-4xl md:text-5xl tracking-tighter leading-[0.95] mb-5">{v.titulo}</h2>
          <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-8 max-w-md mx-auto md:mx-0">{v.texto}</p>
          <Link to="/cadastro" className="inline-block font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg hover:bg-emerald-300 transition-colors">
            {v.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
