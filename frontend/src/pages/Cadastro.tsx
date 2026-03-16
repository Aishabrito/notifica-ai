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

  // Lógica de força da senha
  const forcaSenha = (() => {
    if (senha.length === 0) return null;
    if (senha.length < 6) return "fraca";
    if (senha.length < 10 || !/[0-9]/.test(senha)) return "média";
    return "forte";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    // Validações de UI
    if (senha.length < 8) return setErro("Senha deve ter no mínimo 8 caracteres.");
    if (senha !== confirmarSenha) return setErro("As senhas não coincidem.");
    if (!aceito) return setErro("Você precisa aceitar os termos para continuar.");

    setLoading(true);

    try {
      // 🚀 Enviando para o AuthContext (Back-end)
      const mensagemErro = await cadastrar(nome, email, senha);

      if (mensagemErro) {
        setErro(mensagemErro);
      } else {
        // 🎉 SUCESSO! REDIRECIONA DIRETO PARA O LOGIN:
        navigate("/login"); 
      }
    } catch (err) {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500 selection:text-white flex items-center justify-center px-4 py-24"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,52,131,0.12) 0%, transparent 70%), #0a0a0a' }}
      >
        <div className="w-full max-w-lg relative">
          
          {/* Brilho decorativo Roxo no fundo */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl -z-10" />

          {/* HEADER */}
          <div className="text-center mb-8">
            <Link to="/" className="font-display font-extrabold text-2xl tracking-tighter text-white">
              Notifica<span className="text-emerald-400">.ai</span>
            </Link>
            <h1 className="text-3xl font-black tracking-tighter mt-4 mb-1 text-white">Crie sua conta.</h1>
            <p className="text-neutral-500 text-sm font-light">Comece a monitorar em 20 segundos. É grátis.</p>
          </div>

          {/* CARD OPERACIONAL */}
          <div
            className="rounded-2xl border border-white/[0.05] p-8 text-[#f5f2eb] shadow-2xl"
            style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(108,52,131,0.02) 100%)' }}
          >
            <form onSubmit={handleSubmit} className="space-y-4">

              <Input
                label="Nome completo"
                placeholder=""
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Input
                    type="password"
                    label="Senha"
                    placeholder="Mín. 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  {/* Força da senha com paleta atualizada */}
                  {forcaSenha && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {["fraca", "média", "forte"].map((nivel) => (
                          <div key={nivel} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                            forcaSenha === "fraca"  && nivel === "fraca"  ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]" :
                            forcaSenha === "média"  && (nivel === "fraca" || nivel === "média") ? "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]" :
                            forcaSenha === "forte"  ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                            "bg-neutral-800"
                          }`} />
                        ))}
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-tighter text-neutral-500">{forcaSenha}</span>
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

              {/* Checkbox de Termos Estilizado */}
              <label className="flex items-start gap-3 cursor-pointer group py-2">
                <div
                  onClick={() => setAceito(!aceito)}
                  className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all duration-300 ${
                    aceito
                      ? "bg-emerald-400 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      : "border-neutral-700 group-hover:border-purple-500/60"
                  }`}
                >
                  {aceito && <span className="text-black text-[10px] font-bold">✓</span>}
                </div>
                <span className="text-[11px] text-neutral-500 leading-relaxed font-light">
                  Concordo com os{" "}
                  <span className="text-purple-400 hover:text-purple-300 transition-colors">Termos de Uso</span>{" "}
                  e{" "}
                  <span className="text-purple-400 hover:text-purple-300 transition-colors">Política de Privacidade</span>.
                </span>
              </label>

              {/* Mensagem de Erro Dinâmica */}
              {erro && (
                <div className="font-mono text-[10px] text-purple-400 bg-purple-400/5 border border-purple-400/20 px-4 py-3 rounded-lg animate-shake">
                  ● {erro}
                </div>
              )}

              {/* Botão de Ação Principal */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-400 text-black font-bold py-4 rounded-lg hover:bg-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : "Criar conta gratuita →"}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-neutral-600 mt-8 font-light">
            Já possui uma credencial?{" "}
            <Link to="/login" className="text-purple-400 font-medium hover:text-purple-300 transition-colors border-b border-purple-500/20 pb-0.5">
              Acessar conta
            </Link>
          </p>

        </div>
      </div>
      <Footer />
    </>
  );
}