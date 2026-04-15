
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../services/Api";

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

function extrairMensagemErro(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { mensagem?: string } } };
    return axiosErr.response?.data?.mensagem ?? fallback;
  }
  return fallback;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

 // Verifica sessão ativa ao carregar o app
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // Se o Render demorar mais de 8s, ele desiste e vai pro login

    api.get("/api/auth/me", { signal: controller.signal })
      .then(({ data: d }) => {
        if (d.sucesso) {
          setUsuario({ ...d.usuario, role: d.usuario.role ?? 'user' });
        }
      })
      .catch((err) => {
        console.log("Não autenticado ou erro de timeout", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        setCarregando(false);
      });

    return () => { 
      clearTimeout(timeout); 
      controller.abort(); 
    };
  }, []);
  const cadastrar = async (nome: string, email: string, senha: string): Promise<string | null> => {
    try {
      const { data: d } = await api.post("/api/auth/cadastro", { nome, email, senha });
      if (d.sucesso) { setUsuario(d.usuario); return null; }
      return d.mensagem;
    } catch (err: unknown) {
      return extrairMensagemErro(err, "Erro ao cadastrar.");
    }
  };

  // ─── login agora retorna { erro, role } em vez de só a string de erro ────────
  // Isso resolve o problema de closure do React: ao invés de ler `usuario` do
  // estado (que ainda não re-renderizou), lemos o role direto da resposta da API.
  const login = async (
    email: string,
    senha: string
  ): Promise<{ erro: string | null; role: "user" | "admin" }> => {
    try {
      const { data: d } = await api.post("/api/auth/login", { email, senha });
      if (d.sucesso) {
        setUsuario(d.usuario);
        return { erro: null, role: d.usuario.role ?? "user" };
      }
      return { erro: d.mensagem, role: "user" };
    } catch (err: unknown) {
      return { erro: extrairMensagemErro(err, "Erro ao entrar."), role: "user" };
    }
  };

  const logout = async (): Promise<void> => {
    await api.post("/api/auth/logout").catch(() => {});
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