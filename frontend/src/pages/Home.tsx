import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  intervaloHoras?: number;
  ultimaVerificacao?: string | null;
}

interface Mudanca {
  _id: string;
  detectadaEm: string;
  emailEnviado: boolean;
  resumo?: { relevante: boolean; titulo: string; resumo: string; datas: { data: string; descricao: string }[] };
  pdfsNovos?: string[];
}

const rotuloIntervalo = (h: number) => (h >= 24 ? "1x por dia" : h >= 1 ? `a cada ${h}h` : `a cada ${Math.round(h * 60)} min`);

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
  const [emailManual, setEmailManual] = useState("");
  const [statusMsg, setStatusMsg]     = useState({ tipo: "", texto: "" });
  // Limite de alertas ativos vindo do backend (null = ilimitado, plano Pro)
  const [limite, setLimite]           = useState<number | null>(3);
  const [ehPro, setEhPro]             = useState(false);
  const [intervalos, setIntervalos]   = useState<number[]>([6]);
  const [intervaloPadrao, setIntervaloPadrao] = useState(6);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [historico, setHistorico]     = useState<Record<string, Mudanca[]>>({});
  const [telegram, setTelegram]       = useState<{ disponivel: boolean; conectado: boolean } | null>(null);
  const [linkTelegram, setLinkTelegram] = useState<string | null>(null);
  const [verificacaoEnviada, setVerificacaoEnviada] = useState(false);

  const reenviarVerificacao = async () => {
    try {
      await api.post("/api/auth/verificar-email");
      setVerificacaoEnviada(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem;
      setStatusMsg({ tipo: "erro", texto: msg ?? "Não foi possível enviar o e-mail de confirmação." });
    }
  };

  const carregarPlano = async () => {
    try {
      const { data: d } = await api.get("/api/plano");
      if (d.sucesso) {
        setLimite(d.uso.limiteAlertas);
        setEhPro(d.plano.efetivo === "pro");
        setIntervalos(d.recursos.intervalosPermitidos);
        setIntervaloPadrao(d.recursos.intervaloPadrao);
        setTelegram(d.canais?.telegram ?? null);
      }
    } catch (err) {
      console.error("Erro ao carregar plano:", err);
    }
  };

  useEffect(() => {
    if (usuario) carregarPlano();
  }, [usuario]);

  const alterarFrequencia = async (id: string, intervaloHoras: number) => {
    try {
      await api.patch(`/api/alertas/${id}/frequencia`, { intervaloHoras });
      setAlertas((prev) => prev.map((a) => (a._id === id ? { ...a, intervaloHoras } : a)));
      setStatusMsg({ tipo: "sucesso", texto: `Frequência atualizada: ${rotuloIntervalo(intervaloHoras)}.` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem;
      setStatusMsg({ tipo: "erro", texto: msg ?? "Não foi possível alterar a frequência." });
    }
  };

  const conectarTelegram = async () => {
    try {
      const { data: d } = await api.post("/api/telegram/conectar");
      setLinkTelegram(d.link);
      window.open(d.link, "_blank", "noopener");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem;
      setStatusMsg({ tipo: "erro", texto: msg ?? "Não foi possível gerar o link do Telegram." });
    }
  };

  const desconectarTelegram = async () => {
    await api.delete("/api/telegram").catch(() => {});
    setLinkTelegram(null);
    await carregarPlano();
  };

  const alternarHistorico = async (id: string) => {
    if (historicoAberto === id) return setHistoricoAberto(null);
    setHistoricoAberto(id);
    if (historico[id]) return;
    try {
      const { data: d } = await api.get(`/api/alertas/${id}/historico`);
      setHistorico((prev) => ({ ...prev, [id]: d.mudancas }));
    } catch {
      setHistorico((prev) => ({ ...prev, [id]: [] }));
    }
  };

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
      });
      if (d.sucesso) {
        setUrl("");
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
  const LIMITE = limite ?? Infinity;

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
            {usuario && (
              <Link to="/planos" className={`inline-block mt-3 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${ehPro ? "text-purple-300 border-purple-500/40 bg-purple-500/10" : "text-neutral-500 border-neutral-800 hover:text-white"}`}>
                {ehPro ? "💎 Plano Pro" : "Plano gratuito · conhecer o Pro →"}
              </Link>
            )}
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

        {/* E-MAIL NÃO CONFIRMADO */}
        {usuario && usuario.emailVerificado === false && (
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap border border-amber-400/30 bg-amber-400/5 rounded-xl px-5 py-4">
            <p className="text-xs text-neutral-300">
              ✉️ Confirme seu e-mail para garantir que os alertas cheguem — e liberar o teste grátis do Pro e o Radar.
            </p>
            {verificacaoEnviada ? (
              <span className="font-mono text-[10px] text-emerald-400">link enviado — confira sua caixa de entrada</span>
            ) : (
              <button onClick={reenviarVerificacao} className="font-mono text-[10px] uppercase tracking-widest text-amber-400 hover:text-amber-300">[ reenviar link ]</button>
            )}
          </div>
        )}

        {/* CANAIS: TELEGRAM */}
        {usuario && telegram?.disponivel && (
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap border border-white/5 rounded-xl px-5 py-4 bg-neutral-900/30">
            <div>
              <p className="text-sm font-bold">📲 Alertas no Telegram</p>
              <p className="text-xs text-neutral-500">
                {!ehPro ? "Receba os avisos no celular na hora — exclusivo do Pro."
                  : telegram.conectado ? "Conectado: seus alertas chegam no Telegram e no e-mail."
                  : linkTelegram ? "Toque em \"Iniciar\" no Telegram e depois volte aqui."
                  : "Receba os avisos no celular na hora, além do e-mail."}
              </p>
            </div>
            {!ehPro ? (
              <Link to="/planos" className="font-mono text-[10px] uppercase tracking-widest text-purple-400 hover:text-purple-300">conhecer o Pro →</Link>
            ) : telegram.conectado ? (
              <button onClick={desconectarTelegram} className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-red-400">[ desconectar ]</button>
            ) : linkTelegram ? (
              <div className="flex gap-3">
                <a href={linkTelegram} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-widest text-sky-400">abrir de novo</a>
                <button onClick={carregarPlano} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">[ já conectei ]</button>
              </div>
            ) : (
              <button onClick={conectarTelegram} className="font-mono text-xs bg-sky-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-sky-400">Conectar Telegram</button>
            )}
          </div>
        )}

        {/* FORM */}
        <div
          className="mb-10 md:mb-14 p-6 md:p-8 rounded-2xl border border-white/5"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(108,52,131,0.02) 100%)" }}
        >
          <div className="flex justify-between mb-4 items-center flex-wrap gap-2">
            <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Configurar Novo Vigia</h2>
            <span className={`font-mono text-[9px] ${ativos >= LIMITE ? "text-red-400" : "text-neutral-600"}`}>
              {limite === null ? `${ativos} ATIVOS · PRO ILIMITADO` : `${ativos}/${limite} DISPONÍVEIS`}
            </span>
          </div>

          {ativos >= LIMITE ? (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500 mb-3">
                Limite de <strong className="text-white">{limite} alertas</strong> atingido no plano gratuito.
              </p>
              <button
                onClick={() => navigate("/planos")}
                className="font-mono text-xs bg-emerald-400 text-black px-6 py-2.5 rounded-lg font-bold hover:bg-emerald-300 transition-colors">
                Fazer upgrade →
              </button>
              <p className="text-[11px] text-neutral-600 mt-2">Cartão ou Pix — sem precisar de conta no Mercado Pago.</p>
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

            </form>
          )}

          {statusMsg.texto && (
            <p className={`mt-3 font-mono text-[10px] ${
              statusMsg.tipo === "sucesso" ? "text-emerald-400" :
              statusMsg.tipo === "erro"    ? "text-red-400" :
              "text-purple-400"
            }`}>
              {statusMsg.tipo === "sucesso" ? "✓" : "●"} {statusMsg.texto}
            </p>
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
                    {usuario && (
                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        <label className="font-mono text-[10px] text-neutral-600 flex items-center gap-2">
                          Checagem:
                          <select
                            value={intervalos.includes(alerta.intervaloHoras ?? -1) ? alerta.intervaloHoras! : intervaloPadrao}
                            disabled={!ehPro}
                            onChange={(e) => alterarFrequencia(alerta._id, Number(e.target.value))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-300 disabled:opacity-60"
                          >
                            {[...intervalos].sort((a, b) => b - a).map((h) => (
                              <option key={h} value={h}>{rotuloIntervalo(h)}</option>
                            ))}
                          </select>
                        </label>
                        {!ehPro && <Link to="/planos" className="font-mono text-[10px] text-purple-400 hover:text-purple-300">até a cada 15 min no Pro →</Link>}
                        <button onClick={() => alternarHistorico(alerta._id)} className="font-mono text-[10px] text-neutral-500 hover:text-white">
                          {historicoAberto === alerta._id ? "fechar histórico" : "histórico de mudanças"}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelar(alerta._id)}
                    className="text-neutral-700 hover:text-red-400 font-mono text-[9px] uppercase tracking-widest transition-colors shrink-0 p-1"
                  >
                    [ remover ]
                  </button>
                </div>

                {historicoAberto === alerta._id && (
                  <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                    {!historico[alerta._id] ? (
                      <p className="font-mono text-[10px] text-neutral-600">Carregando…</p>
                    ) : historico[alerta._id].length === 0 ? (
                      <p className="font-mono text-[10px] text-neutral-600">Nenhuma mudança detectada ainda.</p>
                    ) : (
                      historico[alerta._id].map((m) => (
                        <div key={m._id} className="border-l-2 border-purple-500/30 pl-3">
                          <p className="font-mono text-[10px] text-neutral-600">
                            {new Date(m.detectadaEm).toLocaleString("pt-BR")}
                            {m.resumo && !m.resumo.relevante && " · irrelevante (sem e-mail)"}
                          </p>
                          {m.resumo ? (
                            <>
                              <p className="text-sm font-bold text-neutral-200">{m.resumo.titulo}</p>
                              <p className="text-xs text-neutral-400">{m.resumo.resumo}</p>
                              {m.resumo.datas.length > 0 && (
                                <p className="text-[11px] text-emerald-400 mt-1">
                                  📅 {m.resumo.datas.map((d) => `${new Date(`${d.data}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })} — ${d.descricao}`).join(" · ")}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-neutral-500">Página atualizada.{!ehPro && " No Pro, a IA resume o que mudou."}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}