import { Link } from "react-router-dom";

import { Navbar }       from "../components/navbar";
import { Footer }       from "../components/footer";
import { CustomCursor } from "../components/custom-cursor";
import { Reveal, Label } from "../components/reveal";
import { MockWindow, NotifMock, ScenarioCard } from "../components/ui";
import { UseSection }   from "../components/use-section";
import { FaqSection }   from "../components/faq-section";

// ─── Dados das seções de uso ──────────────────────────────────────────────────

const sisuScenarios = [
  { icon: "📋", title: "Lista de espera do SISU abriu",  desc: "Você ficou na espera para Medicina na UFRJ. Cadastrou o link e foi dormir. Às 23h de uma sexta saiu a chamada. Você recebeu o e-mail em minutos — e garantiu a matrícula no prazo." },
  { icon: "🏛️", title: "Chamada de vagas remanescentes", desc: "Vagas que sobram após a matrícula dos convocados voltam para a lista. O site atualiza sem avisar ninguém. Você já está monitorando e chega primeiro." },
  { icon: "📄", title: "PROUNI — Nova rodada liberada",   desc: "Cada rodada tem janela curta de inscrição. Quando abre, quem sabe primeiro tem mais tempo para escolher o curso e a instituição com calma." },
];

const concursosScenarios = [
  { icon: "📰", title: "Resultado final no Diário Oficial",     desc: "O gabarito definitivo ou a homologação saem no D.O.U. sem aviso. Com o Notifica.ai, você sabe antes de abrir o Google." },
  { icon: "📣", title: "Convocação para posse ou exame médico", desc: "Cada etapa tem prazo curto. O candidato que não aparece perde a vaga — mesmo estando na lista classificatória." },
  { icon: "🔄", title: "Chamada de vagas remanescentes",        desc: "Quando um convocado não se apresenta, a vaga volta para o próximo. Essa chamada raramente aparece em destaque — quem monitora chega primeiro." },
  { icon: "⏱️", title: "Abertura de prazo para recursos",       desc: "Janela de recursos dura 2 ou 3 dias. Se você não viu que abriu, perdeu. Com o alerta, você entra no prazo com tranquilidade." },
];

const universitariosScenarios = [
  { icon: "🧪", title: "Edital do PIBIC / PIBID abriu",        desc: "Editais de bolsa têm prazo de inscrição de uma semana ou menos. Com o alerta, você sabe no dia em que abre." },
  { icon: "📊", title: "Resultado de seleção para bolsa",       desc: "Você recebe o alerta antes mesmo de pensar em acessar o site. Tempo de sobra para aceitar ou planejar o próximo passo." },
  { icon: "✈️", title: "Abertura de intercâmbio ou monitoria",  desc: "Vagas limitadas, prazos curtos. Monitorar a página do departamento garante que você não perde mais nenhuma oportunidade." },
];

// ─── Visuais de cada seção ────────────────────────────────────────────────────

const SisuVisual = () => (
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
      <div className="font-mono text-xs text-neutral-600 tracking-widest uppercase mb-4">O QUE ACONTECEU</div>
      {[
        { dot: "green"  as const, label: "22:54 — checagem automática", text: <>Robô detecta conteúdo <strong className="text-neutral-400">diferente do registrado.</strong></> },
        { dot: "green"  as const, label: "22:54 — alerta disparado",    text: <><strong className="text-neutral-400">E-mail enviado imediatamente</strong> para você.</> },
        { dot: "yellow" as const, label: "prazo de matrícula",          text: <>2 dias úteis para confirmar. <strong className="text-neutral-400">Você tem tempo. Os outros, talvez não.</strong></> },
      ].map((item, i, arr) => (
        <div key={i} className="flex gap-4 relative">
          {i < arr.length - 1 && <div className="absolute left-3 top-7 bottom-0 w-px bg-neutral-900" />}
          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-1 border ${item.dot === "green" ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400" : "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"}`}>✓</div>
          <div className="pb-5">
            <div className="font-mono text-xs text-neutral-600 mb-1">{item.label}</div>
            <div className="text-sm text-neutral-500 leading-relaxed">{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  </MockWindow>
);

const ConcursosVisual = () => (
  <MockWindow title="alertas — semana do concurso">
    <NotifMock from="Notifica.ai" time="Seg · 08:02" subject="🚨 Gabarito definitivo publicado — IBGE 2025"  body="A página do concurso do IBGE foi atualizada. Gabarito definitivo disponível."           link="→ Ver gabarito agora" />
    <NotifMock from="Notifica.ai" time="Qua · 14:31" subject="🚨 Convocação publicada — Correios"            body="Lista de convocados para exame médico publicada no portal dos Correios."               link="→ Ver convocação" />
    <NotifMock from="Notifica.ai" time="Sex · 09:15" subject="⚡ Vaga remanescente disponível — TRT-RJ"      body="Nova chamada de vaga remanescente publicada. Prazo de manifestação: 48h."             link="→ Acessar agora" accent="yellow" />
  </MockWindow>
);

const UniversitariosVisual = () => (
  <MockWindow title="seus alertas ativos">
    <NotifMock from="Notifica.ai" time="Hoje · 07:48" subject="🚨 Edital PIBIC 2025 publicado — UFRJ" body="A página da pró-reitoria foi atualizada. Edital de bolsas de iniciação científica disponível. Inscrições abertas." link="→ Ver edital completo" />
    <div className="mt-5 pt-5 border-t border-neutral-900">
      <div className="font-mono text-xs text-neutral-600 tracking-widest uppercase mb-3">PÁGINAS MONITORADAS</div>
      <div className="flex flex-col gap-2">
        {["ufrj.br/pibic/edital", "pr2.ufrj.br/monitoria", "intercambio.ufrj.br/vagas"].map((url) => (
          <div key={url} className="flex justify-between items-center px-3.5 py-2.5 bg-neutral-950 rounded-md border border-neutral-900">
            <span className="font-mono text-xs text-neutral-600">{url}</span>
            <span className="font-mono text-xs text-emerald-400">● ativo</span>
          </div>
        ))}
      </div>
      <div className="font-mono text-xs text-neutral-700 mt-3 text-center">próxima checagem em 4h 22min</div>
    </div>
  </MockWindow>
);

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ComoFunciona() {
  return (
    <div className="bg-neutral-950 text-white min-h-screen font-sans antialiased" style={{ cursor: "none" }}>

      {/* Ruído de fundo */}
      <div
        className="fixed inset-0 pointer-events-none z-[1000] opacity-35"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")` }}
      />
      <CustomCursor />
      <Navbar />

      {/* HERO */}
      <section className="pt-40 pb-20 px-16 border-b border-neutral-900">
        <Reveal>
          <Label>// como funciona</Label>
          <h1 className="text-7xl font-black tracking-tighter leading-[0.88] mb-8">
            Uma coisa só:<br />
            <span className="text-neutral-700">te avisar</span><br />
            <span className="text-emerald-400">antes de todo mundo.</span>
          </h1>
          <p className="text-lg text-neutral-500 max-w-xl leading-relaxed font-light">
            Você cola o link de qualquer página — lista de espera, resultado de concurso, edital de chamada —
            e{" "}<strong className="text-white font-medium">a gente manda um e-mail assim que algo mudar.</strong>{" "}
            Enquanto você vive, a gente fica de olho.
          </p>
        </Reveal>
      </section>

      {/* 3 PASSOS */}
      <section className="px-16 py-24 border-b border-neutral-900">
        <Reveal>
          <Label>// em três passos</Label>
          <h2 className="text-5xl font-black tracking-tighter mb-14">Simples assim.</h2>
        </Reveal>
        <div className="grid grid-cols-3 gap-px bg-neutral-900">
          {[
            { n: "01", title: "Você cola o link",       desc: "Encontrou a página? Cola o link e coloca seu e-mail. Pronto — é o único trabalho que você tem." },
            { n: "02", title: "A gente monitora",       desc: "Nosso sistema checa de 6 em 6 horas — de madrugada, manhã, tarde e noite. Todo dia, incluindo fins de semana e feriados." },
            { n: "03", title: "Mudou? E-mail na hora.", desc: "Qualquer atualização na página e você recebe um e-mail imediatamente com o link direto. Sem spam — só quando importa." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="bg-neutral-950 p-12 group relative overflow-hidden h-full">
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="text-7xl font-black text-neutral-900 leading-none mb-6">{s.n}</div>
                <div className="text-lg font-bold tracking-tight mb-3">{s.title}</div>
                <div className="text-sm text-neutral-500 leading-relaxed">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SEÇÕES DE USO */}
      <UseSection
        tag="🎓 SISU & Vestibular"
        title={<>Lista de espera<br />não avisa<br /><span className="text-emerald-400">ninguém.</span></>}
        intro={<>A lista de espera do SISU pode ser chamada a qualquer momento — e o prazo para confirmar a vaga costuma ser de <strong className="text-neutral-300 font-medium">apenas 2 dias úteis.</strong> Quem não vê a tempo, perde a vaga para o próximo da fila.</>}
        scenarios={sisuScenarios}
        visual={<SisuVisual />}
      />

      <UseSection
        tag="📋 Concursos públicos"
        title={<>Anos de estudo.<br /><span className="text-emerald-400">Não dá pra perder</span><br />a convocação.</>}
        intro={<>Concurso tem muitas fases — e cada uma tem prazo. <strong className="text-neutral-300 font-medium">Nada disso vem com aviso no celular.</strong></>}
        scenarios={concursosScenarios}
        visual={<ConcursosVisual />}
        flip
        dark
      />

      <UseSection
        tag="🔬 Universitários"
        title={<>Bolsa não espera.<br /><span className="text-emerald-400">Edital abre e fecha</span><br />na mesma semana.</>}
        intro={<>Iniciação científica, monitoria, estágio, intercâmbio. <strong className="text-neutral-300 font-medium">Quem vê primeiro, se inscreve com calma. Quem vê tarde, corre contra o prazo.</strong></>}
        scenarios={universitariosScenarios}
        visual={<UniversitariosVisual />}
      />

      {/* STATS */}
      <section className="bg-neutral-900 border-y border-neutral-800 py-16 px-16">
        <Reveal>
          <div className="grid grid-cols-4 gap-12 max-w-4xl mx-auto text-center">
            {[
              { num: "2",   unit: "dias", label: "prazo médio para confirmar vaga na lista de espera do SISU" },
              { num: "1M",  unit: "+",    label: "candidatos disputam o SISU todo ano no Brasil" },
              { num: "4",   unit: "×",    label: "ao dia seu alerta é verificado — incluindo fins de semana" },
              { num: "R$0", unit: "",     label: "para começar — sem cartão, sem compromisso" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-4xl font-black tracking-tighter leading-none mb-2">
                  {s.num}<span className="text-emerald-400">{s.unit}</span>
                </div>
                <div className="font-mono text-xs text-neutral-600 uppercase tracking-wider leading-relaxed">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <FaqSection />

      {/* CTA */}
      <section className="px-16 py-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl" />
        </div>
        <Reveal>
          <h2 className="text-7xl font-black tracking-tighter leading-[0.88] mb-6 relative">
            Chega de<br />
            <span className="text-neutral-800">ficar atualizando</span><br />
            <span className="text-emerald-400">a página.</span>
          </h2>
          <p className="text-base text-neutral-600 mb-12 font-light relative">
            Cria seu alerta agora. É grátis, leva 20 segundos e não precisa instalar nada.
          </p>
          <Link
            to="/cadastro"
            className="inline-block bg-emerald-400 text-black font-bold text-base px-12 py-5 rounded hover:bg-emerald-300 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-400/20 relative"
          >
            Criar meu alerta grátis →
          </Link>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}