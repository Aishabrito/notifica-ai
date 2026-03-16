import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";

// 🌐 Troque pela URL do Render após o deploy
const API = "http://localhost:3000"; 

interface Alerta {
  _id: string;
  url: string;
  email: string;
  titulo: string;
  status: "ativo" | "pausado";
  criadoEm: string;
}

// --- SUB-COMPONENTE: STATUS COM CORES MODERNAS ---
const StatusDot = ({ status }: { status: "ativo" | "pausado" }) => (
  <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${
    status === "ativo"
      ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
      : "text-neutral-600 border-neutral-800 bg-neutral-900"
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === "ativo" ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
    {status}
  </span>
);

// --- COMPONENTE PRINCIPAL ---
export default function Home() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [url, setUrl] = useState("");
  const [emailManual, setEmailManual] = useState("");
  const [statusMsg, setStatusMsg] = useState({ tipo: '', texto: '' });

  const carregarAlertas = async () => {
    try {
      const r = await fetch(`${API}/api/alertas`);
      const d = await r.json();
      if (d.sucesso) {
        const filtroEmail = usuario?.email || emailManual;
        setAlertas(filtroEmail ? d.alertas.filter((a: Alerta) => a.email === filtroEmail) : d.alertas);
      }
    } catch (err) {
      console.error("Erro ao carregar alertas:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAlertas();
  }, [usuario]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ tipo: 'loading', texto: 'Iniciando monitoramento...' });
    
    try {
      const r = await fetch(`${API}/api/cadastrar-alerta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email: usuario?.email || emailManual })
      });
      const d = await r.json();
      
      if (d.sucesso) {
        setStatusMsg({ tipo: 'sucesso', texto: `Sucesso: ${d.titulo}` });
        setUrl("");
        carregarAlertas();
      } else {
        throw new Error(d.mensagem);
      }
    } catch (err: any) {
      setStatusMsg({ tipo: 'erro', texto: err.message || "Erro de conexão." });
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      const r = await fetch(`${API}/api/cancelar-alerta/${id}`, { method: 'DELETE' });
      if (r.ok) setAlertas(prev => prev.filter(a => a._id !== id));
    } catch {
      alert("Erro ao remover alerta.");
    }
  };

  const ativos = alertas.filter(a => a.status === 'ativo').length;
  const LIMITE = 3;

  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased"
         style={{ background: 'radial-gradient(circle at 0% 0%, rgba(108, 52, 131, 0.08) 0%, transparent 40%), #0a0a0a' }}>
      
      <Navbar logado={!!usuario} />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24 relative z-10">
        
        {/* HEADER COM TOQUE ROXO */}
        <div className="flex items-start justify-between mb-16">
          <div>
            <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// painel operacional</p>
            <h1 className="text-5xl font-black tracking-tighter">
              {usuario ? `Olá, ${usuario.nome.split(" ")[0]}.` : "Seus alertas."}
            </h1>
            <p className="text-neutral-500 text-sm mt-2">
              Você tem <strong className="text-emerald-400">{ativos} monitoramento(s)</strong> ativos no momento.
            </p>
          </div>
        </div>

        {/* INPUT DE ALERTA COM CORES DA PALETA */}
        <div className="mb-14 p-8 rounded-2xl border border-white/[0.05]"
             style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(108, 52, 131, 0.02) 100%)' }}>
          
          <div className="flex justify-between mb-4 items-center">
            <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Configurar Novo Vigia</h2>
            <span className="font-mono text-[9px] text-neutral-600">{ativos}/{LIMITE} DISPONÍVEIS</span>
          </div>

          <form onSubmit={handleCadastrar} className="space-y-4">
            <div className="flex gap-3">
              <input 
                type="url" placeholder="URL para monitorar (ex: sisu.mec.gov.br)" value={url} 
                onChange={(e) => setUrl(e.target.value)} required
                className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-4 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
              />
              <button type="submit" className="bg-emerald-400 text-black font-bold text-xs px-8 py-4 rounded-lg hover:bg-emerald-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all">
                {statusMsg.tipo === 'loading' ? 'LENDO...' : 'ATIVAR →'}
              </button>
            </div>
            {!usuario && (
              <input 
                type="email" placeholder="Seu e-mail principal" value={emailManual}
                onChange={(e) => setEmailManual(e.target.value)} required
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-4 font-mono text-xs text-white outline-none focus:border-purple-500/50 transition-all"
              />
            )}
            {statusMsg.texto && (
              <p className={`font-mono text-[10px] ${statusMsg.tipo === 'sucesso' ? 'text-emerald-400' : 'text-purple-400'}`}>
                {statusMsg.tipo === 'sucesso' ? '✓' : '●'} {statusMsg.texto}
              </p>
            )}
          </form>
        </div>

        {/* LISTAGEM DOS ALERTAS DO MONGODB */}
        <div className="space-y-6">
          <h2 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Linha do Tempo de Alertas</h2>
          
          {carregando ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 bg-neutral-900/50 rounded-xl" />
              <div className="h-28 bg-neutral-900/50 rounded-xl" />
            </div>
          ) : alertas.length === 0 ? (
            <div className="border border-dashed border-neutral-800 p-16 rounded-2xl text-center">
              <p className="font-mono text-[10px] text-neutral-700 uppercase tracking-[0.2em]">Nenhum dado encontrado no banco</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {alertas.map(alerta => (
                <div key={alerta._id} className="group bg-neutral-900/30 border border-white/[0.05] p-6 rounded-xl hover:border-purple-500/30 transition-all duration-500">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <StatusDot status={alerta.status} />
                        <span className="font-mono text-[9px] text-neutral-600">ID: {alerta._id.slice(-6)}</span>
                      </div>
                      <h3 className="font-bold text-lg tracking-tight group-hover:text-emerald-400 transition-colors">{alerta.titulo}</h3>
                      <p className="font-mono text-[11px] text-neutral-500 truncate max-w-md">{alerta.url}</p>
                    </div>
                    <button 
                      onClick={() => handleCancelar(alerta._id)}
                      className="text-neutral-700 hover:text-red-400 font-mono text-[9px] uppercase tracking-widest transition-colors p-2"
                    >
                      [ remover ]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}