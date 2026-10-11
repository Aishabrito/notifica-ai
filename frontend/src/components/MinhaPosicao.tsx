import { useState } from "react";
import api from "../services/Api";

export interface Posicao {
  identificador: string;
  encontrado: boolean;
  numero: number | null;
  trecho: string | null;
  verificadoEm: string | null;
  historico: { encontrado: boolean; numero: number | null; em: string }[];
}

export interface Chamada { _id: string; numero: number | null; ate: number; em: string; origem: "ia" | "manual" }
export interface Estimativa { faltamPosicoes: number; ritmo: number | null; chamadasEstimadas: number | null }

type Props = {
  alertaId: string;
  posicao: Posicao | null | undefined;
  onMudou: (p: Posicao | null) => void;
  chamadas?: Chamada[];
  estimativa?: Estimativa | null;
  onChamadas?: (c: Chamada[], e: Estimativa | null) => void;
};

// Histórico das chamadas + quanto falta até a sua posição
function Chamadas({ alertaId, chamadas = [], estimativa, minha, onChamadas }: { alertaId: string; chamadas?: Chamada[]; estimativa?: Estimativa | null; minha: number | null; onChamadas?: Props["onChamadas"] }) {
  const [ate, setAte] = useState("");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState("");
  const ordenadas = [...chamadas].sort((a, b) => a.ate - b.ate);
  const ultima = ordenadas[ordenadas.length - 1]?.ate ?? 0;
  const progresso = minha ? Math.min(100, Math.round((ultima / minha) * 100)) : 0;

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro("");
    try {
      const { data } = await api.post(`/api/alertas/${alertaId}/chamadas`, { ate: Number(ate), numero: numero ? Number(numero) : undefined });
      onChamadas?.(data.chamadas, data.estimativa); setAte(""); setNumero("");
    } catch (err: any) { setErro(err.response?.data?.mensagem ?? "Não foi possível registrar."); }
  };
  const remover = async (id: string) => {
    const { data } = await api.delete(`/api/alertas/${alertaId}/chamadas/${id}`);
    onChamadas?.(data.chamadas, data.estimativa);
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
      {minha && ordenadas.length > 0 && (
        <>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-xs text-neutral-300">
            {estimativa && estimativa.faltamPosicoes === 0
              ? <>🎉 <strong>A chamada já passou da sua posição!</strong> Confira a lista oficial.</>
              : <>Chamaram até a <strong>{ultima}ª</strong> · você é <strong>{minha}º</strong> · faltam <strong>{estimativa?.faltamPosicoes ?? minha - ultima}</strong>
                {estimativa?.chamadasEstimadas ? <> · no ritmo atual (~{estimativa.ritmo} por chamada), <strong>{estimativa.chamadasEstimadas === 1 ? "mais 1 chamada" : `mais ${estimativa.chamadasEstimadas} chamadas`}</strong></> : null}</>}
          </p>
        </>
      )}
      {ordenadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ordenadas.map((c) => (
            <span key={c._id} className="inline-flex items-center gap-1 font-mono text-[10px] border border-neutral-800 rounded-full px-2 py-0.5 text-neutral-400">
              {c.numero ? `${c.numero}ª` : "chamada"} até {c.ate}º{c.origem === "ia" && " ✨"}
              <button onClick={() => remover(c._id)} className="text-neutral-600 hover:text-red-400" aria-label="Remover chamada">✕</button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={registrar} className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
        <span>Registrar chamada:</span>
        <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} placeholder="nº" className="w-10 bg-transparent border-b border-neutral-800 outline-none text-center" aria-label="Número da chamada" />
        <span>ª foi até a posição</span>
        <input value={ate} onChange={(e) => setAte(e.target.value.replace(/\D/g, ""))} placeholder="65" required className="w-14 bg-transparent border-b border-neutral-800 outline-none text-center" aria-label="Última posição chamada" />
        <button className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300 ml-1">salvar</button>
      </form>
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
      {ordenadas.length === 0 && <p className="text-[10px] text-neutral-600">No Pro, a IA registra sozinha quando sai uma chamada nova (✨).</p>}
    </div>
  );
}

// 📍 Minha posição na lista: a pessoa diz como o nome aparece e a gente
// acompanha a posição a cada mudança da página.
export default function MinhaPosicao({ alertaId, posicao, onMudou, chamadas, estimativa, onChamadas }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(posicao?.identificador ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async (identificador: string | null) => {
    setErro(""); setSalvando(true);
    try {
      const { data } = await api.patch(`/api/alertas/${alertaId}/posicao`, { identificador });
      onMudou(data.posicao);
      setEditando(false);
    } catch (e: any) {
      setErro(e.response?.data?.mensagem ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (editando || (!posicao && valor)) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); salvar(valor); }} className="mt-3 space-y-2">
        <p className="font-mono text-[10px] text-neutral-500">Escreva seu nome completo ou nº de inscrição <strong>como aparece na lista</strong>:</p>
        <div className="flex gap-2">
          <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: João da Silva Santos"
            className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400/60" />
          <button disabled={salvando} className="font-mono text-[10px] bg-emerald-400 text-black font-bold px-3 rounded-lg disabled:opacity-50">SALVAR</button>
          <button type="button" onClick={() => { setEditando(false); setValor(posicao?.identificador ?? ""); }} className="font-mono text-[10px] text-neutral-500 px-2">cancelar</button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <p className="text-[10px] text-neutral-600">Fica guardado de forma cifrada e só você vê.</p>
      </form>
    );
  }

  if (!posicao) {
    return (
      <button onClick={() => setEditando(true)} className="mt-2 font-mono text-[10px] text-neutral-500 hover:text-white">
        📍 acompanhar minha posição na lista
      </button>
    );
  }

  // Tendência: compara com a primeira posição conhecida
  const numeros = posicao.historico.filter((h) => h.numero != null);
  const primeiro = numeros[0];
  const subiu = primeiro && posicao.numero != null ? primeiro.numero! - posicao.numero : 0;

  return (
    <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!posicao.encontrado ? (
            <p className="text-sm text-neutral-300">📍 <strong>{posicao.identificador}</strong> ainda não aparece nesta página.</p>
          ) : posicao.numero != null ? (
            <p className="text-sm">
              📍 Sua posição: <strong className="text-emerald-400 text-lg">{posicao.numero}º</strong>
              {subiu > 0 && <span className="text-xs text-emerald-400 ml-2">▲ subiu {subiu} desde {new Date(primeiro.em).toLocaleDateString("pt-BR")}</span>}
            </p>
          ) : (
            <p className="text-sm text-neutral-300">📍 Seu nome aparece na página — confira a posição no trecho:</p>
          )}
          {posicao.encontrado && posicao.trecho && (
            <p className="font-mono text-[10px] text-neutral-500 mt-1 break-words">{posicao.trecho}</p>
          )}
          <p className="text-[10px] text-neutral-600 mt-1">Avisamos quando mudar e quando a chamada chegar em você.</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0 text-right order-last">
          <button onClick={() => setEditando(true)} className="font-mono text-[10px] text-neutral-500 hover:text-white">editar</button>
          <button onClick={() => { if (confirm("Parar de acompanhar sua posição?")) { setValor(""); salvar(null); } }} className="font-mono text-[10px] text-neutral-600 hover:text-red-400">desligar</button>
        </div>
      </div>
      <Chamadas alertaId={alertaId} chamadas={chamadas} estimativa={estimativa} onChamadas={onChamadas}
        minha={posicao.numero ?? [...posicao.historico].reverse().find((h) => h.numero != null)?.numero ?? null} />
    </div>
  );
}
