const crypto = require('crypto');

// ============================================
// 🔐 CRIPTOGRAFIA DE DADOS SENSÍVEIS (AES-256-GCM)
// ============================================
// Nomes, inscrições, CPF parcial e trechos de diário oficial ficam cifrados
// no banco. A chave (32 bytes em base64) fica só no servidor: quem tiver
// acesso apenas ao banco não consegue ler esses dados.
// Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const VERSAO = 'v1';

function chave() {
  const bruta = process.env.DADOS_CHAVE;
  if (!bruta) return null;
  const buffer = Buffer.from(bruta, 'base64');
  if (buffer.length !== 32) throw new Error('DADOS_CHAVE deve ter 32 bytes em base64.');
  return buffer;
}

function criptografiaConfigurada() {
  try { return Boolean(chave()); } catch { return false; }
}

function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const k = chave();
  if (!k) throw new Error('DADOS_CHAVE não configurada.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const conteudo = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return [VERSAO, iv.toString('base64'), cipher.getAuthTag().toString('base64'), conteudo.toString('base64')].join(':');
}

function decifrar(valor) {
  if (!valor) return null;
  const [versao, iv, tag, conteudo] = String(valor).split(':');
  if (versao !== VERSAO || !iv || !tag || !conteudo) throw new Error('Formato de dado cifrado inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(conteudo, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { cifrar, decifrar, criptografiaConfigurada };
