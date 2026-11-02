# Notifica.ai 🔔

> *Pare de ficar atualizando a página. A gente te avisa.*

## 💡 A história por trás do projeto

Quem já ficou abrindo o site do vestibular, edital ou concurso a cada 5 minutos esperando um resultado sabe o quanto isso é desgastante. Eu passei por isso — e resolvi criar uma solução prática e automatizada.

O **Notifica.ai** nasceu de um problema real: a angústia de esperar uma atualização em uma página sem saber quando ela vai acontecer. A aplicação monitora URLs cadastradas e notifica os usuários por e-mail no momento exato em que qualquer alteração de conteúdo for detectada.

---

## 🚀 O que o Notifica.ai faz

- 🔍 **Monitoramento de páginas:** a pessoa cola o link (site da banca, SISU, edital em PDF) e é avisada quando o conteúdo muda.
- ⚡ **Teste agora (sem cadastro):** mostra na hora se conseguimos ler a página.
- 🤖 **Resumo com IA (Pro):** em vez do diff, uma frase dizendo o que mudou, com as datas virando prazos.
- 📰 **Radar do Diário Oficial (Pro):** procura o nome da pessoa no DOU e nos diários municipais e reconhece nomeação e convocação.
- 📅 **Calendário e Prazos:** ENEM, SISU e concursos, com aviso 7 dias antes, na véspera e no dia. Código Vermelho para prazos curtos.
- 📈 **Posição na lista de espera:** histórico das chamadas, quanto falta e estimativa no ritmo atual.
- 🔔 **Avisos por e-mail, no celular (Web Push, app instalável) e no Telegram.**
- 💎 **Planos Free e Pro:** Free com 1 página a cada 6h; Pro ilimitado, a cada 15 min, pago com cartão ou Pix pelo Mercado Pago.
- 👑 **Painel administrativo:** métricas, saúde do crawler, tarefas automáticas, feedbacks e gestão do calendário.

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Função |
|---|---|
| React.js + Vite | Interface SPA rápida e reativa |
| Tailwind CSS | Estilização moderna e responsiva |

### Backend
| Tecnologia | Função |
|---|---|
| Node.js + Express | API RESTful e orquestração de serviços |
| JWT & Cookie-Parser | Autenticação e controle de sessões seguras |
| Mongoose | Modelagem e persistência no banco de dados |
| Axios + Cheerio | Extração e sanitização do DOM (Web Scraping) |
| Resend | Envio de e-mails transacionais com alta entregabilidade |
| Node-cron | Agendamento automatizado de tarefas em segundo plano |

### Banco de Dados & Infraestrutura
| Tecnologia | Função |
|---|---|
| MongoDB Atlas | Banco de dados NoSQL gerenciado em nuvem |
| Vercel | Hospedagem e CI/CD do frontend |
| Render | Hospedagem e deploy contínuo da API backend |
| Express Rate Limit | Proteção contra abusos e rate limiting de rotas sensíveis |

---

## 🏗️ Arquitetura do Projeto

notifica-ai/
├── frontend/                 # React + Vite + Tailwind
│   └── src/
│       ├── components/       # Componentes reutilizáveis
│       ├── pages/            # Painel do usuário, Admin, Login, Cadastro
│       └── App.jsx           # Roteamento e layout principal
│
└── backend/                  # Node.js + Express
├── src/
│   ├── middleware/       # Autenticação e middlewares customizados
│   ├── models/           # Schemas (Alerta, Usuário, LogCron, Feedback)
│   ├── routes/           # Rotas (Auth, Alertas, Admin, Feedbacks)
│   ├── service/          # Crawler e motor de scraping
│   └── utils/            # Utilitários (Mailer, sanitização, headers)
├── server.js             # Ponto de entrada da API + Cron Job
├── .env                  # Variáveis de ambiente (não versionado)
└── .gitignore


### Fluxo de Funcionamento

Usuário logado cadastra URL (+ seletor opcional)
↓
Backend valida segurança (anti-SSRF) e extrai conteúdo limpo
↓
Gera hash MD5 inicial e persiste no MongoDB
↓
Dispara e-mail de confirmação com Resend
↓
Vigia confere no intervalo do plano (6h no Free, até 15 min no Pro)
↓
Detectou diferença no hash? → Dispara alerta por e-mail e registra log


### O Vigia (Cron Job)

A cada 5 minutos (horário de Brasília) o agendador pega os alertas cuja próxima checagem já venceu, conforme o intervalo de cada plano, e executa o ciclo:
1. Reserva os alertas vencidos (sem duplicar entre instâncias).
2. Executa requisições controladas e gera a "impressão digital" (hash MD5) do conteúdo limpo/seletor.
3. Compara o hash atual com o estado anterior armazenado.
4. Se houver divergência, envia o alerta por e-mail, atualiza o hash de referência e persiste as métricas da execução na coleção `LogCron`.

---

## 🔒 Segurança

- **Proteção Anti-SSRF:** Bloqueio dinâmico contra requisições direcionadas a IPs privados/internos e localhost.
- **Rate Limiting:** Restrição de taxa em endpoints críticos para mitigar ataques de força bruta e abusos.
- **Autenticação:** Tokens JWT trafegados em cookies seguros.
- **Variáveis de Ambiente:** Isolamento completo de chaves e segredos via `.env`.
- **Entregabilidade:** E-mails configurados com autenticações SPF, DKIM e DMARC em domínio próprio.

---

## 🌐 Deploy

| Serviço | URL |
|---|---|
| Frontend | [notifica.dev.br](https://notifica.dev.br) |
| Backend | [notifica.dev.br/api](https://notifica.dev.br/api) |

---

## 🗺️ Roadmap

- [x] Autenticação de usuários e controle de sessões via JWT
- [x] Painel administrativo com métricas e logs operacionais
- [x] Suporte à filtragem por seletor CSS específico
- [x] Plano Pro com checagem a cada 15 min (Mercado Pago)
- [x] Notificação no celular (Web Push) e no Telegram
- [x] Resumo da mudança com IA e Radar do Diário Oficial
- [x] Calendário ENEM/SISU/concursos com lembretes
- [ ] Notificações via WhatsApp / Webhook

---

## 👩‍💻 Sobre a Desenvolvedora

Desenvolvido por **Aísha Brito** — graduanda em Ciência da Computação no **CEFET/RJ**.

Projeto arquitetado e desenvolvido do zero como uma aplicação full-stack em produção.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Aísha_Brito-blue)](https://www.linkedin.com/in/a%C3%ADsha-brito-9567bb226/)
[![GitHub](https://img.shields.io/badge/GitHub-Aishabrito-black)](https://github.com/Aisha