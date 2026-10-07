const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Querido Diário falso
let gazettes = {}; // querystring → lista
let qdFora = false;
const consultas = [];
const qd = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  consultas.push(u);
  if (qdFora) { res.writeHead(503); return res.end('{}'); }
  const q = u.searchParams.get('querystring') || '';
  const lista = q ? (gazettes[q] || []) : [{ date: '2026-10-06', territory_id: u.searchParams.get('territory_ids'), url: 'x', excerpts: [] }];
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ total_gazettes: lista.length, gazettes: lista }));
});

(async () => {
  await new Promise(r => qd.listen(4566, '127.0.0.1', r));
  const CHAVE = crypto.randomBytes(32).toString('base64');
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3993', RESEND_API_KEY: 're_fake', BASE_URL: 'http://localhost:3993', FRONTEND_URL: 'https://notifica.dev.br', QUERIDO_DIARIO_API: 'http://127.0.0.1:4566', DADOS_CHAVE: CHAVE });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const MonitorRadar = require(B + '/src/models/MonitorRadar');
  const OcorrenciaRadar = require(B + '/src/models/OcorrenciaRadar');
  const LogRadar = require(B + '/src/models/LogRadar');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const base = 'http://localhost:3993';
  const call = async (method, p, token, body) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const PRO = { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' };

  // ── plano e verificação de e-mail
  const free = await Usuario.create({ nome: 'Free', email: 'free@x.com', senha: '12345678' });
  let r = await call('GET', '/api/radar', jwt.sign({ id: free._id }, 'x'));
  ok(r.status === 200 && r.data.ehPro === false && r.data.cidades.length === 6 && r.data.disponivel, 'GET /api/radar: Free vê o radar como exclusivo do Pro + 6 cidades');
  r = await call('POST', '/api/radar', jwt.sign({ id: free._id }, 'x'), { nome: 'Maria da Silva', cidades: ['3304557'], consentimento: true });
  ok(r.status === 403 && r.data.codigo === 'LIMITE_PLANO', 'Free não cadastra nome');

  const ana = await Usuario.create({ nome: 'Ana', email: 'ana@x.com', senha: '12345678', plano: PRO });
  const t = jwt.sign({ id: ana._id }, 'x');
  const nomeOk = { nome: 'José  da Silva', inscricao: 'AB-123456', cpf: '123.456.789-09', cidades: ['3304557', '3303302'], consentimento: true };
  r = await call('POST', '/api/radar', t, nomeOk);
  ok(r.status === 403 && r.data.codigo === 'EMAIL_NAO_VERIFICADO', 'Pro sem e-mail confirmado → 403');

  r = await call('POST', '/api/auth/verificar-email', t);
  await sleep(100);
  const link = (sent.at(-1)?.html.match(/href="([^"]+verificar-email[^"]+)"/) || [])[1];
  ok(r.status === 200 && link?.startsWith('http://localhost:3993/verificar-email/'), 'pede confirmação → e-mail com link');
  let g = await fetch(link.slice(0, -3) + 'abc'); ok(g.status === 400, 'link adulterado → 400');
  const partes = link.split('/'); const tsVelho = Date.now() - 49 * 3600e3;
  g = await fetch(link.replace(`/${partes.at(-2)}/`, `/${tsVelho}/`)); ok(g.status === 400, 'link com mais de 48h → 400');
  g = await fetch(link); const htmlG = await g.text();
  ok(g.status === 200 && htmlG.includes('E-mail confirmado') && (await Usuario.findById(ana._id)).emailVerificado, 'link válido confirma o e-mail');
  r = await call('GET', '/api/auth/me', t); ok(r.data.usuario.emailVerificado === true, '/api/auth/me informa emailVerificado');

  // ── validações do cadastro
  r = await call('POST', '/api/radar', t, { ...nomeOk, consentimento: false }); ok(r.status === 400, 'sem consentimento → 400');
  r = await call('POST', '/api/radar', t, { ...nomeOk, nome: 'José' }); ok(r.status === 400, 'só primeiro nome → 400');
  r = await call('POST', '/api/radar', t, { ...nomeOk, nome: 'José <script>' }); ok(r.status === 400, 'nome com caracteres inválidos → 400');
  r = await call('POST', '/api/radar', t, { ...nomeOk, cidades: ['9999999'] }); ok(r.status === 400, 'cidade fora da lista → 400');
  r = await call('POST', '/api/radar', t, { ...nomeOk, cpf: '1234' }); ok(r.status === 400, 'CPF incompleto → 400');

  r = await call('POST', '/api/radar', t, nomeOk);
  const monId = r.data?.monitor?.id;
  ok(r.status === 201 && r.data.monitor.nome === 'José da Silva' && r.data.monitor.cpfParcial === '***.456.789-**' && r.data.monitor.cidades[1].nome === 'Niterói', 'cadastro ok: nome normalizado, CPF só parcial');
  const bruto = await mongoose.connection.collection('monitorradars').findOne({});
  const brutoTxt = JSON.stringify(bruto);
  ok(!brutoTxt.includes('Silva') && !brutoTxt.includes('AB-123456') && !brutoTxt.includes('456789') && !brutoTxt.includes('12345678909') && bruto.nomeCifrado.startsWith('v1:'), 'no banco: nome, inscrição e CPF cifrados; CPF completo nunca é salvo');
  await call('POST', '/api/radar', t, { ...nomeOk, nome: 'Ana Souza Lima', inscricao: null, cpf: null });
  r = await call('POST', '/api/radar', t, { ...nomeOk, nome: 'Outra Pessoa Qualquer' });
  ok(r.status === 403, 'limite de 2 nomes por usuário');

  // ── busca: o que conta como ocorrência
  gazettes['"José da Silva"'] = [
    { date: '2026-10-05', territory_id: '3304557', url: 'https://do.rio/2026-10-05.pdf', edition: '140', is_extra_edition: false, excerpts: ['CONVOCAÇÃO: JOSE DA SILVA, CPF ***.456.789-**, inscrição AB-123456 para posse.'] },
    { date: '2026-10-04', territory_id: '3303302', url: 'https://do.niteroi/2026-10-04.pdf', edition: null, is_extra_edition: true, excerpts: ['Resultado final: José da Silva <b>aprovado</b> em 3º lugar.'] },
    { date: '2026-10-03', territory_id: '3304557', url: 'https://do.rio/2026-10-03.pdf', excerpts: ['Exonera Maria José da Silveira do cargo...'] },
  ];
  gazettes['"AB-123456"'] = [
    { date: '2026-10-02', territory_id: '3304557', url: 'https://do.rio/2026-10-02.pdf', excerpts: ['Candidatos convocados por inscrição: AB-123456, AB-123457.'] },
    { date: '2026-10-05', territory_id: '3304557', url: 'https://do.rio/2026-10-05.pdf', excerpts: ['CONVOCAÇÃO: JOSE DA SILVA, CPF ***.456.789-**, inscrição AB-123456 para posse.'] },
  ];
  sent.length = 0; consultas.length = 0;
  r = await call('POST', `/api/radar/${monId}/buscar`, t);
  ok(r.status === 200 && r.data.novas === 3, `busca manual: 3 publicações novas (${r.data?.novas}) — a de "Maria José da Silveira" é descartada`);
  const c1 = consultas.find(u => u.searchParams.get('querystring') === '"José da Silva"');
  const desde1 = c1?.searchParams.get('published_since');
  ok(c1 && c1.searchParams.getAll('territory_ids').join() === '3304557,3303302' && Math.round((Date.now() - Date.parse(desde1)) / 864e5) === 30, '1ª busca: frase exata, só as cidades escolhidas, últimos 30 dias');
  ok(consultas.some(u => u.searchParams.get('querystring') === '"AB-123456"'), 'também busca pelo número de inscrição');
  const ocs = await OcorrenciaRadar.find({ monitor: monId }).lean();
  const porUrl = Object.fromEntries(ocs.map(o => [o.url, o.confirmacao]));
  ok(porUrl['https://do.rio/2026-10-05.pdf'] === 'nome+documento' && porUrl['https://do.niteroi/2026-10-04.pdf'] === 'nome' && porUrl['https://do.rio/2026-10-02.pdf'] === 'inscricao', 'níveis de confirmação: nome+documento / só nome / só inscrição');
  ok(ocs.length === 3, 'mesma publicação achada por nome e inscrição não duplica');
  ok(!JSON.stringify(ocs).includes('JOSE DA SILVA') && ocs.every(o => o.trechosCifrados.startsWith('v1:')), 'trechos (que citam o nome) cifrados no banco');
  await sleep(200);
  ok(sent.length === 1 && sent[0].subject.includes('3 publicações') && sent[0].html.includes('<mark') && sent[0].html.includes('&lt;b&gt;aprovado') && sent[0].html.includes('homônimos'), 'um e-mail com as 3, nome destacado, HTML escapado, aviso de homônimo');
  ok((await LogRadar.countDocuments({ monitor: monId, sucesso: true, manual: true })) === 2 && !JSON.stringify(await LogRadar.find().lean()).includes('Silva'), 'log de auditoria por consulta, sem o nome buscado');

  // 2ª busca: janela = última busca - 3 dias, sem duplicar nem reenviar
  sent.length = 0; consultas.length = 0;
  r = await call('POST', `/api/radar/${monId}/buscar`, t);
  const desde2 = consultas[0]?.searchParams.get('published_since');
  ok(r.data.novas === 0 && sent.length === 0 && Math.round((Date.now() - Date.parse(desde2)) / 864e5) === 3, '2ª busca: nada novo, sem e-mail, olha só os últimos 3 dias');

  // ── listagem
  r = await call('GET', '/api/radar/ocorrencias', t);
  ok(r.status === 200 && r.data.ocorrencias.length === 3 && r.data.ocorrencias[0].trechos[0].includes('JOSE DA SILVA') && r.data.ocorrencias[0].cidade === 'Rio de Janeiro', 'ocorrências decifradas só para o dono');
  r = await call('GET', '/api/radar/ocorrencias', jwt.sign({ id: free._id }, 'x'));
  ok(r.data.ocorrencias.length === 0, 'outro usuário não vê as ocorrências');

  // ── rodada agendada: só Pro; fonte fora do ar não avança a janela
  const { executarRadar } = require(B + '/src/service/radar/radarService');
  const antes = (await MonitorRadar.findById(monId)).ultimaBuscaEm;
  qdFora = true;
  const tot = await executarRadar();
  ok(tot.erros > 0 && String((await MonitorRadar.findById(monId)).ultimaBuscaEm) === String(antes) && await LogRadar.exists({ sucesso: false }), 'fonte fora do ar: registra erro e não avança a janela (repete depois)');
  qdFora = false;

  // ── downgrade pausa / upgrade reativa
  const { aplicarDowngrade, reativarAlertasPausadosPorPlano } = require(B + '/src/service/planoService');
  await aplicarDowngrade(await Usuario.findById(ana._id), { notificar: false });
  ok(await MonitorRadar.countDocuments({ usuario: ana._id, ativo: false, motivoPausa: 'plano' }) === 2, 'perder o Pro pausa os nomes do Radar');
  consultas.length = 0; await executarRadar();
  ok(consultas.length === 0, 'rodada não consulta nomes de quem não é Pro');
  await Usuario.updateOne({ _id: ana._id }, { plano: PRO });
  await reativarAlertasPausadosPorPlano(ana._id);
  ok(await MonitorRadar.countDocuments({ usuario: ana._id, ativo: true }) === 2, 'voltar ao Pro reativa os nomes');

  // ── admin vê só números
  const adm = await Usuario.create({ nome: 'Adm', email: 'adm@x.com', senha: '12345678', role: 'admin' });
  r = await call('GET', '/api/admin/dashboard', jwt.sign({ id: adm._id }, 'x'));
  ok(r.data.dados.radar.monitoresAtivos === 2 && r.data.dados.radar.ocorrencias30d === 3 && !JSON.stringify(r.data).includes('Silva'), 'admin vê só contagens do Radar, nunca os nomes');

  r = await call('GET', '/api/radar/cobertura', t);
  ok(r.status === 200 && r.data.cobertura.length === 6 && r.data.cobertura[0].ultimaPublicacao === '2026-10-06', 'cobertura: data do diário mais recente por cidade');

  // ── exclusão
  r = await call('DELETE', `/api/radar/${monId}`, t);
  ok(r.status === 200 && !(await MonitorRadar.exists({ _id: monId })) && (await OcorrenciaRadar.countDocuments({ monitor: monId })) === 0, 'remover nome apaga também as ocorrências');

  // limite de buscas manuais
  const outro = (await MonitorRadar.findOne({ usuario: ana._id }))._id;
  let ultimo;
  for (let i = 0; i < 6; i++) ultimo = await call('POST', `/api/radar/${outro}/buscar`, t);
  ok(ultimo.status === 429, 'busca manual limitada (5 por hora)');

  delete process.env.DADOS_CHAVE;
  r = await call('POST', '/api/radar', t, nomeOk);
  ok(r.status === 503, 'sem DADOS_CHAVE o Radar fica indisponível (nunca grava em texto puro)');
  qd.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
