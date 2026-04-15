import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/4 bg-[#0a0a0a]/80 backdrop-blur-md">
      <Link to="/" className="font-mono font-bold text-sm tracking-widest text-white">
        notifica<span className="text-emerald-400">.ai</span>
      </Link>
      <div className="flex items-center gap-6 md:gap-8">
        <Link to="/como-funciona" className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors hidden sm:block">
          Como funciona
        </Link>
        <Link
          to="/cadastro"
          className="font-mono text-[10px] uppercase tracking-widest border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-sm hover:bg-emerald-400 hover:text-black transition-all"
        >
          Criar alerta →
        </Link>
      </div>
    </nav>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 md:px-20 py-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <span className="font-mono text-sm font-bold text-white">
        notifica<span className="text-emerald-400">.ai</span>
      </span>
      <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest">
        © {new Date().getFullYear()} — feito com ♥ no Brasil
      </p>
    </footer>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function Ticker() {
  const items = [
    { emoji: '🚨', text: 'SISU 2025 — Lista de espera', color: 'text-neutral-400' },
    { emoji: '✓',  text: 'CEFET-RJ — Convocação',       color: 'text-emerald-400' },
    { emoji: '🚨', text: 'IBGE — Resultado disponível',  color: 'text-purple-400'  },
    { emoji: '✓',  text: 'UFRJ — Editais abertos',       color: 'text-emerald-400' },
  ];
  const doubled = [...items, ...items];

  return (
    <div className="flex items-center gap-3 mb-8 md:mb-10 overflow-hidden border border-purple-500/20 rounded-full w-fit px-3 md:px-4 py-1.5 bg-purple-950/30 shadow-[0_0_15px_rgba(108,52,131,0.1)] max-w-full">
      <span className="font-mono text-[9px] text-purple-200 whitespace-nowrap tracking-widest bg-purple-500/30 px-2 py-0.5 rounded-full shrink-0 uppercase">
        Ao vivo
      </span>
      <div className="overflow-hidden max-w-60 sm:max-w-sm md:max-w-md">
        <div className="flex gap-8 animate-[ticker_18s_linear_infinite] whitespace-nowrap">
          {doubled.map((item, i) => (
            <span key={i} className={`font-mono text-[10px] ${item.color}`}>
              {item.emoji} {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({
  url, msg, color, delay,
}: {
  url: string; msg: string; color: string; delay: string;
}) {
  return (
    <div
      className="border border-white/5 border-l-4 border-l-purple-600 p-5 rounded-lg opacity-0"
      style={{
        background: 'linear-gradient(135deg, rgba(108,52,131,0.07) 0%, rgba(0,0,0,0) 100%)',
        animation: `slideIn 0.5s ease forwards`,
        animationDelay: delay,
      }}
    >
      <div className="font-mono text-[9px] text-neutral-600 mb-1">{url}</div>
      <div className={`font-bold text-sm ${color}`}>{msg}</div>
    </div>
  );
}

// ─── Anxiety Bar ─────────────────────────────────────────────────────────────
function AnxietyBar({ label, val }: { label: string; val: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-purple-400 font-bold">{val}</span>
      </div>
      <div className="h-1.5 bg-neutral-900 rounded-full overflow-hidden relative border border-white/5">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all duration-1000 ease-out meter-bar"
          style={{ width: '0%' }}
          data-width={val}
        />
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-purple-600/20 to-transparent w-1/3 animate-[scan_2s_linear_infinite]" />
      </div>
    </div>
  );
}

// ─── Social Proof Counter ─────────────────────────────────────────────────────
function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div
      className="p-6 rounded-xl border border-white/5 text-center"
      style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)' }}
    >
      <div className="font-mono font-bold text-3xl text-emerald-400 mb-1">{number}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate bars when problem section enters viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>('.meter-bar').forEach((bar) => {
              const target = bar.dataset.width ?? '0%';
              setTimeout(() => { bar.style.width = target; }, 100);
            });
            entry.target.querySelectorAll<HTMLElement>('.reveal-up').forEach((el, i) => {
              setTimeout(() => el.classList.add('opacity-100', 'translate-y-0'), i * 80);
            });
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('.observe-section').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const desktopCards = [
    { url: 'sisu.mec.gov.br',     msg: '🚨 Lista de espera atualizada!',  color: 'text-purple-400', delay: '0.2s'  },
    { url: 'ufrj.br/editais',     msg: '✓ Sem alterações',                color: 'text-neutral-500', delay: '0.5s' },
    { url: 'ibge.gov.br/concurso',msg: '🚨 Resultado final publicado!',   color: 'text-purple-400', delay: '0.8s'  },
  ];

  return (
    <>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scan {
          from { transform: translateX(-100%); }
          to   { transform: translateX(400%); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .reveal-up {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
      `}</style>

      <div className="bg-[#0a0a0a] text-[#f5f2eb] font-sans overflow-x-hidden selection:bg-purple-500 selection:text-white min-h-screen">
        <Navbar />

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] relative"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 65% 40%, rgba(108,52,131,0.16) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 30%, rgba(0,230,118,0.03) 0%, transparent 70%), #0a0a0a',
          }}
        >
          <div className="pt-28 md:pt-40 px-6 md:pl-20 md:pr-12 pb-16 flex flex-col justify-center relative z-10">
            <Ticker />

            <h1 className="font-black text-5xl sm:text-6xl md:text-8xl leading-[0.9] tracking-tighter mb-6 md:mb-8">
              Você vai<br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px #f5f2eb', textShadow: '0 0 10px rgba(108,52,131,0.3)' }}
              >
                saber antes
              </span>
              <br />
              <span className="text-emerald-400">de todo mundo.</span>
            </h1>

            <p className="text-neutral-500 text-base md:text-lg font-light max-w-md leading-relaxed mb-8 md:mb-10">
              Saiu resultado do <strong className="text-purple-400 font-medium">SISU</strong>?
              Convocação do <strong className="text-neutral-200 font-medium">concurso</strong>?{' '}
              A gente te avisa na hora — sem você precisar de F5.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <Link
                to="/cadastro"
                className="w-full sm:w-auto text-center bg-emerald-400 text-black font-black text-sm px-8 md:px-10 py-4 md:py-5 rounded-sm hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)] hover:bg-emerald-300 transition-all uppercase tracking-widest"
              >
                Criar alerta grátis
              </Link>
              <Link
                to="/como-funciona"
                className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-purple-400 border-b border-purple-500/20 pb-1 transition-colors"
              >
                ver como funciona →
              </Link>
            </div>
          </div>

          {/* Feed lateral — desktop */}
          <div className="hidden lg:flex items-center justify-center pr-20 pt-40">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between font-mono text-[10px] text-purple-600 mb-4 uppercase tracking-widest font-bold">
                <span>Alertas recentes</span>
                <span className="text-emerald-400 flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
                    style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
                  />
                  monitorando
                </span>
              </div>
              {desktopCards.map((c) => (
                <AlertCard key={c.url} {...c} />
              ))}
            </div>
          </div>

          {/* Feed mobile */}
          <div className="lg:hidden px-6 pb-16">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {desktopCards.map((c) => (
                <div
                  key={c.url}
                  className="shrink-0 border border-white/5 border-l-4 border-l-purple-600 p-4 rounded-lg min-w-45"
                  style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)' }}
                >
                  <div className="font-mono text-[9px] text-neutral-600 mb-1">{c.url}</div>
                  <div className={`font-bold text-sm ${c.color}`}>{c.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROBLEMA ─────────────────────────────────────────────────── */}
        <section className="py-20 md:py-32 px-6 md:px-20 border-t border-white/5 observe-section">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-4 md:mb-6 reveal-up">
                // o problema
              </span>
              <h2 className="font-black text-4xl md:text-7xl tracking-tighter leading-none mb-6 md:mb-8 reveal-up">
                Cansou de dar{' '}
                <em className="text-emerald-400 not-italic">F5 na página</em>?
              </h2>
              <p className="text-neutral-500 font-light leading-relaxed text-sm md:text-base reveal-up">
                Enquanto você fica recarregando a página de hora em hora,
                a vaga some — ou o prazo passa. Não é falta de esforço,
                é falta de aviso. A gente resolve isso.
              </p>
            </div>

            <div
              className="p-6 md:p-8 rounded-2xl border border-white/5 observe-section"
              style={{ background: 'linear-gradient(145deg, rgba(108,52,131,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 mb-6">
                Nível de ansiedade por monitoramento
              </p>
              <div className="space-y-5 md:space-y-6">
                <AnxietyBar label="Lista SISU"  val="97%" />
                <AnxietyBar label="Concursos"   val="91%" />
                <AnxietyBar label="Bolsas UFRJ" val="74%" />
              </div>
            </div>
          </div>
        </section>

        {/* ── NÚMEROS / PROVA SOCIAL ────────────────────────────────────── */}
        <section className="py-20 md:py-28 px-6 md:px-20 border-t border-white/5 observe-section">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-4 reveal-up">
                // em números
              </span>
              <h2 className="font-black text-4xl md:text-5xl tracking-tighter leading-tight reveal-up">
                Enquanto você dormia,<br />
                <span className="text-purple-400">o robô trabalhava.</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard number="12.400+" label="Alertas enviados" />
              <StatCard number="340+"    label="Sites monitorados" />
              <StatCard number="24/7"    label="Sem pausas" />
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ────────────────────────────────────────────────── */}
        <section
          className="border-t border-white/5 py-20 md:py-28 px-6 text-center relative overflow-hidden observe-section"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a',
          }}
        >
          <div className="relative">
            <h2 className="font-black text-4xl md:text-6xl tracking-tighter leading-none mb-4 reveal-up">
              Chega de atualizar{' '}
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.5)' }}
              >
                a página.
              </span>
            </h2>
            <p className="text-neutral-500 text-base md:text-lg font-light mb-8 md:mb-10 max-w-lg mx-auto leading-relaxed reveal-up">
              Crie seu alerta agora. É grátis, leva 20 segundos e{' '}
              <strong className="text-purple-400">não precisa instalar nada</strong>.
              A gente cuida da ansiedade por você.
            </p>
            <Link
              to="/cadastro"
              className="inline-block w-full sm:w-auto bg-emerald-400 text-black font-black text-sm px-10 md:px-14 py-4 md:py-5 rounded-sm hover:bg-emerald-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] transition-all uppercase tracking-widest reveal-up"
            >
              Criar alerta grátis →
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}