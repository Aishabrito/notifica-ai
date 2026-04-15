// src/pages/ResetarSenha.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

const API = import.meta.env.VITE_API_URL ?? "";

type Etapa = "email" | "codigo";

export default function ResetarSenha() {
  const navigate = useNavigate();

  // Etapa 1 — solicitar código
  const [etapa, setEtapa]       = useState<Etapa>("email");
  const [email, setEmail]       = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [erroEmail, setErroEmail]       = useState<string | null>(null);

  // Etapa 2 — inserir código + nova senha
  const [codigo, setCodigo]           = useState("");
  const [novaSenha, setNovaSenha]     = useState("");
  const [confirmar, setConfirmar]     = useState("");
  const [loadingReset, setLoadingReset] = useState(false);
  const [erroReset, setErroReset]       = useState<string | null>(null);
  const [sucesso, setSucesso]           = useState(false);

  // ── Etapa 1: solicitar código ───────────────────────────────────────────────
  const handleSolicitarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEmail(null);
    setLoadingEmail(true);

    try {
      const res  = await fetch(`${API}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.sucesso) {
        setEtapa("codigo");
      } else {
        setErroEmail(data.mensagem ?? "Não foi possível enviar o código.");
      }
    } catch {
      setErroEmail("Erro de conexão. Tente novamente.");
    } finally {
      setLoadingEmail(false);
    }
  };

  // ── Etapa 2: redefinir senha ────────────────────────────────────────────────
  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroReset(null);

    if (novaSenha.length < 8) {
      setErroReset("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErroReset("As senhas não coincidem.");
      return;
    }

    setLoadingReset(true);
    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, codigo, novaSenha }),
      });
      const data = await res.json();

      if (data.sucesso) {
        setSucesso(true);
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setErroReset(data.mensagem ?? "Não foi possível redefinir a senha.");
      }
    } catch {
      setErroReset("Erro de conexão. Tente novamente.");
    } finally {
      setLoadingReset(false);
    }
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
              <div className="w-7 h-7 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <span className="font-mono text-[10px] text-purple-400 tracking-[0.2em] uppercase">Notifica.ai</span>
            </div>

            <h1 className="text-3xl font-black tracking-tighter text-white leading-[1.1] mb-2">
              {sucesso ? "Senha redefinida!" : "Redefinir senha"}
            </h1>
            <p className="font-mono text-[11px] text-neutral-500 tracking-[0.05em]">
              {etapa === "email"
                ? "// informe seu e-mail para receber o código"
                : "// insira o código de 6 dígitos enviado ao seu e-mail"}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border border-white/[0.07] p-7"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(108,52,131,0.03) 100%)" }}
          >

            {/* ── Sucesso ─────────────────────────────────────────────────────── */}
            {sucesso ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 rounded-full border border-emerald-400/30 bg-emerald-400/10 flex items-center justify-center mx-auto">
                  <span className="text-emerald-400 text-2xl font-black">✓</span>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">Senha alterada com sucesso!</p>
                  <p className="font-mono text-[10px] text-neutral-500">Redirecionando para o login em instantes...</p>
                </div>
                <Link
                  to="/login"
                  className="inline-block font-mono text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                >
                  ir para o login →
                </Link>
              </div>

            ) : etapa === "email" ? (

              /* ── Etapa 1: e-mail ──────────────────────────────────────────── */
              <form onSubmit={handleSolicitarCodigo} className="space-y-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    E-mail cadastrado
                  </label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>

                {erroEmail && (
                  <p className="font-mono text-[10px] text-red-400 bg-red-400/5 border border-red-400/20 px-4 py-3 rounded-lg">
                    ● {erroEmail}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loadingEmail}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl font-mono text-xs uppercase tracking-widest hover:shadow-[0_8px_30px_rgba(168,85,247,0.25)] hover:-translate-y-0.5 active:scale-[0.99] transition-all mt-2"
                >
                  {loadingEmail ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando código...
                    </span>
                  ) : "Enviar código →"}
                </button>
              </form>

            ) : (

              /* ── Etapa 2: código + nova senha ─────────────────────────────── */
              <form onSubmit={handleRedefinir} className="space-y-4">

                {/* Aviso e-mail */}
                <div className="flex items-start gap-3 bg-purple-500/5 border border-purple-500/20 px-4 py-3 rounded-lg">
                  <span className="text-purple-400 mt-0.5 text-sm">📬</span>
                  <div>
                    <p className="font-mono text-[10px] text-purple-300 leading-relaxed">
                      Código enviado para <strong className="text-white">{email}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => { setEtapa("email"); setCodigo(""); setErroReset(null); }}
                      className="font-mono text-[9px] text-neutral-600 hover:text-purple-400 transition-colors mt-1"
                    >
                      usar outro e-mail →
                    </button>
                  </div>
                </div>

                {/* Código OTP */}
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Código de 6 dígitos
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-lg font-bold text-purple-300 placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all tracking-[0.4em] text-center"
                  />
                </div>

                {/* Nova senha */}
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all ${
                      confirmar && confirmar !== novaSenha
                        ? "border-red-500/50"
                        : confirmar && confirmar === novaSenha
                        ? "border-emerald-500/50"
                        : "border-neutral-800"
                    }`}
                  />
                  {confirmar && confirmar !== novaSenha && (
                    <p className="font-mono text-[9px] text-red-400 mt-1.5">As senhas não coincidem.</p>
                  )}
                  {confirmar && confirmar === novaSenha && (
                    <p className="font-mono text-[9px] text-emerald-400 mt-1.5">✓ Senhas coincidem.</p>
                  )}
                </div>

                {erroReset && (
                  <p className="font-mono text-[10px] text-red-400 bg-red-400/5 border border-red-400/20 px-4 py-3 rounded-lg">
                    ● {erroReset}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loadingReset || codigo.length !== 6}
                  className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl font-mono text-xs uppercase tracking-widest hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:scale-[0.99] transition-all mt-2"
                >
                  {loadingReset ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Redefinindo...
                    </span>
                  ) : "Redefinir senha →"}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="text-center font-mono text-[10px] text-neutral-700 mt-5">
            Lembrou a senha?{" "}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 transition-colors">
              fazer login →
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
