// Minha posição na lista de espera
const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let lista = '1 MARIA SOUZA 780,5 2 PEDRO LIMA 775,0 3 CARLA DIAS 770,0 4 JOÃO DA SILVA 765,0';
const servidor = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<html><head><title>Lista de espera UFRJ</title></head><body><main><h1>Lista de espera</h1><p>${lista}</p></main></body></html>`);
});

(async () => {
  await new Promise(r => servidor.listen(4584, '127.0.0.1', r));
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3993',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', DADOS_CHAVE: crypto.randomBytes(32).toString('base64'),
  });
  delete process.env.GEMINI_API_KEY;
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const { executarMonitoramento } = require(B + '/src/service/crawler');
  const { localizarPosicao } = require(B + '/src/service/posicaoLista');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const call = async (method, p, token, body) => { const r = await fetch('http://localhost:3993' + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body && JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const rodar = async (id) => { await Alerta.updateOne({ _id: id }, { proximaVerificacao: new Date() }); await executarMonitoramento(await Alerta.find({ _id: id }).select('+ultimoConteudo +linksPdf').populate('usuario')); await sleep(100); };

  // ── leitura da posição (padrões seguros)
  const casos = [
    ['1 MARIA 780 2 JOÃO DA SILVA 770', 'joao da silva', 2, 'número antes do nome, sem acento e sem diferenciar maiúsculas'],
    ['14º - Ana Lima Classificada 15º - Beto', 'Ana Lima', 14, '"14º - NOME"'],
    ['Inscrição 7 1234567 Pedro Alves 70 pontos', 'Pedro Alves', 7, 'pula o nº de inscrição colado no nome'],
    ['Candidato: Pedro Alves - Classificação: 42 - Nota 70', 'Pedro Alves', 42, 'rótulo "Classificação: 42"'],
    ['Pedro Alves ficou em 3º lugar', 'Pedro Alves', 3, '"3º lugar"'],
    ['Nome: Pedro Alves Situação: aprovado', 'Pedro Alves', null, 'sem padrão seguro: acha o nome, mas não inventa número'],
    ['5 Pedro Alves 80 ... cotas: 2 Pedro Alves 80', 'Pedro Alves', null, 'nome repetido (ampla e cotas): não arrisca número'],
  ];
  for (const [texto, id, esperado, desc] of casos) {
    const r = localizarPosicao(texto, id);
    ok(r.encontrado && r.numero === esperado, `${desc} → ${r.numero}`);
  }
  ok(!localizarPosicao('3 JOAO DA SILVANO 760', 'João da Silva').encontrado, '"JOÃO DA SILVA" não casa com "JOÃO DA SILVANO"');

  // ── configurar no alerta
  const u = await Usuario.create({ nome: 'João', email: 'joao@x.com', senha: '12345678' });
  const outro = await Usuario.create({ nome: 'Eva', email: 'eva@x.com', senha: '12345678' });
  const t = jwt.sign({ id: u._id }, 'x'), to = jwt.sign({ id: outro._id }, 'x');
  let r = await call('POST', '/api/cadastrar-alerta', t, { url: 'http://127.0.0.1:4584/lista' });
  const id = r.data.alerta._id;
  r = await call('PATCH', `/api/alertas/${id}/posicao`, t, { identificador: 'abc' });
  ok(r.status === 400, 'identificador curto demais é recusado');
  r = await call('PATCH', `/api/alertas/${id}/posicao`, to, { identificador: 'João da Silva' });
  ok(r.status === 404, 'não dá para configurar no alerta de outra pessoa');
  r = await call('PATCH', `/api/alertas/${id}/posicao`, t, { identificador: 'João da Silva' });
  ok(r.status === 200 && r.data.posicao.encontrado && r.data.posicao.numero === 4 && r.data.posicao.trecho.includes('JOAO DA SILVA'), 'ativar: já procura na versão guardada da página (posição 4)');
  const bruto = await mongoose.connection.collection('alertas').findOne({ _id: new mongoose.Types.ObjectId(id) });
  ok(!JSON.stringify(bruto.posicao).includes('SILVA') && !JSON.stringify(bruto.posicao).includes('Silva') && bruto.posicao.identificadorCifrado, 'nome e trecho ficam cifrados no banco');
  r = await call('GET', '/api/alertas', t);
  ok(r.data.alertas[0].posicao.identificador === 'João da Silva' && !r.data.alertas[0].posicao.identificadorCifrado, 'a lista de alertas devolve a posição decifrada só para o dono');

  // ── a lista andou: avisa
  sent.length = 0;
  lista = '1 PEDRO LIMA 775,0 2 JOÃO DA SILVA 765,0 3 ANA 760';
  await rodar(id);
  const aviso = sent.find(m => m.subject.includes('subiu'));
  ok(aviso && aviso.subject === '📈 Você subiu 2 posições: agora é 2º' && aviso.to === 'joao@x.com', 'subiu na lista: e-mail "Você subiu 2 posições: agora é 2º"');
  let a = await Alerta.findById(id);
  ok(a.posicao.numero === 2 && a.posicao.historico.length === 2, 'histórico guarda 4º → 2º');

  // página muda mas a posição não: sem e-mail de posição
  sent.length = 0;
  lista = '1 PEDRO LIMA 775,0 2 JOÃO DA SILVA 765,0 3 ANA 760 (atualizado)';
  await rodar(id);
  ok(sent.length > 0 && !sent.some(m => /^(📈|📍|🎉|⚠️)/u.test(m.subject)), 'página mudou mas a posição não: só o aviso normal de mudança, nenhum de posição');

  // convocado: saiu da lista de espera
  sent.length = 0;
  lista = '1 PEDRO LIMA 775,0 2 ANA 760';
  await rodar(id);
  ok(sent.some(m => m.subject.includes('não aparece mais')), 'nome sumiu da lista: avisa para conferir (pode ter sido convocado)');

  // desligar
  r = await call('PATCH', `/api/alertas/${id}/posicao`, t, { identificador: null });
  a = await Alerta.findById(id);
  ok(r.status === 200 && !a.posicao, 'desligar apaga o nome e o histórico');

  servidor.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
