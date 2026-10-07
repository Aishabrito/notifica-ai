const path = require('path');
const B = require('path').resolve(__dirname, '..');

const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };

(async () => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/notifica_testes';
  process.env.JWT_SECRET = 'x'; process.env.PERMITIR_REDE_PRIVADA = 'true'; process.env.PORT = '3997'; process.env.RESEND_API_KEY = 're_fake';
  const mongoose = require(B + '/node_modules/mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  const axios = require(B + '/node_modules/axios');
  axios.get = async () => ({ data: '<html><head><title>Página teste</title></head><body><main>Resultado do concurso</main></body></html>' });
  // usuários legados (formato antigo)
  await mongoose.connection.collection('usuarios').insertMany([
    { nome: 'Leg Free', email: 'legfree@x.com', senha: 'h', plano: 'gratuito' },
    { nome: 'Leg Prem', email: 'legprem@x.com', senha: 'h', plano: 'premium' },
  ]);
  require(B + '/server.js');
  await new Promise(r => setTimeout(r, 1500));
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const lf = await Usuario.findOne({ email: 'legfree@x.com' }).lean();
  const lp = await Usuario.findOne({ email: 'legprem@x.com' }).lean();
  ok(lf.plano.tipo === 'free' && lp.plano.tipo === 'pro', 'migração de planos legados');

  const base = 'http://localhost:3997';
  const call = async (method, p, token, body) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  };
  const cad = await fetch(base + '/api/auth/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'A', email: 'a@x.com', senha: '12345678' }) }).then(r => r.json());
  ok(cad.usuario.plano.tipo === 'free', 'novo usuário nasce free');
  const t = cad.token;

  let p = await call('GET', '/api/plano', t);
  ok(p.data.uso.limiteAlertas === 3 && p.data.plano.efetivo === 'free' && p.data.recursos.intervaloPadrao === 6, 'GET /api/plano free (6h): ' + JSON.stringify(p.data.uso));

  let r = await call('POST', '/api/cadastrar-alerta', t, { url: 'https://example.com', intervaloHoras: 1 });
  ok(r.status === 403 && r.data.codigo === 'INTERVALO_NAO_PERMITIDO' && r.data.mensagem.includes('6h'), 'free não pode 1h: ' + r.data.mensagem);

  const uid = cad.usuario.id;
  for (let i = 0; i < 2; i++) await Alerta.create({ url: 'https://example.com/' + i, email: 'a@x.com', usuario: uid });
  r = await call('POST', '/api/cadastrar-alerta', t, { url: 'https://example.com' });
  ok(r.status === 200 && r.data.alerta.intervaloHoras === 6, 'free cria 3º alerta com 6h (status ' + r.status + ' ' + (r.data.mensagem||'') + ')');
  r = await call('POST', '/api/cadastrar-alerta', t, { url: 'https://example.com' });
  ok(r.status === 403 && r.data.codigo === 'LIMITE_PLANO', 'free bloqueado no 4º: ' + r.data.mensagem);

  const pausado = await Alerta.create({ url: 'https://example.com/p', email: 'a@x.com', usuario: uid, status: 'pausado' });
  r = await call('PATCH', `/api/reativar-alerta/${pausado._id}`, t);
  ok(r.status === 403, 'reativar além do limite bloqueado');

  // upgrade para Pro
  await Usuario.updateOne({ _id: uid }, { plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + 86400000) } });
  p = await call('GET', '/api/plano', t);
  ok(p.data.uso.limiteAlertas === null && p.data.plano.efetivo === 'pro', 'GET /api/plano pro');
  r = await call('PATCH', `/api/reativar-alerta/${pausado._id}`, t);
  ok(r.status === 200, 'pro reativa além de 3');
  r = await call('PATCH', `/api/alertas/${pausado._id}/frequencia`, t, { intervaloHoras: 0.25 });
  ok(r.status === 200 && r.data.alerta.intervaloHoras === 0.25, 'pro muda frequência para 15min');

  // cron: alertas vencidos + legado sem proximaVerificacao
  await mongoose.connection.collection('alertas').insertOne({ url: 'https://example.com/leg', email: 'a@x.com', status: 'ativo', falhasSeguidas: 0 });
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await mongoose.connection.collection('alertas').updateOne({ url: 'https://example.com/leg' }, { $unset: { proximaVerificacao: 1 } });
  const agora = new Date();
  const vencidos = await Alerta.find({ status: 'ativo', $or: [{ proximaVerificacao: { $lte: agora } }, { proximaVerificacao: { $exists: false } }, { proximaVerificacao: null }] }).populate('usuario', 'plano');
  ok(vencidos.length === 5, 'query do cron pega vencidos + legado: ' + vencidos.length);

  // expira o Pro -> alerta de 15min deve voltar a 24h no agendamento
  await Usuario.updateOne({ _id: uid }, { 'plano.validoAte': new Date(Date.now() - 1000) });
  const so = await Alerta.find({ _id: pausado._id }).populate('usuario', 'plano');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  await executarMonitoramento(so);
  const depois = await Alerta.findById(pausado._id).lean();
  const h = (depois.proximaVerificacao - Date.now()) / 3600000;
  ok(h > 5.9 && h <= 6 && String(depois.usuario) === uid, `Pro expirado volta para 6h do Free (${h.toFixed(2)}h), usuario ainda é ObjectId`);
  ok(depois.intervaloHoras === 0.25, 'preferência de 15min preservada para quando voltar ao Pro');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
