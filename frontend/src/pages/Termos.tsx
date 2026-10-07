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
        <p className="font-mono text-xs text-neutral-600 mb-12">Última atualização: outubro de 2026</p>

        {[
          {
            titulo: "1. O que é o Notifica.ai",
            texto: "O Notifica.ai monitora páginas da internet escolhidas pelo usuário e avisa quando o conteúdo muda. No plano Pro, também resume as mudanças com inteligência artificial, procura o nome do usuário em diários oficiais (Radar do Diário Oficial) e envia avisos pelo Telegram. O serviço é fornecido no estado em que se encontra, sem garantia de disponibilidade contínua."
          },
          {
            titulo: "2. Uso aceitável",
            texto: "Você concorda em usar o serviço apenas para fins lícitos. É proibido monitorar páginas que exijam autenticação sem autorização, realizar scraping em larga escala, tentar burlar os limites do plano ou usar o serviço para violar direitos de terceiros. No Radar do Diário Oficial, você só pode cadastrar o seu próprio nome ou o de quem autorizou expressamente."
          },
          {
            titulo: "3. Plano gratuito",
            texto: "O plano gratuito permite até 3 alertas ativos simultaneamente, com checagem a cada 6 horas. Esses limites podem ser alterados mediante aviso prévio por e-mail."
          },
          {
            titulo: "4. Plano Pro, preço e renovação",
            texto: "O plano Pro oferece alertas ilimitados, checagens mais frequentes e os recursos descritos na página de planos, pelo preço ali informado. A assinatura no cartão é renovada automaticamente todo mês até ser cancelada. O pagamento via Pix libera o Pro pelo período comprado (30 dias ou 1 ano) e não é renovado automaticamente. Os pagamentos são processados pelo Mercado Pago. Mudanças de preço são avisadas por e-mail com pelo menos 30 dias de antecedência e não afetam períodos já pagos."
          },
          {
            titulo: "5. Teste grátis",
            texto: "Cada conta pode usar uma única vez o teste grátis do Pro, pelo número de dias informado na página de planos, sem precisar cadastrar cartão. Ao fim do teste, a conta volta automaticamente ao plano gratuito e os alertas acima do limite ficam pausados, sem cobrança."
          },
          {
            titulo: "6. Cancelamento e reembolso",
            texto: "Você pode cancelar a assinatura a qualquer momento na página de planos; o acesso Pro continua até o fim do período já pago. Conforme o art. 49 do Código de Defesa do Consumidor, você pode desistir da primeira contratação em até 7 dias e receber o valor integral de volta — basta pedir pelo e-mail de contato. Fora desse prazo, não há reembolso proporcional de períodos já iniciados."
          },
          {
            titulo: "7. Radar do Diário Oficial",
            texto: "O Radar procura os dados cadastrados em diários oficiais públicos das cidades listadas, usando fontes de terceiros (como o projeto Querido Diário). Não garantimos que todas as publicações sejam encontradas: atrasos, falhas das fontes, diferenças de grafia, homônimos e documentos em imagem podem impedir ou distorcer a detecção. Confira sempre as informações diretamente na publicação oficial."
          },
          {
            titulo: "8. Resumos por inteligência artificial",
            texto: "Os resumos de mudanças são gerados automaticamente por inteligência artificial e podem conter erros ou omissões. Eles não substituem a leitura do documento oficial, que é sempre a referência."
          },
          {
            titulo: "9. Responsabilidade",
            texto: "O Notifica.ai não se responsabiliza por perdas decorrentes de falhas no monitoramento, atrasos na entrega de notificações ou indisponibilidade do serviço. O usuário é responsável por verificar as informações diretamente nas fontes originais."
          },
          {
            titulo: "10. Encerramento da conta",
            texto: "Você pode cancelar um alerta pelo link presente em cada e-mail e excluir sua conta a qualquer momento na página Minha conta — a assinatura no cartão, se houver, é cancelada antes. Podemos suspender contas que violem estes termos."
          },
          {
            titulo: "11. Alterações nos termos",
            texto: "Podemos atualizar estes termos periodicamente. Mudanças significativas serão comunicadas por e-mail. O uso continuado do serviço após a notificação implica aceite dos novos termos."
          },
          {
            titulo: "12. Contato",
            texto: "Dúvidas, pedidos de reembolso ou de exclusão de dados: aisha.paola14@gmail.com"
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