// Painel da dona: quem criou conta, quem usou, quem pagou, reclamações e sugestões
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3979',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', FRONTEND_URL: 'https://notifica.dev.br',
    MP_ACCESS_TOKEN: 'tok', MP_PUBLIC_KEY: 'pub',
  });
  delete process.env.MP_WEBHOOK_SECRET;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  const mp = require(B + '/src/service/mercadoPago');
  const pre = {}, cobrancas = {};
  mp.buscarAssinatura = async (id) => pre[id];
  mp.buscarPagamentoAutorizado = async (id) => cobrancas[id];

  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Transacao = require(B + '/src/models/Transacao');
  const Feedback = require(B + '/src/models/Feedback');
  const { processarPagamentoPix } = require(B + '/src/service/assinaturaService');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3979';
  const call = async (method, p, token, body, ip = '10.0.0.1') => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => null) };
  };

  // ── Login: e-mail com maiúscula (teclado do celular) e e-mail que não é texto
  let r = await call('POST', '/api/auth/cadastro', null, { nome: 'Ana', email: '  Ana@X.com ', senha: '12345678' });
  ok(r.status === 201 || r.status === 200, 'cadastro com maiúscula e espaços funciona');
  const ana = await Usuario.findOne({ email: 'ana@x.com' });
  r = await call('POST', '/api/auth/cadastro', null, { nome: 'Ana 2', email: 'ANA@x.com', senha: '12345678' });
  ok(r.status === 409, 'mesmo e-mail com outra caixa: "já cadastrado" (antes dava erro 500)');
  r = await call('POST', '/api/auth/login', null, { email: 'Ana@x.com', senha: '12345678' });
  ok(r.status === 200 && r.data.sucesso, 'login com a 1ª letra maiúscula entra');
  r = await call('POST', '/api/auth/login', null, { email: { $ne: null }, senha: '12345678' });
  ok(r.status === 401, 'login com objeto no lugar do e-mail é recusado');
  await sleep(150);
  ok((await Usuario.findById(ana._id)).ultimoAcessoEm > new Date(Date.now() - 60e3), 'login registra o último acesso');

  // Uso do site logado também conta (no máx. 1x por hora)
  const bia = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678', criadoEm: new Date(Date.now() - 40 * DIA), ultimoAcessoEm: new Date(Date.now() - 20 * DIA) });
  const tb = jwt.sign({ id: bia._id }, 'x');
  await call('GET', '/api/alertas', tb); await sleep(150);
  const acesso1 = (await Usuario.findById(bia._id)).ultimoAcessoEm;
  ok(acesso1 > new Date(Date.now() - 60e3), 'usar o site logado atualiza o último acesso');
  await call('GET', '/api/alertas', tb); await sleep(150);
  ok((await Usuario.findById(bia._id)).ultimoAcessoEm.getTime() === acesso1.getTime(), 'não grava de novo na mesma hora');

  // ── Reclamações e sugestões
  r = await call('POST', '/api/feedbacks', null, { email: 'visitante@x.com', mensagem: 'O site não abre o edital da FGV', tipo: 'reclamacao', pagina: '/painel' });
  ok(r.status === 201, 'visitante envia reclamação');
  r = await call('POST', '/api/feedbacks', tb, { email: 'outro@x.com', mensagem: 'Podia ter aviso por WhatsApp', tipo: 'sugestao' });
  const sugestao = await Feedback.findOne({ tipo: 'sugestao' }).lean();
  ok(r.status === 201 && sugestao.email === 'bia@x.com' && String(sugestao.usuario) === String(bia._id), 'logada: a mensagem vai com o e-mail e a conta dela');
  ok((await call('POST', '/api/feedbacks', null, { email: 'nao-e-email', mensagem: 'oi oi' })).status === 400, 'e-mail inválido é recusado');
  ok((await call('POST', '/api/feedbacks', null, { email: 'a@x.com', mensagem: 'x'.repeat(2001) })).status === 400, 'mensagem gigante é recusada');
  ok((await call('POST', '/api/feedbacks', null, { email: 'a@x.com', mensagem: 'oi oi', tipo: 'hack' }, '10.0.0.9')).status === 201 && await Feedback.exists({ tipo: 'outro', email: 'a@x.com' }), 'tipo desconhecido vira "outro"');
  for (let i = 0; i < 5; i++) await call('POST', '/api/feedbacks', null, { email: 'spam@x.com', mensagem: 'spam spam' }, '10.0.0.50');
  ok((await call('POST', '/api/feedbacks', null, { email: 'spam@x.com', mensagem: 'spam spam' }, '10.0.0.50')).status === 429, 'mais de 5 em 10 minutos do mesmo IP: bloqueia');

  const adm = await Usuario.create({ nome: 'Aísha', email: 'dona@x.com', senha: '12345678', role: 'admin' });
  const ta = jwt.sign({ id: adm._id }, 'x');
  const reclamacao = await Feedback.findOne({ tipo: 'reclamacao' });
  ok((await call('PATCH', `/api/feedbacks/${reclamacao._id}`, tb, { status: 'resolvido' })).status === 403, 'só a dona muda o status');
  r = await call('PATCH', `/api/feedbacks/${reclamacao._id}`, ta, { status: 'em-andamento' });
  ok(r.status === 200 && r.data.feedback.status === 'em-andamento', 'dona marca "em andamento"');
  sent.length = 0;
  r = await call('POST', `/api/feedbacks/${reclamacao._id}/responder`, ta, { resposta: 'Oi! Já corrigimos.\n\nObrigada <3' });
  const fr = await Feedback.findById(reclamacao._id).lean();
  ok(r.status === 200 && sent.length === 1 && sent[0].to === 'visitante@x.com' && sent[0].html.includes('Já corrigimos') && sent[0].html.includes('&lt;3') && sent[0].html.includes('não abre o edital'), 'responder manda e-mail com a resposta e a mensagem original (HTML escapado)');
  ok(fr.status === 'resolvido' && fr.resposta.startsWith('Oi!') && fr.respondidoEm, 'resposta fica guardada e a mensagem vira "resolvido"');
  require(B + '/src/utils/mailer').sendMail = async () => { throw new Error('fora'); };
  r = await call('POST', `/api/feedbacks/${sugestao._id}/responder`, ta, { resposta: 'Anotado!' });
  ok(r.status === 502 && !(await Feedback.findById(sugestao._id)).resposta, 'e-mail falhou: avisa e não marca como respondida');
  require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };

  // ── Pagamentos: Pix e cobranças do cartão
  const caio = await Usuario.create({ nome: 'Caio', email: 'caio@x.com', senha: '12345678' });
  const ref = `${caio._id}:pix:1`;
  await Transacao.create({ tipo: 'pix', usuario: caio._id, externalReference: ref, oferta: 'pix-30-dias', valor: 20, dias: 30 });
  await processarPagamentoPix({ id: 555, status: 'approved', transaction_amount: 20, external_reference: ref });
  await Transacao.create({ tipo: 'pix', usuario: bia._id, externalReference: `${bia._id}:pix:2`, oferta: 'pix-30-dias', valor: 20, dias: 30, status: 'pending' });

  await Transacao.create({ tipo: 'assinatura', usuario: ana._id, externalReference: `${ana._id}:assinatura:1`, oferta: 'pro-anual', valor: 120, mpId: 'pre_ana', status: 'authorized' });
  pre.pre_ana = { id: 'pre_ana', status: 'authorized', external_reference: `${ana._id}:assinatura:1`, next_payment_date: new Date(Date.now() + 365 * DIA).toISOString(), auto_recurring: { transaction_amount: 120, frequency: 12, frequency_type: 'months' } };
  cobrancas.c9 = { id: 'c9', preapproval_id: 'pre_ana', status: 'processed', transaction_amount: 120, payment: { status: 'approved' } };
  for (let i = 0; i < 2; i++) await fetch(`${base}/api/webhooks/mercadopago?data.id=c9&type=subscription_authorized_payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  ok(await Transacao.countDocuments({ tipo: 'cobranca', mpId: 'c9', valor: 120, oferta: 'pro-anual' }) === 1, 'cobrança aprovada do cartão fica registrada uma vez só (mesmo com aviso repetido do MP)');

  ok((await call('GET', '/api/admin/pagamentos', tb)).status === 403, 'só a dona vê os pagamentos');
  r = await call('GET', '/api/admin/pagamentos', ta);
  const p = r.data;
  ok(r.status === 200 && p.resumo.totalRecebido === 140 && p.resumo.pagamentosAprovados === 2 && p.resumo.pessoasQuePagaram === 2, 'resumo: total recebido, pagamentos e quantas pessoas pagaram');
  const pixCaio = p.pagamentos.find((x) => x.tipo === 'pix' && x.usuario?.nome === 'Caio');
  const pendente = p.pagamentos.find((x) => x.usuario?.nome === 'Bia');
  ok(pixCaio?.pago && pixCaio.usuario.email === 'caio@x.com' && pendente && !pendente.pago && pendente.statusTexto === 'Aguardando', 'lista mostra quem pagou (nome e e-mail) e o que ficou pendente');
  ok(p.resumo.meses.length === 1 && p.resumo.meses[0].total === 140, 'recebido por mês');

  // ── Visão geral e lista de usuários
  r = await call('GET', '/api/admin/dashboard', ta);
  const d = r.data.dados;
  const ua = d.users.find((u) => u.email === 'ana@x.com');
  const uc = d.users.find((u) => u.email === 'caio@x.com');
  ok(ua.nome === 'Ana' && ua.ultimoAcessoEm && ua.totalPago === 120 && uc.totalPago === 20 && uc.pagamentos === 1, 'usuários: nome, último acesso e quanto cada um pagou');
  ok(d.crescimento.cadastros7d === 3 && d.crescimento.cadastros30d === 3 && d.crescimento.ativos7d === 3, 'cadastros e pessoas ativas nos últimos 7 dias (Ana, Bia e a dona; Caio nunca entrou)');
  ok(d.crescimento.reclamacoesAbertas === 0 && d.crescimento.feedbacksNovos >= 2, 'contagem de mensagens novas e reclamações abertas');
  ok(d.feedbacks.some((f) => f.tipo === 'sugestao' && f.status === 'novo'), 'feedbacks chegam com tipo e status');

  // ── Pagamentos que dão errado
  const pays = {};
  mp.buscarPagamento = async (id) => pays[id];
  const TarefaAdmin = require(B + '/src/models/TarefaAdmin');
  const webhook = (tipo, id) => fetch(`${base}/api/webhooks/mercadopago?data.id=${id}&type=${tipo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

  // Renovação recusada no cartão: avisa a pessoa uma vez, mesmo com o MP retentando
  sent.length = 0;
  cobrancas.c10 = { id: 'c10', preapproval_id: 'pre_ana', status: 'recycling', transaction_amount: 120, payment: { status: 'rejected' } };
  await webhook('subscription_authorized_payment', 'c10'); await webhook('subscription_authorized_payment', 'c10'); await sleep(150);
  const avisosRecusa = sent.filter((m) => m.to === 'ana@x.com' && m.subject.includes('Não conseguimos cobrar'));
  ok(avisosRecusa.length === 1 && avisosRecusa[0].html.includes('/planos'), 'cartão recusado na renovação: e-mail para a pessoa (uma vez só)');
  ok((await Transacao.findOne({ externalReference: 'cobranca:c10' })).status === 'rejected', 'cobrança recusada aparece em Pagamentos como "Recusado"');
  cobrancas.c10 = { id: 'c10', preapproval_id: 'pre_ana', status: 'processed', transaction_amount: 120, payment: { status: 'approved' } };
  await webhook('subscription_authorized_payment', 'c10'); await webhook('subscription_authorized_payment', 'c10');
  const c10 = await Transacao.find({ externalReference: 'cobranca:c10' }).lean();
  ok(c10.length === 1 && c10[0].status === 'approved' && c10[0].processadoEm, 'nova tentativa aprovada: a mesma cobrança vira "Pago" (sem duplicar)');

  // O MP encerra a assinatura (sem a pessoa cancelar): ela fica sabendo até quando vale
  sent.length = 0;
  pre.pre_ana = { ...pre.pre_ana, status: 'cancelled' };
  await webhook('subscription_preapproval', 'pre_ana'); await webhook('subscription_preapproval', 'pre_ana'); await sleep(150);
  const encerrada = sent.filter((m) => m.to === 'ana@x.com' && m.subject.includes('encerrada'));
  ok(encerrada.length === 1 && /continua valendo até <strong>\d{2}\/\d{2}\/\d{4}/.test(encerrada[0].html) && (await Usuario.findById(ana._id)).plano.status === 'cancelado', 'assinatura encerrada pelo MP: e-mail com a data até quando o Pro vale (uma vez)');

  // Pix devolvido/contestado: tira os dias, abre tarefa e sai do total recebido
  const antes = (await Usuario.findById(caio._id)).plano.validoAte.getTime();
  pays['555'] = { id: 555, status: 'charged_back', transaction_amount: 20, external_reference: ref };
  await webhook('payment', '555'); await webhook('payment', '555');
  const caioDepois = await Usuario.findById(caio._id);
  ok(Math.round((antes - caioDepois.plano.validoAte.getTime()) / DIA) === 30, 'Pix contestado: os 30 dias comprados são retirados (uma vez só)');
  const tarefaPix = await TarefaAdmin.findOne({ chave: 'estorno:555' }).lean();
  ok(tarefaPix?.prioridade === 'alta' && tarefaPix.titulo.includes('contestado') && tarefaPix.titulo.includes('caio@x.com'), 'Pix contestado: tarefa de prioridade alta no admin');
  r = await call('GET', '/api/admin/pagamentos', ta);
  ok(r.data.resumo.totalRecebido === 240 && r.data.pagamentos.find((x) => x.tipo === 'pix' && x.usuario?.nome === 'Caio')?.statusTexto === 'Contestado no banco', 'dinheiro devolvido sai do total recebido e aparece como "Contestado no banco"');

  // Estorno de uma cobrança do cartão: tarefa para a dona conferir
  pays['888'] = { id: 888, status: 'refunded', transaction_amount: 120, external_reference: `${ana._id}:assinatura:1` };
  await webhook('payment', '888');
  const tarefaCartao = await TarefaAdmin.findOne({ chave: 'estorno:888' }).lean();
  ok(tarefaCartao?.titulo.includes('estornado') && tarefaCartao.titulo.includes('ana@x.com'), 'cartão estornado: tarefa no admin com o e-mail da pessoa');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
