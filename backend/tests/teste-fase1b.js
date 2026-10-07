const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3998', RESEND_API_KEY: 're_fake', BASE_URL: 'http://localhost:3998' });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  await mongoose.connection.dropDatabase();
  const sent = [];
  const mailer = require(B + '/src/utils/mailer'); mailer.sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await new Promise(r => setTimeout(r, 1000));
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const LogCron = require(B + '/src/models/LogCron');
  const Mudanca = require(B + '/src/models/Mudanca');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3998';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };

  const admin = await Usuario.create({ nome: 'Adm', email: 'adm@x.com', senha: '12345678', role: 'admin' });
  const at = jwt.sign({ id: admin._id }, 'x');
  const u = await Usuario.create({ nome: 'Ana <b>', email: 'ana@x.com', senha: '12345678' });

  // ── 4. override: dar Pro de cortesia por 30 dias
  let r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, at, { tipo: 'pro', dias: 30 });
  let uu = await Usuario.findById(u._id);
  ok(r.status === 200 && uu.plano.tipo === 'pro' && uu.plano.origem === 'cortesia' && uu.plano.validoAte > new Date(Date.now() + 29 * 864e5), 'admin concede Pro cortesia 30 dias');
  r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, at, { tipo: 'pro', dias: -2 });
  ok(r.status === 400, 'dias inválido rejeitado');
  r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, jwt.sign({ id: u._id }, 'x'), { tipo: 'pro' });
  ok(r.status === 403, 'não-admin não consegue alterar plano');

  // 6 alertas ativos (criados em ordem)
  for (let i = 0; i < 6; i++) await Alerta.create({ url: 'https://ex.com/' + i, email: 'ana@x.com', titulo: 'Site <script>' + i, usuario: u._id, criadoEm: new Date(Date.now() - (6 - i) * 1000) });

  // ── 2. job de expirados: nada acontece enquanto válido
  const { processarPlanosExpirados } = require(B + '/src/service/planoService');
  let j = await processarPlanosExpirados();
  ok(j.usuariosRebaixados === 0, 'Pro válido não é rebaixado');

  // expira
  await Usuario.updateOne({ _id: u._id }, { 'plano.validoAte': new Date(Date.now() - 1000) });
  j = await processarPlanosExpirados();
  const ativos = await Alerta.find({ usuario: u._id, status: 'ativo' }).sort({ criadoEm: -1 }).lean();
  const pausados = await Alerta.find({ usuario: u._id, status: 'pausado', motivoPausa: 'plano' }).lean();
  uu = await Usuario.findById(u._id);
  ok(j.usuariosRebaixados === 1 && uu.plano.tipo === 'free', 'Pro expirado vira free');
  ok(ativos.length === 3 && pausados.length === 3 && ativos.map(a => a.url).join() === 'https://ex.com/5,https://ex.com/4,https://ex.com/3', 'mantém os 3 mais recentes, pausa 3 com motivo plano');
  await new Promise(r => setTimeout(r, 200));
  const mail = sent.find(m => m.subject.includes('Pro'));
  ok(mail && !mail.html.includes('<script>') && mail.html.includes('&lt;script&gt;') && mail.html.includes('Ana &lt;b&gt;'), 'e-mail de downgrade enviado com HTML escapado');
  j = await processarPlanosExpirados();
  ok(j.usuariosRebaixados === 0, 'job é idempotente');

  // upgrade de novo reativa os pausados por plano (mas não os pausados por falha)
  await Alerta.updateOne({ url: 'https://ex.com/5' }, { status: 'pausado', motivoPausa: 'falhas' });
  r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, at, { tipo: 'pro' });
  const ativos2 = await Alerta.countDocuments({ usuario: u._id, status: 'ativo' });
  uu = await Usuario.findById(u._id);
  ok(r.status === 200 && ativos2 === 5 && uu.plano.validoAte === null, 'upgrade reativa só os pausados por plano (sem expiração): ' + r.data.mensagem);

  // assinatura paga não pode ser removida pelo admin
  await Usuario.updateOne({ _id: u._id }, { 'plano.origem': 'mercadopago' });
  r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, at, { tipo: 'free' });
  ok(r.status === 409, 'não remove assinatura paga ativa');
  await Usuario.updateOne({ _id: u._id }, { 'plano.origem': 'cortesia' });
  r = await call('PATCH', `/api/admin/usuarios/${u._id}/plano`, at, { tipo: 'free' });
  ok(r.status === 200 && (await Alerta.countDocuments({ usuario: u._id, status: 'ativo' })) === 3, 'admin remove Pro: ' + r.data.mensagem);

  // ── 1. métricas do dia somadas
  await LogCron.create([{ alertasVerificados: 10, mudancasDetectadas: 2 }, { alertasVerificados: 5, mudancasDetectadas: 1 }, { alertasVerificados: 99, mudancasDetectadas: 9, dataExecucao: new Date(Date.now() - 2 * 864e5) }]);
  const aid = (await Alerta.findOne())._id;
  await Mudanca.create([{ alertaId: aid, emailNotificado: 'a@x.com', emailEnviado: true }, { alertaId: aid, emailNotificado: 'a@x.com', emailEnviado: true }, { alertaId: aid, emailNotificado: 'a@x.com', emailEnviado: false }]);
  r = await call('GET', '/api/admin/dashboard', at);
  const h = r.data.dados.crawlerHealth;
  ok(h.totalVerificacoesHoje === 15 && h.mudancasDetectadasHoje === 3, `métricas somam rodadas do dia (${h.totalVerificacoesHoje}/${h.mudancasDetectadasHoje})`);
  ok(h.emailsEnviadosHoje === 2 && h.taxaSucessoEmail === 67, `e-mails hoje ${h.emailsEnviadosHoje}, taxa ${h.taxaSucessoEmail}%`);
  const du = r.data.dados.users.find(x => x.email === 'ana@x.com');
  ok(du.plano === 'free' && 'planoOrigem' in du, 'dashboard traz plano do usuário');

  // ── 9. link de cancelamento
  const { gerarLinkCancelamento } = require(B + '/src/utils/linkCancelamento');
  const link = gerarLinkCancelamento(aid);
  let g = await fetch(link); let html = await g.text();
  ok(g.status === 200 && html.includes('<form method="POST">') && html.includes('&lt;script&gt;') && await Alerta.exists({ _id: aid }), 'GET mostra confirmação (escapada) e NÃO apaga');
  g = await fetch(link.slice(0, -4) + 'abcd'); ok(g.status === 400, 'token adulterado → 400');
  const outro = (await Alerta.findOne({ _id: { $ne: aid } }))._id;
  g = await fetch(link.replace(String(aid), String(outro)), { method: 'POST' }); ok(g.status === 400 && await Alerta.exists({ _id: outro }), 'token de um alerta não cancela outro');
  g = await fetch(link, { method: 'POST', headers: { Origin: base } }); html = await g.text();
  ok(g.status === 200 && html.includes('Monitoramento cancelado') && !(await Alerta.exists({ _id: aid })), 'POST (com Origin do backend, passa pelo CORS) apaga o alerta');
  g = await fetch(link); html = await g.text(); ok(html.includes('já cancelado'), 'link reaberto mostra "já cancelado"');
  g = await fetch(base + '/cancelar/nao-e-id/xyz'); ok(g.status === 400, 'id inválido → 400');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
