// Contas Pro de cortesia permanente (config/cortesias.js)
const B = require('path').resolve(__dirname, '..');
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  Object.assign(process.env, {
    PERMITIR_REDE_PRIVADA: 'true', MONGODB_URI: 'mongodb://127.0.0.1:27017/notifica_testes', JWT_SECRET: 'x', PORT: '3984',
    RESEND_API_KEY: 're_fake', EMAIL_REMETENTE: 'n@x', BASE_URL: 'http://x', PRO_CORTESIA_EMAILS: ' Equipe@X.com ,',
  });
  const mongoose = require(B + '/node_modules/mongoose');
  for (let i = 0; i < 30; i++) { try { await mongoose.connect(process.env.MONGODB_URI); break; } catch { await sleep(1000); } }
  await mongoose.connection.dropDatabase();
  require(B + '/src/utils/mailer').sendMail = async () => {};
  const Usuario = require(B + '/src/models/Usuario');
  const { emailsCortesia } = require(B + '/src/config/cortesias');
  const { aplicarCortesias } = require(B + '/src/service/planoService');

  ok(emailsCortesia().includes('aisha.paola14@gmail.com') && emailsCortesia().includes('equipe@x.com') && emailsCortesia().length === 2, 'lista: conta da dona + extras de PRO_CORTESIA_EMAILS (normalizados)');

  const dona = await Usuario.create({ nome: 'Aisha', email: 'aisha.paola14@gmail.com', senha: '12345678' });
  const outro = await Usuario.create({ nome: 'Zé', email: 'ze@x.com', senha: '12345678' });
  const pagante = await Usuario.create({ nome: 'Eq', email: 'equipe@x.com', senha: '12345678', plano: { tipo: 'pro', status: 'ativo', origem: 'mercadopago', mpAssinaturaId: 'pre_1', validoAte: new Date(Date.now() + 864e5) } });

  // ligar o servidor já aplica
  require(B + '/server.js');
  await sleep(1500);
  const d = await Usuario.findById(dona._id);
  ok(d.plano.tipo === 'pro' && d.plano.origem === 'cortesia' && d.plano.validoAte === null, 'ao ligar o servidor, a conta da dona vira Pro sem prazo');
  ok((await Usuario.findById(outro._id)).plano.tipo === 'free', 'quem não está na lista continua Free');
  ok((await Usuario.findById(pagante._id)).plano.origem === 'mercadopago', 'quem já paga no cartão não é mexido');
  ok(await aplicarCortesias() === 0, 'rodar de novo não altera nada');

  // rebaixada por engano: o login devolve o Pro
  await Usuario.updateOne({ _id: dona._id }, { plano: { tipo: 'free', status: 'ativo', origem: null } });
  const r = await fetch('http://localhost:3984/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'aisha.paola14@gmail.com', senha: '12345678' }) }).then(x => x.json());
  ok(r.usuario.plano.tipo === 'pro', 'no login, a conta de cortesia volta a ser Pro');

  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
