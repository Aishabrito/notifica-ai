import { Link } from "react-router-dom";

export const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-16 py-6 bg-neutral-950/95 backdrop-blur border-b border-neutral-900">
    <Link to="/" className="font-black text-xl tracking-tight text-white">
      Notifica<span className="text-emerald-400">.ai</span>
    </Link>
    <div className="flex items-center gap-8">
      <Link to="/como-funciona" className="font-mono text-xs text-white tracking-wide">
        Como funciona
      </Link>
      <Link to="/login" className="font-mono text-xs text-neutral-500 tracking-wide hover:text-white transition-colors">
        Entrar
      </Link>
      <Link to="/cadastro" className="font-mono text-xs bg-emerald-400 text-black px-5 py-2 rounded font-bold hover:bg-emerald-300 transition-colors">
        Criar conta
      </Link>
    </div>
  </nav>
);