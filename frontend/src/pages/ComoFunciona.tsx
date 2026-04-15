import { useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/4#0a0a0a]/80 backdrop-blur-md">
      <Link to="/" className="font-mono font-bold text-sm tracking-widest text-white">
        notifica<span className="text-emerald-400">.ai</span>
      </Link>
      <div className="flex items-center gap-6 md:gap-8">
        <Link
          to="/como-funciona"
          className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hidden sm:block"
        >
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

// ─── Reveal ───────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, delay * 1000);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(22px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
      }}
    >
      {children}
    </div>
  );
}

// ─── Label (section tag) ──────────────────────────────────────────────────────
function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-4 md:mb-6">
      {children}
    </span>
  );
}

// ─── Mock Window (email preview) ──────────────────────────────────────────────
function MockWindow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-white/5 overflow-hidden"
      style={{ background: 'linear-gradient(145deg, rgba(108,52,131,0.05) 0%, #111 100%)' }}
    >
      {/* Barra do "navegador" */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/40" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/40" />
        <span className="font-mono text-[10px] text-neutral-600 ml-2 truncate">{title}</span>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

// ─── Notif Mock (email card) ─────────────────────────────────────────────────
function NotifMock({
  from, time, subject, body, link,
}: {
  from: string; time: string; subject: string; body: ReactNode; link: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-mono text-[10px] text-neutral-600">{from}</p>
          <p className="font-bold text-sm text-white mt-0.5">{subject}</p>
        </div>
        <span className="font-mono text-[10px] text-neutral-600 shrink-0 ml-3">{time}</span>
      </div>
      <div className="text-xs text-neutral-400 leading-relaxed">{body}</div>
      <p className="font-mono text-[10px] text-emerald-400 hover:underline cursor-pointer">{link}</p>
    </div>
  );
}

// ─── Email Visual ─────────────────────────────────────────────────────────────
function EmailVisual() {
  const timeline = [
    {
      dot: 'green' as const,
      label: '22:54 — checagem automática',
      text: (
        <>
          Robô detecta conteúdo{' '}
          <strong className="text-neutral-400">diferente do registrado.</strong>
        </>
      ),
    },
    {
      dot: 'green' as const,
      label: '22:54 — alerta disparado',
      text: (
        <>
          <strong className="text-neutral-400">E-mail enviado imediatamente</strong> para você.
        </>
      ),
    },
    {
      dot: 'yellow' as const,
      label: 'prazo de matrícula',
      text: (
        <>
          2 dias úteis para confirmar.{' '}
          <strong className="text-neutral-400">Você tem tempo. Os outros, talvez não.</strong>
        </>
      ),
    },
  ];

  return (
    <MockWindow title="caixa de entrada — 23:07">
      <NotifMock
        from="Notifica.ai <alerta@notifica.ai>"
        time="23:07"
        subject="🚨 Lista de espera do SISU atualizada!"
        body={
          <>
            Detectamos uma mudança na página que você monitora:
            <br /><br />
            <strong className="text-neutral-300">SISU 2025 — Lista de Espera · UFRJ · Medicina</strong>
            <br /><br />
            Novas chamadas foram publicadas. Confira agora e fique atento ao prazo de matrícula.
          </>
        }
        link="→ Acessar lista de espera agora"
      />

      <div className="mt-5 pt-5 border-t border-neutral-900">
        <div className="font-mono text-xs text-neutral-600 tracking-widest uppercase mb-4">
          O que aconteceu
        </div>
        {timeline.map((item, i) => (
          <div key={i} className="flex gap-3 md:gap-4 relative">
            {i < timeline.length - 1 && (
              <div className="absolute left-3 top-7 bottom-0 w-px bg-neutral-900" />
            )}
            <div
              className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-1 border ${
                item.dot === 'green'
                  ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                  : 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
              }`}
            >
              ✓
            </div>
            <div className="pb-5">
              <div className="font-mono text-[11px] md:text-xs text-neutral-600 mb-1">{item.label}</div>
              <div className="text-xs md:text-sm text-neutral-500 leading-relaxed">{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: 'Funciona com qualquer site?',
    a: 'Sim — qualquer página acessível publicamente pelo navegador. Não precisa de login no site monitorado.',
  },
  {
    q: 'Com que frequência vocês checam?',
    a: 'De 6 em 6 horas, automaticamente. Manhã, tarde, noite e madrugada — todos os dias, incluindo feriados.',
  },
  {
    q: 'Como eu cancelo?',
    a: 'Com 1 clique direto no rodapé do e-mail de alerta. Sem formulário, sem login, sem suporte.',
  },
  {
    q: 'Recebo spam?',
    a: 'Nunca. Você só recebe e-mail quando a página mudar de verdade. Sem newsletter, sem marketing.',
  },
  {
    q: 'E se eu quiser monitorar mais de um link?',
    a: 'Basta criar um alerta para cada URL. Cada um é independente.',
  },
];

function FaqSection() {
  const ref = useRef<HTMLDetailsElement[]>([]);

  return (
    <section className="px-6 md:px-16 py-16 md:py-24 border-b border-white/5">
      <Reveal>
        <Label>// perguntas frequentes</Label>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 md:mb-14">
          Ainda ficou alguma dúvida?
        </h2>
      </Reveal>

      <div className="max-w-2xl space-y-2">
        {faqs.map((faq, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <details
              ref={(el) => { if (el) ref.current[i] = el; }}
              className="group border border-white/5 rounded-xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.04) 0%, rgba(0,0,0,0) 100%)' }}
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none font-bold text-sm text-neutral-200 hover:text-white transition-colors">
                {faq.q}
                <span className="ml-4 font-mono text-purple-500 text-lg group-open:rotate-45 transition-transform duration-200">+</span>
              </summary>
              <div className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed">
                {faq.a}
              </div>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Custom Cursor ────────────────────────────────────────────────────────────
function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring_pos = useRef({ x: 0, y: 0 });
  const raf = useRef<number>(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', move);

    const loop = () => {
      ring_pos.current.x += (pos.current.x - ring_pos.current.x) * 0.12;
      ring_pos.current.y += (pos.current.y - ring_pos.current.y) * 0.12;

      if (dot.current) {
        dot.current.style.transform = `translate(${pos.current.x - 3}px, ${pos.current.y - 3}px)`;
      }
      if (ring.current) {
        ring.current.style.transform = `translate(${ring_pos.current.x - 14}px, ${ring_pos.current.y - 14}px)`;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div
        ref={dot}
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-emerald-400 rounded-full pointer-events-none z-9999"
      />
      <div
        ref={ring}
        className="fixed top-0 left-0 w-7 h-7 border border-purple-500/50 rounded-full pointer-events-none z-9998"
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ComoFunciona() {
  return (
    <>
      <style>{`
        @keyframes noise-scroll {
          0%   { background-position: 0 0; }
          100% { background-position: 200px 200px; }
        }
        .noise-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          animation: noise-scroll 8s steps(10) infinite;
        }
      `}</style>

      <div
        className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased selection:bg-purple-500 selection:text-white"
        style={{ cursor: 'none' }}
      >
        {/* Noise overlay */}
        <div className="noise-overlay fixed inset-0 pointer-events-none z-1000 opacity-[0.35]" />

        <CustomCursor />
        <Navbar />

        {/* ── HERO ───────────────────────────────────────────────────── */}
        <section
          className="pt-32 md:pt-44 pb-16 md:pb-24 px-6 md:px-16 border-b border-white/5 relative overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 70% 40%, rgba(108,52,131,0.14) 0%, transparent 70%), #0a0a0a',
          }}
        >
          <Reveal>
            <div className="flex items-center gap-2 md:gap-3 mb-6 w-fit px-3 md:px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-950/30 shadow-[0_0_15px_rgba(108,52,131,0.1)]">
              <span className="font-mono text-[8px] md:text-[9px] text-purple-200 tracking-widest bg-purple-500/30 px-2.5 py-1 rounded-full uppercase">
                como funciona
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.02] md:leading-[0.9] mb-6 md:mb-8 max-w-3xl">
              Veja exatamente<br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px #f5f2eb', textShadow: '0 0 10px rgba(108,52,131,0.3)' }}
              >
                o que acontece
              </span>
              <br />
              <span className="text-emerald-400">por baixo.</span>
            </h1>

            <p className="text-base md:text-lg text-neutral-500 max-w-xl leading-relaxed font-light">
              Você cola o link de qualquer página e a gente{' '}
              <strong className="text-white font-medium">manda um e-mail assim que algo mudar.</strong>{' '}
              Enquanto você vive, o robô fica de olho.
            </p>
          </Reveal>
        </section>

        {/* ── PARA QUEM É ────────────────────────────────────────────── */}
        <section className="px-6 md:px-16 py-16 md:py-24 border-b border-white/5">
          <Reveal>
            <Label>// para quem é</Label>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 md:mb-14 leading-tight">
              Qualquer site.<br />Qualquer mudança.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🎓',
                who: 'Vestibulandos',
                desc: 'Lista de espera do SISU, chamadas do PROUNI, vagas remanescentes. Tudo muda sem aviso — você recebe antes de todo mundo.',
              },
              {
                icon: '📋',
                who: 'Concurseiros',
                desc: 'Gabarito definitivo, convocação para posse, resultado de recurso, abertura de nova fase. Cada prazo perdido é uma oportunidade a menos.',
              },
              {
                icon: '🔬',
                who: 'Universitários',
                desc: 'Edital de PIBIC, resultado de monitoria, abertura de intercâmbio. Inscrições fecham rápido — quem sabe primeiro, se inscreve com calma.',
              },
            ].map((item) => (
              <Reveal key={item.who}>
                <div
                  className="rounded-xl p-6 border border-purple-500/10 hover:border-purple-500/30 hover:-translate-y-1 transition-all h-full group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)',
                  }}
                >
                  <div className="text-2xl mb-4">{item.icon}</div>
                  <div className="font-bold text-base tracking-tight mb-2 group-hover:text-purple-400 transition-colors">
                    {item.who}
                  </div>
                  <div className="text-sm text-neutral-500 leading-relaxed font-light">{item.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 3 PASSOS ───────────────────────────────────────────────── */}
        <section
          className="px-6 md:px-16 py-16 md:py-24 border-b border-white/5"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(108,52,131,0.08) 0%, transparent 70%), #0a0a0a',
          }}
        >
          <Reveal>
            <Label>// em três passos</Label>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 md:mb-14">
              Simples assim.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-purple-900/15 rounded-xl overflow-hidden border border-purple-600/20">
            {[
              {
                n: '01',
                title: 'Você cola o link',
                desc: 'Encontrou a página? Cola o link e coloca seu e-mail. É o único trabalho que você tem.',
              },
              {
                n: '02',
                title: 'A gente monitora',
                desc: 'Nosso sistema checa de 6 em 6 horas — madrugada, manhã, tarde e noite. Todo dia, inclusive feriados.',
              },
              {
                n: '03',
                title: 'Mudou? E-mail na hora.',
                desc: 'Qualquer atualização e você recebe um e-mail imediatamente com o link direto. Sem spam.',
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className="p-8 md:p-12 group relative overflow-hidden h-full transition-colors duration-300 hover:bg-purple-900/25">
                  {/* Linha de destaque no hover */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-emerald-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                  {/* Glow */}
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-700/15 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="text-6xl md:text-7xl font-black text-purple-900/80 leading-none mb-4 md:mb-6 group-hover:text-purple-700/80 transition-colors">
                    {s.n}
                  </div>
                  <div className="text-base md:text-lg font-bold tracking-tight mb-2 md:mb-3 text-neutral-200 group-hover:text-emerald-400 transition-colors">
                    {s.title}
                  </div>
                  <div className="text-sm text-zinc-400 leading-relaxed">{s.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── NA PRÁTICA ─────────────────────────────────────────────── */}
        <section className="px-6 md:px-16 py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="hidden md:block absolute top-1/2 -translate-y-1/2 left-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none bg-purple-900/15" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center max-w-6xl mx-auto">
            <Reveal>
              <Label>// na prática</Label>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.02] md:leading-[0.92] mb-6">
                Você dorme.<br />
                <span
                  className="text-transparent"
                  style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.4)' }}
                >
                  O robô
                </span>
                <br />
                <span className="text-emerald-400">fica acordado.</span>
              </h2>
              <p className="text-sm md:text-base text-neutral-500 leading-relaxed font-light mb-8">
                Às 23h de uma sexta-feira, a lista de espera do SISU atualiza.{' '}
                <strong className="text-neutral-300 font-medium">A maioria não vê até segunda.</strong>{' '}
                Você recebe o e-mail em minutos — e confirma a vaga no prazo.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  'Funciona com qualquer site que você consegue abrir no navegador',
                  'Sem login no site monitorado — só o link já basta',
                  'Checagem automática 4 vezes por dia, todos os dias',
                  'Cancelamento com 1 clique direto no e-mail',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="text-emerald-400 font-mono text-xs mt-0.5 shrink-0">✓</span>
                    <span className="text-xs md:text-sm text-neutral-400 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="w-full overflow-hidden rounded-xl">
                <EmailVisual />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <FaqSection />

        {/* ── CTA FINAL ──────────────────────────────────────────────── */}
        <section
          className="px-6 md:px-16 py-20 md:py-32 text-center relative overflow-hidden border-t border-white/5"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a',
          }}
        >
          <Reveal>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.02] md:leading-[0.9] mb-6 relative">
              Chega de<br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.5)' }}
              >
                ficar atualizando
              </span>
              <br />
              <span className="text-emerald-400">a página.</span>
            </h2>
            <p className="text-sm md:text-base text-neutral-500 mb-10 md:mb-12 font-light max-w-lg mx-auto leading-relaxed">
              Cria seu alerta agora. É grátis, leva 20 segundos e{' '}
              <strong className="text-purple-400">não precisa instalar nada</strong>.
              A gente cuida da ansiedade por você.
            </p>
            <Link
              to="/cadastro"
              className="inline-block w-full sm:w-auto bg-emerald-400 text-black font-black text-sm md:text-base px-10 md:px-12 py-4 md:py-5 rounded-sm hover:bg-emerald-300 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] uppercase tracking-widest"
            >
              Criar meu alerta grátis →
            </Link>
          </Reveal>
        </section>

        <Footer />
      </div>
    </>
  );
}