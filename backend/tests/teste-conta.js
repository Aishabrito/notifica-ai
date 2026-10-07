// Confirmação de e-mail no cadastro, teste grátis, Minha conta e cidades do Radar
const B = require('path').resolve(__dirname, '..');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3990',
    RESEND_API_KEY: 're_fake', BASE_URL: 'http://localhost:3990', FRONTEND_URL: 'https://notifica.dev.br',
    MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'pub', DADOS_CHAVE: crypto.randomBytes(32).toString('base64'),
    TELEGRAM_BOT_TOKEN: '1:A', TELEGRAM_BOT_USERNAME: 'Bot', TELEGRAM_WEBHOOK_SECRET: 'segredo', RADAR_CIDADES: '3304557',
  });
  const axios = require(B + '/node_modules/axios');
  const tg = []; const postOrig = axios.post;
  axios.post = async (u, b, o) => { if (u.startsWith('https://api.telegram.org/')) { tg.push(b); return { data: { ok: true } }; } return postOrig(u, b, o); };
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  const mp = require(B + '/src/service/mercadoPago');
  let falharCancelamento = false; const cancelados = [];
  mp.cancelarAssinatura = async (id) => { if (falharCancelamento) throw new Error('MP fora'); cancelados.push(id); return { id, status: 'cancelled' }; };
  mp.criarAssinaturaCartao = async (a) => ({ id: 'pre_t', status: 'authorized', external_reference: a.externalReference, next_payment_date: (a.inicioCobranca ?? new Date()).toISOString(), _inicio: a.inicioCobranca });
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Mudanca = require(B + '/src/models/Mudanca');
  const MonitorRadar = require(B + '/src/models/MonitorRadar');
  const Transacao = require(B + '/src/models/Transacao');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3990';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, headers: r.headers, data: await r.json().catch(() => null) }; };

  // ── cadastro: senha curta e e-mail de confirmação
  let r = await call('POST', '/api/auth/cadastro', null, { nome: 'Lia', email: 'lia@x.com', senha: '123' });
  ok(r.status === 400, 'cadastro com senha curta → 400 (antes dava 500)');
  r = await call('POST', '/api/auth/cadastro', null, { nome: 'Lia <b>Souza</b>', email: 'lia@x.com', senha: '12345678' });
  await sleep(150);
  const boasVindas = sent.find(m => m.to === 'lia@x.com');
  const linkConf = (boasVindas?.html.match(/href="(http:\/\/localhost:3990\/verificar-email\/[^"]+)"/) || [])[1];
  ok(r.status === 201 && linkConf && boasVindas.html.includes('Lia &lt;b&gt;Souza') && boasVindas.html.includes('6 em 6 horas'), 'boas-vindas já traz o link de confirmar e-mail (nome escapado, sem prometer "de hora em hora")');
  const tLia = r.data.token;
  const lia = await Usuario.findOne({ email: 'lia@x.com' });

  // ── teste grátis
  r = await call('GET', '/api/plano', tLia);
  ok(r.data.testeGratis.disponivel && r.data.testeGratis.dias === 7 && r.data.testeGratis.exigeEmailVerificado, '/api/plano oferece o teste grátis (pede e-mail confirmado)');
  r = await call('POST', '/api/assinatura/teste-gratis', tLia);
  ok(r.status === 403 && r.data.codigo === 'EMAIL_NAO_VERIFICADO', 'teste grátis exige e-mail confirmado');
  await fetch(linkConf);
  for (let i = 0; i < 5; i++) await Alerta.create({ url: 'https://e.com/' + i, email: 'lia@x.com', usuario: lia._id, status: i < 3 ? 'ativo' : 'pausado', motivoPausa: i < 3 ? null : 'plano' });
  const [t1, t2] = await Promise.all([call('POST', '/api/assinatura/teste-gratis', tLia), call('POST', '/api/assinatura/teste-gratis', tLia)]);
  let u = await Usuario.findById(lia._id);
  const dias = (u.plano.validoAte - Date.now()) / DIA;
  ok([t1.status, t2.status].sort().join() === '200,409' && u.plano.origem === 'teste' && dias > 6.9 && dias < 7.1, 'teste grátis de 7 dias: uma vez só, mesmo com 2 cliques simultâneos');
  ok(await Alerta.countDocuments({ usuario: lia._id, status: 'ativo' }) === 5, 'teste grátis reativa os alertas pausados pelo plano');
  r = await call('POST', '/api/assinatura/cartao', tLia, { offerId: 'pro-mensal', cardToken: 'tk' });
  u = await Usuario.findById(lia._id);
  ok(r.status === 200 && u.plano.origem === 'mercadopago' && Math.round((new Date(u.plano.validoAte) - Date.now()) / DIA) === 10, 'assinar durante o teste: 1ª cobrança só no fim do teste (+3 dias de tolerância)');

  // teste acabando → lembrete; acabou → e-mail "teste grátis terminou"
  const ana = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678', emailVerificado: true, testeGratisUsadoEm: new Date(), plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + 2 * DIA), origem: 'teste' } });
  const { enviarLembretesRenovacao, processarPlanosExpirados } = require(B + '/src/service/planoService');
  sent.length = 0;
  await enviarLembretesRenovacao();
  ok(sent.some(m => m.to === 'ana@x.com' && m.subject.includes('teste grátis')), 'lembrete 3 dias antes do fim do teste');
  await Usuario.updateOne({ _id: ana._id }, { 'plano.validoAte': new Date(Date.now() - 1000) });
  sent.length = 0;
  await processarPlanosExpirados(); await sleep(150);
  u = await Usuario.findById(ana._id);
  ok(u.plano.tipo === 'free' && sent.some(m => m.to === 'ana@x.com' && m.subject.includes('teste grátis') && m.subject.includes('terminou')), 'fim do teste: volta ao Free com e-mail próprio');
  r = await call('POST', '/api/assinatura/teste-gratis', jwt.sign({ id: ana._id }, 'x'));
  ok(r.status === 409, 'quem já usou o teste não ganha outro');

  // ── cidades do Radar (RADAR_CIDADES=Rio)
  const tAna = jwt.sign({ id: ana._id }, 'x');
  await Usuario.updateOne({ _id: ana._id }, { plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  r = await call('GET', '/api/radar', tAna);
  ok(r.data.cidades.length === 1 && r.data.cidades[0].nome === 'Rio de Janeiro', 'RADAR_CIDADES=3304557 → só o Rio disponível');
  r = await call('POST', '/api/radar', tAna, { nome: 'Ana Maria Lima', cidades: ['3303302'], consentimento: true });
  ok(r.status === 400, 'cidade fora de RADAR_CIDADES é recusada');
  r = await call('POST', '/api/radar', tAna, { nome: 'Ana Maria Lima', cidades: ['3304557'], consentimento: true });
  ok(r.status === 201, 'Rio aceito');

  // ── Minha conta
  r = await call('GET', '/api/conta', tAna);
  ok(r.data.conta.email === 'ana@x.com' && r.data.conta.emailVerificado === true, 'GET /api/conta');
  r = await call('PATCH', '/api/conta', tAna, { nome: '  Ana   Paula ' });
  ok(r.status === 200 && (await Usuario.findById(ana._id)).nome === 'Ana Paula', 'troca de nome');
  r = await call('POST', '/api/conta/senha', tAna, { senhaAtual: 'errada', novaSenha: 'novasenha123' });
  ok(r.status === 403, 'troca de senha exige a senha atual');
  r = await call('POST', '/api/conta/senha', tAna, { senhaAtual: '12345678', novaSenha: 'novasenha123' });
  const login = await call('POST', '/api/auth/login', null, { email: 'ana@x.com', senha: 'novasenha123' });
  ok(r.status === 200 && login.status === 200, 'senha trocada: login com a nova funciona');

  await Alerta.create({ url: 'https://a.com', email: 'ana@x.com', usuario: ana._id });
  r = await call('POST', '/api/conta/email', tAna, { novoEmail: 'lia@x.com', senha: 'novasenha123' });
  ok(r.status === 409, 'não troca para e-mail de outra conta');
  sent.length = 0;
  r = await call('POST', '/api/conta/email', tAna, { novoEmail: 'Ana.Nova@X.com', senha: 'novasenha123' });
  await sleep(150);
  u = await Usuario.findById(ana._id);
  ok(r.status === 200 && u.email === 'ana.nova@x.com' && !u.emailVerificado && (await Alerta.findOne({ usuario: ana._id })).email === 'ana.nova@x.com' && sent.some(m => m.to === 'ana.nova@x.com' && m.html.includes('/verificar-email/')), 'troca de e-mail: alertas passam a ir para o novo, que precisa ser confirmado');

  // ── excluir conta
  const bia = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678', telegram: { chatId: '777' }, plano: { tipo: 'pro', status: 'ativo', validoAte: new Date(Date.now() + 30 * DIA), origem: 'mercadopago', mpAssinaturaId: 'pre_bia' } });
  const tBia = jwt.sign({ id: bia._id }, 'x');
  const al = await Alerta.create({ url: 'https://b.com', email: 'bia@x.com', usuario: bia._id });
  await Mudanca.create({ alertaId: al._id, emailNotificado: 'bia@x.com' });
  await MonitorRadar.create({ usuario: bia._id, nomeCifrado: 'v1:x', cidades: ['3304557'], consentimento: { aceitoEm: new Date(), versao: 'radar-v1' } });
  await Transacao.create({ tipo: 'assinatura', usuario: bia._id, externalReference: `${bia._id}:assinatura:1`, oferta: 'pro-mensal', valor: 14.9 });

  r = await call('DELETE', '/api/conta', tBia, { senha: '12345678', confirmacao: 'sim' });
  ok(r.status === 400, 'exclusão exige digitar EXCLUIR');
  r = await call('DELETE', '/api/conta', tBia, { senha: 'errada', confirmacao: 'EXCLUIR' });
  ok(r.status === 403, 'exclusão exige a senha');
  falharCancelamento = true;
  r = await call('DELETE', '/api/conta', tBia, { senha: '12345678', confirmacao: 'EXCLUIR' });
  ok(r.status === 502 && await Usuario.exists({ _id: bia._id }) && await Alerta.exists({ usuario: bia._id }), 'se não der para cancelar a assinatura no MP, nada é apagado');
  falharCancelamento = false; tg.length = 0;
  r = await call('DELETE', '/api/conta', tBia, { senha: '12345678', confirmacao: 'EXCLUIR' });
  ok(r.status === 200 && cancelados.includes('pre_bia') && (r.headers.get('set-cookie') || '').includes('token=;'), 'exclusão: cancela a assinatura antes e encerra a sessão');
  ok(!(await Usuario.exists({ _id: bia._id })) && !(await Alerta.exists({ usuario: bia._id })) && !(await Mudanca.exists({ alertaId: al._id })) && !(await MonitorRadar.exists({ usuario: bia._id })), 'apaga usuário, alertas, histórico e Radar');
  ok(await Transacao.exists({ usuario: bia._id }) && tg.some(m => m.chat_id === '777'), 'mantém o registro de pagamento (obrigação fiscal) e avisa no Telegram');
  r = await call('GET', '/api/conta', tBia);
  ok(r.status === 401, 'token antigo não acessa mais nada');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
