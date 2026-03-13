import { Link } from "react-router-dom";
import { Navbar }   from "../components/navbar";
import { Footer }   from "../components/footer";
import { AuthCard } from "../components/auth-card";
import { Input }    from "../components/input";

export default function Cadastro() {
  return (
    <>
      <Navbar />
      <AuthCard
        title="Crie sua conta"
        subtitle="Comece a monitorar em 20 segundos."
        footer={
          <>
            Já é cadastrada?{" "}
            <Link to="/login" className="text-white font-medium hover:underline">
              Fazer login
            </Link>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Nome" />
            <Input placeholder="Sobrenome" />
          </div>
          <Input type="email"    placeholder="Seu melhor e-mail" />
          <Input type="password" placeholder="Senha (min. 8 caracteres)" />
          <button className="w-full bg-emerald-400 text-black font-bold py-4 rounded-xl hover:bg-emerald-300 transition-all mt-4 text-sm uppercase tracking-wider">
            Criar conta gratuita
          </button>
        </form>
      </AuthCard>
      <Footer />
    </>
  );
}