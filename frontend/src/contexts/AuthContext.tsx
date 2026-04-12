// src/contexts/AuthContext.tsx
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
  login: (email: string, senha: string) => Promise<{ erro: string | null; role: "user" | "admin" }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Verifica sessão ativa ao carregar o app
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.sucesso) {
          setUsuario({ ...d.usuario, role: d.usuario.role ?? 'user' });
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const cadastrar = async (nome: string, email: string, senha: string): Promise<string | null> => {
    const r = await fetch(`${API}/api/auth/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nome, email, senha }),
    });
    const d = await r.json();
    if (d.sucesso) { setUsuario(d.usuario); return null; }
    return d.mensagem;
  };

  // ─── login agora retorna { erro, role } em vez de só a string de erro ────────
  // Isso resolve o problema de closure do React: ao invés de ler `usuario` do
  // estado (que ainda não re-renderizou), lemos o role direto da resposta da API.
  const login = async (
    email: string,
    senha: string
  ): Promise<{ erro: string | null; role: "user" | "admin" }> => {
    const r = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, senha }),
    });
    const d = await r.json();

    if (d.sucesso) {
      setUsuario(d.usuario);
      return { erro: null, role: d.usuario.role ?? "user" };
    }

    return { erro: d.mensagem, role: "user" };
  };

  const logout = async (): Promise<void> => {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, carregando, cadastrar, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
};