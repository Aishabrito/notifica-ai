// src/pages/Login.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [erro, setErro]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    const { erro: mensagemErro, role } = await login(email, senha);
    setLoading(false);

    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    navigate(role === "admin" ? "/admin" : "/dashboard");
  };

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen flex items-center justify-center px-4 py-24 selection:bg-purple-500 selection:text-white"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a" }}
      >
        <div className="w-full max-w-md relative">

          {/* Brilho decorativo */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl -z-10" />

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 tracking-[0.2em] uppercase">Notifica.ai</span>
            </div>

            <h1 className="text-3xl font-black tracking-tighter text-white leading-[1.1] mb-2">
              Bem-vinda<br />de volta.
            </h1>
            <p className="font-mono text-[11px] text-neutral-600 tracking-[0.05em]">
              // acesse seus alertas ativos
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border border-white/[0.07] p-7"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(108,52,131,0.03) 100%)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              {/* Senha */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">
                    Senha
                  </label>
                  <span className="font-mono text-[9px] text-purple-400/60 hover:text-purple-400 cursor-pointer transition-colors">
                    esqueci →
                  </span>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              {/* Erro */}
              {erro && (
                <p className="font-mono text-[10px] text-red-400 bg-red-400/5 border border-red-400/20 px-4 py-3 rounded-lg">
                  ● {erro}
                </p>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl font-mono text-xs uppercase tracking-widest hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:scale-[0.99] transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : "Entrar →"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center font-mono text-[10px] text-neutral-700 mt-5">
            Não tem conta?{" "}
            <Link to="/cadastro" className="text-purple-400 hover:text-purple-300 transition-colors">
              criar agora →
            </Link>
          </p>

          {/* Indicador de status */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[9px] text-neutral-800 uppercase tracking-widest">
              sistema operacional
            </span>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}