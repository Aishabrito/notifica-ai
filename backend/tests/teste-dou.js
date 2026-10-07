// Radar: driver do Diário Oficial da União e janela de busca por fonte
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── servidores falsos: Querido Diário (/gazettes) e busca do DOU (/consulta)
const consultas = { qd: [], dou: [] };
let douModo = 'ok'; // ok | fora | formato
const resultadosDou = [
  { urlTitle: 'portaria-n-123-de-6-de-outubro-de-2026-1', title: 'PORTARIA Nº 123, DE 6 DE OUTUBRO DE 2026', content: 'Nomear <span class="highlight" style="background:#FFA;">JOÃO PEDRO ALVES</span>, aprovado no concurso, para o cargo de Analista.', pubDate: '07/10/2026', pubName: 'DO2', artType: 'Portaria' },
  { urlTitle: 'edital-n-9-2026', title: 'EDITAL Nº 9', content: 'Resultado: João Pedro Alvesson aprovado.', pubDate: '06/10/2026', pubName: 'DO3', artType: 'Edital' },
];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/gazettes') {
    consultas.qd.push(u);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ gazettes: [{ date: '2026-10-05', territory_id: '3304557', url: 'https://do.rio/a.pdf', excerpts: ['Convoca JOAO PEDRO ALVES para exames'] }] }));
  }
  if (u.pathname === '/consulta') {
    consultas.dou.push(u);
    if (douModo === 'fora') { res.writeHead(503); return res.end('indisponível'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const script = douModo === 'formato' ? '' : `<script id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params" type="application/json">${JSON.stringify({ jsonArray: resultadosDou })}</script>`;
    return res.end(`<html><body><div class="resultados"></div>${script}</body></html>`);
  }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise(r => srv.listen(4580, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3989', RESEND_API_KEY: 're_fake', BASE_URL: 'http://x',
    DADOS_CHAVE: crypto.randomBytes(32).toString('base64'), QUERIDO_DIARIO_API: 'http://127.0.0.1:4580',
    DOU_BUSCA_URL: 'http://127.0.0.1:4580/consulta', DOU_MATERIA_URL: 'https://www.in.gov.br/web/dou/-/',
  });
  delete process.env.RADAR_CIDADES;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const MonitorRadar = require(B + '/src/models/MonitorRadar');
  const OcorrenciaRadar = require(B + '/src/models/OcorrenciaRadar');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3989' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  const u = await Usuario.create({ nome: 'J', email: 'j@x.com', senha: '12345678', emailVerificado: true, plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  const t = jwt.sign({ id: u._id }, 'x');

  let r = await call('GET', '/api/radar', t);
  const douOpcao = r.data.cidades.find(c => c.id === 'DOU');
  ok(r.data.cidades.length === 7 && douOpcao?.nome === 'Diário Oficial da União', 'o DOU aparece como opção junto das 6 cidades');
  r = await call('POST', '/api/radar', t, { nome: 'João Pedro Alves', cidades: ['3304557', 'DOU'], consentimento: true });
  const monId = r.data.monitor.id;
  ok(r.status === 201, 'cadastro com Rio + DOU');

  // ── 1ª busca
  sent.length = 0;
  r = await call('POST', `/api/radar/${monId}/buscar`, t);
  const qd = consultas.qd.at(-1), d = consultas.dou.at(-1);
  ok(qd.searchParams.getAll('territory_ids').join() === '3304557', 'Querido Diário recebe só os municípios (sem "DOU")');
  const hoje = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  const ha30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10).split('-').reverse().join('-');
  ok(d.searchParams.get('q') === '"João Pedro Alves"' && d.searchParams.get('s') === 'todos' && d.searchParams.get('exactDate') === 'personalizado' && d.searchParams.get('publishFrom') === ha30 && d.searchParams.get('publishTo') === hoje,
    `busca no DOU: frase exata, todas as seções, de ${ha30} a ${hoje}`);
  const ocs = await OcorrenciaRadar.find({ monitor: monId }).lean();
  const ocDou = ocs.find(o => o.cidadeId === 'DOU');
  ok(r.data.novas === 2 && ocs.length === 2, 'acha 1 no diário do Rio + 1 no DOU ("Alvesson" é descartado)');
  ok(ocDou && ocDou.url === 'https://www.in.gov.br/web/dou/-/portaria-n-123-de-6-de-outubro-de-2026-1' && ocDou.dataPublicacao === '2026-10-07' && ocDou.edicao === 'Seção 2', 'ocorrência do DOU: link da matéria, data e seção');
  await sleep(150);
  ok(sent[0]?.html.includes('Diário Oficial da União') && !sent[0].html.includes('Diário Oficial de Diário') && sent[0].html.includes('Diário Oficial do Rio de Janeiro'), 'e-mail nomeia certo: "Diário Oficial da União" e "Diário Oficial do Rio de Janeiro"');
  r = await call('GET', '/api/radar/ocorrencias', t);
  const listaDou = r.data.ocorrencias.find(o => o.diario === 'Diário Oficial da União');
  ok(listaDou && listaDou.trechos.some(tr => tr.includes('JOÃO PEDRO ALVES') && !tr.includes('<span')), 'trecho do DOU sem HTML, decifrado só para o dono');

  // ── DOU fora do ar: a janela do Querido Diário avança, a do DOU não
  douModo = 'fora';
  await call('POST', `/api/radar/${monId}/buscar`, t);
  let mon = await MonitorRadar.findById(monId);
  const tQd = mon.buscasPorFonte.get('querido-diario'), tDou = mon.buscasPorFonte.get('dou');
  ok(tQd > tDou, 'DOU fora do ar: só a janela do Querido Diário avança');
  douModo = 'ok';
  await MonitorRadar.updateOne({ _id: monId }, { [`buscasPorFonte.querido-diario`]: new Date(), [`buscasPorFonte.dou`]: new Date(Date.now() - 10 * 864e5) });
  await call('POST', `/api/radar/${monId}/buscar`, t);
  const desdeQd = consultas.qd.at(-1).searchParams.get('published_since');
  const desdeDou = consultas.dou.at(-1).searchParams.get('publishFrom');
  ok(Math.round((Date.now() - Date.parse(desdeQd)) / 864e5) === 3 && desdeDou === new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10).split('-').reverse().join('-'),
    'cada fonte busca a partir da sua última busca bem-sucedida (QD: 3 dias; DOU: 10 + 3 dias)');

  // ── página do DOU mudou de formato: erro tratado, sem derrubar nada
  douModo = 'formato';
  r = await call('POST', `/api/radar/${monId}/buscar`, t);
  ok(r.status === 200, 'formato inesperado da página do DOU não derruba a busca (o erro fica no log de auditoria)');

  // ── sem DOU marcado, o DOU não é consultado
  const antes = consultas.dou.length;
  await MonitorRadar.updateOne({ _id: monId }, { cidades: ['3304557'] });
  await call('POST', `/api/radar/${monId}/buscar`, t);
  ok(consultas.dou.length === antes, 'quem não marcou o DOU não gera consulta ao DOU');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
