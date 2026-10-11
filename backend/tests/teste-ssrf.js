const B = require('path').resolve(__dirname, '..');
const http = require('http');
const crypto = require('crypto');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  Object.assign(process.env, { MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3991', RESEND_API_KEY: 're_fake', BASE_URL: 'http://x', GEMINI_API_KEY: 'k' });
  delete process.env.PERMITIR_REDE_PRIVADA;

  // "Metadados da nuvem" falsos: se alguém acessar, fica registrado
  const acessosInternos = [];
  const interno = http.createServer((req, res) => { acessosInternos.push(req.url); res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end('SEGREDO'); });
  await new Promise(r => interno.listen(4570, '127.0.0.1', r));

  const axios = require(B + '/node_modules/axios');
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};
  const iaChamadas = []; const postOrig = axios.post;
  axios.post = async (u, b, o) => { if (!u.includes('generativelanguage')) return postOrig(u, b, o); iaChamadas.push(b); return { data: { candidates: [{ content: { parts: [{ text: JSON.stringify({ relevante: true, titulo: 'x', resumo: 'y', datas: [] }) }] } }] } }; };
  require(B + '/server.js');
  await sleep(800);
  const Usuario = require(B + '/src/models/Usuario');
  const Alerta = require(B + '/src/models/alertaModel');
  const jwt = require(B + '/node_modules/jsonwebtoken');
  const pro = await Usuario.create({ nome: 'P', email: 'p@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', validoAte: null, origem: 'cortesia' } });
  const t = jwt.sign({ id: pro._id }, 'x');

  // 1. cadastro não aceita endereço interno
  for (const url of ['http://169.254.169.254/latest/meta-data/', 'http://127.0.0.1:4570/', 'http://[::ffff:127.0.0.1]:4570/', 'http://10.0.0.5/']) {
    const r = await fetch('http://localhost:3991/api/cadastrar-alerta', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ url }) });
    ok(r.status === 400, `cadastro recusa ${url}`);
  }

  // 2. página pública com link de PDF apontando para a rede interna
  //    (simulamos a resposta da página pública com um stub do axios.get)
  const getOrig = axios.get;
  let versao = 1;
  axios.get = async (url, opts) => {
    if (url === 'https://concurso.exemplo.com.br/edital') {
      const links = versao === 1 ? '' : '<a href="http://127.0.0.1:4570/latest/meta-data/segredo.pdf">Retificação</a>';
      return { headers: { 'content-type': 'text/html' }, data: Buffer.from(`<html><body><main><p>Edital versão ${versao}</p>${links}</main></body></html>`) };
    }
    return getOrig(url, opts);
  };
  const { interpretarResposta, OPCOES_DOWNLOAD } = require(B + '/src/utils/conteudoPagina');
  const pg = await interpretarResposta(await axios.get('https://concurso.exemplo.com.br/edital', OPCOES_DOWNLOAD), { url: 'https://concurso.exemplo.com.br/edital' });
  await Alerta.create({ url: 'https://concurso.exemplo.com.br/edital', email: 'p@x.com', usuario: pro._id, hashConteudo: crypto.createHash('md5').update(pg.texto).digest('hex'), ultimoConteudo: pg.texto, linksPdf: [], proximaVerificacao: new Date(Date.now() - 1000) });
  versao = 2;
  await require(B + '/src/service/agendador').executarRodada();
  ok(acessosInternos.length === 0, 'link de PDF para endereço interno NÃO é acessado pelo crawler');
  ok(iaChamadas.length === 1 && !JSON.stringify(iaChamadas[0]).includes('SEGREDO'), 'a mudança ainda é resumida, sem o conteúdo interno');

  // 3. redirecionamento de um site para a rede interna é bloqueado
  axios.get = getOrig;
  const redirecionador = http.createServer((req, res) => { res.writeHead(302, { Location: 'http://127.0.0.1:4570/latest/meta-data/' }); res.end(); });
  await new Promise(r => redirecionador.listen(4571, '0.0.0.0', r));
  // o 1º salto (127.0.0.2) só é permitido aqui porque testamos o redirecionamento isoladamente
  process.env.PERMITIR_REDE_PRIVADA = 'true';
  const { hostProibido } = require(B + '/src/utils/urlPublica');
  const opcoes = { ...OPCOES_DOWNLOAD, beforeRedirect: (o) => { delete process.env.PERMITIR_REDE_PRIVADA; OPCOES_DOWNLOAD.beforeRedirect(o); } };
  let erro = null;
  try { await axios.get('http://127.0.0.2:4571/', opcoes); } catch (e) { erro = e; }
  ok(erro && /bloqueado/.test(erro.message) && acessosInternos.length === 0, 'redirecionamento para endereço interno é bloqueado: ' + (erro?.message ?? 'nenhum erro'));
  ok(hostProibido('169.254.169.254') && !hostProibido('www.gov.br'), 'hostProibido: interno sim, público não');

  interno.close(); redirecionador.close();
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
