// Radar de editais por interesse
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const consultas = [];
let gazettes = [
  { date: '2026-10-08', territory_id: '3304557', url: 'https://do.rio/1.pdf', excerpts: ['EDITAL DE ABERTURA do Concurso Público para TÉCNICO DE ENFERMAGEM, 40 vagas, inscrições de 01/11 a 30/11'] },
  { date: '2026-10-07', territory_id: '3304557', url: 'https://do.rio/2.pdf', excerpts: ['Exonera MARIA SILVA do cargo de Técnico de Enfermagem'] },
  { date: '2026-10-06', territory_id: '3304557', url: 'https://do.rio/3.pdf', excerpts: ['Escala de plantão dos técnicos de enfermagem do hospital municipal'] },
];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/gazettes') {
    consultas.push(u);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ gazettes }));
  }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise(r => srv.listen(4585, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3988',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', QUERIDO_DIARIO_API: 'http://127.0.0.1:4585', RADAR_CIDADES: '3304557,3303302',
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const { executarRadarEditais, relevante } = require(B + '/src/service/radar/editais');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3988' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  ok(relevante(['Concurso Público: 10 vagas para Analista de TI'], 'analista de ti')
    && !relevante(['Nomeia o analista de TI João'], 'analista de ti')
    && !relevante(['Concurso para analista de tributos'], 'analista de ti'), 'só conta publicação de concurso/seleção que cita o cargo inteiro');

  const pro = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const free = await Usuario.create({ nome: 'Bia', email: 'bia@x.com', senha: '12345678' });
  const tp = jwt.sign({ id: pro._id }, 'x'), tf = jwt.sign({ id: free._id }, 'x');

  let r = await call('POST', '/api/radar/editais', tf, { termo: 'técnico de enfermagem', cidades: ['3304557'] });
  ok(r.status === 403, 'Radar de editais é do Pro');
  r = await call('POST', '/api/radar/editais', tp, { termo: 'ab', cidades: ['3304557'] });
  ok(r.status === 400, 'termo curto é recusado');
  r = await call('POST', '/api/radar/editais', tp, { termo: 'técnico de enfermagem', cidades: ['9999999'] });
  ok(r.status === 400, 'diário fora da lista é recusado');
  sent.length = 0;
  r = await call('POST', '/api/radar/editais', tp, { termo: 'Técnico de Enfermagem', cidades: ['3304557', '3303302'] });
  ok(r.status === 201 && r.data.encontrados === 1 && sent.length === 0, 'cadastro já busca os últimos 7 dias (1 edital; exoneração e escala descartadas), sem e-mail');
  const c = consultas.at(-1);
  ok(c.searchParams.get('querystring') === '"Técnico de Enfermagem"' && c.searchParams.getAll('territory_ids').join() === '3304557,3303302', 'busca a frase exata nos diários escolhidos');

  r = await call('GET', '/api/radar/editais', tp);
  ok(r.data.interesses.length === 1 && r.data.encontrados.length === 1 && r.data.encontrados[0].diario === 'Diário Oficial do Rio de Janeiro', 'lista interesses e editais encontrados');

  // rodada agendada: edital novo → e-mail
  gazettes = [...gazettes, { date: '2026-10-10', territory_id: '3303302', url: 'https://do.niteroi/9.pdf', excerpts: ['Processo seletivo simplificado: técnico de enfermagem, cadastro reserva'] }];
  await executarRadarEditais();
  await sleep(100);
  ok(sent.length === 1 && sent[0].to === 'ana@x.com' && sent[0].subject.includes('Técnico de Enfermagem') && sent[0].html.includes('do.niteroi/9.pdf') && !sent[0].html.includes('do.rio/1.pdf'), 'rodada agendada avisa só a publicação nova');
  sent.length = 0;
  await executarRadarEditais();
  ok(sent.length === 0, 'a mesma publicação não é avisada duas vezes');

  // limite e remoção
  for (const t of ['enfermeiro', 'auxiliar administrativo', 'professor de matemática', 'agente de saúde']) await call('POST', '/api/radar/editais', tp, { termo: t, cidades: ['3304557'] });
  r = await call('POST', '/api/radar/editais', tp, { termo: 'motorista', cidades: ['3304557'] });
  ok(r.status === 403, 'limite de 5 cargos/áreas');
  const id = (await call('GET', '/api/radar/editais', tp)).data.interesses[0].id;
  r = await call('DELETE', `/api/radar/editais/${id}`, tf);
  ok(r.status === 404, 'não apaga interesse de outra pessoa');
  r = await call('DELETE', `/api/radar/editais/${id}`, tp);
  r = await call('GET', '/api/radar/editais', tp);
  ok(r.data.interesses.length === 4 && r.data.encontrados.every(e => e.interesseId !== id), 'apagar remove o interesse e os editais dele');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
