import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  
  useEffect(() => {
    // Lógica do Scroll Reveal otimizada para monitorar elementos específicos
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Ativa as barras de progresso apenas quando a seção do medidor aparece
          entry.target.querySelectorAll('.meter-bar').forEach(b => {
             (b as HTMLElement).style.transform = 'scaleX(1)';
          });
        }
      });
    }, { threshold: 0.15 });

    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(r => observer.observe(r));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] font-sans overflow-x-hidden selection:bg-emerald-400 selection:text-black">
      
      {/* NAVBAR - Atualizada com o link 'Como funciona' */}
      <nav className="fixed top-0 left-0 right-0 z-100 flex justify-between items-center px-6 md:px-12 py-6 bg-linear-to-b from-[#0a0a0a]/90 to-transparent backdrop-blur-md">
        <Link to="/" className="font-display font-extrabold text-xl tracking-tighter">
          Notifica<span className="text-emerald-400">.ai</span>
        </Link>
        <div className="flex items-center gap-8">
          {/* Link para a nova página que você criou */}
          <Link to="/como-funciona" className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
            Como funciona
          </Link>
          <Link to="/login" className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
            Entrar
          </Link>
          <Link to="/cadastro" className="font-mono text-[10px] uppercase tracking-widest bg-emerald-400 text-black px-5 py-2 rounded-sm hover:opacity-80 transition-opacity">
            Criar conta
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] relative">
        <div className="pt-40 px-6 md:pl-20 md:pr-12 flex flex-col justify-center relative z-10">
          
          {/* TICKER - Experiência 'Live' que você citou no currículo */}
          <div className="flex items-center gap-3 mb-10 overflow-hidden border border-emerald-400/20 rounded-full w-fit px-4 py-1">
            <span className="font-mono text-[9px] text-emerald-400 whitespace-nowrap tracking-widest">AO VIVO</span>
            <div className="flex gap-8 animate-ticker whitespace-nowrap font-mono text-[10px] text-gray-600">
                <span>🚨 SISU 2025 — Lista de espera</span>
                <span>CEFET-RJ — Convocação</span>
                <span className="text-emerald-400">IBGE — Resultado disponível</span>
            </div>
          </div>

          <h1 className="font-display font-extrabold text-6xl md:text-8xl leading-[0.9] tracking-tighter mb-8">
            Você vai<br />
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px white' }}>saber antes</span><br />
            <span className="text-emerald-400">de todo mundo.</span>
          </h1>

          <p className="text-gray-400 text-lg font-light max-w-md leading-relaxed mb-10">
            Saiu resultado do <strong>SISU</strong>? Convocação do <strong>concurso</strong>? 
            A gente te avisa na hora — sem você precisar de F5.
          </p>

          <div className="flex items-center gap-6">
            <Link to="/cadastro" className="bg-emerald-400 text-black font-display font-bold px-10 py-5 rounded-sm hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,230,118,0.3)] transition-all">
              Criar alerta grátis
            </Link>
            <Link to="/como-funciona" className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-white border-b border-white/10 pb-1">
              ver detalhes →
            </Link>
          </div>
        </div>

        {/* FEED DE ALERTAS (DIREITA) */}
        <div className="hidden lg:flex items-center justify-center pr-20 pt-40">
            <div className="w-full max-w-sm space-y-3">
               <div className="flex justify-between font-mono text-[10px] text-gray-600 mb-4 uppercase tracking-widest">
                 <span>Alertas recentes</span>
                 <span className="text-emerald-400 flex items-center gap-2">
                   <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> monitorando
                 </span>
               </div>
               <div className="bg-[#1a1a1a] border-l-2 border-red-500 p-4 rounded-r-lg opacity-0 animate-slideIn">
                 <div className="font-mono text-[9px] text-gray-600 mb-1">sisu.mec.gov.br</div>
                 <div className="font-display font-bold text-sm text-red-400">🚨 Lista de espera atualizada!</div>
               </div>
               <div className="bg-[#1a1a1a] border-l-2 border-emerald-400 p-4 rounded-r-lg opacity-0 animate-slideIn delay-100">
                 <div className="font-mono text-[9px] text-gray-600 mb-1">ufrj.br/editais</div>
                 <div className="font-display font-bold text-sm text-gray-400">✓ Sem alterações</div>
               </div>
            </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-32 px-6 md:px-20 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div className="reveal">
          <span className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase block mb-6">// o problema</span>
          <h2 className="font-display font-extrabold text-5xl md:text-7xl tracking-tighter leading-none mb-8">
            Cansada de dar <em className="text-emerald-400 not-italic">F5 na página</em>?
          </h2>
          <p className="text-gray-500 font-light leading-relaxed">
            Resultado de lista de espera ninguém te avisa. Você fica presa num loop de ansiedade que o Notifica.ai resolve.
          </p>
        </div>

        <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/5 reveal">
          <div className="space-y-6">
            <AnxietyBar label="Lista SISU" val="97%" />
            <AnxietyBar label="Concursos" val="91%" />
            <AnxietyBar label="Bolsas UFRJ" val="74%" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 px-6 md:px-20 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="font-display font-extrabold text-lg">Notifica<span className="text-emerald-400">.ai</span></div>
        <div className="font-mono text-[10px] text-gray-700">© 2025 — Feito por Aisha Brito · UFRJ</div>
      </footer>
    </div>
  );
}

interface AnxietyBarProps {
  label: string;
  val: string;
}

function AnxietyBar({ label, val }: AnxietyBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-mono text-[10px] text-gray-500 uppercase">
        <span>{label}</span>
        <span className="text-emerald-400">{val}</span>
      </div>
      <div className="h-1.5 bg-black rounded-full overflow-hidden">
        <div 
          className="h-full bg-emerald-400 origin-left transition-transform duration-1000 meter-bar scale-x-0" 
          style={{ width: val }}
        ></div>
      </div>
    </div>
  );
}