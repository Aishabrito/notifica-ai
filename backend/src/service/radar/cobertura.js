const mongoose = require('mongoose');

// ============================================
// 🗺️ COBERTURA DO RADAR: quais cidades têm diário recente na fonte
// ============================================
// As cidades marcadas como "sempre" em config/radar.js foram conferidas à mão.
// As demais só aparecem para escolha quando a fonte (Querido Diário) tem uma
// edição dos últimos DIAS_MAXIMO dias. A conferência roda ao ligar o servidor
// e todo dia de manhã; se a fonte estiver fora do ar, o último resultado
// conhecido continua valendo (nada some por uma falha passageira).

const DIAS_MAXIMO = 15;

const schema = new mongoose.Schema({
  _id:              { type: String }, // código IBGE
  ultimaPublicacao: { type: String, default: null }, // AAAA-MM-DD
  verificadoEm:     { type: Date, default: null },
}, { versionKey: false });
const CoberturaRadar = mongoose.models.CoberturaRadar || mongoose.model('CoberturaRadar', schema);

const cache = new Map(); // id → { ultimaPublicacao, verificadoEm }

const diasDesde = (ymd, agora = Date.now()) => (agora - Date.parse(`${ymd}T12:00:00Z`)) / 864e5;

function temCobertura(cidadeId, agora = Date.now()) {
  const c = cache.get(cidadeId);
  return Boolean(c?.ultimaPublicacao) && diasDesde(c.ultimaPublicacao, agora) <= DIAS_MAXIMO;
}

async function carregarCobertura() {
  const lista = await CoberturaRadar.find({}).lean();
  for (const c of lista) cache.set(c._id, { ultimaPublicacao: c.ultimaPublicacao, verificadoEm: c.verificadoEm });
  return lista.length;
}

// Confere as cidades que dependem da fonte. Devolve quantas têm diário recente.
async function atualizarCobertura() {
  const { candidatas } = require('../../config/radar');
  const { DRIVERS } = require('./radarService');
  let cobertas = 0;
  for (const cidade of candidatas()) {
    const driver = DRIVERS.find((d) => d.suporta(cidade.id));
    if (!driver?.ultimaPublicacao) continue;
    try {
      const ultimaPublicacao = await driver.ultimaPublicacao(cidade.id);
      const registro = { ultimaPublicacao, verificadoEm: new Date() };
      cache.set(cidade.id, registro);
      await CoberturaRadar.updateOne({ _id: cidade.id }, { $set: registro }, { upsert: true });
      if (temCobertura(cidade.id)) cobertas += 1;
    } catch (err) {
      // Fonte fora do ar: mantém o que já se sabia
      console.warn(`[Radar] Não foi possível conferir ${cidade.nome}: ${err.message}`);
      if (temCobertura(cidade.id)) cobertas += 1;
    }
  }
  return cobertas;
}

module.exports = { CoberturaRadar, DIAS_MAXIMO, temCobertura, carregarCobertura, atualizarCobertura, _cache: cache };
