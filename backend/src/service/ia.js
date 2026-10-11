const axios = require('axios');

// ============================================
// 🤖 CLIENTE DE IA (Google Gemini)
// ============================================
// Único arquivo que conhece o fornecedor. Para trocar de IA, basta
// reimplementar gerarJson() mantendo a mesma assinatura.

const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

function iaConfigurada() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Trava de segurança de custo: no máximo N chamadas por dia por instância
let contadorDia = { dia: null, chamadas: 0 };
let erroIaAberto = false;
let cotaAvisadaEm = null;
function reservarCotaDiaria() {
  const hoje = new Date().toISOString().slice(0, 10);
  if (contadorDia.dia !== hoje) contadorDia = { dia: hoje, chamadas: 0 };
  const limite = Number(process.env.IA_LIMITE_DIARIO || 2000);
  if (contadorDia.chamadas >= limite) return false;
  contadorDia.chamadas += 1;
  return true;
}

/**
 * Pede à IA uma resposta em JSON seguindo um schema.
 * @param {{ instrucoes: string, conteudo: string, schema: object }} params
 * @returns {Promise<object>} JSON já parseado
 */
async function gerarJson({ instrucoes, conteudo, schema }) {
  if (!iaConfigurada()) throw new Error('GEMINI_API_KEY não configurada.');
  if (!reservarCotaDiaria()) {
    if (cotaAvisadaEm !== contadorDia.dia) {
      cotaAvisadaEm = contadorDia.dia;
      require('./tarefasAdmin').abrirTarefa({
      chave: `ia:cota:${contadorDia.dia}`, tipo: 'ia',
      titulo: 'Limite diário de resumos com IA atingido',
      descricao: `Hoje já foram ${contadorDia.chamadas} resumos (IA_LIMITE_DIARIO). Os alertas continuam saindo, mas sem resumo. `
        + 'Se o uso for legítimo, aumente IA_LIMITE_DIARIO no Render e confira o gasto no Google AI Studio.',
        link: 'https://aistudio.google.com/usage',
      });
    }
    throw new Error('Limite diário de chamadas de IA atingido.');
  }

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  let data;
  try {
    ({ data } = await axios.post(
    `${API_GEMINI}/${encodeURIComponent(modelo)}:generateContent`,
    {
      systemInstruction: { parts: [{ text: instrucoes }] },
      contents: [{ role: 'user', parts: [{ text: conteudo }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    },
    {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
      timeout: 60000,
    }
  ));
  } catch (err) {
    // Chave inválida, sem crédito ou cota do Google estourada: precisa de uma pessoa
    const status = err.response?.status;
    if ([400, 401, 403, 429].includes(status)) {
      const { abrirTarefa } = require('./tarefasAdmin');
      erroIaAberto = true;
      abrirTarefa({
        chave: 'ia:erro', tipo: 'ia', prioridade: 'alta',
        titulo: `A IA (Gemini) recusou os pedidos — HTTP ${status}`,
        descricao: `${err.response?.data?.error?.message ?? err.message}`.slice(0, 500)
          + ' — Confira a chave GEMINI_API_KEY, o faturamento e as cotas no Google AI Studio. Os alertas seguem saindo sem resumo.',
        link: 'https://aistudio.google.com/apikey',
      });
    }
    throw err;
  }
  if (erroIaAberto) {
    erroIaAberto = false;
    require('./tarefasAdmin').resolverTarefa('ia:erro', 'Resolvido: a IA voltou a responder.');
  }

  const texto = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((parte) => parte.text ?? '')
    .join('');
  if (!texto) throw new Error(`IA não retornou conteúdo (finishReason: ${data?.candidates?.[0]?.finishReason ?? '?'}).`);

  return JSON.parse(texto);
}

module.exports = { iaConfigurada, gerarJson };
