// "Teste agora" (sem cadastro) e calendário ENEM/SISU/concursos
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const paginas = {
  '/lista': '<html><head><title>UFRJ — Lista de espera</title></head><body><h1>Lista de espera</h1><p>Segunda chamada dos candidatos classificados para matrícula. ' + 'Candidato aprovado na ampla concorrência. '.repeat(10) + '</p><a href="/edital.pdf">Edital</a></body></html>',
  '/vazia': '<html><head><title>App</title></head><body><div id="root"></div><script src="app.js"></script></body></html>',
};
const srv = http.createServer((req, res) => {
  if (!paginas[req.url]) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(paginas[req.url]);
});

(async () => {
  await new Promise(r => srv.listen(4589, '127.0.0.1', r));
  const chaves = require(B + '/node_modules/web-push').generateVAPIDKeys();
  Object.assign(process.env, {
    VAPID_PUBLIC_KEY: chaves.publicKey, VAPID_PRIVATE_KEY: chaves.privateKey,
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3982',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x',
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  const pushes = []; require(B + '/src/service/push')._definirEnvio(async (_i, p) => { pushes.push(JSON.parse(p)); });
  require(B + '/server.js');
  await sleep(1200);
  const Usuario = require(B + '/src/models/Usuario');
  const Prazo = require(B + '/src/models/Prazo');
  const cal = require(B + '/src/service/calendario');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => {
    const headers = { 'Content-Type': 'application/json' }; if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch('http://localhost:3982' + p, { method, headers, body: body && JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => null) };
  };

  // ── Teste agora
  let r = await call('POST', '/api/testar-pagina', null, { url: 'http://127.0.0.1:4589/lista' });
  const pg = r.data?.pagina;
  ok(r.status === 200 && pg.titulo === 'UFRJ — Lista de espera' && pg.tipo === 'html' && pg.pdfs === 1, 'teste agora: lê a página sem login e devolve título e tipo');
  ok(pg.sinais.some((s) => s.tipo === 'lista-espera') && !pg.poucoTexto, 'reconhece que parece lista de espera/chamadas');
  ok(!JSON.stringify(r.data).includes('ampla concorrência'), 'não devolve o conteúdo da página (não vira proxy)');
  r = await call('POST', '/api/testar-pagina', null, { url: 'http://127.0.0.1:4589/vazia' });
  ok(r.status === 200 && r.data.pagina.poucoTexto, 'página montada por JavaScript: avisa que veio quase vazia');
  r = await call('POST', '/api/testar-pagina', null, { url: 'http://127.0.0.1:4589/nao-existe' });
  ok(r.status === 502 && /não conseguimos abrir/i.test(r.data.mensagem), 'página fora do ar: mensagem clara');
  r = await call('POST', '/api/testar-pagina', null, { url: 'ftp://x' });
  ok(r.status === 400, 'link inválido é recusado');
  r = await call('POST', '/api/testar-pagina', null, { url: 'http://127.0.0.1:4589/lista' });
  ok(r.status === 429 && /crie sua conta/i.test(r.data.mensagem), 'limite por minuto: convida a criar conta');

  // ── Calendário (o servidor semeia ao conectar; aqui garantimos antes de olhar)
  // As datas semeadas são reais e ficam no passado com o tempo: o teste não pode depender do relógio
  await cal.semearCalendario();
  const enem = await cal.EventoCalendario.findOne({ chave: 'enem-2026-dia1' });
  const sisu = await cal.EventoCalendario.findOne({ chave: 'sisu-2027-inscricoes' });
  ok(enem?.data === '2026-11-08' && enem.publicado && !enem.previsao && sisu?.previsao === true, 'datas iniciais semeadas (ENEM confirmado, SISU como previsão)');
  const em = (iso) => new Date(`${iso}T11:00:00Z`);
  const titulos = async (iso) => (await cal.proximosEventos(em(iso))).map((e) => e.titulo);
  ok((await titulos('2026-11-02')).includes(enem.titulo) && !(await titulos('2026-11-09')).includes(enem.titulo) && (await titulos('2026-11-09')).includes(sisu.titulo), 'próximas datas: só de hoje em diante');
  r = await call('GET', '/api/calendario');
  ok(r.status === 200 && Array.isArray(r.data.eventos), 'calendário público responde');

  const u = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678', emailVerificado: true });
  const adm = await Usuario.create({ nome: 'Adm', email: 'adm@x.com', senha: '12345678', role: 'admin' });
  await require(B + '/src/service/push').PushInscricao.create({ usuario: u._id, endpoint: 'https://push.x/1', keys: { p256dh: 'a', auth: 'b' } });
  const t = jwt.sign({ id: u._id }, 'x'); const ta = jwt.sign({ id: adm._id }, 'x');

  ok((await call('POST', `/api/calendario/${enem.id}/lembrar`)).status === 401, '"Me avise" sem login pede conta');
  r = await call('POST', `/api/calendario/${enem.id}/lembrar`, t);
  const prazo = await Prazo.findOne({ usuario: u._id, chave: `calendario:${enem.id}` }).lean();
  ok(r.status === 200 && prazo?.data === '2026-11-08' && prazo.tipo === 'prova', '"Me avise" (Free) põe a data em Prazos');
  await call('POST', `/api/calendario/${enem.id}/lembrar`, t);
  ok(await Prazo.countDocuments({ usuario: u._id }) === 1 && (await call('GET', '/api/calendario/meus', t)).data.eventos.includes(enem.id), 'pedir de novo não duplica; aparece em "meus"');

  ok((await call('POST', '/api/calendario/admin', t, { titulo: 'X', publico: 'concurseiro', data: '2026-12-01' })).status === 403, 'só admin cadastra datas');
  r = await call('POST', '/api/calendario/admin', ta, { titulo: 'TJ-RJ — prova objetiva', publico: 'concurseiro', data: '2026-12-01', link: 'javascript:alert(1)' });
  ok(r.status === 400, 'link que não é https é recusado');
  r = await call('POST', '/api/calendario/admin', ta, { titulo: 'TJ-RJ — prova objetiva', publico: 'concurseiro', data: '2026-12-01', link: 'https://www.tjrj.jus.br' });
  ok(r.status === 201 && r.data.evento.publico === 'concurseiro', 'admin cadastra data de concurso');

  // Lembretes: 7 dias antes, véspera e no dia; previsão não dispara
  const dia = (iso) => new Date(`${iso}T11:00:00Z`);
  sent.length = 0; pushes.length = 0;
  ok(await cal.enviarLembretesCalendario(dia('2026-10-31')) === 0, '8 dias antes: nada');
  ok(await cal.enviarLembretesCalendario(dia('2026-11-01')) === 1 && sent[0].subject.includes('faltam 7 dias') && pushes.length === 1, '7 dias antes: e-mail + push');
  ok(await cal.enviarLembretesCalendario(dia('2026-11-01')) === 0, 'não repete o mesmo aviso');
  await cal.enviarLembretesCalendario(dia('2026-11-07'));
  await cal.enviarLembretesCalendario(dia('2026-11-08'));
  ok(sent.length === 3 && sent[1].subject.includes('é amanhã') && sent[2].subject.includes('é hoje'), 'véspera e no dia');
  await call('POST', `/api/calendario/${sisu.id}/lembrar`, t);
  ok(await cal.enviarLembretesCalendario(dia('2027-01-08')) === 0, 'data em previsão não manda lembrete');

  // A equipe muda a data: o prazo acompanha e os avisos recomeçam
  r = await call('PATCH', `/api/calendario/admin/${enem.id}`, ta, { data: '2026-11-22' });
  ok(r.status === 200 && (await Prazo.findOne({ chave: `calendario:${enem.id}` })).data === '2026-11-22', 'data alterada no admin atualiza o prazo de quem pediu aviso');
  ok((await cal.LembreteCalendario.findOne({ evento: enem.id })).enviados.length === 0, 'nova data: os avisos recomeçam');
  r = await call('GET', '/api/calendario/admin', ta);
  ok(r.data.eventos.find((e) => e.id === enem.id).interessados === 1, 'admin vê quantas pessoas pediram aviso');
  // Datas de concurso semeadas entram ocultas: a equipe confere e publica
  const cgu = r.data.eventos.find((e) => e.titulo.startsWith('CGU'));
  ok(cgu && cgu.publicado === false && cgu.publico === 'concurseiro' && !(await cal.proximosEventos(em('2026-11-02'))).some((e) => e.id === cgu.id), 'concursos semeados: ocultos até a equipe conferir');
  await call('PATCH', `/api/calendario/admin/${cgu.id}`, ta, { publicado: true });
  await cal.semearCalendario();
  ok((await cal.proximosEventos(em('2026-11-02'))).some((e) => e.id === cgu.id && e.data === '2026-12-13'), 'publicar no admin mostra a data, e ela não volta a ficar oculta');

  // Ocultar: some do público e não volta quando o servidor reinicia
  await call('PATCH', `/api/calendario/admin/${sisu.id}`, ta, { publicado: false });
  await cal.semearCalendario();
  ok(!(await cal.proximosEventos(em('2026-11-02'))).some((e) => e.id === sisu.id), 'data oculta pela equipe não reaparece');

  r = await call('DELETE', `/api/calendario/${enem.id}/lembrar`, t);
  ok(r.status === 200 && !(await Prazo.exists({ chave: `calendario:${enem.id}` })), 'cancelar o aviso tira a data de Prazos');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
