const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3992', RESEND_API_KEY: 're_fake', BASE_URL: 'https://api.notifica.dev.br', FRONTEND_URL: 'https://notifica.dev.br',
    TELEGRAM_BOT_TOKEN: '123:ABC', TELEGRAM_BOT_USERNAME: 'NotificaAiBot', TELEGRAM_WEBHOOK_SECRET: 'segredo_webhook_123', DADOS_CHAVE: crypto.randomBytes(32).toString('base64'), QUERIDO_DIARIO_API: 'http://127.0.0.1:4567' });
  delete process.env.GEMINI_API_KEY;

  // stub da API do Telegram
  const axios = require(B + '/node_modules/axios');
  const tg = []; let bloqueado = new Set();
  const postOriginal = axios.post;
  axios.post = async (url, body, opts) => {
    if (!url.startsWith('https://api.telegram.org/')) return postOriginal(url, body, opts);
    tg.push({ metodo: url.split('/').pop(), token: url.split('/')[3], body });
    if (body.chat_id && bloqueado.has(String(body.chat_id))) { const e = new Error('Forbidden'); e.response = { status: 403, data: { description: 'Forbidden: bot was blocked by the user' } }; throw e; }
    return { data: { ok: true } };
  };
  // sites e Querido Diário locais
  const paginas = { '/p': 'Prova em 10/05' };
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/gazettes')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ gazettes: [{ date: '2026-10-05', territory_id: '3304557', url: 'https://do.rio/x.pdf', excerpts: ['Nomeia CARLA MENDES SOUZA para o cargo'] }] })); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<html><body><main><p>${paginas[req.url] || ''}</p></main></body></html>`);
  });
  await new Promise(r => srv.listen(4567, '0.0.0.0', r));

  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(1200);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3992';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const webhook = async (update, segredo = 'segredo_webhook_123') => (await fetch(base + '/api/webhooks/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': segredo }, body: JSON.stringify(update) })).status;
  const msg = (chatId, text, type = 'private') => ({ update_id: 1, message: { message_id: 1, chat: { id: chatId, type }, text } });
  const PRO = { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' };

  const sw = tg.find(c => c.metodo === 'setWebhook');
  ok(sw && sw.body.url === 'https://api.notifica.dev.br/api/webhooks/telegram' && sw.body.secret_token === 'segredo_webhook_123' && sw.token === 'bot123:ABC', 'ao iniciar, registra o webhook no Telegram com o segredo');

  const free = await Usuario.create({ nome: 'Free User', email: 'free@x.com', senha: '12345678' });
  const ana = await Usuario.create({ nome: 'Ana Lima', email: 'ana@x.com', senha: '12345678', plano: PRO });
  const tA = jwt.sign({ id: ana._id }, 'x');
  let r = await call('GET', '/api/plano', tA);
  ok(r.data.canais.telegram.disponivel === true && r.data.canais.telegram.conectado === false, '/api/plano informa o canal Telegram');
  r = await call('POST', '/api/telegram/conectar', jwt.sign({ id: free._id }, 'x'));
  ok(r.status === 403, 'Free não conecta Telegram');
  r = await call('POST', '/api/telegram/conectar', tA);
  const codigo = r.data.link?.split('start=')[1];
  ok(r.status === 200 && r.data.link.startsWith('https://t.me/NotificaAiBot?start=') && /^[A-Za-z0-9_-]{20,64}$/.test(codigo), 'gera link t.me com código de uso único');
  const bruto = await mongoose.connection.collection('usuarios').findOne({ _id: ana._id });
  ok(!JSON.stringify(bruto).includes(codigo) && bruto.telegram.codigoHash.length === 64, 'no banco só fica o hash do código');

  ok(await webhook(msg(555, `/start ${codigo}`), 'errado') === 401, 'webhook sem o segredo certo → 401');
  tg.length = 0;
  ok(await webhook(msg(555, `/start ${codigo}`)) === 200, 'webhook válido → 200');
  ok((await Usuario.findById(ana._id)).telegram.chatId === '555' && tg[0]?.body.text.includes('Pronto, Ana'), '/start com código conecta o chat e confirma');
  tg.length = 0;
  await webhook(msg(777, `/start ${codigo}`));
  ok(tg[0]?.body.text.includes('expirou') && (await Usuario.findById(ana._id)).telegram.chatId === '555', 'código já usado não conecta outro chat');
  r = await call('POST', '/api/telegram/conectar', tA);
  const vencido = r.data.link.split('start=')[1];
  await Usuario.updateOne({ _id: ana._id }, { 'telegram.codigoExpira': new Date(Date.now() - 1000) });
  tg.length = 0; await webhook(msg(888, `/start ${vencido}`));
  ok(tg[0]?.body.text.includes('expirou'), 'código com mais de 15 min não vale');
  tg.length = 0; await webhook(msg(999, 'oi'));
  ok(tg[0]?.body.text.includes('Conectar Telegram'), 'mensagem qualquer → instruções');
  tg.length = 0; await webhook(msg(-100123, '/start x', 'group'));
  ok(tg.length === 0, 'mensagens de grupo são ignoradas');
  r = await call('GET', '/api/plano', tA);
  ok(r.data.canais.telegram.conectado === true, 'painel mostra conectado');

  // ── alerta de mudança chega no Telegram (Pro conectado)
  const crypto2 = require('crypto');
  const { OPCOES_DOWNLOAD, interpretarResposta } = require(B + '/src/utils/conteudoPagina');
  const mk = async (u, h) => { const url = `http://127.0.0.${h}:4567/p`; const pg = await interpretarResposta(await axios.get(url, OPCOES_DOWNLOAD), { url }); return Alerta.create({ url, email: u.email, titulo: 'Concurso <XYZ>', usuario: u._id, hashConteudo: crypto2.createHash('md5').update(pg.texto).digest('hex'), ultimoConteudo: pg.texto, proximaVerificacao: new Date(Date.now() - 1000) }); };
  await mk(ana, 2); await mk(free, 3);
  paginas['/p'] = 'Prova em 20/05';
  tg.length = 0;
  const { executarRodada } = require(B + '/src/service/agendador');
  await executarRodada(); await sleep(300);
  const tgMud = tg.filter(c => c.metodo === 'sendMessage');
  ok(tgMud.length === 1 && tgMud[0].body.chat_id === '555' && tgMud[0].body.parse_mode === 'HTML' && tgMud[0].body.text.includes('Mudança detectada') && tgMud[0].body.text.includes('Concurso &lt;XYZ&gt;'), 'mudança: Pro conectado recebe no Telegram (HTML escapado); Free não');
  ok(sent.filter(m => m.subject.startsWith('🚨')).length === 2, 'e-mails continuam indo normalmente');

  // ── Radar também avisa no Telegram
  await Usuario.updateOne({ _id: ana._id }, { emailVerificado: true });
  await call('POST', '/api/radar', tA, { nome: 'Carla Mendes Souza', cidades: ['3304557'], consentimento: true });
  const mon = await require(B + '/src/models/MonitorRadar').findOne({ usuario: ana._id });
  tg.length = 0;
  await call('POST', `/api/radar/${mon._id}/buscar`, tA); await sleep(300);
  const tgRadar = tg.find(c => c.metodo === 'sendMessage');
  ok(tgRadar && tgRadar.body.text.includes('Diário Oficial') && tgRadar.body.text.includes('Rio de Janeiro') && !tgRadar.body.text.includes('CARLA'), 'Radar: aviso no Telegram (sem repetir o trecho com o nome — esse vai por e-mail)');

  // ── bot bloqueado pela pessoa → desconecta sozinho
  bloqueado.add('555');
  paginas['/p'] = 'Prova em 30/05';
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(300);
  ok((await Usuario.findById(ana._id)).telegram.chatId === null, 'bot bloqueado (403) → chat desconectado automaticamente');
  bloqueado.clear();

  // ── um chat por conta + /parar + desconectar pelo site
  const bia = await Usuario.create({ nome: 'Bia Rocha', email: 'bia@x.com', senha: '12345678', plano: PRO });
  const tB = jwt.sign({ id: bia._id }, 'x');
  await Usuario.updateOne({ _id: ana._id }, { 'telegram.chatId': '1000' });
  const cB = (await call('POST', '/api/telegram/conectar', tB)).data.link.split('start=')[1];
  await webhook(msg(1000, `/start ${cB}`));
  ok((await Usuario.findById(bia._id)).telegram.chatId === '1000' && (await Usuario.findById(ana._id)).telegram.chatId === null, 'mesmo chat em outra conta: a conta anterior é desligada');
  tg.length = 0; await webhook(msg(1000, '/parar'));
  ok((await Usuario.findById(bia._id)).telegram.chatId === null && tg[0].body.text.includes('Desconectado'), '/parar desconecta');
  await Usuario.updateOne({ _id: bia._id }, { 'telegram.chatId': '2000' });
  tg.length = 0; r = await call('DELETE', '/api/telegram', tB);
  ok(r.status === 200 && (await Usuario.findById(bia._id)).telegram.chatId === null && tg[0]?.body.chat_id === '2000', 'desconectar pelo site avisa o chat e desliga');

  // ── perdeu o Pro: não recebe mais no Telegram
  await Usuario.updateOne({ _id: bia._id }, { 'telegram.chatId': '3000', plano: { tipo: 'free', status: 'ativo' } });
  await mk(await Usuario.findById(bia._id), 4);
  paginas['/p'] = 'Prova em 31/05';
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  tg.length = 0; await executarRodada(); await sleep(300);
  ok(!tg.some(c => c.body.chat_id === '3000'), 'sem Pro, nada no Telegram (mesmo conectado)');

  delete process.env.TELEGRAM_BOT_TOKEN;
  r = await call('POST', '/api/telegram/conectar', tA);
  ok(r.status === 503, 'sem TELEGRAM_BOT_TOKEN → 503');
  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
