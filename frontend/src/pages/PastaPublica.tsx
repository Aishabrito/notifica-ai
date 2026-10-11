import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

interface PastaPublicaDados { nome: string; descricao: string; autor: string | null; copias: number; itens: { titulo: string; url: string }[] }

export const CHAVE_PASTA_PENDENTE = "notifica:pasta-pendente";

// Página pública de uma pasta compartilhada: vê a lista e monitora tudo com 1 clique
export default function PastaPublica() {
  const { token } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [pasta, setPasta] = useState<PastaPublicaDados | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/api/pastas/publica/${token}`)
      .then(({ data }) => setPasta(data.pasta))
      .catch((e) => setErro(e.response?.data?.mensagem ?? "Pasta não encontrada."));
  }, [token]);

  const copiar = async () => {
    if (!usuario) {
      // Depois do cadastro/login, o painel termina a cópia sozinho
      try { localStorage.setItem(CHAVE_PASTA_PENDENTE, String(token)); } catch { /* segue sem */ }
      navigate("/cadastro");
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post(`/api/pastas/publica/${token}/copiar`);
      setMsg(data.mensagem);
    } catch (e: any) {
      setMsg(e.response?.data?.mensagem ?? "Não foi possível copiar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-(--fundo) text-(--texto) min-h-screen font-sans antialiased"
      style={{ background: "radial-gradient(circle at 0% 0%, rgba(108,52,131,0.08) 0%, transparent 40%), var(--fundo)" }}>
      <Navbar logado={!!usuario} />
      <main className="max-w-2xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16">
        {erro ? (
          <div className="text-center">
            <h1 className="text-3xl font-black mb-3">Pasta indisponível</h1>
            <p className="text-neutral-500 mb-6">{erro}</p>
            <Link to="/" className="font-mono text-xs text-emerald-400">Conhecer o Notifica.ai →</Link>
          </div>
        ) : !pasta ? (
          <p className="font-mono text-xs text-neutral-500">Carregando…</p>
        ) : (
          <>
            <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// pasta compartilhada{pasta.autor && ` por ${pasta.autor}`}</p>
            <h1 className="text-4xl font-black tracking-tighter mb-3">📁 {pasta.nome}</h1>
            {pasta.descricao && <p className="text-neutral-400 mb-2">{pasta.descricao}</p>}
            <p className="font-mono text-[11px] text-neutral-600 mb-8">{pasta.itens.length} página(s){pasta.copias > 0 && ` · ${pasta.copias} pessoa(s) já monitoram`}</p>

            <ul className="space-y-2 mb-8">
              {pasta.itens.map((i) => (
                <li key={i.url} className="border border-white/5 bg-neutral-900/30 rounded-xl p-4">
                  <p className="font-bold text-sm">{i.titulo}</p>
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-neutral-500 hover:text-white break-all">{i.url}</a>
                </li>
              ))}
            </ul>

            <div className="border border-emerald-400/30 bg-emerald-400/5 rounded-2xl p-6">
              <p className="text-sm text-neutral-300 mb-4">Receba um aviso quando qualquer uma dessas páginas mudar — edital, gabarito, resultado, convocação.</p>
              <button onClick={copiar} disabled={enviando} className="font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg disabled:opacity-50">
                {usuario ? (enviando ? "Adicionando…" : "Monitorar todas →") : "Criar conta grátis e monitorar →"}
              </button>
              {!usuario && <p className="text-xs text-neutral-500 mt-3">Já tem conta? <Link to="/login" onClick={() => { try { localStorage.setItem(CHAVE_PASTA_PENDENTE, String(token)); } catch { /* */ } }} className="underline">Entrar</Link></p>}
              {msg && <p className="text-sm text-emerald-400 mt-4">{msg} · <Link to="/dashboard" className="underline">ver no painel</Link></p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
