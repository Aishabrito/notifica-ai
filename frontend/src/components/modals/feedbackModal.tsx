import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
const API = "https://notifica-ai.onrender.com";

type Status = "idle" | "loading" | "success" | "error";

export default function FeedbackModal() {
  const { usuario } = useAuth();

  const [aberto, setAberto]     = useState<boolean>(false);
  const [mensagem, setMensagem] = useState<string>("");
  const [emailManual, setEmail] = useState<string>("");
  const [status, setStatus]     = useState<Status>("idle");
  const [erro, setErro]         = useState<string>("");

  // Se estiver logado usa o email do contexto, senão usa o campo manual
  const emailFinal = usuario?.email ?? emailManual;

  const resetar = (): void => {
    setMensagem("");
    setEmail("");
    setStatus("idle");
    setErro("");
  };

  const fechar = (): void => {
    setAberto(false);
    setTimeout(resetar, 300);
  };

  const enviar = async (): Promise<void> => {
    if (!emailFinal || !mensagem) {
      setErro("Preencha todos os campos.");
      return;
    }

    setStatus("loading");
    setErro("");

    try {
      const r = await fetch(`${API}/api/feedbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailFinal, mensagem }),
      });

      const d = await r.json();

      if (d.sucesso) {
        setStatus("success");
      } else {
        throw new Error(d.mensagem ?? "Erro ao enviar.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar. Tente novamente.";
      setErro(msg);
      setStatus("error");
    }
  };

  return (
    <>
      {/* ── Botão flutuante ───────────────────────────────────────────────── */}
      <button
        onClick={() => setAberto(true)}
        aria-label="Enviar feedback"
        className="
          fixed bottom-6 right-6 z-50
          flex items-center gap-2
          font-mono text-[10px] uppercase tracking-widest
          bg-emerald-400 hover:bg-emerald-300
          text-black font-bold
          px-4 py-2.5 rounded-lg
          hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]
          hover:-translate-y-0.5 active:scale-95
          transition-all duration-200
        "
      >
        <span className="text-[8px]">●</span>
        Feedback
      </button>

      {/* ── Overlay ───────────────────────────────────────────────────────── */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && fechar()}
        >
          {/* Card */}
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.07] shadow-2xl overflow-hidden"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(108,52,131,0.03) 100%)" }}
          >

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div>
                <p className="font-mono text-[9px] text-purple-400 uppercase tracking-[0.2em]">
                  // feedback
                </p>
                <h2 className="text-sm font-bold text-white mt-0.5 tracking-tight">
                  Deixe sua mensagem
                </h2>
              </div>
              <button
                onClick={fechar}
                className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-white border border-neutral-800 hover:border-neutral-600 px-2.5 py-1.5 rounded-lg transition-all"
              >
                [ esc ]
              </button>
            </div>

            {/* Body */}
            <div className="p-5">

              {status === "success" ? (
                /* ── Estado de sucesso ── */
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full border border-emerald-400/20 bg-emerald-400/5 flex items-center justify-center mx-auto mb-4">
                    <span className="text-emerald-400 text-xl font-black">✓</span>
                  </div>
                  <p className="font-bold tracking-tight text-white">Feedback enviado!</p>
                  <p className="font-mono text-[11px] text-neutral-600 mt-1">
                    Obrigado. Vamos analisar sua mensagem.
                  </p>
                  <button
                    onClick={fechar}
                    className="mt-6 font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-white transition-colors"
                  >
                    fechar →
                  </button>
                </div>
              ) : (
                /* ── Formulário ── */
                <div className="space-y-3">

                  {/* Email — exibido apenas para usuários não logados */}
                  {!usuario && (
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-1.5">
                        Seu e-mail
                      </label>
                      <input
                        type="email"
                        placeholder="voce@email.com"
                        value={emailManual}
                        onChange={(e) => setEmail(e.target.value)}
                        className="
                          w-full bg-neutral-900/50 border border-neutral-800
                          rounded-lg px-4 py-3 font-mono text-xs text-white
                          placeholder-neutral-700 outline-none
                          focus:border-purple-500/50 transition-all
                        "
                      />
                    </div>
                  )}

                  {/* Mensagem */}
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-1.5">
                      Mensagem
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Conte o que achou, sugira algo ou reporte um problema..."
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      className="
                        w-full bg-neutral-900/50 border border-neutral-800
                        rounded-lg px-4 py-3 font-mono text-xs text-white resize-none
                        placeholder-neutral-700 outline-none
                        focus:border-purple-500/50 transition-all
                      "
                    />
                  </div>

                  {/* Erro */}
                  {erro && (
                    <p className="font-mono text-[10px] text-red-400 bg-red-400/5 border border-red-400/20 px-3 py-2 rounded-lg">
                      ● {erro}
                    </p>
                  )}

                  {/* Submit */}
                  <button
                    onClick={enviar}
                    disabled={status === "loading"}
                    className="
                      w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50
                      text-black font-bold text-xs uppercase tracking-widest
                      py-3 rounded-lg
                      hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]
                      hover:-translate-y-0.5 active:scale-[0.99]
                      transition-all duration-200
                    "
                  >
                    {status === "loading" ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      "Enviar →"
                    )}
                  </button>

                  {/* Info para usuários logados */}
                  {usuario && (
                    <p className="font-mono text-[9px] text-neutral-700 text-center">
                      enviando como <span className="text-neutral-500">{usuario.email}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}