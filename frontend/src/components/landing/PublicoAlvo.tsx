import { Link } from 'react-router-dom';

export type Publico = 'vestibulando' | 'concurseiro';

type Recurso = { icone: string; titulo: string; texto: string; pro?: boolean };
type Aviso = { app: string; quando: string; titulo: string; corpo: string; urgente?: boolean };

export const PUBLICOS: Record<Publico, {
  emoji: string; rotulo: string; chamada: string; titulo: string; intro: string;
  dores: string[]; passos: { titulo: string; texto: string }[]; recursos: Recurso[];
  avisos: Aviso[]; resumo: { titulo: string; linhas: [string, string][] }; cta: string;
}> = {
  vestibulando: {
    emoji: '🎓',
    rotulo: 'Vestibulando',
    chamada: 'SISU, ProUni, Fies e lista de espera',
    titulo: 'Sua vaga não pode depender de você ficar dando F5.',
    intro: 'A lista de espera anda quando ninguém está olhando. A gente olha por você e te conta, em uma frase, se chegou a sua vez.',
    dores: [
      'Ficar atualizando o site da faculdade a cada hora',
      'Descobrir a chamada pelo grupo do WhatsApp, quando já é tarde',
      'Perder o prazo da matrícula por não ver o e-mail certo',
    ],
    passos: [
      { titulo: 'Escolha o curso', texto: 'Cole o link da lista de espera ou escolha um modelo pronto (SISU, ProUni, Fies, sua universidade).' },
      { titulo: 'Diga a sua posição', texto: 'Informe seu nome ou classificação. A gente acompanha até onde cada chamada chegou.' },
      { titulo: 'Receba no celular', texto: 'Saiu chamada? Notificação na hora, com quanto falta para você e o prazo da matrícula.' },
    ],
    recursos: [
      { icone: '📍', titulo: 'Quanto falta pra mim', texto: '"A 2ª chamada foi até o 65º. Você é o 72º: faltam 7." Com a estimativa no ritmo atual.' },
      { icone: '📲', titulo: 'Aviso no celular', texto: 'Notificação na tela, mesmo com o site fechado. Instala como app, sem loja.' },
      { icone: '🗂️', titulo: 'Prazo e documentos', texto: 'Data da matrícula com a lista do que levar, direto na agenda do seu celular.', pro: true },
      { icone: '✨', titulo: 'Resumo em 1 frase', texto: 'Mudou o edital? A IA conta o que mudou, sem você ler 40 páginas.', pro: true },
    ],
    avisos: [
      { app: 'Notifica.ai', quando: 'agora', titulo: '🎉 Chegou a sua vez!', corpo: 'UFRJ · Medicina: a 3ª chamada foi até o 92º. Você é o 88º.', urgente: true },
      { app: 'Notifica.ai', quando: '2 min', titulo: '🗓️ Matrícula até 14/10', corpo: 'Leve RG, histórico e comprovante de residência.' },
    ],
    resumo: {
      titulo: 'UFRJ · Medicina (ampla concorrência)',
      linhas: [['Chamada', '3ª, até o 92º'], ['Sua posição', '88º ✓'], ['Matrícula', 'até 14/10, online'], ['Documentos', '6 itens no checklist']],
    },
    cta: 'Começar como vestibulando',
  },
  concurseiro: {
    emoji: '📚',
    rotulo: 'Concurseiro(a)',
    chamada: 'Editais, resultados, nomeação e posse',
    titulo: 'Do edital à posse, sem perder nenhum prazo.',
    intro: 'Retificação, gabarito, resultado, convocação: a gente vigia a banca e o Diário Oficial e te avisa só quando algo muda.',
    dores: [
      'Retificação no edital que ninguém comentou',
      'Ler o Diário Oficial todo dia procurando o próprio nome',
      'Prazo de recurso ou de posse que passou despercebido',
    ],
    passos: [
      { titulo: 'Escolha o concurso', texto: 'Cole o link da página da banca ou escolha um modelo pronto (Cebraspe, FGV, Vunesp, órgãos).' },
      { titulo: 'Ligue o Radar', texto: 'Coloque seu nome no Radar do Diário Oficial e os cargos que te interessam.' },
      { titulo: 'Receba o essencial', texto: 'Mudou algo? Aviso com o que mudou, o prazo e o link oficial. Nomeação vem como urgente.' },
    ],
    recursos: [
      { icone: '📰', titulo: 'Seu nome no Diário Oficial', texto: 'Radar do DOU e dos diários municipais. Nomeação chega como 🚨 urgente.', pro: true },
      { icone: '⏰', titulo: 'Prazos em vermelho', texto: 'Recurso, inscrição, posse: tudo em uma lista com contagem regressiva e agenda.', pro: true },
      { icone: '🔎', titulo: 'Radar de editais', texto: 'Avisa quando abre edital para o cargo e a região que você escolheu.', pro: true },
      { icone: '🏛️', titulo: 'Validade do concurso', texto: 'Aprovado(a)? Contamos o tempo até o fim da validade e lembramos 6, 3 e 1 mês antes.' },
    ],
    avisos: [
      { app: 'Notifica.ai', quando: 'agora', titulo: '🚨 Parece a sua nomeação!', corpo: 'DOU de hoje: seu nome em portaria de nomeação. Prazo de posse: 30 dias.', urgente: true },
      { app: 'Notifica.ai', quando: '1 h', titulo: '✏️ Edital retificado', corpo: 'TJ-RJ: a prova mudou de 12/11 para 26/11.' },
    ],
    resumo: {
      titulo: 'TJ-RJ 2025 · Analista Judiciário',
      linhas: [['O que mudou', 'Data da prova'], ['Antes', '12/11'], ['Agora', '26/11'], ['Fonte', 'Página oficial da banca']],
    },
    cta: 'Começar como concurseiro(a)',
  },
};

// Celular de demonstração: as notificações de um público (ou uma de cada, no topo)
export function Celular({ publico }: { publico?: Publico }) {
  const avisos = publico ? PUBLICOS[publico].avisos : [PUBLICOS.vestibulando.avisos[0], PUBLICOS.concurseiro.avisos[0]];
  return (
    <div className="relative mx-auto w-[min(290px,100%)]">
      <div className="absolute -inset-6 rounded-[3rem] bg-purple-600/20 blur-3xl pointer-events-none" />
      <div className="relative rounded-[2.5rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-gradient-to-b from-purple-950/80 via-neutral-950 to-neutral-950 px-3 pt-3 pb-6 min-h-[430px]">
          <div className="flex justify-between items-center px-3 font-mono text-[10px] text-white/70">
            <span>9:41</span>
            <span className="w-16 h-4 rounded-full bg-black" />
            <span>5G ▮</span>
          </div>
          <p className="text-center text-white text-5xl font-extralight mt-6 tracking-tight">9:41</p>
          <p className="text-center text-white/60 text-xs mb-6">sábado, 11 de outubro</p>
          <div className="space-y-2" key={publico ?? 'todos'}>
            {avisos.map((a, i) => (
              <div
                key={a.titulo}
                className={`rounded-2xl p-3 backdrop-blur-md opacity-0 ${a.urgente ? 'bg-white/90 text-neutral-950' : 'bg-white/15 text-white'}`}
                style={{ animation: 'slideIn 0.5s ease forwards', animationDelay: `${0.15 + i * 0.35}s` }}
              >
                <div className={`flex justify-between text-[10px] mb-0.5 ${a.urgente ? 'text-neutral-600' : 'text-white/60'}`}>
                  <span className="flex items-center gap-1.5"><img src="/icone-192.png" alt="" className="w-3.5 h-3.5 rounded" />{a.app}</span>
                  <span>{a.quando}</span>
                </div>
                <p className="text-[13px] font-semibold leading-tight">{a.titulo}</p>
                <p className={`text-[12px] leading-snug ${a.urgente ? 'text-neutral-700' : 'text-white/80'}`}>{a.corpo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Seção com abas: tudo o que cada público ganha, em linguagem direta
export function SecaoPublico({ publico, onTrocar }: { publico: Publico; onTrocar: (p: Publico) => void }) {
  const p = PUBLICOS[publico];
  return (
    <section id="pra-voce" className="px-6 md:px-20 py-20 md:py-28 border-t border-white/5 scroll-mt-16">
      <div className="flex flex-col items-center text-center mb-12">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-4">// feito pra você</p>
        <div role="tablist" aria-label="Escolha seu perfil" className="inline-flex p-1 rounded-full border border-white/10 bg-neutral-900/60">
          {(Object.keys(PUBLICOS) as Publico[]).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={publico === id}
              onClick={() => onTrocar(id)}
              className={`px-4 sm:px-6 py-2.5 rounded-full text-sm font-bold transition-all ${publico === id ? 'bg-emerald-400 text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
            >
              {PUBLICOS[id].emoji} {PUBLICOS[id].rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center max-w-6xl mx-auto" key={publico}>
        <div>
          <h2 className="font-black text-4xl md:text-5xl tracking-tighter leading-[1.02] mb-4">{p.titulo}</h2>
          <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-8 max-w-xl">{p.intro}</p>

          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Chega de:</p>
          <ul className="space-y-2 mb-10">
            {p.dores.map((d) => (
              <li key={d} className="flex gap-3 text-sm text-neutral-400"><span className="text-red-400/80 shrink-0">✕</span><span className="line-through decoration-neutral-700">{d}</span></li>
            ))}
          </ul>

          <ol className="grid sm:grid-cols-3 gap-3">
            {p.passos.map((s, i) => (
              <li key={s.titulo} className="rounded-xl border border-white/5 bg-neutral-900/30 p-4">
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-400 text-black font-black text-sm mb-3">{i + 1}</span>
                <p className="font-bold text-sm mb-1">{s.titulo}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{s.texto}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="hidden lg:block"><Celular publico={publico} /></div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mt-16">
        {p.recursos.map((r) => (
          <div key={r.titulo} className="rounded-2xl border border-white/5 p-5 hover:border-purple-500/30 hover:-translate-y-1 transition-all" style={{ background: 'linear-gradient(135deg, rgba(108,52,131,0.07) 0%, rgba(0,0,0,0) 100%)' }}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-2xl">{r.icone}</span>
              {r.pro && <span className="font-mono text-[9px] uppercase tracking-widest text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5">Pro</span>}
            </div>
            <p className="font-bold mb-1">{r.titulo}</p>
            <p className="text-sm text-neutral-500 leading-relaxed">{r.texto}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <Link
          to={`/cadastro?perfil=${publico}`}
          className="inline-block w-full sm:w-auto bg-emerald-400 text-black font-black text-sm px-10 py-4 rounded-lg hover:bg-emerald-300 hover:-translate-y-0.5 transition-all uppercase tracking-widest"
        >
          {p.cta} →
        </Link>
        <p className="text-xs text-neutral-600 mt-3">Grátis para sempre com 1 página · sem cartão</p>
      </div>
    </section>
  );
}

// "Informação fácil": o que a pessoa teria de ler × o que ela recebe
export function AntesDepois({ publico }: { publico: Publico }) {
  const p = PUBLICOS[publico];
  return (
    <section className="px-6 md:px-20 py-20 md:py-28 border-t border-white/5" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(108,52,131,0.10) 0%, transparent 70%), var(--fundo)' }}>
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3 text-center">// informação fácil</p>
        <h2 className="font-black text-4xl md:text-5xl tracking-tighter text-center mb-12">A gente lê o site difícil.<br /><span className="text-emerald-400">Você lê uma frase.</span></h2>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5 relative overflow-hidden h-64" aria-hidden>
            <p className="font-mono text-[10px] text-neutral-500 mb-3">📄 edital_retificado_v3_FINAL.pdf · pág. 37 de 84</p>
            <div className="space-y-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-2 rounded bg-neutral-700/40" style={{ width: `${60 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-(--fundo) to-transparent" />
            <p className="absolute bottom-4 left-5 text-sm text-neutral-400">Sem o Notifica: ler tudo, todo dia.</p>
          </div>
          <div className="text-center text-3xl text-emerald-400 md:rotate-0 rotate-90">→</div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
            <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Com o Notifica</p>
            <p className="font-bold mb-4">{p.resumo.titulo}</p>
            <dl className="divide-y divide-white/5">
              {p.resumo.linhas.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="font-semibold text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Confianca() {
  const itens = [
    { icone: '🏛️', titulo: 'Só fonte oficial', texto: 'Todo aviso traz o link da página original.' },
    { icone: '🔕', titulo: 'Zero spam', texto: 'Só avisamos quando algo muda de verdade.' },
    { icone: '🔒', titulo: 'Dados protegidos', texto: 'Criptografia e LGPD. Apague sua conta quando quiser.' },
    { icone: '👋', titulo: 'Sem fidelidade', texto: 'Comece grátis. Cancele com 1 clique.' },
  ];
  return (
    <section className="px-6 md:px-20 py-14 border-t border-white/5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {itens.map((i) => (
          <div key={i.titulo} className="flex gap-3">
            <span className="text-2xl shrink-0">{i.icone}</span>
            <div>
              <p className="font-bold text-sm">{i.titulo}</p>
              <p className="text-xs text-neutral-500 leading-relaxed">{i.texto}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
