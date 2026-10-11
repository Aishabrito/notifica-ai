import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Stethoscope } from "lucide-react";
import api from "../../../services/Api";

type Item = { item: string; ok: boolean; variaveis: string };
type Fonte = { id: string; nome: string; fonte: string | null; ultimaPublicacao: string | null; ok: boolean; erro: string | null };
type Modelo = { id: string; ok: boolean; status?: number | null; caracteres?: number; ms?: number; erro?: string | null };
type Saude = {
  configuracoes: Item[];
  fontes: Fonte[];
  cron: { rodadas24h: number; rodadasComErro: { _id: string; dataExecucao: string; alertasComErro: number; erroGlobal: string | null }[] };
  modelos: Modelo[] | null;
};

const Marca = ({ ok }: { ok: boolean }) =>
  ok ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <XCircle size={14} className="text-rose-500 shrink-0" />;

// Checklist do que precisa de atenção manual: configuração, fontes do Radar,
// cron e (sob demanda) os modelos prontos — sites de banca mudam sem aviso.
export default function PainelSaudeSistema() {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async (comModelos = false) => {
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await api.get(`/api/admin/saude${comModelos ? "?modelos=1" : ""}`, { timeout: 120000 });
      setSaude((anterior) => ({ ...data, modelos: data.modelos ?? anterior?.modelos ?? null }));
    } catch (e: any) {
      setErro(e.response?.data?.mensagem ?? "Não foi possível verificar.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const pendencias = saude
    ? saude.configuracoes.filter((c) => !c.ok).length + saude.fontes.filter((f) => !f.ok).length +
      saude.cron.rodadasComErro.length + (saude.modelos?.filter((m) => !m.ok).length ?? 0)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Saúde do sistema</h3>
          {saude && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pendencias ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {pendencias ? `${pendencias} pendência(s)` : "tudo certo"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => carregar(true)} disabled={carregando}
            className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg disabled:opacity-50">
            Testar modelos prontos
          </button>
          <button onClick={() => carregar()} disabled={carregando} className="text-slate-400 hover:text-slate-700 p-1.5" aria-label="Atualizar">
            <RefreshCw size={13} className={carregando ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {erro && <p className="text-xs text-rose-600 mb-3">{erro}</p>}
      {!saude && carregando && <div className="h-32 animate-pulse bg-slate-50 rounded-xl" />}

      {saude && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Configuração (Render)</p>
            <ul className="space-y-1.5">
              {saude.configuracoes.map((c) => (
                <li key={c.item} className="flex items-start gap-2">
                  <Marca ok={c.ok} />
                  <span>{c.item}{!c.ok && <span className="block text-slate-400">falta: {c.variaveis}</span>}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Fontes do Radar</p>
            <ul className="space-y-1.5">
              {saude.fontes.map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <Marca ok={f.ok} />
                  <span>
                    {f.nome}
                    <span className="block text-slate-400">
                      {f.erro ? `erro: ${f.erro}` : f.ultimaPublicacao ? `última edição: ${f.ultimaPublicacao.split("-").reverse().join("/")}` : f.fonte ?? "sem fonte"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mt-4 mb-2">Cron (24h)</p>
            <p className="flex items-center gap-2">
              <Marca ok={saude.cron.rodadas24h > 0 && saude.cron.rodadasComErro.length === 0} />
              {saude.cron.rodadas24h} rodada(s){saude.cron.rodadas24h === 0 && " — o servidor está dormindo? (plano grátis do Render)"}
            </p>
            {saude.cron.rodadasComErro.map((r) => (
              <p key={r._id} className="text-slate-400 ml-6">
                {new Date(r.dataExecucao).toLocaleString("pt-BR")}: {r.erroGlobal ?? `${r.alertasComErro} alerta(s) com erro`}
              </p>
            ))}
          </div>

          <div>
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Modelos prontos</p>
            {!saude.modelos ? (
              <p className="text-slate-400">Clique em "Testar modelos prontos" (leva ~1 minuto).</p>
            ) : (
              <ul className="space-y-1.5">
                {saude.modelos.map((m) => (
                  <li key={m.id} className="flex items-start gap-2">
                    <Marca ok={m.ok} />
                    <span>{m.id}<span className="block text-slate-400">{m.erro ?? `${m.caracteres} caracteres · ${m.ms} ms`}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
