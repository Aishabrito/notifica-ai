import { useEffect, useMemo, useState } from "react";
import { Download, Search, Wallet } from "lucide-react";
import api from "../../../services/Api";
import { Pagamento, ResumoPagamentos } from "./types";
import { baixarPlanilha, dataHoraBR, reais } from "../../../utils/planilha";

const TIPO: Record<Pagamento["tipo"], string> = { pix: "Pix", cobranca: "Cartão (cobrança)", assinatura: "Cartão (adesão)" };
const NOME_OFERTA = (o: string) => o.replace(/^pro-/, "").replace(/^pix-/, "Pix ").replace(/-/g, " ");
const MES = (m: string) => { const [a, mm] = m.split("-"); return new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

type Filtro = "pagos" | "pendentes" | "todos";

export default function TabelaPagamentos() {
  const [pagamentos, setPagamentos] = useState<Pagamento[] | null>(null);
  const [resumo, setResumo] = useState<ResumoPagamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pagos");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/api/admin/pagamentos")
      .then(({ data }) => { setPagamentos(data.pagamentos); setResumo(data.resumo); })
      .catch(() => setErro("Não foi possível carregar os pagamentos."));
  }, []);

  const lista = useMemo(() => (pagamentos ?? []).filter((p) => {
    // A adesão ao cartão não é dinheiro recebido: o que conta são as cobranças
    if (filtro === "pagos" && !p.pago) return false;
    if (filtro === "pendentes" && (p.pago || p.tipo === "assinatura")) return false;
    const q = query.trim().toLowerCase();
    return !q || (p.usuario?.email ?? "").toLowerCase().includes(q) || (p.usuario?.nome ?? "").toLowerCase().includes(q);
  }), [pagamentos, filtro, query]);

  const baixar = () => baixarPlanilha(`pagamentos-notifica-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Data", "Nome", "E-mail", "Forma", "Plano", "Valor (R$)", "Situação"],
    ...lista.map((p) => [dataHoraBR(p.data), p.usuario?.nome ?? "", p.usuario?.email ?? "(conta excluída)", TIPO[p.tipo], NOME_OFERTA(p.oferta), p.valor.toFixed(2).replace(".", ","), p.statusTexto]),
  ]);

  if (erro) return <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>;
  if (!pagamentos || !resumo) return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-pulse h-48" />;

  const maiorMes = Math.max(1, ...resumo.meses.map((m) => m.total));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total recebido</p>
          <p className="text-3xl font-bold mt-1 text-emerald-700">{reais(resumo.totalRecebido)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{resumo.pagamentosAprovados} pagamento(s) aprovado(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pessoas que pagaram</p>
          <p className="text-3xl font-bold mt-1 text-indigo-700">{resumo.pessoasQuePagaram}</p>
          <p className="text-[11px] text-slate-400 mt-1">pelo menos uma vez</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Recebido por mês</p>
          {resumo.meses.length === 0 ? <p className="text-xs text-slate-400">Nenhum pagamento ainda.</p> : (
            <ul className="space-y-1">
              {resumo.meses.slice(0, 4).map((m) => (
                <li key={m.mes} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 text-slate-500 shrink-0 whitespace-nowrap">{MES(m.mes)}</span>
                  <span className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.max(4, (m.total / maiorMes) * 100)}%`, maxWidth: "55%" }} />
                  <span className="font-semibold text-slate-700 whitespace-nowrap">{reais(m.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Quem pagou</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white">
              <option value="pagos">Pagos</option>
              <option value="pendentes">Não concluídos (Pix não pago, recusados)</option>
              <option value="todos">Tudo</option>
            </select>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou e-mail..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-indigo-300 w-44 text-slate-700" />
            </div>
            <button onClick={baixar} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg">
              <Download size={12} /> Baixar planilha
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                {["Data", "Pessoa", "Forma", "Plano", "Valor", "Situação"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-xs">Nada por aqui ainda.</td></tr>
              ) : lista.map((p) => (
                <tr key={p._id}>
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{dataHoraBR(p.data)}</td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-slate-800">{p.usuario?.nome ?? "—"}</p>
                    <p className="text-[11px] text-slate-500">{p.usuario?.email ?? "conta excluída"}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">{TIPO[p.tipo]}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 capitalize whitespace-nowrap">{NOME_OFERTA(p.oferta)}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">{reais(p.valor)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${p.pago ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                      {p.pago ? "Pago" : p.statusTexto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
