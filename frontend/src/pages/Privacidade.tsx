import { Link } from "react-router-dom";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export default function Privacidade() {
  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <p className="font-mono text-[10px] text-purple-400 uppercase tracking-widest mb-4">// legal</p>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Política de Privacidade</h1>
        <p className="font-mono text-xs text-neutral-600 mb-12">Última atualização: outubro de 2026</p>

        {[
          {
            titulo: "1. Dados que coletamos",
            texto: "Coletamos apenas o necessário para o funcionamento do serviço: nome, endereço de e-mail, telefone (opcional), as URLs que você escolhe monitorar e, se você conectar, o identificador do seu chat no Telegram. Não coletamos dados de navegação ou localização. Dados de cartão são digitados diretamente no formulário do Mercado Pago e nunca passam pelos nossos servidores; guardamos apenas a referência da assinatura ou do pagamento Pix."
          },
          {
            titulo: "1.1 Radar do Diário Oficial (plano Pro)",
            texto: "Se você ativar o Radar, guardamos o nome completo, o número de inscrição (opcional) e apenas os 6 dígitos do meio do CPF (opcional) que você informar, além dos trechos de diários oficiais em que eles aparecerem. Esses dados ficam cifrados (AES-256) no banco de dados, são usados somente para procurar publicações em diários oficiais públicos e avisar você, e não ficam visíveis no painel administrativo. Registramos cada consulta feita às fontes oficiais (sem o nome buscado) por 180 dias, para auditoria. Ao remover um nome do Radar, ele e o histórico de publicações encontradas são apagados."
          },
          {
            titulo: "2. Como usamos seus dados",
            texto: "Seu e-mail é usado exclusivamente para enviar notificações de alertas e comunicações essenciais do serviço. Não enviamos e-mails de marketing sem consentimento explícito. Seu telefone, se fornecido, poderá ser usado futuramente para notificações via WhatsApp, mediante opt-in. No plano Pro, os trechos alterados das páginas públicas que você monitora são enviados a um serviço de inteligência artificial (Google Gemini) para gerar o resumo da mudança; seus dados pessoais e os dados do Radar não são enviados à IA."
          },
          {
            titulo: "3. Compartilhamento de dados",
            texto: "Seus dados nunca são vendidos ou compartilhados com terceiros para fins comerciais. Utilizamos serviços de infraestrutura e operação (MongoDB Atlas, Render, Vercel, Resend para e-mails, Mercado Pago para pagamentos, Google Gemini para resumos, Telegram para notificações opcionais a API pública do Querido Diário e a busca pública do Diário Oficial da União, da Imprensa Nacional, para consulta de diários oficiais) que processam dados conforme suas próprias políticas de privacidade."
          },
          {
            titulo: "4. Retenção de dados",
            texto: "Seus dados são mantidos enquanto sua conta estiver ativa. Alertas cancelados são removidos imediatamente do banco de dados. Você pode solicitar a exclusão completa da sua conta a qualquer momento."
          },
          {
            titulo: "5. Segurança",
            texto: "Senhas são armazenadas com hash bcrypt. Sessões são gerenciadas via JWT em cookies httpOnly, protegidos contra acesso por JavaScript. Dados do Radar do Diário Oficial são cifrados com AES-256-GCM. Utilizamos HTTPS em todas as comunicações."
          },
          {
            titulo: "6. Seus direitos",
            texto: "Você tem direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento. Para exercer esses direitos, entre em contato: aisha.paola14@gmail.com"
          },
          {
            titulo: "7. Cookies",
            texto: "Utilizamos apenas um cookie essencial para manter sua sessão autenticada (httpOnly, secure). Não utilizamos cookies de rastreamento ou publicidade."
          },
        ].map((item) => (
          <div key={item.titulo} className="mb-8">
            <h2 className="font-bold text-base mb-2 text-white">{item.titulo}</h2>
            <p className="text-neutral-500 text-sm leading-relaxed font-light">{item.texto}</p>
          </div>
        ))}

        <div className="mt-12 pt-8 border-t border-neutral-900">
          <Link to="/termos" className="font-mono text-xs text-purple-400 hover:underline">
            → Ver Termos de Uso
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}