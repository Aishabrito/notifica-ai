// Notificação no celular (Web Push)
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let versao = 1;
const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<html><body><main><p>Lista versão ${versao}</p></main></body></html>`); });

(async () => {
  await new Promise(r => srv.listen(4586, '127.0.0.1', r));
  const webpush = require(B + '/node_modules/web-push');
  const chaves = webpush.generateVAPIDKeys();
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3983',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', VAPID_PUBLIC_KEY: chaves.publicKey, VAPID_PRIVATE_KEY: chaves.privateKey,
  });
  delete process.env.GEMINI_API_KEY;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};

  // "Servidor de push" simulado
  const enviados = []; let respostaPush = null;
  const push = require(B + '/src/service/push');
  push._definirEnvio(async (inscricao, corpo) => {
    if (respostaPush) { const e = new Error('gone'); e.statusCode = respostaPush; throw e; }
    enviados.push({ endpoint: inscricao.endpoint, ...JSON.parse(corpo) });
  });

  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3983' + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  let r = await call('GET', '/api/push/chave');
  ok(r.data.disponivel && r.data.chave === chaves.publicKey, 'chave pública disponível para o navegador');

  const u = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678' });
  const t = jwt.sign({ id: u._id }, 'x');
  const inscricao = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123xyz', keys: { p256dh: 'BPx', auth: 'au' } };
  r = await call('POST', '/api/push/inscrever', t, { endpoint: 'http://inseguro', keys: inscricao.keys });
  ok(r.status === 400, 'inscrição com endpoint inválido é recusada');
  r = await call('POST', '/api/push/inscrever', null, inscricao);
  ok(r.status === 401, 'inscrever exige login');
  r = await call('POST', '/api/push/inscrever', t, inscricao);
  ok(r.status === 200 && enviados.length === 1 && enviados[0].titulo.includes('ativadas'), 'ativar manda uma notificação de boas-vindas');
  await call('POST', '/api/push/inscrever', t, inscricao);
  ok((await push.PushInscricao.countDocuments({ usuario: u._id })) === 1, 'o mesmo aparelho não duplica');

  // mudança numa página → push na hora (Free também)
  enviados.length = 0;
  const a = await Alerta.create({ url: 'http://127.0.0.1:4586/lista', titulo: 'Lista UFRJ', email: 'ana@x.com', usuario: u._id, hashConteudo: 'antigo' });
  await executarMonitoramento(await Alerta.find({ _id: a._id }).select('+ultimoConteudo +linksPdf').populate('usuario'));
  await sleep(100);
  ok(enviados.length === 1 && enviados[0].titulo.includes('Lista UFRJ') && enviados[0].url === 'http://127.0.0.1:4586/lista' && enviados[0].urgente, 'página mudou: notificação urgente com link para a página');

  // aparelho desinstalou (410): a inscrição é apagada
  respostaPush = 410;
  await push.enviarPush(u._id, { titulo: 'teste' });
  ok((await push.PushInscricao.countDocuments({ usuario: u._id })) === 0, 'aparelho que desinstalou (410) sai da lista');
  respostaPush = null;

  r = await call('GET', '/api/push/status', t);
  ok(r.data.aparelhos === 0, 'status mostra quantos aparelhos recebem');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
