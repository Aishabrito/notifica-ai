import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = "https://notifica-ai.onrender.com";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  plano: "gratuito" | "premium";
  role: "user" | "admin";
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  cadastrar: (nome: string, email: string, senha: string) => Promise<string | null>;
  login: (email: string, senha: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true); // true até checar sessão

  // Verifica se já tem sessão ativa ao carregar o app
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.sucesso) setUsuario(d.usuario); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const cadastrar = async (nome: string, email: string, senha: string) => {
    const r = await fetch(`${API}/api/auth/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nome, email, senha }),
    });
    const d = await r.json();
    if (d.sucesso) { setUsuario(d.usuario); return null; }
    return d.mensagem; // retorna mensagem de erro
  };

  const login = async (email: string, senha: string) => {
    const r = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, senha }),
    });
    const d = await r.json();
    if (d.sucesso) { setUsuario(d.usuario); return null; }
    return d.mensagem;
  };

  const logout = async () => {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, carregando, cadastrar, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar em qualquer componente
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
};