// Prazos: datas da IA viram prazos, Código Vermelho, "já fiz", agenda .ics e checklist
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let versao = 1;
const servidor = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<html><head><title>Concurso TJ</title></head><body><main><p>Gabarito preliminar versão ${versao}. Recursos de 20 a 22.</p></main></body></html>`);
});

const diaISO = (dias) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);
// data e hora de Brasília daqui a N horas
const daquiA = (h) => { const d = new Date(Date.now() + h * 3600e3 - 3 * 3600e3).toISOString(); return { data: d.slice(0, 10), hora: d.slice(11, 16) }; };

(async () => {
  await new Promise(r => servidor.listen(4583, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3992',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://localhost:3992', FRONTEND_URL: 'https://notifica.dev.br', GEMINI_API_KEY: 'k',
  });
  const axios = require(B + '/node_modules/axios');
  let respostaIA = null;
  const postOriginal = axios.post;
  axios.post = async (url, body, opts) => {
    if (!url.includes('generativelanguage.googleapis.com')) return postOriginal(url, body, opts);
    return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify(respostaIA) }] } }] } };
  };
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Prazo = require(B + '/src/models/Prazo');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const { executarCodigoVermelho, linkFeito } = require(B + '/src/service/prazos');
  const { sanitizarResumo } = require(B + '/src/service/resumoMudanca');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3992';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null), r }; };

  // ── IA: tipo, hora e documentos são validados
  const s = sanitizarResumo({ titulo: 'Saiu o gabarito', resumo: 'x', datas: [
    { descricao: 'Prazo de recurso', data: diaISO(5), hora: '18:00', tipo: 'recurso' },
    { descricao: 'Algo', data: diaISO(6), hora: '25:99', tipo: 'invasao' },
  ], documentos: ['RG original', '', 'x'.repeat(300)] });
  ok(s.datas[0].tipo === 'recurso' && s.datas[0].hora === '18:00' && s.datas[1].tipo === 'outro' && !s.datas[1].hora && s.documentos.length === 2 && s.documentos[1].length === 120,
    'resposta da IA: tipo e hora validados, documentos vazios descartados e limitados');

  // ── mudança na página (Pro) → prazos com checklist de documentos
  const pro = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const free = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678' });
  const url = 'http://127.0.0.1:4583/tj';
  const aPro = await Alerta.create({ url, email: 'ana@x.com', usuario: pro._id, titulo: 'Concurso TJ', hashConteudo: 'antigo', ultimoConteudo: 'Gabarito em breve.' });
  const aFree = await Alerta.create({ url, email: 'bia@x.com', usuario: free._id, titulo: 'Concurso TJ', hashConteudo: 'antigo', ultimoConteudo: 'Gabarito em breve.' });
  respostaIA = { relevante: true, titulo: 'Saiu o gabarito preliminar', resumo: 'Recursos de 20 a 22.', datas: [
    { descricao: 'Prazo de recurso do gabarito', data: diaISO(2), hora: '18:00', tipo: 'recurso' },
    { descricao: 'Entrega de documentos', data: diaISO(10), tipo: 'documentos' },
  ], documentos: ['RG original e cópia', 'Diploma'] };
  await executarMonitoramento(await Alerta.find({ _id: { $in: [aPro._id, aFree._id] } }).select('+ultimoConteudo +linksPdf').populate('usuario'));
  let prazos = await Prazo.find({ usuario: pro._id }).sort({ data: 1 }).lean();
  ok(prazos.length === 2 && prazos[0].tipo === 'recurso' && prazos[0].hora === '18:00' && prazos[0].origem === 'ia' && prazos[0].url === url && prazos[0].contexto === 'Concurso TJ',
    'datas achadas pela IA viram prazos do Pro (recurso do gabarito com hora)');
  ok(prazos[1].checklist.map(c => c.item).join('|') === 'RG original e cópia|Diploma' && prazos[0].checklist.length === 0, 'documentos exigidos viram o checklist do prazo de documentos');
  ok(await Prazo.countDocuments({ usuario: free._id }) === 0, 'Free não ganha prazos automáticos');

  // mesma data de novo (página mudou outra vez) não duplica
  versao = 2;
  await Alerta.updateOne({ _id: aPro._id }, { proximaVerificacao: new Date() });
  await executarMonitoramento(await Alerta.find({ _id: aPro._id }).select('+ultimoConteudo +linksPdf').populate('usuario'));
  ok(await Prazo.countDocuments({ usuario: pro._id }) === 2, 'a mesma data detectada de novo não duplica o prazo');

  // ── API
  const tp = jwt.sign({ id: pro._id }, 'x'), tf = jwt.sign({ id: free._id }, 'x');
  let r = await call('GET', '/api/prazos', tp);
  ok(r.status === 200 && r.data.prazos.length === 2 && r.data.prazos[0].limite === new Date(`${diaISO(2)}T18:00:00-03:00`).toISOString(), 'lista os prazos com o momento limite no horário de Brasília');
  r = await call('POST', '/api/prazos', tf, { titulo: 'Pagar taxa', data: diaISO(3) });
  ok(r.status === 403, 'criar prazo é do Pro');
  r = await call('POST', '/api/prazos', tp, { titulo: 'Pagar taxa', data: '2026-13-40' });
  ok(r.status === 400, 'data inválida é recusada');
  r = await call('POST', '/api/prazos', tp, { titulo: 'Pagar taxa de inscrição', ...daquiA(10), tipo: 'inscricao' });
  const manual = r.data.prazo;
  ok(r.status === 201 && manual.origem === 'manual' && manual.tipo === 'inscricao', 'Pro cria prazo à mão');
  const docId = prazos[1]._id;
  const itemId = (await call('GET', '/api/prazos', tp)).data.prazos.find(p => p.id === String(docId)).checklist[0].id;
  r = await call('PATCH', `/api/prazos/${docId}`, tp, { checklistItem: { id: itemId, feito: true } });
  ok(r.data.prazo.checklist[0].feito === true, 'marcar item do checklist');
  r = await call('PATCH', `/api/prazos/${docId}`, tp, { novoItem: 'Comprovante de residência' });
  ok(r.data.prazo.checklist.length === 3, 'adicionar item ao checklist');
  r = await call('PATCH', `/api/prazos/${docId}`, tf, { concluido: true });
  ok(r.status === 404, 'não dá para mexer no prazo de outra pessoa');

  // ── Código Vermelho
  sent.length = 0;
  const agora = new Date();
  let n = await executarCodigoVermelho(agora);
  const vermelho = sent.filter(m => m.subject.includes('Pagar taxa'));
  ok(vermelho.length === 1 && vermelho[0].subject.startsWith('🔴') && vermelho[0].html.includes('CÓDIGO VERMELHO') && vermelho[0].html.includes('/prazo-feito/'), 'prazo em menos de 24h: e-mail 🔴 com botão "já fiz"');
  const doRecurso = sent.filter(m => m.subject.includes('recurso'));
  ok(doRecurso.length === 1 && doRecurso[0].subject.startsWith('🟠'), 'recurso em ~2 dias: lembrete de 72h (🟠)');
  ok(!sent.some(m => m.subject.includes('documentos')), 'prazo daqui a 10 dias ainda não avisa');
  n = await executarCodigoVermelho(agora);
  ok(n === 0, 'rodar de novo na mesma hora não repete lembretes');
  const p72 = await Prazo.findOne({ titulo: /recurso/ });
  ok(p72.lembretes.includes(72) && !p72.lembretes.includes(24), 'marco de 72h registrado; o de 24h ainda vai ser enviado');
  sent.length = 0;
  await executarCodigoVermelho(new Date(new Date(`${diaISO(2)}T18:00:00-03:00`).getTime() - 20 * 3600e3));
  ok(sent.length === 1 && sent[0].subject.includes('recurso') && sent[0].subject.startsWith('🔴'), 'chegando a 24h: manda o lembrete de 24h, uma vez');
  sent.length = 0;
  await executarCodigoVermelho(new Date(new Date(`${diaISO(2)}T18:00:00-03:00`).getTime() - 2 * 3600e3));
  ok(sent.length === 1 && /Faltam 2 horas/.test(sent[0].subject), 'faltando 2h: lembrete de 3h');

  // free com prazo manual antigo (perdeu o Pro) não recebe
  await Prazo.create({ usuario: free._id, titulo: 'Prazo antigo', data: diaISO(1) });
  sent.length = 0;
  await executarCodigoVermelho();
  ok(!sent.some(m => m.to === 'bia@x.com'), 'quem não é Pro não recebe o Código Vermelho');

  // ── "já fiz" pelo link do e-mail
  const pManual = await Prazo.findById(manual.id);
  const link = linkFeito(pManual._id);
  let pg = await fetch(link);
  ok(pg.status === 200 && (await pg.text()).includes('Já fez?') && !(await Prazo.findById(manual.id)).concluidoEm, 'abrir o link só pede confirmação (leitor de e-mail não conclui sozinho)');
  pg = await fetch(link, { method: 'POST' });
  ok(pg.status === 200 && (await Prazo.findById(manual.id)).concluidoEm, 'confirmar: prazo concluído e os lembretes param');
  pg = await fetch(link.replace(/[0-9a-f]{64}$/, 'f'.repeat(64)));
  ok(pg.status === 400, 'link com token errado é recusado');
  r = await call('GET', '/api/prazos', tp);
  ok(r.data.concluidos.some(p => p.id === manual.id) && !r.data.prazos.some(p => p.id === manual.id), 'concluído sai da lista de abertos');

  // ── agenda assinável
  r = await call('POST', '/api/prazos/agenda', tp);
  const agenda = r.data.agenda;
  ok(r.status === 200 && /\/agenda\/[A-Za-z0-9_-]{32}\.ics$/.test(agenda), 'gera link da agenda');
  let ics = await fetch(agenda);
  let texto = await ics.text();
  ok(ics.headers.get('content-type').startsWith('text/calendar') && texto.includes('X-WR-CALNAME') && texto.includes('Prazo de recurso do gabarito') && texto.includes('TRIGGER:-PT3H') && texto.includes('✅ Pagar taxa'),
    'feed .ics com os prazos, lembretes 1 dia e 3h antes e concluídos marcados ✅');
  r = await call('POST', '/api/prazos/agenda', tp);
  ok((await fetch(agenda)).status === 404 && (await fetch(r.data.agenda)).status === 200, 'trocar o link revoga o antigo');
  await Usuario.updateOne({ _id: pro._id }, { 'plano.tipo': 'free' });
  texto = await (await fetch(r.data.agenda)).text();
  ok(!texto.includes('BEGIN:VEVENT'), 'sem Pro, a agenda fica vazia (o link continua válido)');

  r = await call('DELETE', `/api/prazos/${docId}`, tp);
  ok(r.status === 200 && !(await Prazo.findById(docId)), 'apagar prazo');

  servidor.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
