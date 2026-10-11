// ============================================
// 🎁 CONTAS PRO DE CORTESIA PERMANENTE
// ============================================
// E-mails que são Pro sem pagar (dona do produto, equipe). Aplicado ao ligar o
// servidor, todo dia de madrugada e no cadastro/login. Para incluir outras
// pessoas sem mexer no código: PRO_CORTESIA_EMAILS=a@x.com,b@y.com no Render.
const FIXOS = ['aisha.paola14@gmail.com'];

function emailsCortesia() {
  const extras = String(process.env.PRO_CORTESIA_EMAILS ?? '').split(',');
  return [...new Set([...FIXOS, ...extras].map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

module.exports = { emailsCortesia };
