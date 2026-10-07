const crypto = require('crypto');
const transportador   = require('../../utils/mailer');
const MonitorRadar    = require('../../models/MonitorRadar');
const OcorrenciaRadar = require('../../models/OcorrenciaRadar');
const LogRadar        = require('../../models/LogRadar');
require('../../models/Usuario'); // registra o modelo usado no populate('usuario')
const { cifrar, decifrar } = require('../../utils/cripto');
const { escaparHtml } = require('../../utils/html');
const { obterTipoPlanoEfetivo } = require('../../config/planos');
const { RADAR, cidadeDisponivel, nomeDiario } = require('../../config/radar');
const queridoDiario = require('./queridoDiario');
const dou = require('./dou');

// Fontes consultadas; cada uma diz quais "cidades" atende (suporta).
// Novas fontes (DOERJ...) entram nesta lista.
const DRIVERS = [queridoDiario, dou];

const DIA_MS = 24 * 60 * 60 * 1000;
const PAUSA_ENTRE_CONSULTAS_MS = 1000; // educação com a API pública

// ============================================
// 🔤 NORMALIZAÇÃO E CONFIRMAÇÃO DE TRECHOS
// ============================================
// Sem acento, minúsculo, só letras/números: "JOSÉ  da Silva," == "jose da silva"
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const soDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

// CPF mascarado no diário: ***.456.789-** (às vezes com dígitos, x ou •)
function regexCpfMeio(cpfMeio) {
  if (!cpfMeio || cpfMeio.length !== 6) return null;
  return new RegExp(`[\\d*xX•]{3}\\.?\\s?${cpfMeio.slice(0, 3)}\\.?\\s?${cpfMeio.slice(3)}\\s?-?\\s?[\\d*xX•]{2}`);
}

/**
 * Confere nos trechos devolvidos pela fonte se o nome (ou a inscrição)
 * aparece de verdade — a busca da fonte pode ser mais "frouxa" que isso.
 * @returns {null | 'nome' | 'nome+documento' | 'inscricao'}
 */
function confirmarTrechos(trechos, { nome, inscricao, cpfMeio }) {
  const nomeNorm = normalizar(nome);
  const inscNorm = inscricao ? normalizar(inscricao) : null;
  const cpfRegex = regexCpfMeio(cpfMeio);

  let temNome = false;
  let temDocumento = false;
  for (const trecho of trechos) {
    const norm = ` ${normalizar(trecho)} `;
    if (nomeNorm && norm.includes(` ${nomeNorm} `)) temNome = true;
    if (inscNorm && inscNorm.length >= 4 && norm.includes(` ${inscNorm} `)) temDocumento = true;
    if (cpfRegex && cpfRegex.test(trecho)) temDocumento = true;
  }
  if (temNome && temDocumento) return 'nome+documento';
  if (temNome) return 'nome';
  if (temDocumento && inscNorm) return 'inscricao';
  return null;
}

// ============================================
// 📧 E-MAIL DE OCORRÊNCIA
// ============================================
function destacar(trecho, termos) {
  let html = escaparHtml(trecho);
  for (const termo of termos.filter(Boolean)) {
    const seguro = escaparHtml(termo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(seguro, 'gi'), (m) => `<mark style="background:#fde68a;">${m}</mark>`);
  }
  return html;
}

async function enviarEmailOcorrencias(usuario, dados, ocorrencias) {
  const itens = ocorrencias.map((o) => {
    const data = new Date(`${o.dataPublicacao}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    const selo = o.confirmacao === 'nome+documento' ? '✅ nome e documento conferem'
      : o.confirmacao === 'inscricao' ? '🔢 encontrado pelo número de inscrição'
      : '⚠️ encontrado pelo nome — confira se é você (pode haver homônimos)';
    return `
      <div style="border-left:3px solid #10b981;padding:8px 12px;margin:16px 0;">
        <p style="margin:0 0 4px;"><b>${escaparHtml(nomeDiario(o.cidadeId))}</b> · ${escaparHtml(data)}${o.edicao ? ` · edição ${escaparHtml(o.edicao)}` : ''}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#555;">${selo}</p>
        ${o.trechos.map((t) => `<p style="font-size:13px;color:#333;background:#f6f6f6;padding:8px;border-radius:6px;">…${destacar(t, [dados.nome, dados.inscricao])}…</p>`).join('')}
        <p><a href="${escaparHtml(o.url)}">Abrir o diário oficial</a></p>
      </div>`;
  }).join('');

  const frontend = process.env.FRONTEND_URL || 'https://notifica.dev.br';
  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: usuario.email,
    subject: ocorrencias.length === 1
      ? `📰 Você foi citado(a) no ${nomeDiario(ocorrencias[0].cidadeId)}`
      : `📰 Você foi citado(a) em ${ocorrencias.length} publicações de Diário Oficial`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 640px;">
        <h2>Encontramos você no Diário Oficial</h2>
        <p>O Radar do Notifica.ai achou ${ocorrencias.length === 1 ? 'uma publicação' : `${ocorrencias.length} publicações`} que ${ocorrencias.length === 1 ? 'cita' : 'citam'} os dados que você cadastrou.</p>
        ${itens}
        <hr>
        <p style="font-size:12px;color:#666;">Confira sempre no documento oficial. Gerencie seus nomes monitorados em <a href="${frontend}/radar">${frontend}/radar</a>.</p>
      </div>`,
  });
}

// Ganchos para outros canais (ex.: Telegram), registrados em tempo de execução
const ouvintesOcorrencias = [];
function aoEncontrarOcorrencias(fn) { ouvintesOcorrencias.push(fn); }

// ============================================
// 🔎 PROCESSAMENTO DE UM MONITOR
// ============================================
function decifrarMonitor(monitor) {
  const cpfMeio = decifrar(monitor.cpfMeioCifrado);
  return {
    nome: decifrar(monitor.nomeCifrado),
    inscricao: decifrar(monitor.inscricaoCifrada),
    cpfMeio,
  };
}

const chaveOcorrencia = (driver, url, data) =>
  crypto.createHash('sha256').update(`${driver}|${url}|${data}`).digest('hex');

/**
 * Busca o monitor em todas as fontes, registra as publicações novas e avisa.
 * @returns {{ novas: number, resultados: number, erros: number }}
 */
async function processarMonitor(monitor, { manual = false } = {}) {
  const dados = decifrarMonitor(monitor);
  // Janela de cada fonte: desde a última busca bem-sucedida nela (menos a
  // sobreposição), ou os últimos 30 dias na primeira vez
  const desdePara = (driver) => {
    const ultima = monitor.buscasPorFonte?.get(driver.id) ?? monitor.ultimaBuscaEm;
    const ms = ultima
      ? new Date(ultima).getTime() - RADAR.diasSobreposicao * DIA_MS
      : Date.now() - RADAR.diasBuscaInicial * DIA_MS;
    return new Date(ms).toISOString().slice(0, 10);
  };

  // Busca pelo nome e, se houver, pelo número de inscrição (muitas listas de
  // concurso publicam só a inscrição)
  const termos = [dados.nome, dados.inscricao && dados.inscricao.length >= 4 ? dados.inscricao : null].filter(Boolean);

  // Só consulta cidades ainda disponíveis (RADAR_CIDADES pode ter mudado)
  const cidades = monitor.cidades.filter(cidadeDisponivel);
  if (cidades.length === 0) return { novas: 0, resultados: 0, erros: 0 };

  const novas = [];
  let resultados = 0;
  let erros = 0;

  for (const driver of DRIVERS) {
    const cidadesDriver = cidades.filter(driver.suporta);
    if (cidadesDriver.length === 0) continue;
    const desde = desdePara(driver);
    let errosDriver = 0;

    for (const termo of termos) {
      try {
        const publicacoes = await driver.buscar({ termo, cidades: cidadesDriver, desde });
        resultados += publicacoes.length;
        let novasNesta = 0;

        for (const pub of publicacoes) {
          const confirmacao = confirmarTrechos(pub.trechos, dados);
          if (!confirmacao) continue;
          try {
            const ocorrencia = await OcorrenciaRadar.create({
              monitor: monitor._id,
              usuario: monitor.usuario._id ?? monitor.usuario,
              chave: chaveOcorrencia(driver.id, pub.url, pub.data),
              driver: driver.id,
              cidadeId: pub.cidadeId,
              dataPublicacao: pub.data,
              url: pub.url,
              edicao: pub.edicao,
              trechosCifrados: cifrar(JSON.stringify(pub.trechos)),
              confirmacao,
            });
            novas.push({ ...pub, _id: ocorrencia._id, cidadeId: pub.cidadeId, dataPublicacao: pub.data, confirmacao });
            novasNesta += 1;
          } catch (err) {
            if (err.code !== 11000) throw err; // 11000 = já registrada antes
          }
        }

        await LogRadar.create({
          monitor: monitor._id, usuario: monitor.usuario._id ?? monitor.usuario, driver: driver.id,
          cidades: cidadesDriver, desde, resultados: publicacoes.length, novas: novasNesta, manual,
        });
      } catch (err) {
        erros += 1;
        errosDriver += 1;
        console.error(`[Radar] Falha no driver ${driver.id} (monitor ${monitor._id}):`, err.message);
        await LogRadar.create({
          monitor: monitor._id, usuario: monitor.usuario._id ?? monitor.usuario, driver: driver.id,
          cidades: cidadesDriver, desde, sucesso: false, erro: String(err.message).slice(0, 300), manual,
        }).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_CONSULTAS_MS));
    }

    // Só avança a janela desta fonte se todas as consultas nela deram certo
    if (errosDriver === 0) {
      if (!monitor.buscasPorFonte) monitor.buscasPorFonte = new Map();
      monitor.buscasPorFonte.set(driver.id, new Date());
    }
  }

  if (erros === 0) monitor.ultimaBuscaEm = new Date();
  await monitor.save();

  if (novas.length > 0) {
    const usuario = monitor.usuario?.email ? monitor.usuario : await require('../../models/Usuario').findById(monitor.usuario).select('nome email plano telegram');
    try {
      await enviarEmailOcorrencias(usuario, dados, novas);
      await OcorrenciaRadar.updateMany({ _id: { $in: novas.map((n) => n._id) } }, { notificadoEm: new Date() });
    } catch (err) {
      console.error(`[Radar] Falha ao enviar e-mail de ocorrência para ${usuario?.email}:`, err.message);
    }
    for (const ouvinte of ouvintesOcorrencias) {
      Promise.resolve(ouvinte(usuario, dados, novas)).catch((err) => console.error('[Radar] Falha em canal extra:', err.message));
    }
  }

  return { novas: novas.length, resultados, erros };
}

// ============================================
// 🕒 RODADA AGENDADA
// ============================================
let rodadaEmExecucao = false;

async function executarRadar() {
  if (rodadaEmExecucao) return null;
  rodadaEmExecucao = true;
  const totais = { monitores: 0, novas: 0, erros: 0 };
  try {
    const monitores = await MonitorRadar.find({ ativo: true }).populate('usuario', 'nome email plano telegram');
    for (const monitor of monitores) {
      if (!monitor.usuario || obterTipoPlanoEfetivo(monitor.usuario) !== 'pro') continue;
      try {
        const r = await processarMonitor(monitor);
        totais.monitores += 1;
        totais.novas += r.novas;
        totais.erros += r.erros;
      } catch (err) {
        totais.erros += 1;
        console.error(`[Radar] Erro no monitor ${monitor._id}:`, err.message);
      }
    }
    if (totais.monitores) console.log(`[Radar] ${totais.monitores} nome(s) verificados, ${totais.novas} publicação(ões) nova(s).`);
    return totais;
  } finally {
    rodadaEmExecucao = false;
  }
}

module.exports = {
  normalizar,
  confirmarTrechos,
  processarMonitor,
  executarRadar,
  decifrarMonitor,
  aoEncontrarOcorrencias,
  DRIVERS,
};
