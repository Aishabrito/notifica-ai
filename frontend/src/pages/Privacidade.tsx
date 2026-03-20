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
        <p className="font-mono text-xs text-neutral-600 mb-12">Última atualização: março de 2025</p>

        {[
          {
            titulo: "1. Dados que coletamos",
            texto: "Coletamos apenas o necessário para o funcionamento do serviço: nome, endereço de e-mail, telefone (opcional) e as URLs que você escolhe monitorar. Não coletamos dados de navegação, localização ou informações de pagamento."
          },
          {
            titulo: "2. Como usamos seus dados",
            texto: "Seu e-mail é usado exclusivamente para enviar notificações de alertas e comunicações essenciais do serviço. Não enviamos e-mails de marketing sem consentimento explícito. Seu telefone, se fornecido, poderá ser usado futuramente para notificações via WhatsApp, mediante opt-in."
          },
          {
            titulo: "3. Compartilhamento de dados",
            texto: "Seus dados nunca são vendidos ou compartilhados com terceiros para fins comerciais. Utilizamos serviços de infraestrutura (MongoDB Atlas, Render, Vercel) que processam dados conforme suas próprias políticas de privacidade."
          },
          {
            titulo: "4. Retenção de dados",
            texto: "Seus dados são mantidos enquanto sua conta estiver ativa. Alertas cancelados são removidos imediatamente do banco de dados. Você pode solicitar a exclusão completa da sua conta a qualquer momento."
          },
          {
            titulo: "5. Segurança",
            texto: "Senhas são armazenadas com hash bcrypt. Sessões são gerenciadas via JWT em cookies httpOnly, protegidos contra acesso por JavaScript. Utilizamos HTTPS em todas as comunicações."
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