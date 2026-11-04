import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// "Pare de dar F5": vídeo de 15 s (9:16) que mostra o problema e a solução.
// Toca sem som quando aparece na tela e pausa quando sai (não pesa no resto
// da página). Quem pediu menos movimento no sistema vê a capa e um botão de play.
const SRC = '/video/notifica-15s.mp4';
const CAPA = '/video/notifica-15s.jpg';

export default function VideoMotion() {
  const ref = useRef<HTMLVideoElement>(null);
  const [comSom, setComSom] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [poucoMovimento] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const video = ref.current;
    if (!video || poucoMovimento || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.45 });
    obs.observe(video);
    return () => obs.disconnect();
  }, [poucoMovimento]);

  const alternarSom = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setComSom(!video.muted);
    if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}); }
  };

  const tocar = () => ref.current?.play().catch(() => {});

  return (
    <section className="px-6 md:px-20 py-16 md:py-24 border-t border-white/5">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[minmax(0,320px)_1fr] gap-10 md:gap-16 items-center">
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="rounded-[2.2rem] border-[6px] border-neutral-800 bg-black overflow-hidden shadow-[0_0_60px_rgba(52,211,153,0.12)] aspect-[9/16]">
            <video
              ref={ref}
              src={SRC}
              poster={CAPA}
              muted
              loop
              playsInline
              preload="none"
              onPlay={() => setTocando(true)}
              onPause={() => setTocando(false)}
              aria-label="Vídeo de 15 segundos: alguém aperta F5 de madrugada esperando o resultado; o Notifica.ai vigia a página e manda a notificação no celular."
              className="w-full h-full object-cover"
            />
          </div>
          {!tocando && poucoMovimento && (
            <button onClick={tocar} aria-label="Tocar o vídeo"
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
          <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3">// em 15 segundos</p>
          <h2 className="font-black text-4xl md:text-5xl tracking-tighter leading-[0.95] mb-5">
            Você, às 3h47,<br />apertando <span className="text-red-400">F5</span>.
          </h2>
          <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-8 max-w-md mx-auto md:mx-0">
            Lista de espera, retificação, gabarito, nomeação. Enquanto você dorme, o Vigia lê a página oficial e,
            quando muda, manda <strong className="text-(--texto)">uma frase</strong> no seu celular.
          </p>
          <Link to="/cadastro" className="inline-block font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg hover:bg-emerald-300 transition-colors">
            Parar de dar F5 →
          </Link>
        </div>
      </div>
    </section>
  );
}
