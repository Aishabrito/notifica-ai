import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar }   from "../components/navbar";
import { Footer }   from "../components/footer";
import { AuthCard } from "../components/auth-card";
import { Input }    from "../components/input";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [erro, setErro]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const mensagemErro = await login(email, senha);
    setLoading(false);
    if (mensagemErro) return setErro(mensagemErro);
    navigate("/dashboard");
  };

  return (
    <>
      <Navbar />
      <div
        // 🛠️ Adicionado: flex, items-center, justify-center, px-6 e py-24 para responsividade
        className="min-h-screen flex items-center justify-center px-6 py-24 bg-[#0a0a0a] selection:bg-purple-500 selection:text-white"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,52,131,0.1) 0%, transparent 70%), #0a0a0a' }}
      >
        <AuthCard
          title="Bem-vinda de volta"
          subtitle="Acesse seus alertas ativos."
          footer={
            <>
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="text-purple-400 font-medium hover:underline">
                Criar agora
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm sm:max-w-md mx-auto">
            <Input
              type="email"
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Senha"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />

            {erro && (
              <p className="font-mono text-[10px] md:text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-lg">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-purple-100 hover:shadow-[0_8px_30px_rgba(108,52,131,0.2)] transition-all mt-4 text-xs md:text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : "Entrar →"}
            </button>
          </form>
        </AuthCard>
      </div>
      <Footer />
    </>
  );
}