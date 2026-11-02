// Radar: capitais e cidades grandes só aparecem quando a fonte tem diário recente
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ymd = (diasAtras) => new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10);

// Querido Diário simulado: data da última edição por cidade (null = sem diários)
let ultima = { '2927408': ymd(2), '3550308': ymd(1), '1302603': ymd(40) };
let foraDoAr = false;
const srv = http.createServer((req, res) => {
  if (foraDoAr) { res.writeHead(503); return res.end(); }
  const u = new URL(req.url, 'http://x');
  const id = u.searchParams.get('territory_ids');
  const data = ultima[id];
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ gazettes: data ? [{ date: data, territory_id: id, url: 'https://x/d.pdf', excerpts: [] }] : [] }));
});

(async () => {
  await new Promise(r => srv.listen(4593, '127.0.0.1', r));
  Object.assign(process.env, { MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', QUERIDO_DIARIO_API: 'http://127.0.0.1:4593', NODE_ENV: 'test' });
  delete process.env.RADAR_CIDADES;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();

  const radar = require(B + '/src/config/radar');
  const cobertura = require(B + '/src/service/radar/cobertura');
  const ids = () => radar.cidadesDisponiveis().map((c) => c.id);

  ok(ids().length === 7 && ids().includes('3304557') && ids().includes('DOU'), 'antes de conferir: só as cidades conferidas à mão (RJ + DOU)');
  ok(radar.cidadeAtendida('2927408') && !radar.cidadeDisponivel('2927408'), 'Salvador é atendida, mas ainda não aparece para escolher');

  const n = await cobertura.atualizarCobertura();
  ok(n === 2 && ids().includes('2927408') && ids().includes('3550308'), 'Salvador e São Paulo têm diário recente: passam a aparecer');
  ok(!ids().includes('1302603'), 'Manaus com a última edição de 40 dias atrás: fica de fora');
  ok(!ids().includes('5208707'), 'cidade sem diário na fonte: fica de fora');
  ok(radar.cidadesDisponiveis().every((c) => !('sempre' in c)), 'a lista que vai para o site não expõe campos internos');

  // Fonte fora do ar: nada some
  foraDoAr = true;
  await cobertura.atualizarCobertura();
  ok(ids().includes('2927408'), 'Querido Diário fora do ar: Salvador continua (último resultado conhecido)');
  foraDoAr = false;

  // Servidor reinicia: lembra do que já foi conferido
  cobertura._cache.clear();
  ok(!ids().includes('2927408'), '(memória limpa, como num reinício)');
  await cobertura.carregarCobertura();
  ok(ids().includes('2927408') && ids().includes('3550308'), 'ao reiniciar, carrega a cobertura salva no banco');

  // Salvador para de publicar: sai da lista de escolha, mas quem já monitora segue
  ultima = { ...ultima, '2927408': ymd(20) };
  await cobertura.atualizarCobertura();
  ok(!ids().includes('2927408') && radar.cidadeAtendida('2927408'), 'diário parado há 20 dias: sai das opções, mas buscas de quem já cadastrou continuam');

  // RADAR_CIDADES continua mandando
  process.env.RADAR_CIDADES = '3304557,3550308';
  ok(ids().join(',') === '3304557,3550308' && !radar.cidadeAtendida('2927408'), 'RADAR_CIDADES restringe a lista (inclusive as cidades extras)');
  delete process.env.RADAR_CIDADES;

  ok(radar.nomeDiario('3550308') === 'Diário Oficial de São Paulo' && radar.nomeDiario('3304557') === 'Diário Oficial do Rio de Janeiro', 'nome do diário das cidades novas');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
