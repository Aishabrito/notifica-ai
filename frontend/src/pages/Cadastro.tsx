import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome]               = useState("");
  const [email, setEmail]             = useState("");
  const [telefone, setTelefone]       = useState("");
  const [senha, setSenha]             = useState("");
  const [confirmarSenha, setConfirmar] = useState("");
  const [aceito, setAceito]           = useState(false);
  const [erro, setErro]               = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  const forcaSenha = (() => {
    if (senha.length === 0) return null;
    if (senha.length < 6) return "fraca";
    if (senha.length < 10 || !/[0-9]/.test(senha)) return "média";
    return "forte";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) return setErro("Senha deve ter no mínimo 8 caracteres.");
    if (senha !== confirmarSenha) return setErro("As senhas não coincidem.");
    if (!aceito) return setErro("Você precisa aceitar os termos para continuar.");

    setLoading(true);
    try {
      const mensagemErro = await cadastrar(nome, email, senha);
      if (mensagemErro) {
        setErro(mensagemErro);
      } else {
        navigate("/login");
      }
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all";

  const labelClass =
    "block font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600 mb-2";

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen flex items-center justify-center px-4 py-24 selection:bg-purple-500 selection:text-white"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a" }}
      >
        <div className="w-full max-w-lg relative">

          {/* Brilho decorativo */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl -z-10" />

          {/* Header — mesmo padrão do Login */}
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
              Crie sua<br />conta.
            </h1>
            <p className="font-mono text-[11px] text-neutral-600 tracking-[0.05em]">
              // comece a monitorar em 20 segundos. é grátis.
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border border-white/[0.07] p-7"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(108,52,131,0.03) 100%)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Nome */}
              <div>
                <label className={labelClass}>Nome completo</label>
                <input
                  type="text"
                  placeholder="Ex: Maria Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              {/* Telefone */}
              <div>
                <label className={labelClass}>Telefone <span className="text-neutral-800">(opcional)</span></label>
                <input
                  type="tel"
                  placeholder="(DDD) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Senha + Confirmar — grid 2 colunas em md */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Senha</label>
                  <input
                    type="password"
                    placeholder="Mín. 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className={inputClass}
                  />
                  {/* Força da senha */}
                  {forcaSenha && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {["fraca", "média", "forte"].map((nivel) => (
                          <div
                            key={nivel}
                            className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                              forcaSenha === "fraca" && nivel === "fraca"
                                ? "bg-red-400"
                                : forcaSenha === "média" && (nivel === "fraca" || nivel === "média")
                                ? "bg-yellow-400"
                                : forcaSenha === "forte"
                                ? "bg-emerald-400"
                                : "bg-neutral-800"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
                        {forcaSenha}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Confirmar senha</label>
                  <input
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Checkbox Termos */}
              <label className="flex items-start gap-3 cursor-pointer group py-1">
                <div
                  onClick={() => setAceito(!aceito)}
                  className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all duration-300 ${
                    aceito
                      ? "bg-emerald-400 border-emerald-400"
                      : "border-neutral-700 group-hover:border-purple-500/60"
                  }`}
                >
                  {aceito && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                </div>
                <span className="font-mono text-[10px] text-neutral-600 leading-relaxed">
                  Concordo com os{" "}
                  <Link to="/termos" className="text-purple-400 hover:text-purple-300 transition-colors">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link to="/privacidade" className="text-purple-400 hover:text-purple-300 transition-colors">
                    Política de Privacidade
                  </Link>.
                </span>
              </label>

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
                    Processando...
                  </span>
                ) : "Criar conta gratuita →"}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <p className="text-center font-mono text-[10px] text-neutral-700 mt-5">
            Já tem conta?{" "}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 transition-colors">
              acessar conta →
            </Link>
          </p>

          <p className="text-center font-mono text-[9px] text-neutral-800 mt-3">
            <Link to="/termos" className="text-purple-400/50 hover:text-purple-300 transition-colors">
              Termos de Uso
            </Link>
            {" · "}
            <Link to="/privacidade" className="text-purple-400/50 hover:text-purple-300 transition-colors">
              Política de Privacidade
            </Link>
          </p>

          {/* Status indicator */}
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