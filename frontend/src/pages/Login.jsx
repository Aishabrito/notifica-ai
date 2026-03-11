import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-[#f5f2eb]">
      <div className="max-w-md w-full bg-[#111] border border-white/10 p-10 rounded-4xl shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Bem-vinda de volta</h2>
          <p className="text-gray-500 text-sm mt-2">Acesse seus alertas ativos.</p>
        </div>
        
        <form className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">E-mail</label>
            <input type="email" placeholder="seu@email.com" className="w-full bg-black border border-white/5 p-4 rounded-xl mt-1 outline-none focus:border-emerald-400 transition-all font-mono text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Senha</label>
            <input type="password" placeholder="••••••••" className="w-full bg-black border border-white/5 p-4 rounded-xl mt-1 outline-none focus:border-emerald-400 transition-all font-mono text-sm" />
          </div>
          <button className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all mt-4 text-sm uppercase tracking-wider">
            Entrar →
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          Ainda não tem conta? <Link to="/cadastro" className="text-emerald-400 font-medium hover:underline">Criar agora</Link>
        </div>
      </div>
    </div>
  );
}