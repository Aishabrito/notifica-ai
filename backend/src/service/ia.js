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
  if (!reservarCotaDiaria()) throw new Error('Limite diário de chamadas de IA atingido.');

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const { data } = await axios.post(
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
  );

  const texto = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((parte) => parte.text ?? '')
    .join('');
  if (!texto) throw new Error(`IA não retornou conteúdo (finishReason: ${data?.candidates?.[0]?.finishReason ?? '?'}).`);

  return JSON.parse(texto);
}

module.exports = { iaConfigurada, gerarJson };
