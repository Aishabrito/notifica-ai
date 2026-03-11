import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); // Ativa o carregamento
    
    try {
      const resposta = await fetch('https://notifica-ai.onrender.com/api/cadastrar-alerta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email })
      });

      const dados = await resposta.json();

      if (dados.sucesso) {
        alert(`Mágica! O robô leu o site: ${dados.titulo}`);
        setUrl('');
        setEmail('');
      } else {
        alert(`Erro: ${dados.mensagem}`);
      }
    } catch (erro) {
      console.error("Erro na requisição:", erro);
      alert('Erro ao conectar com o servidor. Verifique sua conexão.');
    } finally {
      setIsLoading(false); // Desativa o carregamento indepedente do resultado
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-[#f5f2eb]">
      <div className="max-w-3xl w-full text-center space-y-8">
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter">
          Notifica.<span className="text-emerald-400">ai</span>
        </h1>
        <p className="text-gray-500 text-lg md:text-xl font-light max-w-2xl mx-auto">
          Monitoramento inteligente de editais e sites para quem não quer perder a vaga. [cite: 16]
        </p>

        <form onSubmit={handleSubmit} className="bg-[#111] p-3 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 shadow-2xl">
          <input
            type="url"
            placeholder="Link do site (ex: sisu.mec.gov.br)"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-[1.5] bg-black/40 border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400/50 transition-all font-mono text-sm"
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-black/40 border border-white/5 p-4 rounded-xl outline-none focus:border-emerald-400/50 transition-all font-mono text-sm"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl hover:bg-emerald-300 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Vigiando...' : 'Criar Alerta'}
          </button>
        </form>
        
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono">
          Checagem a cada 6 horas • 100% Gratuito
        </p>
      </div>
    </div>
  );
}