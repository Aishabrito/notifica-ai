// Resumo semanal por e-mail
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3985',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://localhost:3985', FRONTEND_URL: 'https://notifica.dev.br',
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Mudanca = require(B + '/src/models/Mudanca');
  const Prazo = require(B + '/src/models/Prazo');
  const { enviarResumosSemanais, linkSair } = require(B + '/src/service/resumoSemanal');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3985' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const dia = (n) => new Date(Date.now() + n * DIA).toISOString().slice(0, 10);

  const pro = await Usuario.create({ nome: 'Ana Souza', email: 'ana@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const free = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678' });
  const quieto = await Usuario.create({ nome: 'Caio', email: 'caio@x.com', senha: '12345678' });
  const a1 = await Alerta.create({ url: 'https://ex.gov.br/sisu', titulo: 'SISU <lista>', email: 'ana@x.com', usuario: pro._id });
  const a2 = await Alerta.create({ url: 'https://ex.gov.br/tj', titulo: 'TJ', email: 'bia@x.com', usuario: free._id });
  await Alerta.create({ url: 'https://ex.gov.br/x', titulo: 'X', email: 'caio@x.com', usuario: quieto._id });
  await Mudanca.create([
    { alertaId: a1._id, emailNotificado: 'ana@x.com', resumo: { relevante: true, titulo: 'Saiu a 3ª chamada', resumo: 'x', datas: [] } },
    { alertaId: a1._id, emailNotificado: 'ana@x.com', resumo: { relevante: false, titulo: 'Só o contador', resumo: 'x', datas: [] } },
    { alertaId: a2._id, emailNotificado: 'bia@x.com' },
  ]);
  const antiga = await Mudanca.create({ alertaId: a2._id, emailNotificado: 'bia@x.com' });
  await mongoose.connection.collection('mudancas').updateOne({ _id: antiga._id }, { $set: { detectadaEm: new Date(Date.now() - 10 * DIA) } }); // createdAt é imutável no Mongoose
  await Prazo.create([
    { usuario: pro._id, titulo: 'Matrícula', data: dia(3), tipo: 'matricula' },
    { usuario: pro._id, titulo: 'Prova daqui a 1 mês', data: dia(30) },
  ]);

  sent.length = 0;
  const n = await enviarResumosSemanais();
  const paraAna = sent.find(m => m.to === 'ana@x.com'), paraBia = sent.find(m => m.to === 'bia@x.com');
  ok(n === 2 && !sent.some(m => m.to === 'caio@x.com'), 'só recebe quem teve algo na semana (Caio, sem nada, não recebe)');
  ok(paraAna.subject.startsWith('⏰ 1 prazo(s)') && paraAna.html.includes('Matrícula') && !paraAna.html.includes('daqui a 1 mês'), 'Pro: prazos das próximas 2 semanas no topo e no assunto');
  ok(paraAna.html.includes('Saiu a 3ª chamada') && !paraAna.html.includes('Só o contador') && paraAna.html.includes('SISU &lt;lista&gt;'), 'mudanças da semana, sem as irrelevantes, com texto escapado');
  ok(paraBia.html.includes('1 mudança(s)') && paraBia.html.includes('Conhecer o Pro') && !paraBia.html.includes('Prazos nas'), 'Free: só as mudanças (a de 10 dias atrás fica de fora) + convite ao Pro');
  ok(paraAna.headers?.['List-Unsubscribe'] && paraAna.html.includes('/resumo-semanal/sair/'), 'link para sair do resumo (também no cabeçalho List-Unsubscribe)');

  sent.length = 0;
  ok(await enviarResumosSemanais() === 0 && sent.length === 0, 'não manda duas vezes na mesma semana');

  // sair pelo link: GET só confirma, POST desliga
  const link = linkSair(pro._id);
  let pg = await fetch(link);
  ok(pg.status === 200 && (await Usuario.findById(pro._id)).resumoSemanal === true, 'abrir o link só pede confirmação');
  await fetch(link, { method: 'POST' });
  ok((await Usuario.findById(pro._id)).resumoSemanal === false, 'confirmar desliga o resumo');
  ok((await fetch(link.replace(/[0-9a-f]{64}$/, '0'.repeat(64)))).status === 400, 'token errado é recusado');

  await Usuario.updateMany({}, { resumoSemanalEnviadoEm: new Date(Date.now() - 8 * DIA) });
  sent.length = 0;
  await enviarResumosSemanais();
  ok(!sent.some(m => m.to === 'ana@x.com') && sent.some(m => m.to === 'bia@x.com'), 'na semana seguinte: quem saiu não recebe; os outros sim');

  // preferência em Minha conta
  const tb = jwt.sign({ id: free._id }, 'x');
  let r = await call('PATCH', '/api/conta/preferencias', tb, { resumoSemanal: false });
  ok(r.status === 200 && (await call('GET', '/api/conta', tb)).data.conta.resumoSemanal === false, 'ligar/desligar em Minha conta');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
