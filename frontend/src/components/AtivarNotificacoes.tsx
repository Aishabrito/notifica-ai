import { useEffect, useState } from "react";
import { ativarPush, desativarPush, estadoPush, type EstadoPush } from "../utils/push";

// Cartão "receba no celular": ativa as notificações neste aparelho.
// compacto = versão de uma linha (Minha conta)
export default function AtivarNotificacoes({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { estadoPush().then(setEstado).catch(() => setEstado("indisponivel")); }, []);

  const ativar = async () => {
    setEnviando(true); setMsg("");
    try {
      const r = await ativarPush();
      setMsg(r.mensagem);
      setEstado(await estadoPush());
    } catch {
      setMsg("Não foi possível ativar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  if (!estado || estado === "indisponivel") return null;
  if (estado === "ativo" && !compacto) return null; // no painel, some depois de ativado

  const corpo = (() => {
    if (estado === "ativo") return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">✅ Notificações ativas neste aparelho.</p>
        <button onClick={async () => { await desativarPush(); setEstado(await estadoPush()); }} className="font-mono text-[10px] text-neutral-500 hover:text-red-400">desativar</button>
      </div>
    );
    if (estado === "precisa-instalar") return (
      <p className="text-sm text-neutral-300">
        No iPhone, instale o Notifica.ai primeiro: toque em <strong>Compartilhar</strong> <span aria-hidden>⬆️</span> e depois em
        <strong> "Adicionar à Tela de Início"</strong>. Abra pelo ícone e ative aqui.
      </p>
    );
    if (estado === "bloqueado") return (
      <p className="text-sm text-neutral-300">As notificações estão bloqueadas neste navegador. Libere em <strong>Configurações do site → Notificações</strong> e recarregue a página.</p>
    );
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold">📲 Receba os avisos no celular, na hora</p>
          <p className="text-xs text-neutral-500">Mais rápido que o e-mail e não cai no spam. Funciona no Android, iPhone e computador.</p>
        </div>
        <button disabled={enviando} onClick={ativar} className="font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-50 shrink-0">
          {enviando ? "Ativando…" : "Ativar notificações"}
        </button>
      </div>
    );
  })();

  return (
    <section className={compacto ? "border border-white/5 rounded-2xl p-6 space-y-2" : "mb-8 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-5"}>
      {compacto && <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Notificações no celular</h2>}
      {corpo}
      {msg && <p className="text-xs text-emerald-400 mt-2">{msg}</p>}
    </section>
  );
}
