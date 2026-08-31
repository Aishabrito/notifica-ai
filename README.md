# Notifica.ai 🔔

> *Pare de ficar atualizando a página. A gente te avisa.*

## 💡 A história por trás do projeto

Quem já ficou abrindo o site do vestibular, edital ou concurso a cada 5 minutos esperando um resultado sabe o quanto isso é desgastante. Eu passei por isso — e resolvi criar uma solução prática e automatizada.

O **Notifica.ai** nasceu de um problema real: a angústia de esperar uma atualização em uma página sem saber quando ela vai acontecer. A aplicação monitora URLs cadastradas e notifica os usuários por e-mail no momento exato em que qualquer alteração de conteúdo for detectada.

---

## 🚀 O que o Notifica.ai faz

- 🔍 **Monitoramento inteligente:** Web scraping automatizado com suporte a seletores CSS customizados.
- 🔐 **Autenticação segura:** Cadastro e login com autenticação via JWT armazenado em cookies HTTP-only.
- 📊 **Painel do Usuário:** Gerenciamento centralizado de alertas (criação, listagem, remoção e reativação).
- 👑 **Painel Administrativo:** Dashboard robusto com métricas globais, feedbacks e histórico de logs de execução do Vigia.
- 🤖 **O Vigia (Cron Job):** Rotina diária agendada (às 10h e 15h) para varredura e detecção de mudanças.
- 📧 **Notificações por e-mail:** Alertas automáticos e e-mails de confirmação transacionais com link direto de cancelamento.

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
Vigia executa varredura (10h e 15h)
↓
Detectou diferença no hash? → Dispara alerta por e-mail e registra log


### O Vigia (Cron Job)

O motor de automação opera em horários programados (10:00 e 15:00 - Horário de Brasília) executando o seguinte ciclo:
1. Busca todos os alertas ativos no banco de dados.
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
- [ ] Notificações instantâneas via WhatsApp / Webhook
- [ ] Histórico visual de mudanças detectadas no DOM
- [ ] Plano com checagem em intervalos reduzidos (ex: a cada 30 min)

---

## 👩‍💻 Sobre a Desenvolvedora

Desenvolvido por **Aísha Brito** — graduanda em Ciência da Computação no **CEFET/RJ**.

Projeto arquitetado e desenvolvido do zero como uma aplicação full-stack em produção.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Aísha_Brito-blue)](https://www.linkedin.com/in/a%C3%ADsha-brito-9567bb226/)
[![GitHub](https://img.shields.io/badge/GitHub-Aishabrito-black)](https://github.com/Aisha