const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', RESEND_API_KEY: 're_fake', BASE_URL: 'http://x' });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};
  const console_log = console.log; console.log = (...a) => { if (!String(a[0]).startsWith('[Crawler]')) console_log(...a); };
  console.warn = () => {};
  // stub de rede: registra chamadas, concorrência por host e global
  const axios = require(B + '/node_modules/axios');
  let chamadas = [], emVoo = 0, maxEmVoo = 0; const voandoHost = {}; let maxPorHost = 0;
  axios.get = async (url, opts) => {
    const host = new URL(url).hostname;
    chamadas.push({ url, ua: opts.headers['User-Agent'], t: Date.now() });
    emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo);
    voandoHost[host] = (voandoHost[host] || 0) + 1; maxPorHost = Math.max(maxPorHost, voandoHost[host]);
    await sleep(200);
    emVoo--; voandoHost[host]--;
    if (url.includes('quebrado')) { const e = new Error('boom'); e.response = { status: 500, statusText: 'Erro' }; throw e; }
    return { data: `<html><body><main>conteudo ${url} ${Date.now() > 0 ? 'v1' : ''}</main></body></html>` };
  };
  const Alerta = require(B + '/src/models/alertaModel');
  const LogCron = require(B + '/src/models/LogCron');
  const { reservarAlertasVencidos, executarRodada } = require(B + '/src/service/agendador');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const passado = new Date(Date.now() - 1000);
  const mk = (url, extra = {}) => Alerta.create({ url, email: 'a@x.com', proximaVerificacao: passado, ...extra });

  // ── 6. reserva concorrente (simula 2 instâncias ao mesmo tempo)
  for (let i = 0; i < 50; i++) await mk(`https://s${i}.com/`);
  await mk('https://futuro.com/', { proximaVerificacao: new Date(Date.now() + 3600e3) });
  await mk('https://travado.com/', { travadoAte: new Date(Date.now() + 600e3), travaId: 'outra' });
  await mk('https://expirado.com/', { travadoAte: new Date(Date.now() - 1000), travaId: 'morta' });
  await mongoose.connection.collection('alertas').insertOne({ url: 'https://legado.com/', email: 'a@x.com', status: 'ativo', falhasSeguidas: 0 });
  // barreira: nenhum updateMany roda antes das 3 instâncias terem lido os candidatos
  const updateOriginal = Alerta.updateMany.bind(Alerta);
  let chegaram = 0, liberar; const barreira = new Promise(r => liberar = r);
  Alerta.updateMany = async (...args) => { if (++chegaram === 3) liberar(); await barreira; return updateOriginal(...args); };
  const [a, b, c] = await Promise.all([reservarAlertasVencidos(), reservarAlertasVencidos(), reservarAlertasVencidos()]);
  Alerta.updateMany = updateOriginal;
  ok(chegaram === 3, 'as 3 instâncias leram os mesmos candidatos antes de reservar (corrida real)');
  const ids = [...a, ...b, ...c].map(x => String(x._id));
  const urls = [...a, ...b, ...c].map(x => x.url);
  ok(ids.length === new Set(ids).size, `3 reservas simultâneas não se sobrepõem (${a.length}+${b.length}+${c.length})`);
  ok(ids.length === 52 && urls.includes('https://expirado.com/') && urls.includes('https://legado.com/'), 'todos os vencidos reservados, incluindo reserva expirada e alerta legado: ' + ids.length);
  ok(!urls.includes('https://futuro.com/') && !urls.includes('https://travado.com/'), 'não reserva futuro nem alerta com reserva válida de outra instância');
  ok((await reservarAlertasVencidos()).length === 0, 'segunda leva não pega nada já reservado');

  // ── 5. velocidade: 52 alertas em hosts diferentes, 200ms cada
  let t0 = Date.now();
  const m = await executarMonitoramento([...a, ...b, ...c]);
  const dur = Date.now() - t0;
  ok(m.alertasVerificados === 52 && maxEmVoo === 5, `5 em paralelo: 52 alertas em ${dur}ms (antes: >52×(200ms+1-5s) ≈ 2,6min)`);
  const doc = await Alerta.findOne({ url: 'https://s0.com/' }).lean();
  const hProx = (doc.proximaVerificacao - Date.now()) / 3600e3;
  ok(doc.travadoAte === null && hProx > 5.9 && hProx <= 6, `após verificar: reserva liberada e próxima checagem em 6h (Free) — ${hProx.toFixed(2)}h`);

  // ── 5. mesma URL monitorada por 12 pessoas → no máx. 1 download por UA (4 UAs)
  await Alerta.deleteMany({}); chamadas = [];
  for (let i = 0; i < 12; i++) await mk('https://cebraspe.org.br/concurso');
  await executarRodada();
  const uas = new Set(chamadas.map(c => c.ua));
  ok(chamadas.length === uas.size && chamadas.length <= 4, `12 alertas na mesma URL → ${chamadas.length} download(s) (1 por User-Agent)`);

  // ── 5. mesmo site, URLs diferentes: nunca 2 requisições simultâneas ao host, com pausa entre elas
  await Alerta.deleteMany({}); chamadas = []; maxPorHost = 0;
  for (let i = 0; i < 3; i++) await mk('https://fgv.br/pagina' + i);
  for (let i = 0; i < 4; i++) await mk(`https://outro${i}.com/`);
  t0 = Date.now();
  await executarRodada();
  const fgv = chamadas.filter(c => c.url.includes('fgv')).map(c => c.t);
  const gaps = fgv.slice(1).map((t, i) => t - fgv[i]);
  ok(maxPorHost === 1 && gaps.every(g => g >= 1200), `mesmo host em fila com pausa (intervalos: ${gaps.join(', ')}ms)`);
  const outros = chamadas.filter(c => c.url.includes('outro')).map(c => c.t - t0);
  ok(Math.max(...outros) < 1000, `outros sites não esperam a fila da FGV (todos em <1s: ${outros.join(', ')}ms)`);

  // ── erro isolado + log
  await Alerta.deleteMany({}); await LogCron.deleteMany({});
  await mk('https://quebrado.com/'); await mk('https://bom.com/');
  const r = await executarRodada();
  const q = await Alerta.findOne({ url: 'https://quebrado.com/' }).lean();
  ok(r.alertasComErro === 1 && r.alertasVerificados === 2 && q.falhasSeguidas === 1 && q.travadoAte === null, 'site com erro não afeta os outros e libera a reserva');
  ok((await LogCron.countDocuments()) === 1, 'rodada com trabalho grava log');
  await executarRodada();
  ok((await LogCron.countDocuments()) === 1, 'rodada vazia não grava log');

  // ── rodadas sobrepostas no mesmo processo
  await mk('https://lento.com/');
  const [r1, r2] = await Promise.all([executarRodada(), executarRodada()]);
  ok((r1 === null) !== (r2 === null), 'segunda rodada simultânea no mesmo processo é pulada');

  // ── crash simulado: reserva fica, expira, e é reassumida
  await Alerta.deleteMany({});
  await mk('https://crash.com/');
  const reservado = await reservarAlertasVencidos(); // "instância" morre sem verificar
  ok(reservado.length === 1 && (await reservarAlertasVencidos()).length === 0, 'alerta de instância que caiu fica reservado...');
  await Alerta.updateOne({ url: 'https://crash.com/' }, { travadoAte: new Date(Date.now() - 1) }); // passa o prazo
  ok((await reservarAlertasVencidos()).length === 1, '...e é reassumido quando a reserva expira');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
