import { Link } from "react-router-dom";
import { Navbar }        from "../components/navbar";
import { Footer }        from "../components/footer";
import { CustomCursor }  from "../components/custom-cursor";
import { Reveal, Label } from "../components/reveal";
import { MockWindow, NotifMock } from "../components/ui";
import { FaqSection }    from "../components/faq-section";

const EmailVisual = () => (
  <MockWindow title="caixa de entrada — 23:07">
    <NotifMock
      from="Notifica.ai <alerta@notifica.ai>"
      time="23:07"
      subject="🚨 Lista de espera do SISU atualizada!"
      body={
        <>
          Detectamos uma mudança na página que você monitora:<br /><br />
          <strong className="text-neutral-300">SISU 2025 — Lista de Espera · UFRJ · Medicina</strong><br /><br />
          Novas chamadas foram publicadas. Confira agora e fique atento ao prazo de matrícula.
        </>
      }
      link="→ Acessar lista de espera agora"
    />
    <div className="mt-5 pt-5 border-t border-neutral-900">
      <div className="font-mono text-xs text-neutral-600 tracking-widest uppercase mb-4">O que aconteceu</div>
      {[
        { dot: "green"  as const, label: "22:54 — checagem automática", text: <>Robô detecta conteúdo <strong className="text-neutral-400">diferente do registrado.</strong></> },
        { dot: "green"  as const, label: "22:54 — alerta disparado",    text: <><strong className="text-neutral-400">E-mail enviado imediatamente</strong> para você.</> },
        { dot: "yellow" as const, label: "prazo de matrícula",          text: <>2 dias úteis para confirmar. <strong className="text-neutral-400">Você tem tempo. Os outros, talvez não.</strong></> },
      ].map((item, i, arr) => (
        <div key={i} className="flex gap-3 md:gap-4 relative">
          {i < arr.length - 1 && <div className="absolute left-3 top-7 bottom-0 w-px bg-neutral-900" />}
          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-1 border ${
            item.dot === "green"
              ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
              : "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
          }`}>✓</div>
          <div className="pb-5">
            <div className="font-mono text-[11px] md:text-xs text-neutral-600 mb-1">{item.label}</div>
            <div className="text-xs md:text-sm text-neutral-500 leading-relaxed">{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  </MockWindow>
);

export default function ComoFunciona() {
  return (
    <div
      className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased selection:bg-purple-500 selection:text-white"
      style={{ cursor: "none" }}
    >
      {/* Ruído */}
      <div className="fixed inset-0 pointer-events-none z-1000 opacity-[0.35]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")` }}
      />
      <CustomCursor />
      <Navbar />

      {/* HERO */}
      <section
        className="pt-32 md:pt-40 pb-16 md:pb-24 px-6 md:px-16 border-b border-white/5 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 70% 40%, rgba(108,52,131,0.14) 0%, transparent 70%), #0a0a0a' }}
      >
        <Reveal>
          <div className="flex items-center gap-2 md:gap-3 mb-6 w-fit px-3 md:px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-950/30 shadow-[0_0_15px_rgba(108,52,131,0.1)]">
            <span className="font-mono text-[8px] md:text-[9px] text-purple-200 tracking-widest bg-purple-500/30 px-2.5 py-1 rounded-full uppercase">como funciona</span>
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.05] md:leading-[0.88] mb-6 md:mb-8 max-w-3xl">
            Uma coisa só:<br />
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #f5f2eb', textShadow: '0 0 10px rgba(108,52,131,0.3)' }}>te avisar</span><br />
            <span className="text-emerald-400">antes de todo mundo.</span>
          </h1>
          <p className="text-base md:text-lg text-neutral-500 max-w-xl leading-relaxed font-light">
            Você cola o link de qualquer página — lista de espera, resultado de concurso, edital de chamada —
            e <strong className="text-white font-medium">a gente manda um e-mail assim que algo mudar.</strong>{" "}
            Enquanto você vive, a gente fica de olho.
          </p>
        </Reveal>
      </section>

      {/* PARA QUEM É */}
      <section className="px-6 md:px-16 py-16 md:py-24 border-b border-white/[0.05]">
        <Reveal>
          <Label>// para quem é</Label>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 md:mb-14 leading-tight">Qualquer site.<br />Qualquer mudança.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-4">
          {[
            { icon: "🎓", who: "Vestibulandos",  desc: "Lista de espera do SISU, chamadas do PROUNI, vagas remanescentes. Tudo muda sem aviso — você recebe antes de todo mundo." },
            { icon: "📋", who: "Concurseiros",   desc: "Gabarito definitivo, convocação para posse, resultado de recurso, abertura de nova fase. Cada prazo perdido é uma oportunidade a menos." },
            { icon: "🔬", who: "Universitários", desc: "Edital de PIBIC, resultado de monitoria, abertura de intercâmbio. Inscrições fecham rápido — quem sabe primeiro, se inscreve com calma." },
          ].map((item) => (
            <Reveal key={item.who}>
              <div
                className="rounded-xl p-6 border border-purple-500/10 hover:border-purple-500/30 transition-all h-full group"
                style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.06) 0%, rgba(0,0,0,0) 100%)' }}
              >
                <div className="text-2xl mb-4">{item.icon}</div>
                <div className="font-bold text-base tracking-tight mb-2 group-hover:text-purple-400 transition-colors">{item.who}</div>
                <div className="text-sm text-neutral-500 leading-relaxed font-light">{item.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 3 PASSOS */}
      <section
        className="px-6 md:px-16 py-16 md:py-24 border-b border-white/[0.05]"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(108,52,131,0.08) 0%, transparent 70%), #0a0a0a' }}
      >
        <Reveal>
          <Label>// em três passos</Label>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 md:mb-14">Simples assim.</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-purple-900/10 rounded-xl overflow-hidden border border-purple-500/10">
          {[
            { n: "01", title: "Você cola o link",        desc: "Encontrou a página? Cola o link e coloca seu e-mail. É o único trabalho que você tem." },
            { n: "02", title: "A gente monitora",        desc: "Nosso sistema checa de 6 em 6 horas — madrugada, manhã, tarde e noite. Todo dia, inclusive feriados." },
            { n: "03", title: "Mudou? E-mail na hora.",  desc: "Qualquer atualização e você recebe um e-mail imediatamente com o link direto. Sem spam." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div
                className="p-8 md:p-12 group relative overflow-hidden h-full"
                style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(108,52,131,0.01) 100%)' }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="text-6xl md:text-7xl font-black text-purple-950/30 leading-none mb-4 md:mb-6 group-hover:text-purple-500/10 transition-colors">{s.n}</div>
                <div className="text-base md:text-lg font-bold tracking-tight mb-2 md:mb-3 group-hover:text-emerald-400 transition-colors">{s.title}</div>
                <div className="text-sm text-neutral-500 leading-relaxed">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* NA PRÁTICA */}
      <section className="px-6 md:px-16 py-16 md:py-24 border-b border-white/[0.05] relative overflow-hidden">
        {/* Escondi a bola de blur no mobile porque pode vazar da tela, volta no desktop */}
        <div className="hidden md:block absolute top-1/2 -translate-y-1/2 left-0 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none bg-purple-900/15" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center max-w-6xl mx-auto">
          <Reveal>
            <Label>// na prática</Label>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] md:leading-[0.92] mb-6">
              Você dorme.<br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.4)' }}
              >O robô</span><br />
              <span className="text-emerald-400">fica acordado.</span>
            </h2>
            <p className="text-sm md:text-base text-neutral-500 leading-relaxed font-light mb-8">
              Às 23h de uma sexta-feira, a lista de espera do SISU atualiza.{" "}
              <strong className="text-neutral-300 font-medium">A maioria não vê até segunda.</strong>{" "}
              Você recebe o e-mail em minutos — e confirma a vaga no prazo.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "Funciona com qualquer site que você consegue abrir no navegador",
                "Sem login no site monitorado — só o link já basta",
                "Checagem automática 4 vezes por dia, todos os dias",
                "Cancelamento com 1 clique direto no e-mail",
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

    

      <FaqSection />

      {/* CTA */}
      <section
        className="px-6 md:px-16 py-20 md:py-32 text-center relative overflow-hidden border-t border-white/5"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a' }}
      >
        <Reveal>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] md:leading-[0.88] mb-6 relative">
            Chega de<br />
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #6C3483', textShadow: '0 0 15px rgba(108,52,131,0.5)' }}>ficar atualizando</span><br />
            <span className="text-emerald-400">a página.</span>
          </h2>
          <p className="text-sm md:text-base text-neutral-500 mb-10 md:mb-12 font-light max-w-lg mx-auto leading-relaxed">
            Cria seu alerta agora. É grátis, leva 20 segundos e{" "}
            <strong className="text-purple-400">não precisa instalar nada</strong>.
            A gente cuida da ansiedade por você.
          </p>
          <Link
            to="/cadastro"
            className="inline-block w-full sm:w-auto bg-emerald-400 text-black font-bold text-sm md:text-base px-10 md:px-12 py-4 md:py-5 rounded-sm hover:bg-emerald-300 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] relative"
          >
            Criar meu alerta grátis →
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}