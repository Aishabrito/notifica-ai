import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

interface Alerta {
  _id: string;
  url: string;
  email: string;
  titulo: string;
  status: "ativo" | "pausado";
  criadoEm: string;
}

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

const BLOCKED_DOMAINS = ["instagram.com", "youtube.com", "youtu.be", "facebook.com", "tiktok.com"];

export default function Home() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [alertas, setAlertas]         = useState<Alerta[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [url, setUrl]                 = useState("");
  const [seletorCss, setSeletorCss]   = useState("");
  const [emailManual, setEmailManual] = useState("");
  const [statusMsg, setStatusMsg]     = useState({ tipo: "", texto: "" });

  const emailAtivo = usuario?.email || emailManual;

  const carregarAlertas = async (emailParam?: string) => {
    const emailFiltro = emailParam ?? emailAtivo;
    try {
      const { data: d } = await api.get("/api/alertas");
      if (d.sucesso) {
        setAlertas(emailFiltro
          ? d.alertas.filter((a: Alerta) => a.email === emailFiltro)
          : []
        );
      }
    } catch (err) {
      console.error("Erro ao carregar alertas:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    api.get("/teste").catch(() => {});
    carregarAlertas();
  }, [usuario, emailManual]);

  useEffect(() => {
    const onFocus = () => carregarAlertas();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [usuario, emailManual]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ativos >= LIMITE) return;

    // Client-side URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      setStatusMsg({ tipo: "erro", texto: "URL inválida. Use um endereço http:// ou https:// completo." });
      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      setStatusMsg({ tipo: "erro", texto: "Apenas URLs http:// e https:// são permitidas." });
      return;
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d))) {
      setStatusMsg({ tipo: "erro", texto: "Este site não pode ser monitorado. Insira o link de uma página pública com conteúdo rastreável (ex: resultado, edital, lista)." });
      return;
    }

    setStatusMsg({ tipo: "loading", texto: "Iniciando monitoramento..." });

    try {
      const { data: d } = await api.post("/api/cadastrar-alerta", {
        url,
        email: emailAtivo,
        seletorCss: seletorCss.trim() || undefined,
      });
      if (d.sucesso) {
        setUrl("");
        setSeletorCss("");
        await carregarAlertas(emailAtivo);
        setStatusMsg({ tipo: "sucesso", texto: `Monitorando: ${d.titulo}` });
      } else {
        throw new Error(d.mensagem);
      }
    } catch (err: unknown) {
      setStatusMsg({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro de conexão.",
      });
    }
  };

  const handleCancelar = async (id: string) => {
    await api.delete(`/api/cancelar-alerta/${id}`).catch(() => {});
    setAlertas((prev) => prev.filter((a) => a._id !== id));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const ativos = alertas.filter((a) => a.status === "ativo").length;
  const LIMITE = 3;

  return (
    <div
      className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased"
      style={{ background: "radial-gradient(circle at 0% 0%, rgba(108,52,131,0.08) 0%, transparent 40%), #0a0a0a" }}
    >
      <Navbar logado={!!usuario} />

      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16 md:pb-24 relative z-10">

        {/* HEADER */}
        <div className="flex items-start justify-between mb-10 md:mb-16 gap-4">
          <div>
            <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// painel operacional</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
              {usuario ? `Olá, ${usuario.nome.split(" ")[0]}.` : "Seus alertas."}
            </h1>
            <p className="text-neutral-500 text-sm mt-2">
              Você tem <strong className="text-emerald-400">{ativos} monitoramento{ativos !== 1 ? "s" : ""}</strong> ativo{ativos !== 1 ? "s" : ""} no momento.
            </p>
          </div>
          {usuario && (
            <button
              onClick={handleLogout}
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-white border border-neutral-800 hover:border-neutral-600 px-3 md:px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              Sair →
            </button>
          )}
        </div>

        {/* FORM */}
        <div
          className="mb-10 md:mb-14 p-6 md:p-8 rounded-2xl border border-white/5"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(108,52,131,0.02) 100%)" }}
        >
          <div className="flex justify-between mb-4 items-center flex-wrap gap-2">
            <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Configurar Novo Vigia</h2>
            <span className={`font-mono text-[9px] ${ativos >= LIMITE ? "text-red-400" : "text-neutral-600"}`}>
              {ativos}/{LIMITE} DISPONÍVEIS
            </span>
          </div>

          {ativos >= LIMITE ? (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500 mb-3">
                Limite de <strong className="text-white">3 alertas</strong> atingido no plano gratuito.
              </p>
              <button className="font-mono text-xs bg-emerald-400 text-black px-6 py-2.5 rounded-lg font-bold hover:bg-emerald-300 transition-colors">
                Fazer upgrade →
              </button>
            </div>
          ) : (
            <form onSubmit={handleCadastrar} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  placeholder="URL para monitorar (ex: sisu.mec.gov.br)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 md:py-4 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={statusMsg.tipo === "loading"}
                  className="bg-emerald-400 text-black font-bold text-xs px-6 md:px-8 py-3 md:py-4 rounded-lg hover:bg-emerald-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
                >
                  {statusMsg.tipo === "loading" ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      LENDO...
                    </span>
                  ) : "ATIVAR →"}
                </button>
              </div>

              <input
                type="text"
                placeholder="Seletor CSS (opcional, ex: main, #conteudo-principal, .lista-resultados)"
                value={seletorCss}
                onChange={(e) => setSeletorCss(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 md:py-4 font-mono text-xs text-white placeholder-neutral-700 outline-none focus:border-purple-500/50 transition-all"
              />

              {!usuario && (
                <input
                  type="email"
                  placeholder="Seu e-mail principal"
                  value={emailManual}
                  onChange={(e) => setEmailManual(e.target.value)}
                  required
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 md:py-4 font-mono text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                />
              )}

              {statusMsg.texto && (
                <p className={`font-mono text-[10px] ${
                  statusMsg.tipo === "sucesso" ? "text-emerald-400" :
                  statusMsg.tipo === "erro"    ? "text-red-400" :
                  "text-purple-400"
                }`}>
                  {statusMsg.tipo === "sucesso" ? "✓" : "●"} {statusMsg.texto}
                </p>
              )}
            </form>
          )}
        </div>

        {/* LISTA */}
        <div className="space-y-4 md:space-y-6">
          <h2 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Linha do Tempo de Alertas</h2>

          {carregando ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-neutral-900/50 rounded-xl" />
              <div className="h-24 bg-neutral-900/50 rounded-xl" />
            </div>
          ) : alertas.length === 0 ? (
            <div className="border border-dashed border-neutral-800 p-12 md:p-16 rounded-2xl text-center">
              <p className="font-mono text-[10px] text-neutral-700 uppercase tracking-[0.2em]">Nenhum alerta ativo ainda</p>
              <p className="text-neutral-600 text-sm mt-2">Cole uma URL acima para começar.</p>
            </div>
          ) : (
            alertas.map((alerta) => (
              <div
                key={alerta._id}
                className="group bg-neutral-900/30 border border-white/5 p-5 md:p-6 rounded-xl hover:border-purple-500/30 transition-all duration-500"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <StatusDot status={alerta.status} />
                      <span className="font-mono text-[9px] text-neutral-600">ID: {alerta._id.slice(-6)}</span>
                    </div>
                    <h3 className="font-bold text-base md:text-lg tracking-tight group-hover:text-emerald-400 transition-colors truncate">
                      {alerta.titulo}
                    </h3>
                    <p className="font-mono text-[11px] text-neutral-500 truncate">{alerta.url}</p>
                  </div>
                  <button
                    onClick={() => handleCancelar(alerta._id)}
                    className="text-neutral-700 hover:text-red-400 font-mono text-[9px] uppercase tracking-widest transition-colors shrink-0 p-1"
                  >
                    [ remover ]
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}