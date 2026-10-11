// Checklist de tarefas do admin: abertas pelo sistema, resolvidas pela admin ou sozinhas
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let siteNoAr = false, qdNoAr = false;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/edital')) {
    if (!siteNoAr) { res.writeHead(503); return res.end('fora'); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><body><main>Edital 2026 publicado</main></body></html>');
  }
  if (req.url.startsWith('/novo')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><body><main>Página nova do edital</main></body></html>'); }
  if (req.url.startsWith('/gazettes')) {
    if (!qdNoAr) { res.writeHead(500); return res.end('erro'); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ gazettes: [] }));
  }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise(r => srv.listen(4582, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3991', RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x',
    QUERIDO_DIARIO_API: 'http://127.0.0.1:4582', RADAR_CIDADES: '3304557', DADOS_CHAVE: crypto.randomBytes(32).toString('base64'),
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Mudanca = require(B + '/src/models/Mudanca');
  const TarefaAdmin = require(B + '/src/models/TarefaAdmin');
  const MonitorRadar = require(B + '/src/models/MonitorRadar');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const { processarMonitor } = require(B + '/src/service/radar/radarService');
  const { abrirTarefa } = require(B + '/src/service/tarefasAdmin');
  const { gerarTarefasDeSaude } = require(B + '/src/service/saudeSistema');
  const { cifrar } = require(B + '/src/utils/cripto');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3991' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  const u = await Usuario.create({ nome: 'Ana Souza', email: 'ana@x.com', senha: '12345678' });
  const adm = await Usuario.create({ nome: 'Adm', email: 'adm@x.com', senha: '12345678', role: 'admin' });
  const tu = jwt.sign({ id: u._id }, 'x'), ta = jwt.sign({ id: adm._id }, 'x');

  // ── deduplicação
  await abrirTarefa({ chave: 'x:1', tipo: 'manual', titulo: 'A' });
  await Promise.all([abrirTarefa({ chave: 'x:1', tipo: 'manual', titulo: 'A' }), abrirTarefa({ chave: 'x:1', tipo: 'manual', titulo: 'A' })]);
  const dup = await TarefaAdmin.find({ chave: 'x:1' });
  ok(dup.length === 1 && dup[0].ocorrencias === 3, 'mesmo problema repetido = 1 tarefa contando 3 ocorrências (inclusive em paralelo)');
  await TarefaAdmin.deleteMany({});

  // ── página que não abre: 3 falhas → alerta pausado + tarefa urgente
  const urlEdital = 'http://127.0.0.1:4582/edital';
  let alerta = await Alerta.create({ url: urlEdital, email: 'ana@x.com', usuario: u._id, titulo: 'Edital IBGE', hashConteudo: 'abc' });
  for (let i = 0; i < 3; i++) { alerta = await Alerta.findById(alerta._id).populate('usuario'); await executarMonitoramento([alerta]); }
  alerta = await Alerta.findById(alerta._id);
  let tarefas = await TarefaAdmin.find({ status: 'aberta' }).lean();
  ok(alerta.status === 'pausado' && tarefas.length === 1 && tarefas[0].tipo === 'alerta-pausado' && tarefas[0].prioridade === 'alta' && String(tarefas[0].alerta) === String(alerta._id), 'site fora do ar 3x: alerta pausado e tarefa urgente no checklist');

  let r = await call('GET', '/api/admin/tarefas', tu);
  ok(r.status === 403, 'checklist é só para admin');
  r = await call('GET', '/api/admin/tarefas', ta);
  const t1 = r.data.tarefas[0];
  ok(r.data.abertas === 1 && t1.usuario.email === 'ana@x.com' && t1.alerta.url === urlEdital && t1.link === urlEdital, 'admin vê a tarefa com a pessoa, o alerta e o link para conferir');
  r = await call('GET', '/api/admin/dashboard', ta);
  ok(r.data.dados.tarefasAbertas === 1, 'painel mostra o número de tarefas pendentes');

  // ── "tentar de novo": o site voltou → a tarefa fecha sozinha na próxima leitura
  siteNoAr = true;
  r = await call('POST', `/api/admin/tarefas/${t1.id}/reativar-alerta`, ta);
  ok(r.status === 200, 'admin reativa o alerta pausado');
  await executarMonitoramento([await Alerta.findById(alerta._id).populate('usuario')]);
  let t = await TarefaAdmin.findById(t1.id);
  ok(t.status === 'concluida' && t.concluidaPor === 'sistema' && !(await Alerta.findById(alerta._id)).tarefaAberta, 'página voltou a abrir: tarefa concluída automaticamente');

  // ── avisar a pessoa manualmente (ex.: link direto do edital)
  siteNoAr = false;
  await Alerta.updateOne({ _id: alerta._id }, { falhasSeguidas: 0 });
  for (let i = 0; i < 3; i++) await executarMonitoramento([await Alerta.findById(alerta._id).populate('usuario')]);
  t = await TarefaAdmin.findOne({ status: 'aberta' });
  ok(t && String(t._id) !== t1.id, 'problema voltou depois de resolvido: abre uma tarefa nova');
  sent.length = 0;
  r = await call('POST', `/api/admin/tarefas/${t._id}/avisar`, ta, { mensagem: 'Saiu o edital! <b>Prazo</b> até sexta.', link: 'javascript:alert(1)' });
  ok(r.status === 400, 'link do aviso precisa ser http(s)');
  r = await call('POST', `/api/admin/tarefas/${t._id}/avisar`, ta, { mensagem: 'Saiu o edital! <b>Prazo</b> até sexta.', link: 'https://exemplo.gov.br/edital.pdf' });
  const mud = await Mudanca.findOne({ alertaId: alerta._id, 'resumo.titulo': 'Atualização da equipe' }).lean();
  ok(r.status === 200 && sent[0]?.to === 'ana@x.com' && sent[0].html.includes('https://exemplo.gov.br/edital.pdf') && sent[0].html.includes('&lt;b&gt;Prazo') && sent[0].subject.includes('Edital IBGE'), 'aviso vai por e-mail para a pessoa, com o link e o texto escapado');
  ok(mud?.resumo?.titulo === 'Atualização da equipe' && mud.resumo.resumo.includes('edital.pdf'), 'o aviso aparece no histórico do alerta da pessoa');
  t = await TarefaAdmin.findById(t._id);
  ok(t.status === 'concluida' && t.concluidaPor === 'adm@x.com' && t.nota.startsWith('Pessoa avisada'), 'enviar o aviso já dá ok na tarefa, com nota');

  // ── trocar o endereço da página
  await TarefaAdmin.updateOne({ _id: t._id }, { status: 'aberta', concluidaEm: null });
  r = await call('POST', `/api/admin/tarefas/${t._id}/trocar-url`, ta, { url: 'http://127.0.0.1:4582/novo' });
  alerta = await Alerta.findById(alerta._id);
  ok(r.status === 200 && alerta.url === 'http://127.0.0.1:4582/novo' && alerta.status === 'ativo' && alerta.hashConteudo === null, 'trocar endereço: alerta reativado com a nova URL');
  sent.length = 0;
  await executarMonitoramento([await Alerta.findById(alerta._id).populate('usuario')]);
  ok(sent.length === 0 && (await Alerta.findById(alerta._id)).hashConteudo, 'a primeira leitura do endereço novo vira a base (sem alarme falso)');

  // ── lembrete manual, dar ok e reabrir
  r = await call('POST', '/api/admin/tarefas', ta, { titulo: 'Conferir edital da Cesgranrio', link: 'https://www.cesgranrio.org.br/' });
  const idManual = r.data.tarefa.id;
  ok(r.status === 201 && r.data.tarefa.tipo === 'manual', 'admin cria lembrete manual');
  r = await call('PATCH', `/api/admin/tarefas/${idManual}`, ta, { status: 'concluida', nota: 'feito' });
  ok(r.data.tarefa.status === 'concluida' && r.data.tarefa.nota === 'feito', 'dar ok com nota');
  r = await call('GET', '/api/admin/tarefas?status=concluida', ta);
  ok(r.data.tarefas.some(x => x.id === idManual), 'concluídas ficam no histórico');
  r = await call('PATCH', `/api/admin/tarefas/${idManual}`, ta, { status: 'aberta' });
  ok(r.data.tarefa.status === 'aberta', 'reabrir tarefa');

  // ── Radar: fonte fora do ar vira tarefa, sem nome da pessoa (LGPD); volta → fecha
  const mon = await MonitorRadar.create({ usuario: u._id, nomeCifrado: cifrar('Ana Souza'), cidades: ['3304557'], consentimento: { aceitoEm: new Date(), versao: '1' } });
  await processarMonitor(await MonitorRadar.findById(mon._id).populate('usuario'));
  t = await TarefaAdmin.findOne({ chave: 'fonte:querido-diario', status: 'aberta' }).lean();
  ok(t && t.tipo === 'fonte-radar' && !JSON.stringify(t).includes('Ana') && t.link, 'fonte do Radar fora do ar: tarefa com link para conferir e sem o nome da pessoa');
  qdNoAr = true;
  await processarMonitor(await MonitorRadar.findById(mon._id).populate('usuario'));
  ok((await TarefaAdmin.findById(t._id)).status === 'concluida', 'fonte voltou: tarefa fecha sozinha');

  // ── verificação diária: configuração faltando vira tarefa e fecha quando preenchida
  delete process.env.GEMINI_API_KEY;
  await gerarTarefasDeSaude();
  ok(await TarefaAdmin.exists({ chave: 'config:ia', status: 'aberta' }), 'verificação diária: falta GEMINI_API_KEY → tarefa "Configurar: IA"');
  process.env.GEMINI_API_KEY = 'x';
  await gerarTarefasDeSaude();
  ok(!(await TarefaAdmin.exists({ chave: 'config:ia', status: 'aberta' })), 'chave preenchida: tarefa fecha sozinha');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
