import { Link } from 'react-router-dom';

export default function Cadastro() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-[#f5f2eb]">
      <div className="max-w-md w-full bg-[#111] border border-white/10 p-10 rounded-4xl shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Crie sua conta</h2>
          <p className="text-gray-500 text-sm mt-2">Comece a monitorar em 20 segundos.</p>
        </div>
        
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Nome" className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 font-mono text-sm" />
            <input type="text" placeholder="Sobrenome" className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 font-mono text-sm" />
          </div>
          <input type="email" placeholder="Seu melhor e-mail" className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 font-mono text-sm" />
          <input type="password" placeholder="Senha (min. 8 caracteres)" className="w-full bg-black border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400 font-mono text-sm" />
          
          <button className="w-full bg-emerald-400 text-black font-bold py-4 rounded-xl hover:bg-emerald-300 transition-all mt-4 text-sm uppercase tracking-wider">
            Criar conta gratuita
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          Já é cadastrada? <Link to="/login" className="text-white font-medium hover:underline">Fazer login</Link>
        </div>
      </div>
    </div>
  );
}