// Lista de espera: histórico das chamadas e estimativa
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let lista = '40 PEDRO 41 ANA 72 JOÃO DA SILVA 80 CARLA';
const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<html><head><title>Lista UFRJ</title></head><body><main><p>${lista}</p></main></body></html>`); });

(async () => {
  await new Promise(r => srv.listen(4587, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3982',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', GEMINI_API_KEY: 'k', DADOS_CHAVE: crypto.randomBytes(32).toString('base64'),
  });
  const axios = require(B + '/node_modules/axios');
  let respostaIA = null;
  const postOriginal = axios.post;
  axios.post = async (url, body, opts) => url.includes('generativelanguage') ? { data: { candidates: [{ content: { parts: [{ text: JSON.stringify(respostaIA) }] } }] } } : postOriginal(url, body, opts);
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const { estimarChamadas, sanitizarResumo } = { ...require(B + '/src/service/posicaoLista'), ...require(B + '/src/service/resumoMudanca') };
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3982' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const rodar = async (id) => { await Alerta.updateOne({ _id: id }, { proximaVerificacao: new Date() }); await executarMonitoramento(await Alerta.find({ _id: id }).select('+ultimoConteudo +linksPdf').populate('usuario')); await sleep(100); };

  // ── estimativa
  const est = estimarChamadas([{ ate: 40 }, { ate: 65 }], 72);
  ok(est.faltamPosicoes === 7 && est.ritmo === 25 && est.chamadasEstimadas === 1, 'ritmo de 25 posições por chamada: faltam 7 → ~1 chamada');
  ok(estimarChamadas([{ ate: 80 }], 72).faltamPosicoes === 0, 'posição já alcançada: faltam 0');
  ok(estimarChamadas([], 72) === null && estimarChamadas([{ ate: 10 }], null) === null, 'sem chamadas ou sem posição: sem estimativa');
  const s = sanitizarResumo({ titulo: 'Saiu a 2ª chamada', resumo: 'x', datas: [], documentos: [], chamada: { numero: 2, ultimaPosicao: 65 } });
  const ruim = sanitizarResumo({ titulo: 'x', resumo: 'y', datas: [], documentos: [], chamada: { ultimaPosicao: -3 } });
  ok(s.chamada.numero === 2 && s.chamada.ultimaPosicao === 65 && !ruim.chamada, 'IA: chamada válida é aceita; número inválido é descartado');

  // ── registro manual
  const u = await Usuario.create({ nome: 'João', email: 'joao@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'cortesia' } });
  const t = jwt.sign({ id: u._id }, 'x');
  let r = await call('POST', '/api/cadastrar-alerta', t, { url: 'http://127.0.0.1:4587/lista' });
  const id = r.data.alerta._id;
  await call('PATCH', `/api/alertas/${id}/posicao`, t, { identificador: 'João da Silva' });
  r = await call('POST', `/api/alertas/${id}/chamadas`, t, { numero: 1, ate: 40 });
  ok(r.status === 200 && r.data.chamadas.length === 1 && r.data.estimativa.faltamPosicoes === 32, 'registrar "1ª chamada foi até a 40ª": faltam 32 posições');
  r = await call('POST', `/api/alertas/${id}/chamadas`, t, { numero: 1, ate: 40 });
  ok(r.status === 409, 'a mesma chamada não é registrada duas vezes');
  r = await call('POST', `/api/alertas/${id}/chamadas`, t, { ate: 'muitas' });
  ok(r.status === 400, 'posição inválida é recusada');
  r = await call('GET', '/api/alertas', t);
  ok(r.data.alertas[0].estimativa?.faltamPosicoes === 32, 'a lista de alertas já traz a estimativa');

  // ── a IA lê a 2ª chamada na página
  sent.length = 0;
  respostaIA = { relevante: true, titulo: 'Saiu a 2ª chamada da lista de espera', resumo: 'Convocados até a 65ª posição.', datas: [], documentos: [], chamada: { numero: 2, ultimaPosicao: 65 } };
  lista = '2ª CHAMADA até 65 — 40 PEDRO 41 ANA 72 JOÃO DA SILVA 80 CARLA';
  await rodar(id);
  let a = await Alerta.findById(id);
  ok(a.chamadas.length === 2 && a.chamadas[1].ate === 65 && a.chamadas[1].origem === 'ia', 'mudança na página: a IA registra a 2ª chamada (até a 65ª)');
  ok(!sent.some(m => m.subject.includes('chegou na sua posição')), 'ainda não chegou na posição 72: sem aviso de alcance');
  r = await call('GET', '/api/alertas', t);
  ok(r.data.alertas[0].estimativa.chamadasEstimadas === 1 && r.data.alertas[0].estimativa.ritmo === 25, 'estimativa: ritmo de 25 por chamada, ~1 chamada até você');

  // ── 3ª chamada passa da posição: aviso urgente (mesmo com o nome saindo da lista)
  sent.length = 0;
  respostaIA = { relevante: true, titulo: 'Saiu a 3ª chamada', resumo: 'Convocados até a 90ª.', datas: [], documentos: [], chamada: { numero: 3, ultimaPosicao: 90 } };
  lista = '3ª CHAMADA até 90 — convocados: 40 PEDRO 41 ANA 80 CARLA';
  await rodar(id);
  ok(sent.some(m => m.subject.startsWith('🎉 A chamada chegou na sua posição') && m.html.includes('72º')), 'chamada passou da sua posição (72ª): e-mail 🎉 usando a última posição conhecida');

  srv.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
