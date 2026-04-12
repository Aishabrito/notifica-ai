import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="border-t border-neutral-900 px-6 md:px-16 py-10 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
    <div className="font-black text-lg tracking-tight">
      Notifica<span className="text-emerald-400">.ai</span>
    </div>
    <div className="flex items-center gap-4 font-mono text-xs">
      <Link to="/termos" className="text-purple-400/60 hover:text-purple-400 transition-colors border-b border-purple-500/20 pb-0.5">
        Termos de Uso
      </Link>
      <Link to="/privacidade" className="text-purple-400/60 hover:text-purple-400 transition-colors border-b border-purple-500/20 pb-0.5">
        Política de Privacidade
      </Link>
    </div>
    <div className="font-mono text-xs text-neutral-800">
      © 2025 Notifica.ai
    </div>
    <div className="font-mono text-xs text-neutral-700">
      por <span className="text-neutral-600">Aisha Brito · UFRJ</span>
    </div>
  </footer>
);