import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';

interface AnxietyBarProps {
  label: string;
  val: string;
}

function AnxietyBar({ label, val }: AnxietyBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-mono text-[10px] text-neutral-500 uppercase tracking-widest relative">
        <span>{label}</span>
        <span className="text-purple-400 font-bold">{val}</span>
      </div>
      <div className="h-1.5 bg-neutral-900 rounded-full overflow-hidden relative border border-white/5">
        <div
          className="h-full bg-emerald-400 origin-left transition-transform duration-1000 meter-bar scale-x-0"
          style={{ width: val }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-600/30 to-transparent w-1/3 animate-scan" />
      </div>
    </div>
  );
}

export default function LandingPage() {

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.querySelectorAll('.meter-bar').forEach(b => {
            (b as HTMLElement).style.transform = 'scaleX(1)';
          });
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(r => observer.observe(r));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] font-sans overflow-x-hidden selection:bg-purple-500 selection:text-white">

      <Navbar />

      {/* HERO */}
      <section
        className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] relative"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 65% 40%, rgba(108,52,131,0.16) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 30%, rgba(0,230,118,0.03) 0%, transparent 70%), #0a0a0a' }}
      >
        <div className="pt-28 md:pt-40 px-6 md:pl-20 md:pr-12 pb-16 flex flex-col justify-center relative z-10">

          {/* TICKER */}
          <div className="flex items-center gap-3 mb-8 md:mb-10 overflow-hidden border border-purple-500/20 rounded-full w-fit px-3 md:px-4 py-1.5 bg-purple-950/30 shadow-[0_0_15px_rgba(108,52,131,0.1)] max-w-full">
            <span className="font-mono text-[9px] text-purple-200 whitespace-nowrap tracking-widest bg-purple-500/30 px-2 py-0.5 rounded-full shrink-0">AO VIVO</span>
            <div className="flex gap-6 md:gap-8 animate-ticker whitespace-nowrap font-mono text-[10px] text-neutral-400">
              <span>🚨 SISU 2025 — Lista de espera</span>
              <span className="text-emerald-400">CEFET-RJ — Convocação</span>
              <span className="text-purple-400">IBGE — Resultado disponível</span>
              <span className="text-emerald-400">UFRJ — Editais abertos</span>
              <span>🚨 SISU 2025 — Lista de espera</span>
              <span className="text-emerald-400">CEFET-RJ — Convocação</span>
              <span className="text-purple-400">IBGE — Resultado disponível</span>
              <span className="text-emerald-400">UFRJ — Editais abertos</span>
            </div>
          </div>

          <h1 className="font-display font-extrabold text-5xl sm:text-6xl md:text-8xl leading-[0.9] tracking-tighter mb-6 md:mb-8">
            Você vai<br />
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #f5f2eb', textShadow: '0 0 10px rgba(108,52,131,0.3)' }}>saber antes</span><br />
            <span className="text-emerald-400">de todo mundo.</span>
          </h1>

          <p className="text-neutral-500 text-base md:text-lg font-light max-w-md leading-relaxed mb-8 md:mb-10">
            Saiu resultado do <strong className="text-purple-400 font-medium">SISU</strong>? Convocação do{" "}
            <strong className="text-neutral-200 font-medium">concurso</strong>?
            A gente te avisa na hora — sem você precisar de F5.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <Link
              to="/cadastro"
              className="w-full sm:w-auto text-center bg-emerald-400 text-black font-display font-bold px-8 md:px-10 py-4 md:py-5 rounded-sm hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)] hover:bg-emerald-300 transition-all"
            >
              Criar alerta grátis
            </Link>
            <Link
              to="/como-funciona"
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-purple-400 border-b border-purple-500/20 pb-1 transition-colors"
            >
              ver detalhes →
            </Link>
          </div>
        </div>

        {/* FEED LATERAL — só desktop */}
        <div className="hidden lg:flex items-center justify-center pr-20 pt-40">
          <div className="w-full max-w-sm space-y-3">
            <div className="flex justify-between font-mono text-[10px] text-purple-600 mb-4 uppercase tracking-widest font-bold">
              <span>Alertas recentes</span>
              <span className="text-emerald-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                monitorando
              </span>
            </div>
            {[
              { url: "sisu.mec.gov.br",    msg: "🚨 Lista de espera atualizada!",    color: "text-purple-400", delay: "0s" },
              { url: "ufrj.br/editais",    msg: "✓ Sem alterações",                  color: "text-neutral-500", delay: "0.4s" },
              { url: "ibge.gov.br/concurso", msg: "🚨 Resultado final publicado!",   color: "text-purple-400", delay: "0.8s" },
            ].map((card) => (
              <div
                key={card.url}
                className="border border-white/5 border-l-4 border-l-purple-600 p-5 rounded-lg opacity-0 animate-slideIn"
                style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)', animationDelay: card.delay }}
              >
                <div className="font-mono text-[9px] text-neutral-600 mb-1">{card.url}</div>
                <div className={`font-display font-bold text-sm ${card.color}`}>{card.msg}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FEED MOBILE — versão compacta */}
        <div className="lg:hidden px-6 pb-16">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { url: "sisu.mec.gov.br",     msg: "🚨 Lista atualizada!",    color: "text-purple-400" },
              { url: "ufrj.br/editais",     msg: "✓ Sem alterações",        color: "text-neutral-500" },
              { url: "ibge.gov.br/concurso", msg: "🚨 Resultado publicado!", color: "text-purple-400" },
            ].map((card) => (
              <div
                key={card.url}
                className="shrink-0 border border-white/5 border-l-4 border-l-purple-600 p-4 rounded-lg min-w-[200px]"
                style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)' }}
              >
                <div className="font-mono text-[9px] text-neutral-600 mb-1">{card.url}</div>
                <div className={`font-display font-bold text-sm ${card.color}`}>{card.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-20 md:py-32 px-6 md:px-20 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="reveal">
            <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-4 md:mb-6">// o problema</span>
            <h2 className="font-display font-extrabold text-4xl md:text-7xl tracking-tighter leading-none mb-6 md:mb-8">
              Cansada de dar <em className="text-emerald-400 not-italic">F5 na página</em>?
            </h2>
            <p className="text-neutral-500 font-light leading-relaxed text-sm md:text-base">
              Resultado de lista de espera ninguém te avisa. Você fica presa num loop de ansiedade que o Notifica.ai resolve.
            </p>
          </div>
          <div
            className="p-6 md:p-8 rounded-2xl border border-white/5 reveal"
            style={{ background: 'linear-gradient(145deg, rgba(108,52,131,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
          >
            <div className="space-y-5 md:space-y-6">
              <AnxietyBar label="Lista SISU"  val="97%" />
              <AnxietyBar label="Concursos"   val="91%" />
              <AnxietyBar label="Bolsas UFRJ" val="74%" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 PASSOS */}
      <section
        className="py-20 md:py-32 px-6 md:px-20 border-t border-white/[0.05]"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(108,52,131,0.08) 0%, transparent 70%), #0a0a0a' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-14 reveal">
            <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-4">// em três passos</span>
            <h2 className="font-display font-extrabold text-4xl md:text-6xl tracking-tighter leading-none">
              Simples assim.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-purple-900/10 rounded-xl overflow-hidden border border-purple-500/10">
            {[
              { n: "01", title: "Você cola o link",       desc: "Cola o link e seu e-mail. É o único trabalho que você tem." },
              { n: "02", title: "A gente monitora",       desc: "Checamos de 6 em 6 horas — manhã, tarde, noite e madrugada." },
              { n: "03", title: "Mudou? E-mail na hora.", desc: "Qualquer atualização e você recebe um e-mail imediatamente." },
            ].map((s, i) => (
              <div
                key={s.n}
                className="p-8 md:p-10 group relative overflow-hidden reveal"
                style={{ transitionDelay: `${i * 0.1}s`, background: 'linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(108,52,131,0.01) 100%)' }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="text-5xl md:text-6xl font-black text-purple-950/30 leading-none mb-4 md:mb-6 font-display group-hover:text-purple-500/10 transition-colors">{s.n}</div>
                <div className="font-display font-bold text-base md:text-lg mb-2 group-hover:text-emerald-400 transition-colors">{s.title}</div>
                <div className="text-sm text-neutral-500 font-light leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="border-t border-white/[0.05] py-20 md:py-28 px-6 text-center relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a' }}
      >
        <div className="reveal relative">
          <h2 className="font-display font-extrabold text-4xl md:text-6xl tracking-tighter leading-none mb-4">
            Chega de atualizar{" "}
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.5)' }}>a página.</span>
          </h2>
          <p className="text-neutral-500 text-base md:text-lg font-light mb-8 md:mb-10 max-w-lg mx-auto leading-relaxed">
            Crie seu alerta agora. É grátis, leva 20 segundos e{" "}
            <strong className="text-purple-400">não precisa instalar nada</strong>.
            A gente cuida da ansiedade por você.
          </p>
          <Link
            to="/cadastro"
            className="inline-block w-full sm:w-auto bg-emerald-400 text-black font-display font-bold text-base px-10 md:px-14 py-4 md:py-5 rounded-sm hover:bg-emerald-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] transition-all"
          >
            Criar alerta grátis →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}