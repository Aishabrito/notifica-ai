// Modelos prontos de 1 clique e painel de saúde do sistema (admin)
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const textoLongo = 'Edital publicado. Inscrições abertas até o fim do mês. '.repeat(10);
const srv = http.createServer((req, res) => {
  if (req.url === '/bom') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(`<html><head><title>Banca</title></head><body><main><p>${textoLongo}</p></main></body></html>`); }
  if (req.url === '/vazio') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><body><div id="root"></div></body></html>'); }
  if (req.url.startsWith('/gazettes')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ gazettes: [{ date: '2020-01-02' }] })); }
  res.writeHead(404); res.end('não existe');
});

(async () => {
  await new Promise(r => srv.listen(4581, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3990', RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x',
    QUERIDO_DIARIO_API: 'http://127.0.0.1:4581', RADAR_CIDADES: '3304557',
  });
  for (const v of ['MP_ACCESS_TOKEN', 'MP_PUBLIC_KEY', 'GEMINI_API_KEY', 'DADOS_CHAVE', 'TELEGRAM_BOT_TOKEN']) delete process.env[v];
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};
  const { MODELOS, CATEGORIAS } = require(B + '/src/config/modelos');
  const originais = MODELOS.map(m => ({ ...m }));
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3990' + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  // ── catálogo
  ok(new Set(originais.map(m => m.id)).size === originais.length, 'IDs dos modelos são únicos');
  ok(originais.every(m => /^https:\/\//.test(m.url) && CATEGORIAS[m.categoria] && m.nome && m.descricao), 'todo modelo tem https, categoria válida, nome e descrição');
  let r = await call('GET', '/api/modelos');
  ok(r.status === 200 && r.data.modelos.length === originais.length && Object.keys(r.data.categorias).length === 4, 'GET /api/modelos é público e lista categorias e modelos');

  // ── monitorar um modelo = cadastrar a URL dele
  MODELOS.splice(0, MODELOS.length,
    { id: 'bom', categoria: 'bancas', nome: 'Bom', descricao: 'ok', url: 'http://127.0.0.1:4581/bom' },
    { id: 'vazio', categoria: 'bancas', nome: 'Vazio', descricao: 'js', url: 'http://127.0.0.1:4581/vazio' },
    { id: 'sumiu', categoria: 'bancas', nome: 'Sumiu', descricao: '404', url: 'http://127.0.0.1:4581/sumiu' });
  const u = await Usuario.create({ nome: 'U', email: 'u@x.com', senha: '12345678' });
  const tu = jwt.sign({ id: u._id }, 'x');
  r = await call('POST', '/api/cadastrar-alerta', tu, { url: MODELOS[0].url });
  ok(r.status === 200 && r.data.titulo === 'Banca', 'modelo pronto vira alerta pelo cadastro normal (respeita o limite do plano)');

  // ── saúde do sistema
  r = await call('GET', '/api/admin/saude', tu);
  ok(r.status === 403, 'saúde do sistema é só para admin');
  const adm = await Usuario.create({ nome: 'A', email: 'a@x.com', senha: '12345678', role: 'admin' });
  const ta = jwt.sign({ id: adm._id }, 'x');
  r = await call('GET', '/api/admin/saude', ta);
  const conf = Object.fromEntries(r.data.configuracoes.map(c => [c.item, c.ok]));
  ok(r.status === 200 && conf['E-mail (Resend)'] === true && conf['Mercado Pago (pagamentos)'] === false && conf['IA (resumos)'] === false, 'lista configurações que faltam no servidor');
  ok(r.data.fontes.length === 1 && r.data.fontes[0].ultimaPublicacao === '2020-01-02' && r.data.fontes[0].ok === false, 'diário sem edição recente aparece como pendência');
  ok(r.data.modelos === null, 'modelos só são testados quando pedido (?modelos=1)');
  r = await call('GET', '/api/admin/saude?modelos=1', ta);
  const mod = Object.fromEntries(r.data.modelos.map(m => [m.id, m]));
  ok(mod.bom.ok && mod.bom.caracteres >= 200, 'modelo com texto legível: ok');
  ok(!mod.vazio.ok && /JavaScript/.test(mod.vazio.erro), 'página sem texto (feita em JavaScript) é sinalizada');
  ok(!mod.sumiu.ok && mod.sumiu.status === 404, 'endereço que sumiu (404) é sinalizado');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
