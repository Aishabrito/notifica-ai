import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Download, MailCheck, MailWarning } from "lucide-react";
import { UserRecord, AlertRecord } from "./types";
import api from "../../../services/Api";
import { baixarPlanilha, dataBR, haQuanto, reais } from "../../../utils/planilha";

// ─── Helpers ───────────────────────────────────────────────────────────
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700", "bg-pink-100 text-pink-700", "bg-amber-100 text-amber-700"];
const avatarColor = (email: string) => AVATAR_COLORS[(email?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (u: UserRecord) => ((u.nome || u.email || "??").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();

const PERFIL: Record<string, string> = {
  vestibulando: "🎓 Vestibulando", "lista-espera": "⏳ Lista de espera", concurseiro: "📚 Concurseiro", aprovado: "🏅 Aprovado",
};
const ORIGEM: Record<string, string> = { mercadopago: "cartão", pix: "Pix", cortesia: "cortesia", teste: "teste grátis" };

type Filtro = "todos" | "pagantes" | "pro" | "free" | "ativos7" | "sumidos" | "novos7";
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "novos7", rotulo: "Novos (7 dias)" },
  { id: "ativos7", rotulo: "Usaram (7 dias)" },
  { id: "sumidos", rotulo: "Sumidos (+30 dias)" },
  { id: "pagantes", rotulo: "Já pagaram" },
  { id: "pro", rotulo: "Pro" },
  { id: "free", rotulo: "Free" },
];

const diasDesde = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : Infinity);

function Avatar({ user }: { user: UserRecord }) {
  return (
    <div className={`w-7 h-7 text-[10px] rounded-full flex items-center justify-center font-medium shrink-0 ${avatarColor(user.email)}`}>
      {initials(user)}
    </div>
  );
}

function StatusBadge({ status }: { status: AlertRecord["status"] }) {
  const map: Record<AlertRecord["status"], string> = {
    ativo:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    pausado: "bg-slate-100 text-slate-500 border-slate-200",
    erro:    "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>;
}

function PlanoBadge({ user }: { user: UserRecord }) {
  const pro = user.plano === "pro";
  const validade = user.planoValidoAte ? ` até ${dataBR(user.planoValidoAte)}` : "";
  const origem = user.planoOrigem ? ORIGEM[user.planoOrigem] : null;
  return (
    <span
      title={pro ? `${origem ?? "Pro"}${user.planoStatus === "cancelado" ? " (cancelada)" : ""}${validade}` : undefined}
      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
        pro ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-slate-50 text-slate-500 border-slate-200"
      }`}
    >
      {pro ? `pro${origem ? ` · ${origem}` : ""}` : "free"}
    </span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function TabelaUsuarios({
  users,
  alerts,
  onRefresh,
}: {
  users: UserRecord[];
  alerts: AlertRecord[];
  onRefresh?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const alterarPlano = async (user: UserRecord, tipo: "free" | "pro") => {
    let dias: number | undefined;
    if (tipo === "pro") {
      const resposta = window.prompt(`Pro de cortesia para ${user.email}.\nPor quantos dias? (deixe vazio para sem expiração)`, "30");
      if (resposta === null) return;
      if (resposta.trim()) {
        dias = Number(resposta);
        if (!Number.isInteger(dias) || dias <= 0) return window.alert("Informe um número inteiro de dias.");
      }
    } else if (!window.confirm(`Voltar ${user.email} para o Free? Alertas acima do limite serão pausados.`)) {
      return;
    }

    setSalvando(user._id);
    try {
      const { data } = await api.patch(`/api/admin/usuarios/${user._id}/plano`, { tipo, dias });
      window.alert(data.mensagem);
      onRefresh?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem;
      window.alert(msg ?? "Erro ao alterar plano.");
    } finally {
      setSalvando(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.nome ?? "").toLowerCase().includes(q)) return false;
      switch (filtro) {
        case "pagantes": return (u.totalPago ?? 0) > 0;
        case "pro": return u.plano === "pro";
        case "free": return u.plano === "free";
        case "ativos7": return diasDesde(u.ultimoAcessoEm) <= 7;
        case "sumidos": return diasDesde(u.ultimoAcessoEm ?? u.criadoEm) > 30;
        case "novos7": return diasDesde(u.criadoEm) <= 7;
        default: return true;
      }
    });
  }, [users, query, filtro]);

  const baixar = () => baixarPlanilha(`usuarios-notifica-${new Date().toISOString().slice(0, 10)}.csv`, [
    ["Nome", "E-mail", "E-mail confirmado", "Perfil", "Plano", "Origem do Pro", "Pro válido até", "Total pago (R$)", "Pagamentos", "Páginas monitoradas", "Telegram", "Criou a conta em", "Último acesso"],
    ...filtered.map((u) => [
      u.nome ?? "", u.email, u.emailVerificado ? "sim" : "não", u.perfil ? PERFIL[u.perfil] ?? u.perfil : "", u.plano,
      u.planoOrigem ? ORIGEM[u.planoOrigem] : "", dataBR(u.planoValidoAte), (u.totalPago ?? 0).toFixed(2).replace(".", ","), u.pagamentos ?? 0,
      u.alertas, u.telegram ? "sim" : "não", dataBR(u.criadoEm), dataBR(u.ultimoAcessoEm),
    ]),
  ]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-slate-900">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Usuários cadastrados</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} de {users?.length ?? 0} · clique numa pessoa para ver as páginas dela</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-indigo-300 w-52 text-slate-700"
            />
          </div>
          <button onClick={baixar} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg">
            <Download size={12} /> Baixar planilha
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${filtro === f.id ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Pessoa</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Plano</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Pagou</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Criou a conta</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Último uso</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Páginas</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const isExp = expanded === user._id;
                const userAlerts = (alerts ?? []).filter((a) => a.userId === user._id);
                return (
                  <React.Fragment key={user._id}>
                    <tr
                      onClick={() => setExpanded(isExp ? null : user._id)}
                      className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${isExp ? "bg-indigo-50/20" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-[180px]">
                          <Avatar user={user} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {user.nome || "—"}{user.role === "admin" && <span className="ml-1 text-[9px] text-indigo-600">ADMIN</span>}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              {user.emailVerificado
                                ? <MailCheck size={10} className="text-emerald-500 shrink-0" aria-label="e-mail confirmado" />
                                : <MailWarning size={10} className="text-amber-500 shrink-0" aria-label="e-mail não confirmado" />}
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <PlanoBadge user={user} />
                          {!(user.plano === "pro" && user.planoOrigem === "mercadopago") && (
                            <button
                              disabled={salvando === user._id}
                              onClick={(e) => { e.stopPropagation(); alterarPlano(user, user.plano === "pro" ? "free" : "pro"); }}
                              className="text-[10px] text-indigo-600 hover:underline disabled:opacity-50 whitespace-nowrap"
                            >
                              {user.plano === "pro" ? "remover" : "dar pro"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        {(user.totalPago ?? 0) > 0
                          ? <span className="font-semibold text-emerald-700">{reais(user.totalPago ?? 0)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dataBR(user.criadoEm)}</td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        <span className={diasDesde(user.ultimoAcessoEm) <= 7 ? "text-emerald-700" : "text-slate-400"} title={user.ultimoAcessoEm ? new Date(user.ultimoAcessoEm).toLocaleString("pt-BR") : "Ainda não registrado"}>
                          {haQuanto(user.ultimoAcessoEm)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-mono">{user.alertas}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-right">
                        {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500 mb-2">
                              <span>Perfil: <b className="text-slate-700">{user.perfil ? PERFIL[user.perfil] ?? user.perfil : "não escolheu"}</b></span>
                              <span>E-mail: <b className="text-slate-700">{user.emailVerificado ? "confirmado" : "não confirmado"}</b></span>
                              <span>Telegram: <b className="text-slate-700">{user.telegram ? "conectado" : "não"}</b></span>
                              {user.plano === "pro" && <span>Pro {user.planoValidoAte ? `até ${dataBR(user.planoValidoAte)}` : "sem prazo"}{user.planoStatus === "cancelado" ? " (cancelou a renovação)" : ""}</span>}
                              {(user.pagamentos ?? 0) > 0 && <span>{user.pagamentos} pagamento(s), {reais(user.totalPago ?? 0)}</span>}
                            </div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Páginas monitoradas</p>
                            {userAlerts.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Nenhuma página monitorada.</p>
                            ) : (
                              userAlerts.map((a) => (
                                <div key={a._id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <StatusBadge status={a.status} />
                                  <span className="text-[11px] truncate text-indigo-600 flex-1">{a.url}</span>
                                  <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink size={10} className="text-slate-400 hover:text-indigo-600" />
                                  </a>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
