import { Link } from "react-router-dom";
import { Navbar }   from "../components/navbar";
import { Footer }   from "../components/footer";
import { AuthCard } from "../components/auth-card";
import { Input }    from "../components/input";

export default function Login() {
  return (
    <>
      <Navbar />
      <AuthCard
        title="Bem-vinda de volta"
        subtitle="Acesse seus alertas ativos."
        footer={
          <>
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="text-emerald-400 font-medium hover:underline">
              Criar agora
            </Link>
          </>
        }
      >
        <form className="space-y-5">
          <Input type="email"    label="E-mail" placeholder="seu@email.com" />
          <Input type="password" label="Senha"  placeholder="••••••••" />
          <button className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all mt-4 text-sm uppercase tracking-wider">
            Entrar →
          </button>
        </form>
      </AuthCard>
      <Footer />
    </>
  );
}