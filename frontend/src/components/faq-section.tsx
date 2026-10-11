import { useState } from "react";
import { FaqItem } from "./types";
import { Reveal, Label } from "./reveal";

const FAQ_ITEMS: FaqItem[] = [
  { q: "Precisa instalar alguma coisa?",               a: "Não. Funciona no navegador do celular ou do computador. Se quiser, dá para instalar como app (sem loja) para receber notificação na tela." },
  { q: "Serve para a lista de espera da minha faculdade?", a: "Sim. SISU, ProUni, Fies e a página de chamadas de qualquer universidade: se você abre no navegador sem login, a gente monitora. Informe sua posição e mostramos quanto falta para chegar em você." },
  { q: "Como sei se fui nomeado(a)?",                   a: "No Pro, o Radar procura seu nome no Diário Oficial da União e nos diários municipais. Se for uma nomeação, o aviso chega como urgente, já com o prazo de posse e a lista de documentos." },
  { q: "Com que frequência a página é verificada?",    a: "No plano grátis, de 6 em 6 horas, todo dia. No Pro, você escolhe: a cada 6 horas, 1 hora ou 15 minutos. Para chamada com prazo curto, o Pro é o mais indicado." },
  { q: "Vou receber um monte de mensagem?",            a: "Não. Só avisamos quando algo muda de verdade. E todo aviso tem um link para cancelar com 1 clique." },
  { q: "Posso monitorar mais de um site?",             a: "No grátis você monitora 1 página, ótimo para a lista ou o edital que mais importa. No Pro é ilimitado, com resumo do que mudou feito por IA e o Radar do Diário Oficial." },
];

export const FaqSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  const toggle = (i: number) => setOpen(open === i ? null : i);

  return (
    <section id="duvidas" className="px-6 md:px-20 py-16 md:py-24 border-t border-white/5">
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
                className="w-full flex justify-between items-center px-5 md:px-6 py-5 text-left hover:bg-neutral-800 transition-colors cursor-pointer"
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