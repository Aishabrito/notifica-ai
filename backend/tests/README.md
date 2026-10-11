# Testes do backend

Testes de integração: sobem o servidor de verdade contra um MongoDB local e
simulam toda a rede externa (Mercado Pago, Gemini, Telegram, Querido Diário,
Resend). Nenhuma chamada real é feita e nada é cobrado.

```bash
# 1. MongoDB local (uma vez)
docker run -d --name mongo-testes -p 27017:27017 mongo:7

# 2. Rodar tudo
cd backend
npm test
```

⚠️ Os testes usam o banco `notifica_testes` em `127.0.0.1:27017` e o **apagam**
ao começar. Nunca aponte esses testes para o banco de produção.

Cada arquivo `teste-*.js` também pode rodar sozinho: `node tests/teste-radar.js`.
