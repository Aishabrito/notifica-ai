import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/Api";
import AtivarNotificacoes from "./AtivarNotificacoes";
import { lerUrlPendente, limparUrlPendente } from "../utils/urlPendente";

export type Perfil = "vestibulando" | "lista-espera" | "concurseiro" | "aprovado";
type Modelo = { id: string; categoria: string; nome: string; descricao: string; url: string };

const PERFIS: { id: Perfil; emoji: string; titulo: string; texto: string }[] = [
  { id: "vestibulando", emoji: "🎓", titulo: "Vestibulando", texto: "ENEM, SISU, ProUni, Fies e vestibulares" },
  { id: "lista-espera", emoji: "⏳", titulo: "Estou em lista de espera", texto: "Quero saber na hora quando me chamarem" },
  { id: "concurseiro", emoji: "📚", titulo: "Concurseiro(a)", texto: "Editais, retificações, gabaritos e resultados" },
  { id: "aprovado", emoji: "🏛️", titulo: "Fui aprovado(a)", texto: "Aguardando nomeação no Diário Oficial" },
];

// Categorias de modelo prontos sugeridas para cada perfil
const CATEGORIAS: Record<Perfil, string[]> = {
  vestibulando: ["vestibular", "bolsas"],
  "lista-espera": ["bolsas", "vestibular"],
  concurseiro: ["bancas", "orgaos"],
  aprovado: ["orgaos", "bancas"],
};

type Props = { ehPro: boolean; email: string; onConcluir: () => void };

// 👋 Boas-vindas no 1º acesso: escolhe o perfil e já sai com tudo configurado
export default function BoasVindas({ ehPro, email, onConcluir }: Props) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [sugerido] = useState<string | null>(() => { try { return localStorage.getItem("notifica:perfil-sugerido"); } catch { return null; } });
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  // Página testada na página inicial ("Teste agora") antes do cadastro
  const [pendente] = useState(lerUrlPendente);
  const [url, setUrl] = useState(pendente ?? "");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | ""; texto: string }>({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api.get("/api/modelos").then(({ data }) => setModelos(data.modelos ?? [])).catch(() => {}); }, []);

  const concluir = async () => {
    await api.patch("/api/conta/preferencias", { boasVindasConcluida: true }).catch(() => {});
    onConcluir();
  };

  const escolher = async (p: Perfil) => {
    setPerfil(p);
    setPasso(2);
    await api.patch("/api/conta/preferencias", { perfil: p }).catch(() => {});
  };

  // Cria o alerta (e, na lista de espera, já liga a posição)
  const monitorar = async (alvo: string, comPosicao = false) => {
    setEnviando(true); setMsg({ tipo: "", texto: "" });
    try {
      const { data } = await api.post("/api/cadastrar-alerta", { url: alvo, email });
      if (comPosicao && nome.trim().length >= 4) {
        await api.patch(`/api/alertas/${data.alerta._id}/posicao`, { identificador: nome.trim() }).catch(() => {});
      }
      if (alvo === pendente) limparUrlPendente();
      setMsg({ tipo: "ok", texto: `Pronto! Monitorando: ${data.titulo}` });
      setPasso(3);
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e.response?.data?.mensagem ?? "Não foi possível monitorar esta página." });
    } finally {
      setEnviando(false);
    }
  };

  const sugeridos = perfil ? modelos.filter((m) => CATEGORIAS[perfil].includes(m.categoria)).sort((a, b) => CATEGORIAS[perfil].indexOf(a.categoria) - CATEGORIAS[perfil].indexOf(b.categoria)).slice(0, 6) : [];
  const campo = "w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400/60";

  const listaModelos = (
    <div className="grid sm:grid-cols-2 gap-2">
      {sugeridos.map((m) => (
        <button key={m.id} disabled={enviando} onClick={() => monitorar(m.url)}
          className="text-left rounded-xl border border-neutral-800 hover:border-emerald-400/50 p-3 transition-colors disabled:opacity-50">
          <p className="text-sm font-bold">{m.nome}</p>
          <p className="text-[11px] text-neutral-500">{m.descricao}</p>
        </button>
      ))}
    </div>
  );

  return (
    <section className="mb-10 rounded-2xl border border-emerald-400/25 p-6 md:p-8" style={{ background: "linear-gradient(145deg, rgba(16,185,129,0.06) 0%, rgba(108,52,131,0.05) 100%)" }}>
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest">Boas-vindas · passo {passo} de 3</p>
        <button onClick={concluir} className="font-mono text-[10px] text-neutral-500 hover:text-white">pular</button>
      </div>

      {passo === 1 && (
        <>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1">O que você quer acompanhar?</h2>
          <p className="text-sm text-neutral-400 mb-6">A gente já deixa tudo configurado para você.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PERFIS.map((p) => (
              <button key={p.id} onClick={() => escolher(p.id)} className={`text-left rounded-xl border hover:border-emerald-400/60 bg-neutral-900/30 p-4 transition-colors ${sugerido === p.id ? "border-emerald-400/60 ring-1 ring-emerald-400/30" : "border-neutral-800"}`}>
                <p className="text-lg font-bold flex justify-between gap-2"><span><span aria-hidden>{p.emoji}</span> {p.titulo}</span>{sugerido === p.id && <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 self-center">sugerido</span>}</p>
                <p className="text-xs text-neutral-500">{p.texto}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {passo === 2 && pendente && perfil !== "lista-espera" && (
        <div className="mb-6 rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4">
          <p className="text-sm font-bold mb-1">📌 A página que você testou</p>
          <p className="font-mono text-[11px] text-neutral-400 break-all mb-3">{pendente}</p>
          <button disabled={enviando} onClick={() => monitorar(pendente)} className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
            {enviando ? "Lendo a página…" : "Monitorar esta página →"}
          </button>
        </div>
      )}

      {passo === 2 && perfil === "lista-espera" && (
        <>
          <h2 className="text-2xl font-black tracking-tight mb-1">Onde sai a sua lista?</h2>
          <p className="text-sm text-neutral-400 mb-5">Cole o link da página onde a universidade ou o órgão publica as chamadas. Avisamos quando ela mudar — e quando você subir.</p>
          <form onSubmit={(e) => { e.preventDefault(); monitorar(url, true); }} className="space-y-3">
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (página das chamadas da lista de espera)" className={campo} />
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome como aparece na lista (opcional)" className={campo} />
            <button disabled={enviando} className="font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg disabled:opacity-50">{enviando ? "Lendo a página…" : "Acompanhar minha lista →"}</button>
          </form>
          {sugeridos.length > 0 && (
            <>
              <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mt-6 mb-2">Ou comece por uma destas</p>
              {listaModelos}
            </>
          )}
        </>
      )}

      {passo === 2 && perfil && perfil !== "lista-espera" && (
        <>
          <h2 className="text-2xl font-black tracking-tight mb-1">
            {perfil === "vestibulando" ? "Qual página você quer acompanhar primeiro?" : perfil === "concurseiro" ? "Qual banca ou órgão você acompanha?" : "Vamos vigiar a sua nomeação"}
          </h2>
          <p className="text-sm text-neutral-400 mb-5">
            {perfil === "aprovado"
              ? "A nomeação sai no Diário Oficial — e muita gente perde o prazo de posse por não ver. Monitore a página do órgão e ative o Radar do seu nome."
              : "Toque para monitorar com 1 clique. Dá para adicionar outras páginas depois."}
          </p>
          {perfil === "aprovado" && (
            <div className="mb-5 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
              <p className="text-sm font-bold mb-1">📰 Radar do seu nome no Diário Oficial</p>
              <p className="text-xs text-neutral-400 mb-3">Procuramos seu nome 2x por dia nos diários oficiais e avisamos na hora da convocação, com o prazo da posse.</p>
              <Link to={ehPro ? "/radar" : "/planos"} onClick={concluir} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                {ehPro ? "Ativar o Radar →" : "Testar o Pro grátis por 7 dias →"}
              </Link>
            </div>
          )}
          {listaModelos}
          {perfil === "concurseiro" && (
            <p className="text-xs text-neutral-500 mt-4">
              💡 Quer saber quando sair edital para o seu cargo? {ehPro ? <Link to="/radar" className="underline">Escolha o cargo no Radar de editais</Link> : <Link to="/planos" className="underline">É do plano Pro</Link>}.
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); monitorar(url); }} className="flex gap-2 mt-5">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ou cole o link de outra página" className={campo} />
            <button disabled={enviando || !url} className="font-mono text-xs border border-emerald-400/40 text-emerald-400 px-4 rounded-lg shrink-0 disabled:opacity-40">Monitorar</button>
          </form>
        </>
      )}

      {passo === 3 && (
        <>
          <h2 className="text-2xl font-black tracking-tight mb-1">Último passo: receba o aviso na hora</h2>
          <p className="text-sm text-neutral-400 mb-5">Ative as notificações no celular para não depender só do e-mail.</p>
          <AtivarNotificacoes />
          <button onClick={concluir} className="font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg">Ir para o meu painel →</button>
        </>
      )}

      {msg.texto && <p className={`mt-4 text-sm ${msg.tipo === "erro" ? "text-red-400" : "text-emerald-400"}`}>{msg.texto}</p>}
    </section>
  );
}
