# Colocar no ar: checklist de produção

Tudo o que precisa estar preenchido para o site funcionar completo para o usuário.
Depois de cada mudança no Render, o serviço reinicia sozinho. A aba **Tarefas**
do painel admin (`/admin`) avisa o que ainda falta configurar.

## 1. Backend no Render (Environment)

### Obrigatórias: sem elas o site não funciona

| Variável | O que é | Onde conseguir |
|---|---|---|
| `MONGODB_URI` | Banco de dados | MongoDB Atlas → Connect → Drivers |
| `JWT_SECRET` | Segredo do login | Texto longo e aleatório. Trocar desloga todo mundo |
| `BASE_URL` | Endereço público da API (links de cancelar alerta) | `https://notifica.dev.br` |
| `FRONTEND_URL` | Endereço do site (volta do pagamento, links dos e-mails) | `https://notifica.dev.br` |
| `CORS_ORIGINS` | Sites que podem chamar a API | `https://notifica.dev.br` |
| `RESEND_API_KEY` | Envio de e-mail | resend.com → API Keys |
| `EMAIL_REMETENTE` | Remetente dos e-mails | `noreply@notifica.dev.br` (domínio verificado no Resend) |

### Pagamentos (Mercado Pago)

| Variável | O que é |
|---|---|
| `MP_ACCESS_TOKEN` | Credencial de **produção** (começa com `APP_USR-`) |
| `MP_PUBLIC_KEY` | Chave pública da mesma tela |
| `MP_WEBHOOK_SECRET` | "Assinatura secreta" do webhook |
| `MP_PRECO_MENSAL`, `MP_PRECO_SEMESTRAL`, `MP_PRECO_ANUAL` | Preços (padrão 20, 75 e 120) |

No painel do Mercado Pago (Suas integrações → sua aplicação → **Webhooks**):

- URL: `https://notifica.dev.br/api/webhooks/mercadopago` (o `BASE_URL` + `/api/webhooks/mercadopago`)
- Eventos: **Pagamentos** e **Planos e assinaturas**
- Copie a "assinatura secreta" para `MP_WEBHOOK_SECRET`

Para testar antes de cobrar de verdade: use as credenciais de **teste** e os
cartões de teste do Mercado Pago, faça uma assinatura e um Pix, e confira a aba
**Pagamentos** do admin. Depois troque para as credenciais de produção.

O que o sistema já faz sozinho com os pagamentos:
- Pix aprovado: libera o Pro na hora (a tela consulta a cada 5 s e o webhook confirma).
- Cartão recusado na renovação: e-mail para a pessoa, uma vez por cobrança.
- Assinatura encerrada pelo Mercado Pago: e-mail dizendo até quando o Pro vale.
- Pix devolvido ou contestado: tira os dias de Pro e abre tarefa urgente no admin.
- Estorno ou contestação no cartão: tarefa urgente no admin (cancele a assinatura se o dinheiro voltou).

### Recursos do Pro

| Variável | Para quê | Como gerar |
|---|---|---|
| `DADOS_CHAVE` | Radar do Diário Oficial (cifra nomes e CPF) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **guarde uma cópia**: se perder, os nomes cadastrados não podem ser lidos |
| `GEMINI_API_KEY` | Resumo das mudanças com IA | aistudio.google.com/apikey |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificação no celular | `npx web-push generate-vapid-keys` — gere **uma vez só**; trocar desativa quem já ativou |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Avisos no Telegram | @BotFather → /newbot |

### Opcionais

| Variável | Padrão | Para quê |
|---|---|---|
| `EMAIL_ADMIN` | contas admin | Quem recebe "alerta pausado por falhas" |
| `PRO_CORTESIA_EMAILS` | — | Outras contas Pro sem pagar |
| `RADAR_CIDADES` | todas | Restringir as cidades do Radar |
| `FREE_INTERVALO_HORAS` | 6 | Frequência do plano grátis (6, 12 ou 24) |
| `FREE_MAX_ALERTAS` | 1 | Páginas no plano grátis |
| `TESTE_GRATIS_DIAS` | 7 | Dias do teste grátis do Pro |
| `INDICACAO_DIAS_BONUS` | 30 | Dias que quem indica ganha |

A lista completa, com explicações, está em `backend/.env.example`.

## 2. Frontend no Vercel

| Variável | Valor |
|---|---|
| `VITE_API_URL` | Endereço da API (o mesmo do `BASE_URL`) |

Mudou a variável? Faça um novo deploy: o Vite grava o valor na hora do build.

## 3. E-mail (Resend)

- Domínio `notifica.dev.br` verificado (SPF, DKIM e DMARC no DNS).
- Os avisos de mudança têm "cancelar inscrição" de 1 clique (Gmail/Outlook pedem isso).
- Se o Resend falhar, o sistema tenta de novo (até 3 vezes). Se o aviso de mudança
  não sair, abre a tarefa "E-mail de mudança não foi enviado" no admin.

## 4. Conta de administrador

O painel fica em `/admin` e só abre para contas com `role: "admin"`. Para dar
acesso a outra pessoa: MongoDB Atlas → Browse Collections → `usuarios` →
documento da pessoa → mude `role` para `"admin"`.

## 5. Depois de cada deploy

1. Entre em `/admin` → **Tarefas**: nada de "Configurar: ..." pendente.
2. **Tarefas** → os modelos prontos são conferidos às segundas; se algum quebrar, aparece lá.
3. **Calendário**: confira e publique (ícone do olho) as datas de concurso que entraram ocultas.
4. Faça um teste de verdade: cadastre uma página, ative a notificação no celular
   em **Minha conta** e mande uma mensagem pelo botão de feedback (ela aparece em
   **Reclamações e sugestões**).
