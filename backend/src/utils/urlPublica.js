const dns = require('dns').promises;
const net = require('net');

// ============================================
// 🛡️ ANTI-SSRF: só deixa o servidor acessar endereços públicos
// ============================================
// Usado no cadastro de alertas, nos links de PDF achados dentro das páginas
// e em cada redirecionamento. Bloqueia localhost, redes privadas, link-local
// (ex.: 169.254.169.254, metadados de nuvem) e IPv4 embutido em IPv6.

const FAIXAS_IPV4_PRIVADAS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const ipv4ParaNumero = (ip) => ip.split('.').reduce((acc, parte) => (acc << 8) + Number(parte), 0) >>> 0;

function ipv4Privado(ip) {
  const n = ipv4ParaNumero(ip);
  return FAIXAS_IPV4_PRIVADAS.some(([base, bits]) => {
    const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mascara) === (ipv4ParaNumero(base) & mascara);
  });
}

function ipPrivado(ip) {
  const limpo = String(ip).replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIPv4(limpo)) return ipv4Privado(limpo);
  if (!net.isIPv6(limpo)) return false;
  const mapeado = limpo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ipv4Privado(mapeado[1]);
  if (limpo.startsWith('::ffff:')) return true; // ::ffff:7f00:1 e afins
  return limpo === '::1' || limpo === '::' || /^f[cd]/.test(limpo) || /^fe[89ab]/.test(limpo);
}

// Só para testes automatizados locais: nunca ative em produção
const redePrivadaPermitida = () => process.env.PERMITIR_REDE_PRIVADA === 'true';

// Checagem síncrona do nome do host (usada também nos redirecionamentos)
function hostProibido(hostname) {
  if (redePrivadaPermitida()) return false;
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true;
  return net.isIP(host) ? ipPrivado(host) : false;
}

/**
 * Valida uma URL antes do servidor acessá-la: protocolo http(s), host
 * público e — resolvendo o DNS — nenhum IP interno por trás do nome.
 * @returns {Promise<{ valido: boolean, motivo?: string }>}
 */
async function validarUrlPublica(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valido: false, motivo: 'URL inválida.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valido: false, motivo: 'Apenas URLs http:// e https:// são permitidas.' };
  }
  if (hostProibido(parsed.hostname)) {
    return { valido: false, motivo: 'URLs internas ou de rede privada não são permitidas.' };
  }
  if (!redePrivadaPermitida() && !net.isIP(parsed.hostname.replace(/^\[|\]$/g, ''))) {
    try {
      const enderecos = await dns.lookup(parsed.hostname, { all: true });
      if (enderecos.some((e) => ipPrivado(e.address))) {
        return { valido: false, motivo: 'URLs internas ou de rede privada não são permitidas.' };
      }
    } catch {
      return { valido: false, motivo: 'Não encontramos este endereço. Confira se a URL está correta.' };
    }
  }
  return { valido: true };
}

module.exports = { validarUrlPublica, hostProibido, ipPrivado };
