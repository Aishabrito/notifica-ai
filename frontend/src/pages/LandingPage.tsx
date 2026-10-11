import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SeletorAparencia from '../components/SeletorAparencia';
import { Footer } from '../components/footer';
import { FaqSection } from '../components/faq-section';
import { PUBLICOS, Celular, SecaoPublico, AntesDepois, Confianca, type Publico } from '../components/landing/PublicoAlvo';
import TesteAgora from '../components/landing/TesteAgora';
import ProximasDatas from '../components/landing/ProximasDatas';
import Comparacao from '../components/landing/Comparacao';
import CompartilharTurma from '../components/landing/CompartilharTurma';

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/4 bg-(--fundo)/80 backdrop-blur-md">
      <Link to="/" className="font-mono font-bold text-sm tracking-widest text-white">
        notifica<span className="text-emerald-400">.ai</span>
      </Link>
      <div className="flex items-center gap-4 md:gap-8">
        <SeletorAparencia />
        <a href="#pra-voce" className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors hidden md:block">
          Como funciona
        </a>
        <Link to="/calendario" className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors hidden md:block">
          Calendário
        </Link>
        <a href="#planos" className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors hidden md:block">
          Planos
        </a>
        <Link to="/login" className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors hidden sm:block">
          Entrar
        </Link>
        <Link
          to="/cadastro"
          className="font-mono text-[10px] uppercase tracking-widest border border-emerald-400/40 text-emerald-400 px-4 py-2 rounded-sm hover:bg-emerald-400 hover:text-black transition-all"
        >
          Começar grátis
        </Link>
      </div>
    </nav>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

function Planos() {
  // Preços e limites vêm do backend (mesma fonte do checkout); sem resposta, mostra só "Pro"
  const [config, setConfig] = useState<{ menor: number; mensal: number; free?: { maxAlertas: number; intervaloHoras: number } } | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/api/mp-config`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const porMes: number[] = (d?.planos ?? []).map((p: { porMes: number }) => p.porMes);
        const mensal = d?.cartao?.valor;
        if (mensal) setConfig({ menor: porMes.length ? Math.min(...porMes) : mensal, mensal, free: d.free });
      })
      .catch(() => {});
  }, []);
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const maxFree = config?.free?.maxAlertas ?? 1;

  const planos = [
    {
      nome: 'Grátis', preco: 'R$ 0', destaque: false, cta: 'Criar conta grátis',
      itens: [maxFree === 1 ? '1 página monitorada' : `${maxFree} páginas monitoradas`, `Checagem a cada ${config?.free?.intervaloHoras ?? 6} horas`, 'Aviso por e-mail'],
    },
    {
      nome: 'Pro', destaque: true, cta: 'Testar 7 dias grátis',
      preco: config ? `a partir de ${brl(config.menor)}/mês` : 'Pro',
      nota: config && config.menor < config.mensal ? `no plano anual · ou ${brl(config.mensal)} no mensal` : null,
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
      <p className="text-neutral-500 mb-12 max-w-xl">Pague no cartão ou no Pix. Sem fidelidade: cancele quando quiser.</p>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        {planos.map((p) => (
          <div key={p.nome} className={`rounded-2xl p-8 border ${p.destaque ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/10'}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">{p.nome}</p>
            <p className={`text-3xl font-black ${'nota' in p && p.nota ? 'mb-1' : 'mb-6'}`}>{p.preco}</p>
            {'nota' in p && p.nota && <p className="text-xs text-neutral-500 mb-6">{p.nota}</p>}
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

export default function LandingPage({ publicoInicial = 'vestibulando' }: { publicoInicial?: Publico }) {
  const [publico, setPublico] = useState<Publico>(publicoInicial);
  const escolher = (p: Publico) => {
    setPublico(p);
    document.getElementById('pra-voce')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="bg-(--fundo) text-(--texto) font-sans overflow-x-hidden selection:bg-purple-500 selection:text-white min-h-screen">
        <Navbar />

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 relative px-6 md:px-20 pt-28 md:pt-36 pb-16 md:pb-24 items-center"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 70% 40%, rgba(108,52,131,0.18) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 30%, rgba(0,230,118,0.04) 0%, transparent 70%), var(--fundo)',
          }}
        >
          <div className="relative z-10">
            <Ticker />

            <h1 className="font-black text-5xl sm:text-6xl md:text-7xl leading-[0.92] tracking-tighter mb-6">
              Você vai<br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px var(--texto)', textShadow: '0 0 10px rgba(108,52,131,0.3)' }}
              >
                saber antes
              </span>
              <br />
              <span className="text-emerald-400">de todo mundo.</span>
            </h1>

            <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-8 max-w-lg">
              A gente vigia o site do <strong className="text-(--texto) font-semibold">SISU</strong>, da{' '}
              <strong className="text-(--texto) font-semibold">banca</strong> e o{' '}
              <strong className="text-(--texto) font-semibold">Diário Oficial</strong>. Mudou? Você recebe no celular,
              em uma frase, com o prazo e o link oficial.
            </p>

            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Eu sou:</p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-xl mb-6">
              {(Object.keys(PUBLICOS) as Publico[]).map((id) => (
                <button
                  key={id}
                  onClick={() => escolher(id)}
                  className={`text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 group ${publico === id ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-white/10 hover:border-white/25 bg-neutral-900/30'}`}
                >
                  <span className="text-2xl">{PUBLICOS[id].emoji}</span>
                  <p className="font-black text-lg mt-1 flex justify-between items-center">
                    {PUBLICOS[id].rotulo}
                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </p>
                  <p className="text-xs text-neutral-500">{PUBLICOS[id].chamada}</p>
                </button>
              ))}
            </div>

            <a
              href="#teste-agora"
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-emerald-400 border-b border-purple-500/20 pb-1 transition-colors"
            >
              ou cole um link e teste agora, sem cadastro →
            </a>
          </div>

          <Celular />
        </section>

        <TesteAgora publico={publico} />

        <AntesDepois publico={publico} />

        <SecaoPublico publico={publico} onTrocar={setPublico} />

        <ProximasDatas publico={publico} />

        <Comparacao />

        <CompartilharTurma publico={publico} />

        <Confianca />

        <Planos />

        <FaqSection />

        <Footer />
      </div>
    </>
  );
}
