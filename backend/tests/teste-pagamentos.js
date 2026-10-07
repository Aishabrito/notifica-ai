const B = require('path').resolve(__dirname, '..');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

(async () => {
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3994', RESEND_API_KEY: 're_fake', BASE_URL: 'http://x',
    MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'pub-123', MP_WEBHOOK_SECRET: 'segredo123', MP_PRECO_MENSAL: '29.90', FRONTEND_URL: 'https://notifica.dev.br',
  });
  delete process.env.MP_PRECO_PIX_ANUAL; delete process.env.MP_PRECO_PIX_30_DIAS;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };

  // ── stub da API do MP ("servidor do MP" em memória)
  const mp = require(B + '/src/service/mercadoPago');
  const pre = {}, pays = {}, chamadas = { criar: [], status: [], pix: [] };
  let recusarCartao = false, statusCriado = 'authorized';
  mp.criarAssinaturaCartao = async (args) => {
    chamadas.criar.push(args);
    if (recusarCartao) throw new mp.ErroMercadoPago(400, { message: 'Card token invalid', cause: [{ code: 'x', description: 'invalid card' }] });
    const id = 'pre_' + chamadas.criar.length;
    pre[id] = { id, status: statusCriado, external_reference: args.externalReference, next_payment_date: new Date(Date.now() + 30 * DIA).toISOString(), auto_recurring: { transaction_amount: args.trustedOffer.amount } };
    return pre[id];
  };
  mp.buscarAssinatura = async (id) => { if (!pre[id]) throw new mp.ErroMercadoPago(404, { message: 'not found' }); return pre[id]; };
  mp.alterarStatusAssinatura = async (id, status) => { chamadas.status.push([id, status]); pre[id].status = status; return pre[id]; };
  mp.cancelarAssinatura = async (id) => mp.alterarStatusAssinatura(id, 'cancelled');
  mp.criarPagamentoPix = async ({ oferta, usuario, externalReference }) => {
    chamadas.pix.push({ oferta, email: usuario.email, externalReference });
    const id = String(9000 + chamadas.pix.length);
    pays[id] = { id: Number(id), status: 'pending', transaction_amount: oferta.amount, external_reference: externalReference, payment_method_id: 'pix', date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString(),
      point_of_interaction: { transaction_data: { qr_code: '00020126PIXCOPIAECOLA' + id, qr_code_base64: 'iVBORw0KGgo=', ticket_url: 'https://mp/ticket/' + id } } };
    return pays[id];
  };
  mp.buscarPagamento = async (id) => { if (!pays[id]) throw new mp.ErroMercadoPago(404, { message: 'not found' }); return pays[id]; };

  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Transacao = require(B + '/src/models/Transacao');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3994';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, headers: r.headers, data: await r.json().catch(() => null) }; };
  const webhook = async (tipo, dataId, { assinar = true } = {}) => {
    const reqId = crypto.randomUUID(), ts = Math.floor(Date.now() / 1000);
    const headers = { 'Content-Type': 'application/json', 'x-request-id': reqId };
    if (assinar) headers['x-signature'] = `ts=${ts},v1=${crypto.createHmac('sha256', 'segredo123').update(`id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex')}`;
    return (await fetch(`${base}/api/webhooks/mercadopago?data.id=${dataId}&type=${tipo}`, { method: 'POST', headers, body: '{}' })).status;
  };
  const novoUsuario = async (email, extra = {}) => { const u = await Usuario.create({ nome: 'Ana Maria Souza', email, senha: '12345678', ...extra }); return { u, t: jwt.sign({ id: u._id }, 'x') }; };

  // ── configuração pública
  let r = await call('GET', '/api/mp-config');
  ok(r.status === 200 && r.data.publicKey === 'pub-123' && r.data.cartao.valor === 29.9 && r.headers.get('cache-control').includes('no-store'), '/api/mp-config: chave pública + preço, sem cache');
  ok(r.data.pix.find(p => p.id === 'pix-anual').valor === 299 && r.data.pix.find(p => p.id === 'pix-30-dias').dias === 30, 'ofertas Pix: 30 dias (R$ 29,90) e anual (10x = R$ 299)');

  // ── CARTÃO
  const { u: ana, t: tAna } = await novoUsuario('ana@x.com');
  for (let i = 0; i < 5; i++) await Alerta.create({ url: 'https://e.com/' + i, email: 'ana@x.com', usuario: ana._id, criadoEm: new Date(Date.now() - (5 - i) * 1000) });
  await require(B + '/src/service/planoService').aplicarDowngrade(await Usuario.findById(ana._id), { notificar: false });

  r = await call('POST', '/api/assinatura/cartao', tAna, { offerId: 'pro-mensal', cardToken: 'tok_card_1', amount: 0.01, frequency: 99 });
  const c0 = chamadas.criar[0];
  ok(r.status === 200 && r.data.status === 'authorized', 'cartão aprovado → 200 authorized');
  ok(c0.trustedOffer.amount === 29.9 && c0.trustedOffer.frequency === 1 && c0.payerEmail === 'ana@x.com' && c0.cardTokenId === 'tok_card_1', 'valor/recorrência vêm do servidor (ignora amount/frequency enviados) e e-mail vem da sessão');
  ok(/^[a-f0-9]{24}:assinatura:[0-9a-f-]{36}$/.test(c0.externalReference) && await Transacao.exists({ externalReference: c0.externalReference, mpId: 'pre_1', status: 'authorized' }), 'external_reference único e persistido');
  let uu = await Usuario.findById(ana._id);
  ok(uu.plano.tipo === 'pro' && uu.plano.origem === 'mercadopago' && uu.plano.mpAssinaturaId === 'pre_1', 'vira Pro na hora, sem esperar webhook');
  ok(await Alerta.countDocuments({ usuario: ana._id, status: 'ativo' }) === 5, 'alertas pausados pelo plano voltaram');
  await sleep(100);
  ok(sent.filter(m => m.subject.includes('Pro')).length === 1 && sent.at(-1).html.includes('Próxima renovação'), 'e-mail de boas-vindas (fala em renovação automática)');
  r = await call('POST', '/api/assinatura/cartao', tAna, { offerId: 'pro-mensal', cardToken: 'tok2' });
  ok(r.status === 409, 'já tem assinatura → 409');
  await webhook('subscription_preapproval', 'pre_1'); await sleep(100);
  ok(sent.filter(m => m.subject.includes('Pro')).length === 1, 'webhook depois da criação não reenvia boas-vindas');

  r = await call('POST', '/api/assinatura/cartao', tAna, { offerId: 'pro-anual-falso', cardToken: 'x' });
  ok(r.status === 400, 'oferta inexistente → 400');

  // recusa do MP / status não autorizado
  const { u: bia, t: tBia } = await novoUsuario('bia@x.com');
  recusarCartao = true;
  r = await call('POST', '/api/assinatura/cartao', tBia, { offerId: 'pro-mensal', cardToken: 'ruim' });
  ok(r.status === 402 && !JSON.stringify(r.data).includes('ruim') && !JSON.stringify(r.data).includes('invalid card'), 'cartão recusado → 402 com mensagem amigável (sem vazar token nem erro bruto)');
  recusarCartao = false; statusCriado = 'pending';
  r = await call('POST', '/api/assinatura/cartao', tBia, { offerId: 'pro-mensal', cardToken: 'ok' });
  ok(r.status === 402 && r.data.status === 'pending' && (await Usuario.findById(bia._id)).plano.tipo === 'free', 'assinatura não autorizada → continua Free');
  statusCriado = 'authorized';

  // clique duplo: duas requisições ao mesmo tempo
  const { u: duo, t: tDuo } = await novoUsuario('duo@x.com');
  const antes = chamadas.criar.length;
  const [d1, d2] = await Promise.all([
    call('POST', '/api/assinatura/cartao', tDuo, { offerId: 'pro-mensal', cardToken: 'a' }),
    call('POST', '/api/assinatura/cartao', tDuo, { offerId: 'pro-mensal', cardToken: 'b' }),
  ]);
  ok(chamadas.criar.length - antes === 1 && [d1.status, d2.status].sort().join() === '200,409', 'clique duplo: só 1 assinatura criada, a outra recebe 409');

  // ── consulta e ações
  r = await call('GET', '/api/assinatura/subscriptions/pre_1', tAna);
  ok(r.status === 200 && r.data.assinatura.status === 'authorized' && r.data.assinatura.valor === 29.9, 'consulta da assinatura');
  r = await call('GET', '/api/assinatura/subscriptions/pre_1', tBia);
  ok(r.status === 404, 'não consulta assinatura de outra pessoa');
  r = await call('POST', '/api/assinatura/subscriptions/pre_1/delete', tAna);
  ok(r.status === 400, 'ação fora da lista → 400');
  r = await call('POST', '/api/assinatura/subscriptions/pre_1/pause', tAna);
  uu = await Usuario.findById(ana._id);
  ok(r.status === 200 && chamadas.status.at(-1)[1] === 'paused' && uu.plano.status === 'cancelado' && uu.plano.tipo === 'pro', 'pausar → MP paused, Pro continua até o fim do período');
  r = await call('POST', '/api/assinatura/subscriptions/pre_1/reactivate', tAna);
  uu = await Usuario.findById(ana._id);
  ok(r.status === 200 && chamadas.status.at(-1)[1] === 'authorized' && uu.plano.status === 'ativo', 'reativar → authorized, plano ativo de novo');
  r = await call('POST', '/api/assinatura/subscriptions/pre_1/cancel', tAna);
  uu = await Usuario.findById(ana._id);
  ok(r.status === 200 && chamadas.status.at(-1)[1] === 'cancelled' && uu.plano.status === 'cancelado' && r.data.mensagem.includes('continua até'), 'cancelar → cancelled, mensagem com a data final');

  // ── PIX
  const { u: caio, t: tCaio } = await novoUsuario('caio@x.com');
  for (let i = 0; i < 4; i++) await Alerta.create({ url: 'https://p.com/' + i, email: 'caio@x.com', usuario: caio._id, status: i < 3 ? 'ativo' : 'pausado', motivoPausa: i < 3 ? null : 'plano' });
  r = await call('POST', '/api/assinatura/pix', tCaio, { offerId: 'pix-30-dias', amount: 1 });
  const pixId = r.data.pagamentoId;
  ok(r.status === 200 && r.data.qrCode.startsWith('00020126') && r.data.qrCodeBase64 && r.data.valor === 29.9 && r.data.dias === 30 && chamadas.pix[0].oferta.amount === 29.9, 'Pix gerado: QR + copia e cola, valor do servidor');
  ok(/:pix:/.test(chamadas.pix[0].externalReference) && await Transacao.exists({ tipo: 'pix', mpId: pixId, dias: 30 }), 'transação Pix registrada');
  r = await call('GET', `/api/assinatura/pix/${pixId}`, tCaio);
  ok(r.status === 200 && r.data.aprovado === false && r.data.status === 'pending', 'consulta: ainda pendente');
  r = await call('GET', `/api/assinatura/pix/${pixId}`, tAna);
  ok(r.status === 404, 'não consulta Pix de outra pessoa');

  // pagamento cai: webhook + consulta do frontend ao mesmo tempo (concorrência)
  pays[pixId].status = 'approved';
  const [w1, w2, q1] = await Promise.all([webhook('payment', pixId), webhook('payment', pixId), call('GET', `/api/assinatura/pix/${pixId}`, tCaio)]);
  uu = await Usuario.findById(caio._id);
  const diasPro = (uu.plano.validoAte - Date.now()) / DIA;
  ok(w1 === 200 && w2 === 200 && q1.data.aprovado === true, 'webhook + consulta simultâneos → aprovado');
  ok(uu.plano.tipo === 'pro' && uu.plano.origem === 'pix' && diasPro > 29.9 && diasPro < 30.1, `Pix aprovado soma 30 dias UMA vez só (${diasPro.toFixed(2)} dias)`);
  ok(await Alerta.countDocuments({ usuario: caio._id, status: 'ativo' }) === 4, 'Pix reativa os alertas pausados pelo plano');
  await sleep(100);
  const boasVindasPix = sent.filter(m => m.to === 'caio@x.com' && m.subject.includes('Pro'));
  ok(boasVindasPix.length === 1 && boasVindasPix[0].html.includes('não renova automaticamente'), 'boas-vindas do Pix explica que não renova sozinho');

  // compra o anual com dias sobrando → soma
  r = await call('POST', '/api/assinatura/pix', tCaio, { offerId: 'pix-anual' });
  pays[r.data.pagamentoId].status = 'approved';
  await webhook('payment', r.data.pagamentoId);
  uu = await Usuario.findById(caio._id);
  ok(Math.round((uu.plano.validoAte - Date.now()) / DIA) === 395, 'anual com 30 dias sobrando → 395 dias');

  // valor divergente (pagamento menor que a oferta) não ativa
  const { u: dani, t: tDani } = await novoUsuario('dani@x.com');
  r = await call('POST', '/api/assinatura/pix', tDani, { offerId: 'pix-30-dias' });
  pays[r.data.pagamentoId].status = 'approved'; pays[r.data.pagamentoId].transaction_amount = 1.0;
  await webhook('payment', r.data.pagamentoId);
  ok((await Usuario.findById(dani._id)).plano.tipo === 'free', 'pagamento com valor menor que a oferta não ativa o Pro');

  // pagamento de cartão (cobrança de assinatura) chegando como "payment" é ignorado
  pays['777'] = { id: 777, status: 'approved', transaction_amount: 29.9, external_reference: c0.externalReference, payment_method_id: 'visa' };
  ok(await webhook('payment', '777') === 200, 'cobrança do cartão no tópico payment é ignorada sem erro');

  // bloqueios
  r = await call('POST', '/api/assinatura/pix', tDuo, { offerId: 'pix-30-dias' });
  ok(r.status === 409, 'quem tem assinatura no cartão não gera Pix');
  const { t: tVip } = await novoUsuario('vip@x.com', { plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  r = await call('POST', '/api/assinatura/pix', tVip, { offerId: 'pix-30-dias' });
  ok(r.status === 409, 'Pro vitalício (cortesia sem prazo) não gera Pix');

  // cartão com Pix ativo: só começa a cobrar quando o Pix acabar
  r = await call('POST', '/api/assinatura/cartao', tCaio, { offerId: 'pro-mensal', cardToken: 'tok_caio' });
  const inicio = chamadas.criar.at(-1).inicioCobranca;
  ok(r.status === 200 && inicio && Math.round((inicio - Date.now()) / DIA) === 395, 'assinar no cartão com Pix ativo → 1ª cobrança só quando os dias pagos acabarem');

  // ── lembrete de renovação do Pix
  const { u: eva } = await novoUsuario('eva@x.com', { plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + 2 * DIA), origem: 'pix' } });
  await novoUsuario('fabio@x.com', { plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + 20 * DIA), origem: 'pix' } });
  const { enviarLembretesRenovacao } = require(B + '/src/service/planoService');
  sent.length = 0;
  let lemb = await enviarLembretesRenovacao();
  ok(lemb.lembretesEnviados === 1 && sent[0].to === 'eva@x.com' && sent[0].subject.includes('2 dia'), 'lembrete só para quem vence em até 3 dias');
  lemb = await enviarLembretesRenovacao();
  ok(lemb.lembretesEnviados === 0, 'lembrete não repete');

  // ── admin não remove plano Pix pago
  const adm = await Usuario.create({ nome: 'Adm', email: 'adm@x.com', senha: '12345678', role: 'admin' });
  r = await call('PATCH', `/api/admin/usuarios/${eva._id}/plano`, jwt.sign({ id: adm._id }, 'x'), { tipo: 'free' });
  ok(r.status === 409, 'admin não remove Pro pago via Pix');

  // ── receita no painel admin
  r = await call('GET', '/api/admin/dashboard', jwt.sign({ id: adm._id }, 'x'));
  const rec = r.data.dados.receita;
  ok(rec && rec.assinantesCartao === 2 && rec.mrrCartao === 59.8 && rec.pixRecebido30d === 328.9 && rec.proPix >= 1 && rec.cortesias === 1 && rec.conversao > 0,
    `admin: receita (cartão ${rec?.assinantesCartao}× = R$ ${rec?.mrrCartao}/mês, Pix 30d R$ ${rec?.pixRecebido30d}, conversão ${rec?.conversao}%)`);

  // ── assinatura antiga (external_reference = só o id do usuário) continua funcionando
  const { u: velha } = await novoUsuario('velha@x.com');
  pre['pre_velha'] = { id: 'pre_velha', status: 'authorized', external_reference: String(velha._id), next_payment_date: new Date(Date.now() + 30 * DIA).toISOString() };
  await webhook('subscription_preapproval', 'pre_velha');
  ok((await Usuario.findById(velha._id)).plano.mpAssinaturaId === 'pre_velha', 'assinaturas criadas antes desta versão continuam sincronizando');

  ok(await webhook('payment', pixId, { assinar: false }) === 401, 'webhook sem assinatura → 401');

  delete process.env.MP_ACCESS_TOKEN;
  r = await call('POST', '/api/assinatura/pix', tBia, { offerId: 'pix-30-dias' });
  ok(r.status === 503, 'sem MP_ACCESS_TOKEN → 503');
  r = await call('POST', '/api/assinatura/criar', tBia);
  ok(r.status === 404, 'fluxo antigo de redirecionamento (/criar) removido');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
