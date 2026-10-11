// Nomeação/posse pelo Radar e validade do concurso
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DIA = 864e5;

let gazettes = [];
const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ gazettes })); });

(async () => {
  await new Promise(r => srv.listen(4588, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3981',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', QUERIDO_DIARIO_API: 'http://127.0.0.1:4588', RADAR_CIDADES: '3304557',
    DADOS_CHAVE: crypto.randomBytes(32).toString('base64'),
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Prazo = require(B + '/src/models/Prazo');
  const MonitorRadar = require(B + '/src/models/MonitorRadar');
  const { processarMonitor } = require(B + '/src/service/radar/radarService');
  const { ehNomeacao, lembrarValidades, Concurso } = require(B + '/src/service/nomeacao');
  const { cifrar } = require(B + '/src/utils/cripto');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3981' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  ok(ehNomeacao(['O Prefeito resolve NOMEAR, em caráter efetivo, ANA SOUZA']) && ehNomeacao(['Convoca os candidatos abaixo para posse']) && !ehNomeacao(['Resultado preliminar: ANA SOUZA, nota 80']), 'reconhece nomeação/convocação/posse (e não confunde com resultado)');

  const u = await Usuario.create({ nome: 'Ana Souza', email: 'ana@x.com', senha: '12345678', emailVerificado: true, plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const mon = await MonitorRadar.create({ usuario: u._id, nomeCifrado: cifrar('Ana Souza'), cidades: ['3304557'], consentimento: { aceitoEm: new Date(), versao: '1' } });

  // citação comum
  gazettes = [{ date: '2026-10-05', territory_id: '3304557', url: 'https://do.rio/1.pdf', excerpts: ['Resultado final: ANA SOUZA, classificação 12'] }];
  await processarMonitor(await MonitorRadar.findById(mon._id).populate('usuario'));
  ok(sent.at(-1)?.subject.startsWith('📰') && !(await Prazo.exists({ usuario: u._id })), 'citação comum: aviso normal, sem prazo de posse');

  // nomeação
  sent.length = 0;
  gazettes = [{ date: '2026-10-09', territory_id: '3304557', url: 'https://do.rio/2.pdf', excerpts: ['Resolve NOMEAR ANA SOUZA para o cargo de Analista, devendo tomar posse no prazo legal'] }];
  await processarMonitor(await MonitorRadar.findById(mon._id).populate('usuario'));
  const prazo = await Prazo.findOne({ usuario: u._id }).lean();
  ok(sent.at(-1)?.subject.startsWith('🚨 URGENTE') && sent.at(-1).html.includes('Pode ser a sua nomeação'), 'nomeação: e-mail 🚨 URGENTE com orientação sobre o prazo de posse');
  ok(prazo && prazo.data === '2026-11-08' && prazo.checklist.length >= 8 && prazo.checklist.some(c => /reservista/i.test(c.item)) && prazo.url === 'https://do.rio/2.pdf', 'cria o prazo de posse (30 dias) com o checklist de documentos');
  await processarMonitor(await MonitorRadar.findById(mon._id).populate('usuario'));
  ok(await Prazo.countDocuments({ usuario: u._id }) === 1, 'a mesma publicação não cria outro prazo');

  // ── validade do concurso
  const t = jwt.sign({ id: u._id }, 'x');
  let r = await call('POST', '/api/concursos', t, { nome: 'TJ-RJ 2025 — Analista', homologadoEm: '2099-01-01' });
  ok(r.status === 400, 'homologação no futuro é recusada');
  const homolog = new Date(Date.now() - (730 - 85) * DIA).toISOString().slice(0, 10); // vence em ~85 dias
  r = await call('POST', '/api/concursos', t, { nome: 'TJ-RJ 2025 — Analista', homologadoEm: homolog, classificacao: 37 });
  const c = r.data.concurso;
  ok(r.status === 201 && c.diasRestantes >= 83 && c.diasRestantes <= 87, `validade de 2 anos calculada (faltam ${c.diasRestantes} dias)`);
  ok(await Prazo.exists({ usuario: u._id, chave: `validade:${c.id}`, data: c.validadeAte }), 'fim da validade entra em Prazos (e na agenda)');

  sent.length = 0;
  await lembrarValidades();
  ok(sent.length === 1 && sent[0].subject.includes('validade') && sent[0].subject.includes('TJ-RJ'), 'faltando ~85 dias: lembrete do marco de 90 dias');
  await lembrarValidades();
  ok(sent.length === 1, 'não repete o mesmo lembrete');

  r = await call('PATCH', `/api/concursos/${c.id}`, t, { prorrogado: true });
  ok(r.data.concurso.diasRestantes > 700 && (await Prazo.findOne({ chave: `validade:${c.id}` })).data === r.data.concurso.validadeAte, 'marcou prorrogado: validade +2 anos e o prazo é atualizado');
  ok((await Concurso.findById(c.id)).lembretes.length === 0, 'nova data final: os lembretes recomeçam');

  r = await call('DELETE', `/api/concursos/${c.id}`, t);
  ok(r.status === 200 && !(await Prazo.exists({ chave: `validade:${c.id}` })), 'apagar o concurso remove o prazo da validade');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
