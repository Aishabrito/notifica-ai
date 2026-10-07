import { useEffect, useRef, useState } from 'react';
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

function Planos() {
  // Preço vem do backend (mesma fonte do checkout); sem resposta, mostra só "Pro"
  const [preco, setPreco] = useState<number | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/api/mp-config`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPreco(d?.cartao?.valor ?? null))
      .catch(() => {});
  }, []);

  const planos = [
    {
      nome: 'Grátis', preco: 'R$ 0', destaque: false, cta: 'Criar conta grátis',
      itens: ['3 alertas ativos', 'Checagem a cada 6 horas', 'Aviso por e-mail'],
    },
    {
      nome: 'Pro', destaque: true, cta: 'Testar 7 dias grátis',
      preco: preco ? `${preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês` : 'Pro',
      itens: [
        'Alertas ilimitados',
        'Checagem até a cada 15 minutos',
        'Resumo do que mudou, feito por IA',
        'Prazos direto na sua agenda',
        'Radar: seu nome no Diário Oficial',
        'Alertas no Telegram',
      ],
    },
  ];

  return (
    <section id="planos" className="px-6 md:px-20 py-20 md:py-28 border-t border-white/5">
      <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3">// planos</p>
      <h2 className="font-black text-4xl md:text-5xl tracking-tighter mb-3">Comece grátis. Vire Pro quando precisar.</h2>
      <p className="text-neutral-500 mb-12 max-w-xl">Pague no cartão ou no Pix, sem precisar de conta no Mercado Pago. Cancele quando quiser.</p>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        {planos.map((p) => (
          <div key={p.nome} className={`rounded-2xl p-8 border ${p.destaque ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/10'}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">{p.nome}</p>
            <p className="text-3xl font-black mb-6">{p.preco}</p>
            <ul className="space-y-2 mb-8">
              {p.itens.map((i) => (
                <li key={i} className="text-sm text-neutral-300 flex gap-2"><span className="text-emerald-400">✓</span>{i}</li>
              ))}
            </ul>
            <Link
              to="/cadastro"
              className={`inline-block font-mono text-xs font-bold px-6 py-3 rounded-lg uppercase tracking-widest ${p.destaque ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'border border-white/20 hover:border-white/40'}`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LandingPage() {
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
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
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

        <Planos />

        <Footer />
      </div>
    </>
  );
}