// Envio de e-mail (Resend): sem chave o servidor liga; erros passageiros têm nova tentativa
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };

(async () => {
  delete process.env.RESEND_API_KEY;
  let mailer;
  try { mailer = require(B + '/src/utils/mailer'); } catch { /* falha abaixo */ }
  ok(Boolean(mailer), 'sem RESEND_API_KEY o módulo carrega (o servidor não cai ao ligar)');
  let erro = await mailer.sendMail({ from: 'a@x', to: 'b@x', subject: 'Oi', html: '<p>oi</p>' }).catch((e) => e);
  ok(/RESEND_API_KEY não configurada/.test(erro?.message), 'sem chave: o envio falha com mensagem clara');

  process.env.RESEND_API_KEY = 're_fake';
  const esperas = [];
  let respostas = [];
  const enviados = [];
  mailer._definirCliente({ emails: { send: async (m) => { enviados.push(m); return respostas.shift(); } } }, async (ms) => { esperas.push(ms); });

  respostas = [{ data: null, error: { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests' } }, { data: { id: 'e1' }, error: null }];
  const r = await mailer.sendMail({ from: 'a@x', to: 'b@x', subject: 'Oi', html: '<p>oi</p>', headers: { 'List-Unsubscribe': '<https://x/c>' } });
  ok(r?.id === 'e1' && enviados.length === 2 && esperas[0] === 1000, 'limite de envio (429): espera 1s e envia de novo');
  ok(enviados[0].to[0] === 'b@x' && enviados[0].headers['List-Unsubscribe'] === '<https://x/c>', 'repassa destinatário e cabeçalhos ao Resend');

  enviados.length = 0; esperas.length = 0;
  respostas = [{ error: { statusCode: 500, name: 'internal_server_error', message: 'boom' } }, { error: { statusCode: 503, name: 'application_error', message: 'boom' } }, { error: { statusCode: 500, name: 'internal_server_error', message: 'ainda fora' } }];
  erro = await mailer.sendMail({ from: 'a@x', to: 'b@x', subject: 'Oi', html: '' }).catch((e) => e);
  ok(enviados.length === 3 && esperas.join(',') === '1000,2000' && /ainda fora/.test(erro?.message), 'Resend fora do ar: 3 tentativas (1s, 2s) e depois desiste com o erro');

  enviados.length = 0;
  respostas = [{ error: { statusCode: 422, name: 'validation_error', message: 'Invalid `to` field' } }];
  erro = await mailer.sendMail({ from: 'a@x', to: 'invalido', subject: 'Oi', html: '' }).catch((e) => e);
  ok(enviados.length === 1 && /Invalid `to`/.test(erro?.message), 'erro definitivo (e-mail inválido): não tenta de novo');

  enviados.length = 0;
  respostas = [];
  mailer._definirCliente({ emails: { send: async () => { enviados.push(1); if (enviados.length === 1) throw new Error('ECONNRESET'); return { data: { id: 'e2' }, error: null }; } } });
  ok((await mailer.sendMail({ from: 'a@x', to: 'b@x', subject: 'Oi', html: '' }))?.id === 'e2', 'queda de rede: tenta de novo');
})().catch((e) => { console.error(e); process.exit(1); });
