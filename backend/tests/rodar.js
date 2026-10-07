// Roda todas as suítes de teste do backend, uma por vez.
// Pré-requisito: MongoDB local em 127.0.0.1:27017 (ex.: docker run -d -p 27017:27017 mongo:7).
// Os testes usam o banco "notifica_testes" e o APAGAM ao começar — nunca aponte para produção.
// Toda rede externa (Mercado Pago, Gemini, Telegram, Querido Diário, Resend) é simulada.
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  'teste-fase1.js',      // planos, limites, migração
  'teste-fase1b.js',     // downgrade, cortesia, métricas, cancelamento por link
  'teste-crawler.js',    // paralelismo, reserva atômica, cache por URL
  'teste-ia.js',         // resumo com IA, PDFs, .ics
  'teste-pagamentos.js', // cartão, Pix, webhook, receita
  'teste-radar.js',      // Radar do Diário Oficial, criptografia, verificação de e-mail
  'teste-telegram.js',   // bot do Telegram
  'teste-ssrf.js',       // proteção contra acesso à rede interna
  'teste-conta.js',      // confirmação de e-mail, teste grátis, Minha conta, cidades do Radar
  'teste-dou.js',        // Radar: Diário Oficial da União e janela por fonte
];

let falhas = 0;
let total = 0;
for (const suite of SUITES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, suite)], { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const oks = (saida.match(/^✅ /gm) ?? []).length;
  const erros = (saida.match(/^❌ /gm) ?? []).length;
  total += oks + erros;
  const quebrou = r.status !== 0 || erros > 0;
  if (quebrou) falhas += Math.max(erros, 1);
  console.log(`${quebrou ? '❌' : '✅'} ${suite}: ${oks} ok, ${erros} falha(s)${r.status !== 0 && !erros ? ` (saiu com código ${r.status})` : ''}`);
  if (quebrou) {
    console.log(saida.split('\n').filter((l) => l.startsWith('❌') || /Error/.test(l)).slice(0, 20).join('\n'));
  }
}
console.log(`\n${total} cenários, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
