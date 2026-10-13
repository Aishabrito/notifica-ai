// "Grupo de WhatsApp × Notifica": por que trocar o boato pela fonte oficial
const LINHAS: [string, string, string][] = [
  ['De onde vem', 'Print de print, "um amigo disse"', 'A página oficial, com o link'],
  ['Quando chega', 'Quando alguém lembra de mandar', 'Na hora em que a página muda'],
  ['Quanto ler', '300 mensagens e figurinhas', '1 frase com o que mudou'],
  ['O seu caso', 'Você que procure seu nome', 'Sua posição e seu prazo, já calculados'],
  ['De madrugada', 'Todo mundo dormindo', 'A gente continua olhando'],
];

export default function Comparacao() {
  return (
    <section className="px-6 md:px-20 py-20 md:py-24 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-3 text-center">// sem boato</p>
        <h2 className="font-black text-4xl md:text-5xl tracking-tighter text-center mb-10">Grupo de WhatsApp <span className="text-neutral-600">×</span> <span className="text-emerald-400">Notifica</span></h2>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[0.8fr_1fr_1fr] text-[10px] md:text-xs font-mono uppercase tracking-widest bg-neutral-900/60">
            <span className="p-3 md:p-4" />
            <span className="p-3 md:p-4 text-neutral-500">💬 Grupo</span>
            <span className="p-3 md:p-4 text-emerald-400">🔔 Notifica</span>
          </div>
          {LINHAS.map(([tema, grupo, nos]) => (
            <div key={tema} className="grid grid-cols-[0.8fr_1fr_1fr] border-t border-white/5 text-xs md:text-sm">
              <span className="p-3 md:p-4 font-bold">{tema}</span>
              <span className="p-3 md:p-4 text-neutral-500">{grupo}</span>
              <span className="p-3 md:p-4 bg-emerald-400/5">{nos}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
