const B = require('path').resolve(__dirname, '..');
const SP = require('path').join(__dirname, 'fixtures');
const fs = require('fs');
const http = require('http');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── sites simulados (conteúdo trocável em tempo de teste)
const paginas = {};
const servidor = http.createServer((req, res) => {
  const p = paginas[req.url];
  if (!p) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.tipo });
  res.end(p.corpo);
});
const html = (corpo, links = []) => ({ tipo: 'text/html; charset=utf-8', corpo: `<html><head><title>Concurso XYZ</title></head><body><main><h1>Concurso XYZ</h1><p>${corpo}</p>${links.map(l => `<a href="${l}">doc</a>`).join('')}</main></body></html>` });
const pdf = (arq) => ({ tipo: 'application/pdf', corpo: fs.readFileSync(`${SP}/${arq}`) });

(async () => {
  await new Promise(r => servidor.listen(4555, '0.0.0.0', r));
  Object.assign(process.env, { PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3995', RESEND_API_KEY: 're_fake', BASE_URL: 'http://x', GEMINI_API_KEY: 'chave-teste' });
  const axios = require(B + '/node_modules/axios');

  // ── 0. o texto extraído de HTML não muda em relação à versão anterior (hash estável)
  const { extrairConteudoLimpo } = require(B + '/src/utils/extrairConteudo');
  const { OPCOES_DOWNLOAD, interpretarResposta } = require(B + '/src/utils/conteudoPagina');
  paginas['/bom'] = { tipo: 'text/html', corpo: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<html><body><main><p>Inscrições abertas até 10/04 — São Paulo</p></main></body></html>')]) };
  paginas['/latin1'] = { tipo: 'text/html', corpo: Buffer.from('<html><body><p>Convoca\xe7\xe3o publicada</p></body></html>', 'latin1') };
  paginas['/json'] = { tipo: 'application/json', corpo: '{"a":1}' };
  paginas['/normal'] = html('Resultado final publicado em 10/05');
  for (const rota of ['/bom', '/latin1', '/json', '/normal']) {
    const u = 'http://127.0.0.1:4555' + rota;
    const antigo = extrairConteudoLimpo((await axios.get(u, { timeout: 5000 })).data, null, u);
    const novo = (await interpretarResposta(await axios.get(u, OPCOES_DOWNLOAD), { url: u })).texto;
    ok(antigo === novo, `texto de ${rota} idêntico ao da versão anterior (hash não muda no deploy)`);
  }
  paginas['/doc.pdf'] = pdf('retificacao.pdf');
  const lido = await interpretarResposta(await axios.get('http://127.0.0.1:4555/doc.pdf', OPCOES_DOWNLOAD), { url: 'x' });
  ok(lido.tipo === 'pdf' && lido.texto.includes('20/05/2027') && lido.texto.includes('Analista de TI'), 'PDF real é lido como texto: ' + lido.texto.slice(0, 60));

  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  const sent = []; require(B + '/src/utils/mailer').sendMail = async (m) => { sent.push(m); };

  // ── stub do Gemini: registra as chamadas e devolve a resposta configurada
  const chamadasIA = []; let respostaIA = null; let falharIA = false;
  const postOriginal = axios.post;
  axios.post = async (url, body, opts) => {
    if (!url.includes('generativelanguage.googleapis.com')) return postOriginal(url, body, opts);
    chamadasIA.push({ url, body, opts });
    await sleep(150);
    if (falharIA) { const e = new Error('Request failed with status code 503'); throw e; }
    return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify(respostaIA) }] }, finishReason: 'STOP' }] } };
  };

  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const Mudanca = require(B + '/src/models/Mudanca');
  const { executarRodada } = require(B + '/src/service/agendador');
  const jwt = require(B + '/node_modules/jsonwebtoken');

  const pro = await Usuario.create({ nome: 'Pro', email: 'pro@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  const pro2 = await Usuario.create({ nome: 'Pro2', email: 'pro2@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  const free = await Usuario.create({ nome: 'Free', email: 'free@x.com', senha: '12345678' });

  // ── 1. cadastro guarda a primeira versão e não a devolve na API
  const rotaEdital = '/edital';
  paginas[rotaEdital] = html('Inscrições até 10/04. Prova objetiva em 10/05. Local a definir.', ['/docs/edital.pdf']);
  const getOriginal = axios.get;
  axios.get = (u, o) => getOriginal(u.replace('https://concurso.exemplo.gov.br', 'http://127.0.0.2:4555'), o);
  const t = jwt.sign({ id: pro._id }, 'x');
  let r = await fetch('http://localhost:3995/api/cadastrar-alerta', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ url: 'https://concurso.exemplo.gov.br' + rotaEdital }) }).then(x => x.json());
  axios.get = getOriginal;
  const salvo = await Alerta.findById(r.alerta?._id).select('+ultimoConteudo +linksPdf').lean();
  ok(r.sucesso && r.titulo === 'Concurso XYZ', 'cadastro devolve o título (antes vinha undefined)');
  ok(!('ultimoConteudo' in r.alerta) && salvo.ultimoConteudo.includes('10/05') && salvo.linksPdf[0].endsWith('/docs/edital.pdf') && salvo.tipoConteudo === 'html', 'cadastro guarda texto + links de PDF, sem expor na resposta');
  const lista = await fetch('http://localhost:3995/api/alertas', { headers: { Authorization: 'Bearer ' + t } }).then(x => x.json());
  ok(lista.alertas.length === 1 && !('ultimoConteudo' in lista.alertas[0]) && !('linksPdf' in lista.alertas[0]), 'GET /api/alertas não expõe o texto guardado');
  await Alerta.deleteMany({}); await sleep(200); sent.length = 0;

  // ── cenário principal: 2 Pro + 1 Free monitorando a mesma página (hosts diferentes p/ não enfileirar)
  const base = (h) => `http://127.0.0.${h}:4555${rotaEdital}`;
  const criar = async (usuario, h) => {
    const u = base(h);
    const pg = await interpretarResposta(await axios.get(u, OPCOES_DOWNLOAD), { url: u });
    return Alerta.create({ url: u, email: usuario.email, titulo: 'Concurso XYZ', usuario: usuario._id, hashConteudo: require('crypto').createHash('md5').update(pg.texto).digest('hex'), ultimoConteudo: pg.texto, linksPdf: pg.linksPdf, tipoConteudo: 'html', proximaVerificacao: new Date(Date.now() - 1000) });
  };
  // mesmo conteúdo em 3 "sites" (127.0.0.3/4/5 servem o mesmo path)
  await criar(pro, 3); await criar(pro2, 4); await criar(free, 5);

  // sem mudança → nada
  await executarRodada();
  ok(sent.length === 0 && chamadasIA.length === 0, 'sem mudança: nenhum e-mail e nenhuma chamada de IA');

  // mudança: data da prova + PDF de retificação novo
  paginas[rotaEdital] = html('Inscrições até 10/04. Prova objetiva em 20/05. Local: Maracanã.', ['/docs/edital.pdf', '/docs/retificacao2.pdf']);
  paginas['/docs/retificacao2.pdf'] = pdf('retificacao.pdf');
  respostaIA = { relevante: true, titulo: 'Prova adiada para 20/05 e 10 vagas novas', resumo: 'A 2ª retificação muda a prova para 20/05/2027 e adiciona 10 vagas de Analista de TI.', datas: [{ descricao: 'Prova objetiva', data: '2027-05-20' }, { descricao: 'Data passada', data: '2020-01-01' }, { descricao: 'Lixo', data: '20/05/2027' }] };
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada();

  ok(chamadasIA.length === 1, `2 usuários Pro na mesma mudança → IA chamada 1 vez só (${chamadasIA.length})`);
  const prompt = chamadasIA[0]?.body.contents[0].parts[0].text || '';
  ok(prompt.includes('[-10-] [+20+]') && prompt.includes('[-a definir-] [+: Maracanã+]'), 'IA recebe só os trechos alterados (-removido- / +adicionado+)');
  ok(prompt.includes('RETIFICAÇÃO Nº 2') && prompt.includes('Analista de TI') && !prompt.includes('/docs/edital.pdf\n'), 'IA recebe o texto do PDF NOVO (não do antigo)');
  const req0 = chamadasIA[0];
  ok(req0.opts.headers['x-goog-api-key'] === 'chave-teste' && req0.url.includes('gemini-2.5-flash:generateContent') && req0.body.generationConfig.responseMimeType === 'application/json' && req0.body.systemInstruction.parts[0].text.includes('não confiável'), 'requisição ao Gemini no formato certo (chave no header, JSON schema, aviso de conteúdo não confiável)');

  await sleep(200);
  const mailPro = sent.filter(m => m.to === 'pro@x.com' || m.to === 'pro2@x.com');
  const mailFree = sent.find(m => m.to === 'free@x.com');
  ok(mailPro.length === 2 && mailPro.every(m => m.subject.startsWith('🚨 Prova adiada para 20/05') && m.html.includes('Analista de TI')), 'os 2 Pro recebem o resumo no assunto e no corpo');
  const ics = mailPro[0] && Buffer.from(mailPro[0].attachments[0].content, 'base64').toString();
  ok(mailPro[0]?.attachments?.[0]?.filename === 'prazos.ics' && ics.includes('DTSTART;VALUE=DATE:20270520') && !ics.includes('2020') && ics.split('BEGIN:VEVENT').length === 2, 'anexo .ics com a data da prova (datas passadas/inválidas descartadas)');
  ok(mailFree && mailFree.subject.startsWith('🚨 Atualização detectada') && mailFree.html.includes('No plano Pro') && !mailFree.attachments, 'Free recebe o aviso genérico + convite para o Pro');
  const mud = await Mudanca.find({ 'resumo.titulo': { $exists: true } }).lean();
  ok(mud.length === 2 && mud[0].pdfsNovos[0].endsWith('/docs/retificacao2.pdf'), 'histórico guarda o resumo e o PDF novo');

  // ── IA diz que é irrelevante → Pro não recebe e-mail
  sent.length = 0; chamadasIA.length = 0;
  paginas[rotaEdital] = html('Inscrições até 10/04. Prova objetiva em 20/05. Local: Maracanã. Visitas hoje 999.', ['/docs/edital.pdf', '/docs/retificacao2.pdf']);
  respostaIA = { relevante: false, titulo: 'Só o contador mudou', resumo: 'Nada importante.', datas: [] };
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(200);
  ok(!sent.some(m => m.to.startsWith('pro')) && sent.some(m => m.to === 'free@x.com'), 'mudança irrelevante: Pro não é incomodado (Free segue com o aviso genérico)');
  ok(await Mudanca.countDocuments({ 'resumo.relevante': false, emailEnviado: false }) === 2, 'irrelevante fica registrada no histórico, sem e-mail');

  // ── IA fora do ar → aviso genérico (nunca deixa de avisar)
  sent.length = 0; falharIA = true;
  paginas[rotaEdital] = html('Inscrições prorrogadas até 30/04. Prova objetiva em 20/05.', []);
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(200);
  ok(sent.filter(m => m.to.startsWith('pro')).every(m => m.subject.startsWith('🚨 Atualização detectada')) && sent.length === 3, 'IA falhou → todos recebem o aviso genérico');
  falharIA = false;

  // ── sem GEMINI_API_KEY → não chama IA
  sent.length = 0; chamadasIA.length = 0; delete process.env.GEMINI_API_KEY;
  paginas[rotaEdital] = html('Inscrições prorrogadas até 05/05. Prova objetiva em 20/05.', []);
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(200);
  ok(chamadasIA.length === 0 && sent.length === 3, 'sem chave do Gemini: nenhuma chamada, aviso genérico para todos');
  process.env.GEMINI_API_KEY = 'chave-teste';

  // ── alerta antigo (sem texto guardado) que muda → aviso genérico, e passa a guardar
  await Alerta.deleteMany({}); sent.length = 0; chamadasIA.length = 0;
  paginas['/velho'] = html('Lista de espera: chamada 3');
  await mongoose.connection.collection('alertas').insertOne({ url: 'http://127.0.0.6:4555/velho', email: 'pro@x.com', usuario: pro._id, status: 'ativo', falhasSeguidas: 0, hashConteudo: 'hash-antigo-qualquer' });
  await executarRodada(); await sleep(200);
  let velho = await Alerta.findOne({ url: /velho/ }).select('+ultimoConteudo').lean();
  ok(sent.length === 1 && sent[0].subject.startsWith('🚨 Atualização detectada') && chamadasIA.length === 0 && velho.ultimoConteudo.includes('chamada 3'), 'alerta antigo: aviso genérico na 1ª mudança e passa a guardar o texto');
  paginas['/velho'] = html('Lista de espera: chamada 4');
  respostaIA = { relevante: true, titulo: 'Saiu a 4ª chamada', resumo: 'A lista de espera avançou para a chamada 4.', datas: [] };
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(200);
  ok(chamadasIA.length === 1 && sent[1]?.subject.startsWith('🚨 Saiu a 4ª chamada') && !sent[1].attachments, '...e a partir da 2ª mudança já recebe resumo (sem anexo quando não há datas)');

  // ── PDF monitorado antes desta versão: 1ª leitura só refaz a base (sem e-mail falso)
  await Alerta.deleteMany({}); sent.length = 0;
  paginas['/edital_v.pdf'] = pdf('edital_v1.pdf');
  await mongoose.connection.collection('alertas').insertOne({ url: 'http://127.0.0.7:4555/edital_v.pdf', email: 'pro@x.com', usuario: pro._id, status: 'ativo', falhasSeguidas: 0, hashConteudo: 'hash-dos-bytes-antigos' });
  await executarRodada(); await sleep(200);
  ok(sent.length === 0, 'PDF antigo: troca de base sem e-mail falso de "mudança"');
  paginas['/edital_v.pdf'] = pdf('edital_v2.pdf');
  respostaIA = { relevante: true, titulo: 'Inscrições prorrogadas até 15/04', resumo: 'O prazo de inscrição passou de 10/04 para 15/04/2027.', datas: [{ descricao: 'Fim das inscrições', data: '2027-04-15' }] };
  chamadasIA.length = 0;
  await Alerta.updateMany({}, { proximaVerificacao: new Date(Date.now() - 1000) });
  await executarRodada(); await sleep(200);
  const p2 = chamadasIA[0]?.body.contents[0].parts[0].text || '';
  ok(sent.length === 1 && sent[0].subject.includes('prorrogadas') && p2.includes('[-10-] [+15+]'), 'PDF que muda de versão: IA compara o texto dos dois PDFs');

  servidor.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
