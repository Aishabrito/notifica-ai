import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar }   from "../components/navbar";
import { Footer }   from "../components/footer";
import { Input }    from "../components/input";

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
    if (senha.length < 8)         return setErro("Senha deve ter no mínimo 8 caracteres.");
    if (senha !== confirmarSenha)  return setErro("As senhas não coincidem.");
    if (!aceito)                   return setErro("Você precisa aceitar os termos para continuar.");
    setLoading(true);
    const mensagemErro = await cadastrar(nome, email, senha);
    setLoading(false);
    if (mensagemErro) return setErro(mensagemErro);
    navigate("/dashboard");
  };

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500 selection:text-white flex items-center justify-center px-4 py-24"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,52,131,0.1) 0%, transparent 70%), #0a0a0a' }}
      >
        <div className="w-full max-w-lg">

          {/* HEADER */}
          <div className="text-center mb-8">
            <Link to="/" className="font-display font-extrabold text-2xl tracking-tighter text-white">
              Notifica<span className="text-emerald-400">.ai</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight mt-4 mb-1">Crie sua conta</h1>
            <p className="text-neutral-500 text-sm">Comece a monitorar em 20 segundos. É grátis.</p>
          </div>

          {/* CARD */}
          <div
            className="rounded-2xl border border-purple-500/10 p-8 text-[#f5f2eb]"
            style={{ background: 'linear-gradient(145deg, rgba(108,52,131,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">

              <Input
                label="Nome completo"
                placeholder="Aisha Brito"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />

              <Input
                type="email"
                label="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                type="tel"
                label="Telefone (opcional)"
                placeholder="(21) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    type="password"
                    label="Senha"
                    placeholder="Mín. 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  {/* Força da senha */}
                  {forcaSenha && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {["fraca", "média", "forte"].map((nivel) => (
                          <div key={nivel} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            forcaSenha === "fraca"  && nivel === "fraca"  ? "bg-red-400" :
                            forcaSenha === "média"  && (nivel === "fraca" || nivel === "média") ? "bg-yellow-400" :
                            forcaSenha === "forte"  ? "bg-emerald-400" :
                            "bg-neutral-800"
                          }`} />
                        ))}
                      </div>
                      <span className={`font-mono text-[10px] ${
                        forcaSenha === "fraca" ? "text-red-400" :
                        forcaSenha === "média" ? "text-yellow-400" :
                        "text-emerald-400"
                      }`}>{forcaSenha}</span>
                    </div>
                  )}
                </div>

                <Input
                  type="password"
                  label="Confirmar senha"
                  placeholder="Repita a senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                />
              </div>

              {/* Termos */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setAceito(!aceito)}
                  className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
                    aceito
                      ? "bg-emerald-400 border-emerald-400"
                      : "border-neutral-700 group-hover:border-purple-500/60"
                  }`}
                >
                  {aceito && <span className="text-black text-[10px] font-bold">✓</span>}
                </div>
                <span className="text-xs text-neutral-500 leading-relaxed">
                  Concordo com os{" "}
                  <span className="text-purple-400 hover:underline cursor-pointer">Termos de Uso</span>{" "}
                  e{" "}
                  <span className="text-purple-400 hover:underline cursor-pointer">Política de Privacidade</span>.
                  Seus dados nunca são compartilhados com terceiros.
                </span>
              </label>

              {erro && (
                <p className="font-mono text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-lg">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-400 text-black font-bold py-4 rounded-xl hover:bg-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Criando conta...
                  </span>
                ) : "Criar conta gratuita →"}
              </button>
            </form>

          </div>

          <p className="text-center text-sm text-neutral-600 mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-purple-400 font-medium hover:underline">
              Fazer login
            </Link>
          </p>

        </div>
      </div>
      <Footer />
    </>
  );
}