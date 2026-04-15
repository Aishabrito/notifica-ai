# Notifica.ai 🔔

> *Pare de ficar atualizando a página. A gente te avisa.*

## 💡 A história por trás do projeto

Quem já ficou abrindo o site do vestibular ou do concurso a cada 5 minutos esperando um resultado sabe como é ansioso. Eu passei por isso — e resolvi acabar com essa situação de uma vez.

O **Notifica.ai** nasceu de um problema real: a angústia de esperar uma atualização em uma página sem saber quando ela vai acontecer. A solução é simples — você nos diz o site, a gente monitora, e só te avisamos quando algo mudar. Sem ansiedade, sem página aberta, sem perder a vaga.

---

## 🚀 O que o Notifica.ai faz

- 🔍 **Monitora qualquer site** automaticamente
- 📧 **Envia e-mail de alerta** quando detecta mudança no conteúdo
- 🤖 **Vigia automático** que checa os sites a cada 6 horas
- ❌ **Cancelamento fácil** direto pelo e-mail, sem precisar de login
- 🎯 **Feito para** vestibulandos, universitários e concurseiros

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Função |
|---|---|
| React.js + Vite | Interface do usuário |
| Tailwind CSS | Estilização responsiva |

### Backend
| Tecnologia | Função |
|---|---|
| Node.js + Express | Servidor e API REST |
| Mongoose | Modelagem e conexão com banco |
| Axios + Cheerio | Web scraping dos sites monitorados |
| Resend | Envio de e-mails transacionais |
| Node-cron | Agendamento do Vigia automático |

### Banco de Dados & Infraestrutura
| Tecnologia | Função |
|---|---|
| MongoDB Atlas | Banco NoSQL na nuvem (gratuito) |
| Vercel | Deploy do frontend |
| Render | Deploy do backend |
| dotenv | Gestão segura de variáveis de ambiente |

---

## 🏗️ Arquitetura do Projeto

```
notifica-ai/
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       └── App.jsx    # Interface principal
│
└── backend/           # Node.js + Express
    ├── server.js      # API + Vigia (Cron Job)
    ├── .env           # Variáveis de ambiente (não versionado)
    └── .gitignore
```

### Fluxo de funcionamento

```
Usuário insere URL + e-mail
        ↓
Backend faz Web Scraping do site
        ↓
Salva alerta no MongoDB
        ↓
Envia e-mail de confirmação
        ↓
Vigia checa o site a cada 6h
        ↓
Se mudou → envia e-mail de alerta
```

### O Vigia (Cron Job)

O coração do produto. Um processo agendado que:
1. Busca todos os alertas ativos no banco
2. Acessa cada site e gera uma "impressão digital" (hash MD5) do conteúdo
3. Compara com a impressão digital anterior
4. Se diferente → dispara o e-mail de alerta e atualiza o hash

---

## ⚙️ Contribuindo

Quer rodar o projeto localmente ou contribuir? Abre uma [issue](https://github.com/Aishabrito/notifica-ai/issues) ou me chama no LinkedIn!

---

## 🌐 Deploy

| Serviço | URL |
|---|---|
| Frontend | [notifica.dev.br](https://notifica.dev.br) |
| Backend | [notifica.dev.br/api](https://notifica.dev.br/api) |

---

## 🔒 Segurança

- Credenciais protegidas via variáveis de ambiente (`.env`)
- Arquivo `.env` incluído no `.gitignore` — nunca versionado
- E-mails enviados via Resend com domínio próprio verificado (SPF/DKIM/DMARC)

---

## 🗺️ Roadmap

- [ ] Painel do usuário com login (JWT)
- [ ] Notificação por WhatsApp
- [ ] Histórico de mudanças detectadas
- [ ] Plano premium com checagem a cada 30 minutos
- [ ] Detecção inteligente de seção específica da página

---

## 👩‍💻 Sobre

Desenvolvido por **Aisha** — estudante de Engenharia Eletrônica e de Computação na UFRJ.

Projeto construído do zero como aplicação full-stack real, desde a ideia até o deploy em produção.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Aísha_Brito-blue)](https://www.linkedin.com/in/a%C3%ADsha-brito-9567bb226/)
[![GitHub](https://img.shields.io/badge/GitHub-Aishabrito-black)](https://github.com/Aishabrito)
