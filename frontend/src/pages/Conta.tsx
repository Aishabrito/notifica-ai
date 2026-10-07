import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/navbar";
import api from "../services/Api";

interface Conta {
  nome: string; email: string; emailVerificado: boolean; criadoEm: string;
  plano: string; origemPlano: string | null; telegramConectado: boolean;
}
type Msg = { tipo: "" | "sucesso" | "erro"; texto: string };

function mensagemErro(err: unknown, padrao: string) {
  return (err as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ?? padrao;
}

const campo = "mt-1 w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-purple-500/50";
const botao = "font-mono text-xs bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-lg disabled:opacity-40";

export default function Conta() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [conta, setConta] = useState<Conta | null>(null);
  const [msg, setMsg] = useState<Msg>({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState("");
  const [senhas, setSenhas] = useState({ senhaAtual: "", novaSenha: "" });
  const [trocaEmail, setTrocaEmail] = useState({ novoEmail: "", senha: "" });
  const [exclusao, setExclusao] = useState({ senha: "", confirmacao: "" });

  const carregar = async () => {
    const { data } = await api.get("/api/conta");
    setConta(data.conta);
    setNome(data.conta.nome);
  };

  useEffect(() => {
    carregar().catch(() => setMsg({ tipo: "erro", texto: "Não foi possível carregar sua conta." }));
  }, []);

  // Executa uma ação e mostra o resultado
  const executar = async (acao: () => Promise<{ data: { mensagem?: string } }>, aoConcluir?: () => void | Promise<void>) => {
    if (enviando) return;
    setEnviando(true);
    try {
      const { data } = await acao();
      setMsg({ tipo: "sucesso", texto: data.mensagem ?? "Pronto." });
      await aoConcluir?.();
    } catch (err) {
      setMsg({ tipo: "erro", texto: mensagemErro(err, "Não foi possível concluir. Tente novamente.") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans antialiased">
      <Navbar logado={!!usuario} />
      <main className="max-w-2xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-16 space-y-8">
        <div>
          <p className="font-mono text-[10px] text-purple-400 tracking-[0.3em] uppercase mb-2">// minha conta</p>
          <h1 className="text-4xl font-black tracking-tighter">Minha conta</h1>
          {conta && (
            <p className="text-sm text-neutral-500 mt-2">
              {conta.email} · {conta.emailVerificado ? "e-mail confirmado ✓" : "e-mail não confirmado"} · plano{" "}
              <Link to="/planos" className="underline">{conta.plano === "pro" ? "Pro" : "gratuito"}</Link>
            </p>
          )}
        </div>

        {msg.texto && (
          <p role="status" className={`font-mono text-xs ${msg.tipo === "sucesso" ? "text-emerald-400" : "text-red-400"}`}>
            {msg.tipo === "sucesso" ? "✓" : "●"} {msg.texto}
          </p>
        )}

        {/* NOME */}
        <form className="border border-white/5 rounded-2xl p-6 space-y-3" onSubmit={(e) => { e.preventDefault(); executar(() => api.patch("/api/conta", { nome }), carregar); }}>
          <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Nome</h2>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} aria-label="Nome" />
          <button disabled={enviando || !nome.trim() || nome === conta?.nome} className={botao}>Salvar nome</button>
        </form>

        {/* SENHA */}
        <form className="border border-white/5 rounded-2xl p-6 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          executar(() => api.post("/api/conta/senha", senhas), () => setSenhas({ senhaAtual: "", novaSenha: "" }));
        }}>
          <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Trocar senha</h2>
          <label className="block text-xs text-neutral-400">Senha atual
            <input type="password" autoComplete="current-password" value={senhas.senhaAtual} onChange={(e) => setSenhas({ ...senhas, senhaAtual: e.target.value })} className={campo} />
          </label>
          <label className="block text-xs text-neutral-400">Nova senha (mín. 8 caracteres)
            <input type="password" autoComplete="new-password" value={senhas.novaSenha} onChange={(e) => setSenhas({ ...senhas, novaSenha: e.target.value })} className={campo} />
          </label>
          <button disabled={enviando || !senhas.senhaAtual || senhas.novaSenha.length < 8} className={botao}>Trocar senha</button>
        </form>

        {/* E-MAIL */}
        <form className="border border-white/5 rounded-2xl p-6 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          executar(() => api.post("/api/conta/email", trocaEmail), async () => { setTrocaEmail({ novoEmail: "", senha: "" }); await carregar(); });
        }}>
          <h2 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">Trocar e-mail</h2>
          <p className="text-xs text-neutral-500">Seus alertas passam a ir para o novo e-mail, que precisa ser confirmado.</p>
          <label className="block text-xs text-neutral-400">Novo e-mail
            <input type="email" value={trocaEmail.novoEmail} onChange={(e) => setTrocaEmail({ ...trocaEmail, novoEmail: e.target.value })} className={campo} />
          </label>
          <label className="block text-xs text-neutral-400">Sua senha
            <input type="password" autoComplete="current-password" value={trocaEmail.senha} onChange={(e) => setTrocaEmail({ ...trocaEmail, senha: e.target.value })} className={campo} />
          </label>
          <button disabled={enviando || !trocaEmail.novoEmail || !trocaEmail.senha} className={botao}>Trocar e-mail</button>
        </form>

        {/* EXCLUIR */}
        <form className="border border-red-500/20 rounded-2xl p-6 space-y-3" onSubmit={(e) => {
          e.preventDefault();
          if (!window.confirm("Excluir sua conta? Isso apaga seus alertas, histórico e nomes do Radar, e não pode ser desfeito.")) return;
          executar(() => api.delete("/api/conta", { data: exclusao }), async () => {
            await logout();
            navigate("/");
          });
        }}>
          <h2 className="font-mono text-[10px] text-red-400 uppercase tracking-widest">Excluir conta</h2>
          <p className="text-xs text-neutral-500">
            Apaga seus alertas, histórico de mudanças e nomes do Radar. Se você tiver assinatura no cartão, ela é cancelada antes.
            Registros de pagamento são mantidos apenas pelo prazo exigido por lei.
          </p>
          <label className="block text-xs text-neutral-400">Sua senha
            <input type="password" autoComplete="current-password" value={exclusao.senha} onChange={(e) => setExclusao({ ...exclusao, senha: e.target.value })} className={campo} />
          </label>
          <label className="block text-xs text-neutral-400">Digite EXCLUIR para confirmar
            <input value={exclusao.confirmacao} onChange={(e) => setExclusao({ ...exclusao, confirmacao: e.target.value })} className={campo} />
          </label>
          <button disabled={enviando || !exclusao.senha || exclusao.confirmacao !== "EXCLUIR"} className="font-mono text-xs bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg disabled:opacity-40">
            Excluir minha conta
          </button>
        </form>
      </main>
    </div>
  );
}
