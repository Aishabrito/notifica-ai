import { useState, useEffect } from 'react';

// Interface para as perguntas do FAQ (TypeScript)
interface FAQItemProps {
  question: string;
  answer: string;
}

export default function ComoFunciona() {
  useEffect(() => {
    // Lógica de Scroll Reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen selection:bg-emerald-400 selection:text-black">
      
      {/* HERO DA EXPLICAÇÃO */}
      <section className="pt-40 px-6 md:px-16 pb-20 border-b border-white/5">
        <div className="font-mono text-emerald-400 text-[10px] tracking-[0.3em] uppercase mb-6 flex items-center gap-4">
          <span className="w-10 h-px bg-emerald-400"></span> // como funciona
        </div>
        <h1 className="font-display font-extrabold text-6xl md:text-8xl leading-[0.85] tracking-tighter mb-10">
          Uma coisa só:<br />
          <span className="text-white/10" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>te avisar</span><br />
          <span className="text-emerald-400">antes de todos.</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl font-light leading-relaxed">
          Você cola o link de qualquer página e <strong>nós mandamos um e-mail assim que algo mudar.</strong> 
          Simples, direto e sem distrações.
        </p>
      </section>

      {/* SEÇÃO FAQ */}
      <section className="py-24 px-6 md:px-16 reveal">
        <h2 className="font-display font-bold text-4xl mb-12 tracking-tight">Dúvidas frequentes</h2>
        <div className="max-w-3xl space-y-2">
          <FAQItem 
            question="Precisa instalar alguma coisa?" 
            answer="Não. Nenhuma extensão ou aplicativo. Você só precisa do link e do seu e-mail." 
          />
          <FAQItem 
            question="Com que frequência o robô verifica?" 
            answer="No plano gratuito, de 6 em 6 horas. No premium, a cada 30 minutos para casos críticos." 
          />
        </div>
      </section>

    </div>
  );
}

// COMPONENTE DE FAQ COM ESTADO (React Way)
function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-[#111] rounded-lg overflow-hidden border border-white/5">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-display font-bold text-sm">{question}</span>
        <span className={`text-emerald-400 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-6 pb-6 text-gray-500 text-sm leading-relaxed border-t border-white/5 pt-4">
          {answer}
        </p>
      </div>
    </div>
  );
}