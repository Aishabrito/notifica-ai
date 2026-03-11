import { useState } from "react";
import { FaqItem } from "./types";
import { Reveal, Label } from "./reveal";

const FAQ_ITEMS: FaqItem[] = [
  { q: "Precisa instalar alguma coisa?",             a: "Não. Nenhuma extensão, nenhum aplicativo. Você cola o link e o seu e-mail — é o único passo. Funciona em qualquer navegador, em qualquer dispositivo." },
  { q: "Funciona com SISU, PROUNI e Diário Oficial?", a: "Sim. Sites do governo e portais de concurso são exatamente o tipo de página que o Notifica.ai monitora melhor. Se você consegue abrir no navegador sem fazer login, a gente monitora." },
  { q: "Com que frequência a página é verificada?",  a: "No plano gratuito, de 6 em 6 horas — quatro vezes por dia, todo dia. No plano premium, a cada 30 minutos. Para listas de espera com prazo de 2 dias, o premium é o mais indicado." },
  { q: "Como cancelo um alerta?",                    a: "Todo e-mail tem um link de cancelamento no rodapé. Um clique e acabou — sem login, sem formulário, sem burocracia." },
  { q: "E se o site não mudar por semanas?",         a: "Você não recebe nenhum e-mail. Só avisamos quando algo muda de verdade — sem spam, sem notificações desnecessárias." },
  { q: "Posso monitorar mais de um site?",           a: "No plano gratuito você tem 3 alertas ativos — dá para monitorar lista do SISU, resultado de concurso e edital de bolsa ao mesmo tempo. No premium os alertas são ilimitados." },
];

export const FaqSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  const toggle = (i: number) => setOpen(open === i ? null : i);

  return (
    <section className="px-16 py-24 border-b border-neutral-900">
      <Reveal>
        <Label>// dúvidas frequentes</Label>
        <h2 className="text-4xl font-black tracking-tighter mb-10">Tirou alguma dúvida?</h2>
      </Reveal>

      <div className="flex flex-col gap-0.5 max-w-3xl">
        {FAQ_ITEMS.map((item, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <div className="bg-neutral-900 rounded overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="w-full flex justify-between items-center px-6 py-5 text-left hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <span className="font-bold text-sm tracking-tight">{item.q}</span>
                <span className={`text-emerald-400 font-mono text-lg ml-6 shrink-0 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-48" : "max-h-0"}`}>
                <div className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed border-t border-neutral-800 pt-4">
                  {item.a}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};