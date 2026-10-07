import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

interface Cidade { id: string; nome: string; uf: string }
interface Monitor {
  id: string; nome: string; inscricao: string | null; cpfParcial: string | null;
  cidades: Cidade[]; ativo: boolean; motivoPausa: string | null; ultimaBuscaEm: string | null;
}
interface Ocorrencia {
  id: string; monitorId: string; cidade: string; dataPublicacao: string; url: string;
  edicao: string | null; confirmacao: "nome" | "nome+documento" | "inscricao"; trechos: string[];
}
interface EstadoRadar {
  disponivel: boolean; ehPro: boolean; emailVerificado: boolean; limite: number;
  cidades: Cidade[]; monitores: Monitor[];
}
type Msg = { tipo: "" | "sucesso" | "erro" | "processando"; texto: string };

const SELO: Record<Ocorrencia["confirmacao"], { texto: string; cor: string }> = {
  "nome+documento": { texto: "nome e documento conferem", cor: "text-emerald-400 border-emerald-400/30" },
  inscricao: { texto: "encontrado pela inscrição", cor: "text-sky-400 border-sky-400/30" },
  nome: { texto: "só pelo nome — confira (homônimos)", cor: "text-amber-400 border-amber-400/30" },
};

function mensagemErro(err: unknown, padrao: string) {
  return (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ?? padrao;
}
const dataBR = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export default function Radar() {
  const { usuario } = useAuth();
  const [estado, setEstado] = useState<EstadoRadar | null>(null);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState<Msg>({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ nome: "", inscricao: "", cpf: "", cidades: [] as string[], consentimento: false });

  const carregar = async () => {
    const { data } = await api.get("/api/radar");
    setEstado(data);
    if (data.disponivel && data.monitores.length > 0) {
      const { data: o } = await api.get("/api/radar/ocorrencias");
      setOcorrencias(o.ocorrencias);
    }
  };

  useEffect(() => {
    carregar()
      .catch(() => setMsg({ tipo: "erro", texto: "Não foi possível carregar o Radar. Recarregue a página." }))
      .finally(() => setCarregando(false));
  }, []);

  const pedirVerificacao = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post("/api/auth/verificar-email");
      setMsg({ tipo: "sucesso", texto: data.mensagem });
      if (data.jaVerificado) await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: mensagemErro(err, "Não foi possível enviar o e-mail.") });
    } finally {
      setEnviando(false);
    }
  };

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setMsg({ tipo: "processando", texto: "Cadastrando…" });
    try {
      await api.post("/api/radar", {
        nome: form.nome,
        inscricao: form.inscricao || null,
        cpf: form.cpf || null,
        cidades: form.cidades,
        consentimento: form.consentimento,
      });
      setForm({ nome: "", inscricao: "", cpf: "", cidades: [], consentimento: false });
      setMsg({ tipo: "sucesso", texto: "Pronto! Vamos procurar seu nome nos diários oficiais 2x por dia. Use \"buscar agora\" para a primeira busca." });
      await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: mensagemErro(err, "Não foi possível cadastrar.") });
    } finally {
      setEnviando(false);
    }
  };

  const buscarAgora = async (id: string) => {
    if (enviando) return;
    setEnviando(true);
    setMsg({ tipo: "processando", texto: "Procurando nos diários oficiais… pode levar alguns segundos." });
    try {
      const { data } = await api.post(`/api/radar/${id}/buscar`);
      setMsg({ tipo: "sucesso", texto: data.mensagem });
      await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: mensagemErro(err, "Não foi possível buscar agora.") });
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: string) => {
    if (!window.confirm("Remover este nome do Radar? O histórico de publicações encontradas também será apagado.")) return;
    try {
      const { data } = await api.delete(`/api/radar/${id}`);
      setMsg({ tipo: "sucesso", texto: data.mensagem });
      setOcorrencias((prev) => prev.filter((o) => o.monitorId !== id));
      await carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: mensagemErro(err, "Não foi possível remover.") });
    }
  };

  const alternarCidade = (id: string) =>
    setForm((f) => ({ ...f, cidades: f.cidades.includes(id) ? f.cidades.filter((c) => c !== id) : [...f.cidades, id] }));

  const podeCadastrar = estado && estado.ehPro && estado.emailVerificado && estado.monitores.length < estado.limite;

  return (
    <div
      className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased"
      style={{ background: "radial-gradient(circle at 0% 0%, rgba(108,52,131,0.08) 0%, transparent 40%), #0a0a0a" }}
    >
      <Navbar logado={!!usuario} />

      <main className="max-w-3xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16">
        <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// radar do diário oficial</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">Seu nome no Diário Oficial</h1>
        <p className="text-neutral-500 mb-8">
          Procuramos seu nome e sua inscrição nos diários oficiais 2x por dia e avisamos por e-mail assim que você for citado(a):
          convocação, nomeação, resultado, posse.
        </p>

        {carregando ? (
          <p className="font-mono text-xs text-neutral-500">Carregando…</p>
        ) : !estado ? null : !estado.disponivel ? (
          <p className="text-sm text-neutral-500">O Radar ainda não está disponível. Volte em breve.</p>
        ) : (
          <>
            {!estado.ehPro && (
              <section className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-black mb-2">Exclusivo do plano Pro 💎</h2>
                <p className="text-sm text-neutral-400 mb-4">Assine o Pro para monitorar seu nome em {estado.cidades.map((c) => c.nome).join(", ")}.</p>
                <Link to="/planos" className="inline-block font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg">Ver planos →</Link>
              </section>
            )}

            {estado.ehPro && !estado.emailVerificado && (
              <section className="border border-amber-400/30 bg-amber-400/5 rounded-2xl p-6 mb-8">
                <h2 className="text-lg font-black mb-2">Confirme seu e-mail primeiro</h2>
                <p className="text-sm text-neutral-400 mb-4">Por segurança, o Radar só funciona com e-mail confirmado — é para lá que mandamos os avisos.</p>
                <button disabled={enviando} onClick={pedirVerificacao} className="font-mono text-xs bg-amber-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-50">
                  Enviar link de confirmação
                </button>
              </section>
            )}

            {/* NOMES MONITORADOS */}
            {estado.monitores.length > 0 && (
              <section className="space-y-3 mb-8">
                <h2 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Nomes monitorados ({estado.monitores.length}/{estado.limite})</h2>
                {estado.monitores.map((m) => (
                  <div key={m.id} className="bg-neutral-900/30 border border-white/5 rounded-xl p-5">
                    <div className="flex justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-bold">{m.nome}</p>
                        <p className="font-mono text-[11px] text-neutral-500">
                          {m.inscricao && <>inscrição {m.inscricao} · </>}
                          {m.cpfParcial && <>CPF {m.cpfParcial} · </>}
                          {m.cidades.map((c) => c.nome).join(", ")}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-600 mt-1">
                          {!m.ativo ? "⏸ pausado (plano Pro necessário)" : m.ultimaBuscaEm ? `última busca: ${new Date(m.ultimaBuscaEm).toLocaleString("pt-BR")}` : "ainda não buscado"}
                        </p>
                      </div>
                      <div className="flex gap-3 items-start">
                        {m.ativo && <button disabled={enviando} onClick={() => buscarAgora(m.id)} className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300 disabled:opacity-50">[ buscar agora ]</button>}
                        <button onClick={() => remover(m.id)} className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-red-400">[ remover ]</button>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* CADASTRO */}
            {podeCadastrar && (
              <form onSubmit={cadastrar} className="border border-white/5 rounded-2xl p-6 mb-8 space-y-4" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(108,52,131,0.02) 100%)" }}>
                <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Monitorar um nome</h2>
                <label className="block">
                  <span className="text-xs text-neutral-400">Nome completo (como aparece em documentos)</span>
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Maria Fernanda da Silva" className="mt-1 w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500/50" />
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-neutral-400">Nº de inscrição <span className="text-neutral-600">(opcional — muitas listas só mostram ele)</span></span>
                    <input value={form.inscricao} onChange={(e) => setForm({ ...form, inscricao: e.target.value })} placeholder="Ex.: 123456789" className="mt-1 w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500/50" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-400">CPF <span className="text-neutral-600">(opcional — guardamos só os 6 dígitos do meio)</span></span>
                    <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} inputMode="numeric" placeholder="000.000.000-00" className="mt-1 w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500/50" />
                  </label>
                </div>
                <fieldset>
                  <legend className="text-xs text-neutral-400 mb-2">Diários oficiais das cidades</legend>
                  <div className="flex flex-wrap gap-2">
                    {estado.cidades.map((c) => (
                      <button type="button" key={c.id} onClick={() => alternarCidade(c.id)} aria-pressed={form.cidades.includes(c.id)} className={`font-mono text-xs px-3 py-1.5 rounded-full border ${form.cidades.includes(c.id) ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "border-neutral-800 text-neutral-500"}`}>
                        {c.nome}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-2">Mais cidades em breve.</p>
                </fieldset>
                <label className="flex gap-3 items-start text-xs text-neutral-400">
                  <input type="checkbox" checked={form.consentimento} onChange={(e) => setForm({ ...form, consentimento: e.target.checked })} className="mt-0.5" />
                  <span>
                    Declaro que o nome acima é meu (ou de quem me autorizou) e concordo que o Notifica.ai guarde esses dados, cifrados,
                    apenas para procurá-los em diários oficiais públicos e me avisar. Posso remover a qualquer momento. Veja a <Link to="/privacidade" className="underline">política de privacidade</Link>.
                  </span>
                </label>
                <button type="submit" disabled={enviando || !form.consentimento || form.cidades.length === 0} className="font-mono text-xs bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg disabled:opacity-40">
                  Ativar Radar →
                </button>
              </form>
            )}

            {msg.texto && (
              <p role="status" className={`mb-6 font-mono text-xs ${msg.tipo === "sucesso" ? "text-emerald-400" : msg.tipo === "erro" ? "text-red-400" : "text-purple-400"}`}>
                {msg.tipo === "sucesso" ? "✓" : "●"} {msg.texto}
              </p>
            )}

            {/* PUBLICAÇÕES ENCONTRADAS */}
            {estado.monitores.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">Publicações encontradas</h2>
                {ocorrencias.length === 0 ? (
                  <p className="text-sm text-neutral-600 border border-dashed border-neutral-800 rounded-xl p-6 text-center">Nenhuma publicação com seus dados ainda. Seguimos de olho.</p>
                ) : (
                  ocorrencias.map((o) => (
                    <article key={o.id} className="border-l-2 border-emerald-400/40 bg-neutral-900/30 rounded-r-xl p-4">
                      <div className="flex justify-between gap-3 flex-wrap mb-2">
                        <p className="font-bold text-sm">Diário Oficial de {o.cidade} · {dataBR(o.dataPublicacao)}{o.edicao && <span className="text-neutral-500 font-normal"> · ed. {o.edicao}</span>}</p>
                        <span className={`font-mono text-[10px] border rounded-full px-2 py-0.5 ${SELO[o.confirmacao].cor}`}>{SELO[o.confirmacao].texto}</span>
                      </div>
                      {o.trechos.map((t, i) => <p key={i} className="text-xs text-neutral-400 bg-black/30 rounded p-2 mb-1">…{t}…</p>)}
                      <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-emerald-400 hover:underline">abrir o diário oficial →</a>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
