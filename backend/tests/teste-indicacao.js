// Indique e ganhe
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3987',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', FRONTEND_URL: 'https://notifica.dev.br',
    MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'pub', TESTE_GRATIS_DIAS: '7',
  });
  delete process.env.MP_WEBHOOK_SECRET;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };

  // MP simulado: assinatura e cobrança aprovada do cartão
  const mp = require(B + '/src/service/mercadoPago');
  const pre = {}, cobrancas = {};
  mp.buscarAssinatura = async (id) => pre[id];
  mp.buscarPagamentoAutorizado = async (id) => cobrancas[id];

  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Transacao = require(B + '/src/models/Transacao');
  const { processarPagamentoPix } = require(B + '/src/service/assinaturaService');
  const { processarPlanosExpirados } = require(B + '/src/service/planoService');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3987';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const pagarPix = async (usuario, dias = 30, valor = 20) => {
    const ref = `${usuario._id}:pix:${Math.random()}`;
    await Transacao.create({ tipo: 'pix', usuario: usuario._id, externalReference: ref, oferta: 'pix-30-dias', valor, dias });
    return processarPagamentoPix({ id: Math.floor(Math.random() * 1e9), status: 'approved', transaction_amount: valor, external_reference: ref });
  };

  // ── código e link
  const ana = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678' });
  const ta = jwt.sign({ id: ana._id }, 'x');
  let r = await call('GET', '/api/conta/indicacao', ta);
  const codigo = r.data.codigo;
  ok(r.status === 200 && /^[A-Z2-9]{6}$/.test(codigo) && r.data.link === `https://notifica.dev.br/cadastro?ref=${codigo}`, 'gera código de 6 letras e o link de convite');
  r = await call('GET', '/api/conta/indicacao', ta);
  ok(r.data.codigo === codigo, 'o código não muda');

  // ── cadastro pelo link
  r = await call('POST', '/api/auth/cadastro', null, { nome: 'Bia Lima', email: 'bia@x.com', senha: '12345678', indicacao: codigo.toLowerCase() });
  const bia = await Usuario.findOne({ email: 'bia@x.com' });
  ok(r.status === 201 && String(bia.indicadoPor) === String(ana._id), 'cadastro com ?ref liga a pessoa a quem indicou');
  await call('POST', '/api/auth/cadastro', null, { nome: 'Caio', email: 'caio@x.com', senha: '12345678', indicacao: 'XXXXXX' });
  ok((await Usuario.findOne({ email: 'caio@x.com' })).indicadoPor === null, 'código inválido é ignorado sem erro');

  // ── quem foi indicado ganha teste maior
  await Usuario.updateOne({ _id: bia._id }, { emailVerificado: true });
  const tb = jwt.sign({ id: bia._id }, 'x');
  r = await call('POST', '/api/assinatura/teste-gratis', tb);
  let b = await Usuario.findById(bia._id);
  ok(r.status === 200 && Math.round((b.plano.validoAte - Date.now()) / DIA) === 14, 'indicado ganha 14 dias de teste (7 + 7)');
  ok(!(await Usuario.findById(ana._id)).plano?.validoAte, 'teste grátis não dá recompensa (só pagamento)');

  // ── indicado paga no Pix → Ana (Free) ganha 30 dias de Pro
  sent.length = 0;
  await pagarPix(b);
  let a = await Usuario.findById(ana._id);
  ok(a.plano.tipo === 'pro' && a.plano.origem === 'cortesia' && Math.round((a.plano.validoAte - Date.now()) / DIA) === 30, 'indicado pagou: quem indicou (Free) vira Pro por 30 dias');
  await sleep(50);
  ok(sent.some(m => m.to === 'ana@x.com' && m.subject.includes('30 dias')), 'e-mail avisando o presente');
  await pagarPix(b);
  a = await Usuario.findById(ana._id);
  ok(Math.round((a.plano.validoAte - Date.now()) / DIA) === 30, 'segundo pagamento do mesmo indicado não dá recompensa de novo');

  // ── Ana já é Pro com prazo: soma
  const dani = await Usuario.create({ nome: 'Dani', email: 'dani@x.com', senha: '12345678', indicadoPor: ana._id });
  await pagarPix(dani);
  a = await Usuario.findById(ana._id);
  ok(Math.round((a.plano.validoAte - Date.now()) / DIA) === 60, 'Pro com prazo: soma mais 30 dias');

  // ── quem indica paga no cartão: os dias ficam guardados
  const eva = await Usuario.create({ nome: 'Eva', email: 'eva@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'mercadopago', mpAssinaturaId: 'pre_eva', validoAte: new Date(Date.now() + 20 * DIA) } });
  const fabio = await Usuario.create({ nome: 'Fábio', email: 'fabio@x.com', senha: '12345678', indicadoPor: eva._id });
  // indicado assina no cartão: a recompensa só vem com a cobrança aprovada
  pre.pre_fabio = { id: 'pre_fabio', status: 'authorized', external_reference: `${fabio._id}:assinatura:1`, next_payment_date: new Date(Date.now() + 30 * DIA).toISOString(), auto_recurring: { transaction_amount: 20, frequency: 1, frequency_type: 'months' } };
  await fetch(`${base}/api/webhooks/mercadopago?data.id=pre_fabio&type=subscription_preapproval`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  ok((await Usuario.findById(eva._id)).creditoDias === 0, 'assinatura autorizada ainda não conta (falta a cobrança)');
  cobrancas.c1 = { id: 'c1', preapproval_id: 'pre_fabio', status: 'processed', payment: { status: 'approved' } };
  await fetch(`${base}/api/webhooks/mercadopago?data.id=c1&type=subscription_authorized_payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  let e = await Usuario.findById(eva._id);
  ok(e.creditoDias === 30 && Math.round((e.plano.validoAte - Date.now()) / DIA) === 20, 'cobrança aprovada no cartão do indicado: Eva (paga no cartão) guarda 30 dias, sem mexer na assinatura');

  // Eva cancela o cartão e o período acaba: os dias guardados viram Pro
  await Usuario.updateOne({ _id: eva._id }, { 'plano.status': 'cancelado', 'plano.validoAte': new Date(Date.now() - 1000) });
  await processarPlanosExpirados();
  e = await Usuario.findById(eva._id);
  ok(e.plano.tipo === 'pro' && e.plano.origem === 'cortesia' && Math.round((e.plano.validoAte - Date.now()) / DIA) === 30 && e.creditoDias === 0, 'quando o plano acaba, os dias guardados viram Pro em vez de rebaixar');

  // ── resumo
  r = await call('GET', '/api/conta/indicacao', ta);
  ok(r.data.cadastros === 2 && r.data.convertidos === 2 && r.data.diasGanhos === 60, 'resumo: 2 cadastros, 2 assinaram, 60 dias ganhos');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
