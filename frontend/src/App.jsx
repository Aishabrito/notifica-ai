import { useState } from 'react';

export default function App() {
  // Estados para guardar o que o usuário digita no formulário
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');

  // NOVA FUNÇÃO: Agora ela é "async" porque precisa esperar o back-end responder
  const handleSubmit = async (e) => {
    e.preventDefault(); 
    
    try {
      // Conectando o React com o nosso Back-end Node.js!
      const resposta = await fetch('http://localhost:3000/api/cadastrar-alerta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email }) // Enviando os dados
      });

      const dados = await resposta.json();

      if (dados.sucesso) {
        // Se deu certo, mostra o título do site que o robô encontrou!
        alert(`Mágica! O robô leu o site: ${dados.titulo}`);
        setUrl('');
        setEmail('');
      } else {
        alert(`Erro: ${dados.mensagem}`);
      }

   } catch (erro) {
      console.error("Detalhes do erro para o desenvolvedor:", erro); // Agora estamos usando a variável!
      alert('Erro ao conectar com o servidor. O Back-end está rodando?');
    }
  };

  return (
    // Fundo escuro (slate-900) dá aquela cara "Tech" e de credibilidade
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Container principal */}
      <div className="max-w-3xl w-full text-center space-y-8">
        
        {/* Título e Slogan */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
            Notifica.<span className="text-emerald-400">ai</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            Monitoramento inteligente para quem não quer perder oportunidades. 
            Você diz o site, nós te avisamos quando ele atualizar.
          </p>
        </div>

        {/* O Formulário */}
        <form 
          onSubmit={handleSubmit} 
          className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col md:flex-row gap-4"
        >
          <input
            type="url"
            placeholder="Link do site (ex: https://g1.globo.com)"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-lg border border-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
          />
          
          <input
            type="email"
            placeholder="Seu melhor e-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-lg border border-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors"
          />
          
          <button
            type="submit"
            className="bg-emerald-400 text-slate-900 font-bold px-8 py-3 rounded-lg hover:bg-emerald-500 transition-colors duration-200 cursor-pointer"
          >
            Criar Alerta
          </button>
        </form>

        {/* Mini prova social / nicho */}
        <p className="text-sm font-medium text-slate-500">
          🔥 Perfeito para vestibulares, concursos e listas de espera.
        </p>

      </div>
    </div>
  );
}