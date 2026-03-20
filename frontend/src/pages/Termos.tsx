import { Link } from "react-router-dom";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export default function Termos() {
  return (
    <div className="bg-[#0a0a0a] text-[#f5f2eb] min-h-screen font-sans">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <p className="font-mono text-[10px] text-purple-400 uppercase tracking-widest mb-4">// legal</p>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Termos de Uso</h1>
        <p className="font-mono text-xs text-neutral-600 mb-12">Última atualização: março de 2025</p>

        {[
          {
            titulo: "1. O que é o Notifica.ai",
            texto: "O Notifica.ai é um serviço de monitoramento de páginas web que envia notificações por e-mail quando detecta alterações no conteúdo de uma URL cadastrada pelo usuário. O serviço é fornecido no estado em que se encontra, sem garantias de disponibilidade contínua."
          },
          {
            titulo: "2. Uso aceitável",
            texto: "Você concorda em usar o serviço apenas para fins lícitos. É proibido monitorar páginas que exijam autenticação sem autorização, realizar scraping em larga escala, ou utilizar o serviço para fins que violem direitos de terceiros."
          },
          {
            titulo: "3. Limites do plano gratuito",
            texto: "O plano gratuito permite até 3 alertas ativos simultaneamente, com checagem a cada 6 horas. Esses limites podem ser alterados a qualquer momento mediante aviso prévio por e-mail."
          },
          {
            titulo: "4. Responsabilidade",
            texto: "O Notifica.ai não se responsabiliza por perdas decorrentes de falhas no monitoramento, atrasos na entrega de notificações ou indisponibilidade do serviço. O usuário é responsável por verificar as informações diretamente nas fontes originais."
          },
          {
            titulo: "5. Cancelamento",
            texto: "Você pode cancelar qualquer alerta a qualquer momento clicando no link de cancelamento presente em cada e-mail. Para encerrar sua conta, entre em contato pelo e-mail de suporte."
          },
          {
            titulo: "6. Alterações nos termos",
            texto: "Podemos atualizar estes termos periodicamente. Mudanças significativas serão comunicadas por e-mail. O uso continuado do serviço após a notificação implica aceite dos novos termos."
          },
          {
            titulo: "7. Contato",
            texto: "Dúvidas sobre estes termos? Entre em contato: aisha.paola14@gmail.com"
          },
        ].map((item) => (
          <div key={item.titulo} className="mb-8">
            <h2 className="font-bold text-base mb-2 text-white">{item.titulo}</h2>
            <p className="text-neutral-500 text-sm leading-relaxed font-light">{item.texto}</p>
          </div>
        ))}

        <div className="mt-12 pt-8 border-t border-neutral-900">
          <Link to="/privacidade" className="font-mono text-xs text-purple-400 hover:underline">
            → Ver Política de Privacidade
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}