const crypto = require('crypto');
const transportador = require('../../utils/mailer');
const { InteresseEdital, EditalEncontrado } = require('../../models/InteresseEdital');
require('../../models/Usuario');
const { escaparHtml } = require('../../utils/html');
const { obterTipoPlanoEfetivo } = require('../../config/planos');
const { cidadeDisponivel, nomeDiario } = require('../../config/radar');

// ============================================
// 📢 RADAR DE EDITAIS POR INTERESSE (Pro)
// ============================================
// Procura o cargo/área nos mesmos diários do Radar de nomes e só fica com
// publicações que falam de concurso/seleção (edital, inscrições...).

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_PRIMEIRA_BUSCA = 7;
const DIAS_SOBREPOSICAO = 2;
const MAX_INTERESSES = 5;

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Palavras que indicam abertura de seleção (não basta citar o cargo)
const SINAIS_SELECAO = /\b(concurso publico|concurso|processo seletivo|selecao publica|edital de abertura|abertura de inscricoes|inscricoes|vagas|cadastro reserva)\b/;
// Publicações de pessoal que citam o cargo mas não são oportunidade
const RUIDO = /\b(exonera|aposenta|falecimento|pensao|licenca|ferias)\w*/;

function relevante(trechos, termo) {
  const alvo = ` ${normalizar(termo)} `;
  return trechos.some((t) => {
    const n = ` ${normalizar(t)} `;
    return n.includes(alvo) && SINAIS_SELECAO.test(n) && !RUIDO.test(n);
  });
}

async function avisarEditais(usuario, interesse, novos) {
  const itens = novos.map((e) => `
    <div style="border-left:3px solid #8b5cf6;padding:8px 12px;margin:16px 0;">
      <p style="margin:0 0 4px;"><b>${escaparHtml(nomeDiario(e.cidadeId))}</b> · ${escaparHtml(e.dataPublicacao.split('-').reverse().join('/'))}</p>
      ${e.trechos.slice(0, 2).map((t) => `<p style="font-size:13px;color:#333;background:#f6f6f6;padding:8px;border-radius:6px;">…${escaparHtml(t)}…</p>`).join('')}
      <p><a href="${escaparHtml(e.url)}">Abrir a publicação</a></p>
    </div>`).join('');
  const frontend = process.env.FRONTEND_URL || 'https://notifica.dev.br';
  await transportador.sendMail({
    from: `"Notifica.ai" <${process.env.EMAIL_REMETENTE}>`,
    to: usuario.email,
    subject: `📢 ${novos.length === 1 ? 'Nova publicação' : `${novos.length} publicações`} sobre "${interesse.termo}"`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 640px;">
        <h2>Edital à vista: ${escaparHtml(interesse.termo)}</h2>
        <p>O Radar de editais achou ${novos.length === 1 ? 'uma publicação' : `${novos.length} publicações`} de concurso ou seleção que ${novos.length === 1 ? 'cita' : 'citam'} o que você acompanha.</p>
        ${itens}
        <p style="font-size:13px">💡 Achou o edital? Cadastre a página da banca no Notifica.ai para acompanhar retificações e prazos.</p>
        <hr><p style="font-size:12px;color:#666;">Gerencie seus interesses em <a href="${frontend}/radar">${frontend}/radar</a>.</p>
      </div>`,
  });
  if (usuario.telegram?.chatId) {
    const telegram = require('../telegram');
    if (telegram.telegramConfigurado()) {
      await telegram.enviarMensagem(usuario.telegram.chatId,
        `📢 <b>${novos.length} publicação(ões) sobre "${escaparHtml(interesse.termo)}"</b>\n\n${novos.slice(0, 5).map((e) => `• ${escaparHtml(nomeDiario(e.cidadeId))} — ${e.dataPublicacao.split('-').reverse().join('/')}\n${escaparHtml(e.url)}`).join('\n\n')}`).catch(() => {});
    }
  }
}

async function processarInteresse(interesse, { avisar = true } = {}) {
  const { DRIVERS } = require('./radarService');
  const usuario = interesse.usuario?.email ? interesse.usuario : await require('../../models/Usuario').findById(interesse.usuario).select('email nome plano telegram');
  const cidades = interesse.cidades.filter(cidadeDisponivel);
  const novos = [];
  let erros = 0;

  for (const driver of DRIVERS) {
    const doDriver = cidades.filter(driver.suporta);
    if (!doDriver.length) continue;
    const ultima = interesse.buscasPorFonte?.get(driver.id);
    const desde = new Date(ultima ? new Date(ultima).getTime() - DIAS_SOBREPOSICAO * DIA_MS : Date.now() - DIAS_PRIMEIRA_BUSCA * DIA_MS).toISOString().slice(0, 10);
    try {
      const publicacoes = await driver.buscar({ termo: interesse.termo, cidades: doDriver, desde });
      for (const pub of publicacoes) {
        if (!relevante(pub.trechos, interesse.termo)) continue;
        const chave = crypto.createHash('sha256').update(`${driver.id}|${pub.url}|${pub.data}`).digest('hex');
        try {
          const doc = await EditalEncontrado.create({
            interesse: interesse._id, usuario: usuario._id, chave, driver: driver.id, cidadeId: pub.cidadeId,
            dataPublicacao: pub.data, url: pub.url, trechos: pub.trechos.slice(0, 3).map((t) => t.slice(0, 400)),
          });
          novos.push(doc);
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
      }
      if (!interesse.buscasPorFonte) interesse.buscasPorFonte = new Map();
      interesse.buscasPorFonte.set(driver.id, new Date());
    } catch (err) {
      erros += 1;
      console.error(`[Editais] Falha em ${driver.id}:`, err.message);
    }
  }

  interesse.ultimaBuscaEm = new Date();
  await interesse.save();

  if (avisar && novos.length) {
    try {
      await avisarEditais(usuario, interesse, novos);
      await EditalEncontrado.updateMany({ _id: { $in: novos.map((n) => n._id) } }, { notificadoEm: new Date() });
    } catch (err) {
      console.error('[Editais] Falha ao avisar:', err.message);
    }
  }
  return { novos: novos.length, erros };
}

let emExecucao = false;
async function executarRadarEditais() {
  if (emExecucao) return null;
  emExecucao = true;
  try {
    const interesses = await InteresseEdital.find({ ativo: true }).populate('usuario', 'nome email plano telegram');
    let total = 0;
    for (const i of interesses) {
      if (!i.usuario || obterTipoPlanoEfetivo(i.usuario) !== 'pro') continue;
      try {
        total += (await processarInteresse(i)).novos;
      } catch (err) {
        console.error(`[Editais] Erro no interesse ${i._id}:`, err.message);
      }
    }
    if (total) console.log(`[Editais] ${total} publicação(ões) nova(s) de editais.`);
    return total;
  } finally {
    emExecucao = false;
  }
}

module.exports = { processarInteresse, executarRadarEditais, relevante, MAX_INTERESSES };
