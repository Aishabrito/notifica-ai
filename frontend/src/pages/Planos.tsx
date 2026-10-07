import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

// ─── Tipos ─────────────────────────────────────────────────────────────
interface OfertaPix { id: string; dias: number; valor: number; descricao: string }
interface MpConfig {
  publicKey: string | null;
  pagamentosAtivos: boolean;
  cartao: { id: string; valor: number };
  pix: OfertaPix[];
}
interface PlanoInfo {
  plano: { tipo: string; status: string; validoAte: string | null; efetivo: "free" | "pro"; origem: string | null; assinaturaId: string | null };
  uso: { alertasAtivos: number; limiteAlertas: number | null };
  testeGratis?: { disponivel: boolean; dias: number; exigeEmailVerificado: boolean };
}
interface PixGerado {
  pagamentoId: string; valor: number; dias: number;
  qrCode: string | null; qrCodeBase64: string | null; linkPagamento: string | null; expiraEm: string | null;
}
type Estado = { tipo: "" | "processando" | "sucesso" | "erro"; texto: string };

// Estados da assinatura no Mercado Pago (a API usa "cancelled")
const STATUS_ASSINATURA: Record<string, string> = {
  pending: "Aguardando pagamento",
  authorized: "Ativa — renova todo mês",
  paused: "Pausada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opcoes?: { locale?: string }) => {
      bricks: () => {
        create: (tipo: string, containerId: string, settings: unknown) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function mensagemErro(err: unknown, padrao: string) {
  return (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ?? padrao;
}

// Carrega o SDK oficial do Mercado Pago uma única vez
function carregarSdkMercadoPago(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>('script[data-mp-sdk]');
    const script = existente ?? Object.assign(document.createElement("script"), { src: "https://sdk.mercadopago.com/js/v2", async: true });
    script.dataset.mpSdk = "1";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Falha ao carregar o Mercado Pago.")));
    if (!existente) document.body.appendChild(script);
  });
}

const RECURSOS = [
  { nome: "Alertas ativos", free: "3", pro: "Ilimitados" },
  { nome: "Frequência de checagem", free: "A cada 6 horas", pro: "Até a cada 15 min" },
  { nome: "Resumo do que mudou (IA)", free: "—", pro: "✓" },
  { nome: "Prazos direto na agenda", free: "—", pro: "✓" },
  { nome: "Radar do Diário Oficial", free: "—", pro: "✓" },
  { nome: "Alertas no Telegram", free: "—", pro: "✓" },
];

export default function Planos() {
  const { usuario } = useAuth();
  const [config, setConfig] = useState<MpConfig | null>(null);
  const [info, setInfo] = useState<PlanoInfo | null>(null);
  const [assinaturaStatus, setAssinaturaStatus] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [metodo, setMetodo] = useState<"cartao" | "pix">("cartao");
  const [estado, setEstado] = useState<Estado>({ tipo: "", texto: "" });
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  // O onSubmit do Brick é criado uma vez só: a trava contra clique duplo
  // precisa ser uma ref (o estado ficaria com o valor antigo dentro dele).
  const inFlight = useRef(false);

  const carregarPlano = async () => {
    const { data } = await api.get("/api/plano");
    setInfo(data);
    if (data.plano.assinaturaId) {
      api.get(`/api/assinatura/subscriptions/${data.plano.assinaturaId}`)
        .then(({ data: d }) => setAssinaturaStatus(d.assinatura.status))
        .catch(() => setAssinaturaStatus(null));
    }
    return data as PlanoInfo;
  };

  // Inicialização: configuração pública (sem cache) + plano do usuário
  useEffect(() => {
    (async () => {
      try {
        const resposta = await fetch(`${API_URL}/api/mp-config`, { cache: "no-store" });
        setConfig(await resposta.json());
        await carregarPlano();
      } catch {
        setEstado({ tipo: "erro", texto: "Não foi possível carregar os planos. Recarregue a página para tentar novamente." });
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ehPro = info?.plano.efetivo === "pro";
  const temCartao = info?.plano.origem === "mercadopago" && info.plano.status === "ativo";
  const podeAssinarCartao = !temCartao;
  const podePagarPix = !temCartao && !(ehPro && !info?.plano.validoAte);

  // ─── Cartão: Card Payment Brick (o cartão é tokenizado pelo Mercado Pago) ─
  useEffect(() => {
    if (metodo !== "cartao" || !config?.pagamentosAtivos || !config.publicKey || !info || !podeAssinarCartao) return;
    let cancelado = false;

    (async () => {
      try {
        await carregarSdkMercadoPago();
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(config.publicKey!, { locale: "pt-BR" });
        brickRef.current = await mp.bricks().create("cardPayment", "cardPaymentBrick_container", {
          initialization: { amount: config.cartao.valor, payer: { email: usuario?.email } },
          customization: {
            visual: { style: { theme: "dark" }, texts: { formSubmit: "Assinar Pro" } },
            paymentMethods: { maxInstallments: 1, types: { excluded: ["debit_card"] } },
          },
          callbacks: {
            onReady: () => {},
            onError: () => setEstado({ tipo: "erro", texto: "Erro no formulário do cartão. Confira os dados e tente novamente." }),
            // Deve retornar uma Promise que só termina depois do backend responder
            onSubmit: (dados: { token: string }) => new Promise<void>((resolve, reject) => {
              if (inFlight.current) return reject();
              inFlight.current = true;
              setIsSubmitting(true);
              setEstado({ tipo: "processando", texto: "Processando pagamento…" });
              api.post("/api/assinatura/cartao", { offerId: config.cartao.id, cardToken: dados.token })
                .then(async () => {
                  setEstado({ tipo: "sucesso", texto: "Pagamento aprovado! Você agora é Pro 🚀" });
                  await carregarPlano();
                  resolve();
                })
                .catch((err) => {
                  setEstado({ tipo: "erro", texto: mensagemErro(err, "Não foi possível processar o pagamento. Tente novamente.") });
                  reject();
                })
                .finally(() => { inFlight.current = false; setIsSubmitting(false); });
            }),
          },
        });
      } catch {
        setEstado({ tipo: "erro", texto: "Não foi possível carregar o formulário de cartão. Tente novamente ou use o Pix." });
      }
    })();

    return () => {
      cancelado = true;
      brickRef.current?.unmount();
      brickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodo, config, info?.plano.origem, info?.plano.status]);

  // ─── Pix ───────────────────────────────────────────────────────────────
  const gerarPix = async (oferta: OfertaPix) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setEstado({ tipo: "processando", texto: "Gerando Pix…" });
    try {
      const { data } = await api.post("/api/assinatura/pix", { offerId: oferta.id });
      setPix(data);
      setEstado({ tipo: "", texto: "" });
    } catch (err) {
      setEstado({ tipo: "erro", texto: mensagemErro(err, "Não foi possível gerar o Pix. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Consulta o pagamento a cada 5s enquanto o QR Code estiver na tela
  useEffect(() => {
    if (!pix) return;
    const intervalo = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/assinatura/pix/${pix.pagamentoId}`);
        if (data.aprovado) {
          clearInterval(intervalo);
          setPix(null);
          setEstado({ tipo: "sucesso", texto: `Pix confirmado! Você tem mais ${pix.dias} dias de Pro 🚀` });
          await carregarPlano();
        } else if (["rejected", "cancelled", "expired"].includes(data.status)) {
          clearInterval(intervalo);
          setPix(null);
          setEstado({ tipo: "erro", texto: "O Pix expirou ou foi recusado. Gere um novo para tentar novamente." });
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 5000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix]);

  const copiarPix = async () => {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // ─── Teste grátis ──────────────────────────────────────────────────────
  const iniciarTeste = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data } = await api.post("/api/assinatura/teste-gratis");
      setEstado({ tipo: "sucesso", texto: data.mensagem });
      await carregarPlano();
    } catch (err) {
      setEstado({ tipo: "erro", texto: mensagemErro(err, "Não foi possível iniciar o teste. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const enviarConfirmacao = async () => {
    try {
      const { data } = await api.post("/api/auth/verificar-email");
      setEstado({ tipo: "sucesso", texto: data.mensagem });
    } catch (err) {
      setEstado({ tipo: "erro", texto: mensagemErro(err, "Não foi possível enviar o e-mail.") });
    }
  };

  // ─── Gerenciar assinatura (pausar / reativar / cancelar) ──────────────
  const acaoAssinatura = async (acao: "pause" | "reactivate" | "cancel") => {
    if (!info?.plano.assinaturaId || isSubmitting) return;
    if (acao === "cancel" && !window.confirm("Cancelar a assinatura? Você continua Pro até o fim do período já pago.")) return;
    setIsSubmitting(true);
    setEstado({ tipo: "processando", texto: "Processando…" });
    try {
      const { data } = await api.post(`/api/assinatura/subscriptions/${info.plano.assinaturaId}/${acao}`);
      setEstado({ tipo: "sucesso", texto: data.mensagem });
      setAssinaturaStatus(data.status);
      await carregarPlano();
    } catch (err) {
      setEstado({ tipo: "erro", texto: mensagemErro(err, "Não foi possível concluir. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased"
      style={{ background: "radial-gradient(circle at 0% 0%, rgba(108,52,131,0.08) 0%, transparent 40%), #0a0a0a" }}
    >
      <Navbar logado={!!usuario} />

      <main data-mp-subscriptions-page="without-plan-authorized" className="max-w-4xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// planos</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">Notifica.ai Pro</h1>
        <p className="text-neutral-500 mb-10">Saiba o que mudou antes de todo mundo — sem precisar de conta no Mercado Pago.</p>

        {carregando ? (
          <div className="flex items-center gap-3 text-neutral-500 font-mono text-xs">
            <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            Carregando planos…
          </div>
        ) : (
          <>
            {/* STATUS DO PLANO ATUAL */}
            {ehPro && info && (
              <section className="border border-emerald-400/20 bg-emerald-400/5 rounded-2xl p-6 mb-8">
                <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest mb-2">Seu plano</p>
                <h2 className="text-2xl font-black mb-2">Você é Pro 💎</h2>
                {info.plano.origem === "mercadopago" && (
                  <>
                    <p className="text-sm text-neutral-400">
                      Assinatura no cartão: <strong className="text-white">{STATUS_ASSINATURA[assinaturaStatus ?? ""] ?? (info.plano.status === "ativo" ? "Ativa" : "Cancelada")}</strong>
                      {info.plano.status !== "ativo" && <> · acesso Pro até {dataBR(info.plano.validoAte)}</>}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {info.plano.status === "ativo" ? (
                        <>
                          <button disabled={isSubmitting} onClick={() => acaoAssinatura("pause")} className="font-mono text-xs border border-neutral-700 px-4 py-2 rounded-lg hover:border-neutral-500 disabled:opacity-50">Pausar</button>
                          <button disabled={isSubmitting} onClick={() => acaoAssinatura("cancel")} className="font-mono text-xs border border-red-500/40 text-red-400 px-4 py-2 rounded-lg hover:border-red-400 disabled:opacity-50">Cancelar assinatura</button>
                        </>
                      ) : assinaturaStatus === "paused" ? (
                        <button disabled={isSubmitting} onClick={() => acaoAssinatura("reactivate")} className="font-mono text-xs bg-emerald-400 text-black font-bold px-4 py-2 rounded-lg disabled:opacity-50">Reativar assinatura</button>
                      ) : null}
                    </div>
                  </>
                )}
                {info.plano.origem === "pix" && (
                  <p className="text-sm text-neutral-400">Pago via Pix · válido até <strong className="text-white">{dataBR(info.plano.validoAte)}</strong>. Renove abaixo quando quiser — os dias se somam.</p>
                )}
                {info.plano.origem === "teste" && (
                  <p className="text-sm text-neutral-400">Teste grátis até <strong className="text-white">{dataBR(info.plano.validoAte)}</strong>. Gostou? Assine abaixo — a primeira cobrança só acontece quando o teste acabar.</p>
                )}
                {info.plano.origem === "cortesia" && (
                  <p className="text-sm text-neutral-400">Pro de cortesia{info.plano.validoAte ? <> até <strong className="text-white">{dataBR(info.plano.validoAte)}</strong></> : " sem data para acabar"}.</p>
                )}
              </section>
            )}

            {/* TESTE GRÁTIS */}
            {info?.testeGratis?.disponivel && (
              <section className="border border-emerald-400/30 bg-emerald-400/5 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-black">Teste o Pro grátis por {info.testeGratis.dias} dias</h2>
                  <p className="text-sm text-neutral-400">Sem cartão, sem compromisso. No fim, sua conta volta ao gratuito sozinha.</p>
                </div>
                {info.testeGratis.exigeEmailVerificado ? (
                  <button onClick={enviarConfirmacao} className="font-mono text-xs border border-amber-400 text-amber-400 font-bold px-5 py-2.5 rounded-lg">
                    Confirmar e-mail para liberar
                  </button>
                ) : (
                  <button disabled={isSubmitting} onClick={iniciarTeste} className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
                    Começar teste grátis →
                  </button>
                )}
              </section>
            )}

            {/* COMPARAÇÃO */}
            <section className="grid md:grid-cols-2 gap-4 mb-10">
              {(["free", "pro"] as const).map((p) => (
                <div key={p} className={`rounded-2xl border p-6 ${p === "pro" ? "border-purple-500/40 bg-purple-500/5" : "border-neutral-800"}`}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1">{p === "pro" ? "Pro" : "Gratuito"}</p>
                  <p className="text-3xl font-black mb-4">
                    {p === "pro" ? <>{brl(config?.cartao.valor ?? 0)}<span className="text-sm text-neutral-500 font-normal">/mês</span></> : "R$ 0"}
                  </p>
                  <ul className="space-y-2">
                    {RECURSOS.map((r) => (
                      <li key={r.nome} className="flex justify-between text-sm gap-4">
                        <span className="text-neutral-400">{r.nome}</span>
                        <span className={p === "pro" ? "text-emerald-400 font-medium" : "text-neutral-600"}>{p === "pro" ? r.pro : r.free}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {/* CHECKOUT */}
            {!config?.pagamentosAtivos ? (
              <p className="text-sm text-neutral-500">Pagamentos indisponíveis no momento. Tente novamente mais tarde.</p>
            ) : (podeAssinarCartao || podePagarPix) && (
              <section className="border border-neutral-800 rounded-2xl p-6">
                <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-4">
                  {ehPro ? "Renovar ou trocar a forma de pagamento" : "Assinar o Pro"}
                </h2>

                <div className="flex gap-2 mb-6">
                  {podeAssinarCartao && (
                    <button onClick={() => { setMetodo("cartao"); setPix(null); }} className={`font-mono text-xs px-4 py-2 rounded-lg border ${metodo === "cartao" ? "border-emerald-400 text-emerald-400" : "border-neutral-800 text-neutral-500"}`}>
                      💳 Cartão — renova sozinho
                    </button>
                  )}
                  {podePagarPix && (
                    <button onClick={() => setMetodo("pix")} className={`font-mono text-xs px-4 py-2 rounded-lg border ${metodo === "pix" ? "border-emerald-400 text-emerald-400" : "border-neutral-800 text-neutral-500"}`}>
                      ⚡ Pix — sem renovação automática
                    </button>
                  )}
                </div>

                {metodo === "cartao" && podeAssinarCartao && (
                  <>
                    <p className="text-xs text-neutral-500 mb-4">
                      {brl(config.cartao.valor)} por mês. Cancele quando quiser pelo painel.
                      {ehPro && info?.plano.validoAte && <> A primeira cobrança só acontece quando seus dias de Pro atuais acabarem ({dataBR(info.plano.validoAte)}).</>}
                    </p>
                    {/* Formulário seguro do Mercado Pago: os dados do cartão nunca passam pelo nosso servidor */}
                    <div id="cardPaymentBrick_container" data-mp-subscription-cta="without-plan-authorized" />
                  </>
                )}

                {metodo === "pix" && podePagarPix && !pix && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {config.pix.map((o) => (
                      <button key={o.id} disabled={isSubmitting} onClick={() => gerarPix(o)} className="text-left border border-neutral-800 hover:border-emerald-400/50 rounded-xl p-4 disabled:opacity-50 transition-colors">
                        <p className="font-bold">{o.dias >= 365 ? "1 ano" : `${o.dias} dias`}</p>
                        <p className="text-2xl font-black text-emerald-400">{brl(o.valor)}</p>
                        {o.dias >= 365 && <p className="text-xs text-neutral-500 mt-1">equivale a {brl(o.valor / 12)}/mês</p>}
                      </button>
                    ))}
                  </div>
                )}

                {pix && (
                  <div className="flex flex-col items-center text-center gap-4">
                    <p className="text-sm text-neutral-400">Escaneie o QR Code no app do seu banco ou use o Pix copia e cola. <strong className="text-white">{brl(pix.valor)}</strong> · {pix.dias} dias de Pro</p>
                    {pix.qrCodeBase64 && <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code do Pix" className="w-56 h-56 bg-white p-2 rounded-xl" />}
                    {pix.qrCode && (
                      <div className="w-full max-w-md">
                        <textarea readOnly value={pix.qrCode} rows={3} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 font-mono text-[10px] text-neutral-400 resize-none" aria-label="Pix copia e cola" />
                        <button onClick={copiarPix} className="mt-2 w-full font-mono text-xs bg-emerald-400 text-black font-bold py-2.5 rounded-lg">{copiado ? "Copiado ✓" : "Copiar código Pix"}</button>
                      </div>
                    )}
                    <p className="flex items-center gap-2 font-mono text-[10px] text-purple-400">
                      <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      Aguardando pagamento… a confirmação aparece aqui automaticamente.
                    </p>
                    {pix.expiraEm && <p className="text-[10px] text-neutral-600">O código expira às {new Date(pix.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>}
                  </div>
                )}
              </section>
            )}

            {estado.texto && (
              <p role="status" className={`mt-4 font-mono text-xs ${estado.tipo === "sucesso" ? "text-emerald-400" : estado.tipo === "erro" ? "text-red-400" : "text-purple-400"}`}>
                {estado.tipo === "sucesso" ? "✓" : "●"} {estado.texto}
              </p>
            )}

            <p className="mt-10 text-xs text-neutral-600">
              Pagamentos processados pelo Mercado Pago. <Link to="/dashboard" className="underline hover:text-neutral-400">Voltar ao painel</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
