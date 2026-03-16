import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface NavbarProps {
  logado?: boolean;
}

export const Navbar = ({ logado = false }: NavbarProps) => {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false); // ⬅️ Controla o menu no celular

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const fecharMenu = () => setMenuAberto(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur border-b border-neutral-900">
      {/* Container Principal */}
      <div className="flex justify-between items-center px-6 md:px-16 py-4 md:py-6">
        <Link to="/" onClick={fecharMenu} className="font-black text-xl tracking-tight text-white">
          Notifica<span className="text-emerald-400">.ai</span>
        </Link>

        {/* 🍔 Ícone do Menu Hambúrguer (Aparece só no Celular) */}
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          className="md:hidden text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuAberto ? (
              // Ícone de "X" (Fechar)
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              // Ícone de Hambúrguer (Abrir)
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* 💻 Menu Desktop (Escondido no Celular, aparece de Tablet para cima) */}
        <div className="hidden md:flex items-center gap-8">
          {logado ? (
            <>
              <span className="font-mono text-xs text-neutral-500 tracking-wide">
                {usuario?.email}
              </span>
              <button
                onClick={handleLogout}
                className="font-mono text-xs text-neutral-500 tracking-wide hover:text-white transition-colors border border-neutral-800 hover:border-neutral-600 px-4 py-2 rounded-lg"
              >
                Sair →
              </button>
            </>
          ) : (
            <>
              <Link to="/como-funciona" className="font-mono text-xs text-white tracking-wide">
                Como funciona
              </Link>
              <Link to="/login" className="font-mono text-xs text-neutral-500 tracking-wide hover:text-white transition-colors">
                Entrar
              </Link>
              <Link to="/cadastro" className="font-mono text-xs bg-emerald-400 text-black px-5 py-2 rounded font-bold hover:bg-emerald-300 transition-colors">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 📱 Menu Mobile (Desce quando clica no hambúrguer) */}
      {menuAberto && (
        <div className="md:hidden absolute top-full left-0 w-full bg-neutral-950/95 backdrop-blur-md border-b border-neutral-900 p-6 flex flex-col gap-6 shadow-2xl">
          {logado ? (
            <>
              <span className="font-mono text-xs text-neutral-500 tracking-wide border-b border-neutral-800 pb-4">
                {usuario?.email}
              </span>
              <button
                onClick={() => {
                  fecharMenu();
                  handleLogout();
                }}
                className="w-full text-left font-mono text-xs text-red-400 tracking-wide py-2"
              >
                Sair da conta →
              </button>
            </>
          ) : (
            <>
              <Link to="/como-funciona" onClick={fecharMenu} className="font-mono text-sm text-white tracking-wide">
                Como funciona
              </Link>
              <Link to="/login" onClick={fecharMenu} className="font-mono text-sm text-neutral-400 hover:text-white transition-colors">
                Entrar
              </Link>
              <Link to="/cadastro" onClick={fecharMenu} className="w-full text-center font-mono text-sm bg-emerald-400 text-black px-5 py-3 rounded font-bold mt-2">
                Criar conta
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};