import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#f5f2eb] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(108,52,131,0.08) 0%, transparent 70%), #0a0a0a' }}
    >
      {/* Número grande de fundo */}
      <div
        className="absolute text-[20rem] font-black leading-none pointer-events-none select-none"
        style={{ color: 'rgba(108,52,131,0.06)', letterSpacing: '-0.05em' }}
      >
        404
      </div>

      <div className="relative">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-4">// erro 404</p>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-6">
          Página não<br />
          <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #6C3483' }}>encontrada.</span>
        </h1>
        <p className="text-neutral-500 text-base font-light max-w-sm mx-auto leading-relaxed mb-10">
          O link que você acessou não existe ou foi removido.
          Mas seus alertas continuam monitorando por aqui.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="w-full sm:w-auto text-center bg-emerald-400 text-black font-bold px-8 py-4 rounded-sm hover:bg-emerald-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(16,185,129,0.3)] transition-all text-sm"
          >
            Voltar para o início
          </Link>
          <Link
            to="/dashboard"
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-purple-400 border-b border-purple-500/20 pb-1 transition-colors"
          >
            Ir para o painel →
          </Link>
        </div>
      </div>
    </div>
  );
}