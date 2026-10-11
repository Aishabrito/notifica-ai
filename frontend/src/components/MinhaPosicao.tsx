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

type Props = { alertaId: string; posicao: Posicao | null | undefined; onMudou: (p: Posicao | null) => void };

// 📍 Minha posição na lista: a pessoa diz como o nome aparece e a gente
// acompanha a posição a cada mudança da página.
export default function MinhaPosicao({ alertaId, posicao, onMudou }: Props) {
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
          <p className="text-[10px] text-neutral-600 mt-1">Avisamos por e-mail quando mudar.</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0 text-right">
          <button onClick={() => setEditando(true)} className="font-mono text-[10px] text-neutral-500 hover:text-white">editar</button>
          <button onClick={() => { if (confirm("Parar de acompanhar sua posição?")) { setValor(""); salvar(null); } }} className="font-mono text-[10px] text-neutral-600 hover:text-red-400">desligar</button>
        </div>
      </div>
    </div>
  );
}
