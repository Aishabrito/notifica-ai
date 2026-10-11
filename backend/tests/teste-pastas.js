// Pastas compartilháveis
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3986',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', FRONTEND_URL: 'https://notifica.dev.br', FREE_MAX_ALERTAS: '1',
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3986' + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  const ana = await Usuario.create({ nome: 'Ana Souza', email: 'ana@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const bia = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const caio = await Usuario.create({ nome: 'Caio', email: 'caio@x.com', senha: '12345678' });
  const ta = jwt.sign({ id: ana._id }, 'x'), tb = jwt.sign({ id: bia._id }, 'x'), tc = jwt.sign({ id: caio._id }, 'x');
  const mk = (u, url, titulo) => Alerta.create({ url, titulo, email: u.email, usuario: u._id, hashConteudo: 'h' });
  const a1 = await mk(ana, 'http://127.0.0.1:9/edital', 'Edital TJ');
  const a2 = await mk(ana, 'http://127.0.0.1:9/gabarito', 'Gabarito TJ');
  const a3 = await mk(ana, 'http://127.0.0.1:9/resultado', 'Resultado TJ');
  const daBia = await mk(bia, 'http://127.0.0.1:9/gabarito', 'Gabarito TJ');

  // ── criar
  let r = await call('POST', '/api/pastas', ta, { nome: 'Concurso TJ-RJ 2026', descricao: 'Tudo do TJ', alertas: [a1._id, a2._id, a3._id, daBia._id] });
  const pasta = r.data.pasta;
  ok(r.status === 201 && pasta.alertas.length === 3 && !pasta.link, 'cria a pasta só com os próprios alertas (o da outra pessoa é ignorado); ainda não compartilhada');
  r = await call('POST', '/api/pastas', ta, { nome: '' });
  ok(r.status === 400, 'pasta sem nome é recusada');

  // ── compartilhar
  r = await call('PATCH', `/api/pastas/${pasta.id}`, ta, { compartilhar: true });
  const link = r.data.pasta.link;
  const token = link.split('/p/')[1];
  ok(/^https:\/\/notifica\.dev\.br\/p\/[A-Za-z0-9_-]{12}$/.test(link), 'compartilhar gera link público');
  r = await call('GET', `/api/pastas/publica/${token}`);
  ok(r.status === 200 && r.data.pasta.itens.length === 3 && r.data.pasta.autor === 'Ana' && !JSON.stringify(r.data).includes('ana@x.com'), 'qualquer pessoa vê a pasta pelo link (só o primeiro nome de quem criou, sem e-mail)');
  r = await call('PATCH', `/api/pastas/${pasta.id}`, tb, { compartilhar: false });
  ok(r.status === 404, 'só a dona mexe na pasta');

  // ── copiar
  r = await call('POST', `/api/pastas/publica/${token}/copiar`);
  ok(r.status === 401, 'copiar exige login');
  r = await call('POST', `/api/pastas/publica/${token}/copiar`, tb);
  ok(r.data.copiados === 2 && r.data.jaMonitorados === 1 && await Alerta.countDocuments({ usuario: bia._id }) === 3, 'Pro copia: adiciona as 2 que faltavam e pula a que já monitorava');
  const novo = await Alerta.findOne({ usuario: bia._id, url: 'http://127.0.0.1:9/edital' });
  ok(novo.hashConteudo == null && novo.proximaVerificacao <= new Date() && novo.email === 'bia@x.com', 'alerta copiado começa sem base (a 1ª checagem só guarda a versão) e no e-mail de quem copiou');
  r = await call('POST', `/api/pastas/publica/${token}/copiar`, tc);
  ok(r.data.copiados === 1 && r.data.semEspaco === 2 && /não couberam/.test(r.data.mensagem), 'Free copia só até o limite do plano e avisa o que não coube');
  r = await call('GET', `/api/pastas/publica/${token}`);
  ok(r.data.pasta.copias === 2, 'contador de cópias');

  // ── parar de compartilhar / trocar link
  r = await call('PATCH', `/api/pastas/${pasta.id}`, ta, { compartilhar: 'novo' });
  ok((await call('GET', `/api/pastas/publica/${token}`)).status === 404 && r.data.pasta.link !== link, 'gerar link novo invalida o antigo');
  r = await call('PATCH', `/api/pastas/${pasta.id}`, ta, { compartilhar: false });
  ok(r.data.pasta.link === null, 'parar de compartilhar');

  // ── alerta apagado some da pasta; apagar pasta não apaga alertas
  await Alerta.deleteOne({ _id: a3._id });
  r = await call('GET', '/api/pastas', ta);
  ok(r.data.pastas[0].alertas.length === 2, 'alerta removido some da pasta');
  r = await call('DELETE', `/api/pastas/${pasta.id}`, ta);
  ok(r.status === 200 && await Alerta.countDocuments({ usuario: ana._id }) === 2, 'apagar a pasta mantém os alertas');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
