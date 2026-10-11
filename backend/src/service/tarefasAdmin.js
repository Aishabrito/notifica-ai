const TarefaAdmin = require('../models/TarefaAdmin');

// ============================================
// 📋 TAREFAS PARA A ADMINISTRAÇÃO
// ============================================
// Quando algo precisa de uma pessoa (página que não abre, diário fora do ar,
// pagamento que não foi processado...), o sistema abre uma tarefa no painel.
// Nunca lança erro: registrar a tarefa não pode derrubar o fluxo principal.

async function abrirTarefa({ chave, tipo, titulo, descricao = '', link = null, alerta = null, usuario = null, prioridade = 'normal' }) {
  const agora = new Date();
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      return await TarefaAdmin.findOneAndUpdate(
        { chave, status: 'aberta' },
        {
          $setOnInsert: { tipo, titulo: String(titulo).slice(0, 200), alerta, usuario, prioridade },
          $set: { descricao: String(descricao).slice(0, 2000), link, ultimaOcorrenciaEm: agora },
          $inc: { ocorrencias: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: false }
      );
    } catch (err) {
      if (err.code === 11000 && tentativa === 0) continue; // corrida com outra instância: tenta de novo
      console.error('[Tarefas] Falha ao abrir tarefa:', chave, err.message);
      return null;
    }
  }
  return null;
}

// Fecha sozinho quando o problema some (ex.: a página voltou a abrir)
async function resolverTarefa(chave, nota = 'Resolvido automaticamente: o problema não se repetiu.') {
  try {
    const r = await TarefaAdmin.updateMany(
      { chave, status: 'aberta' },
      { $set: { status: 'concluida', concluidaEm: new Date(), concluidaPor: 'sistema', nota } }
    );
    return r.modifiedCount;
  } catch (err) {
    console.error('[Tarefas] Falha ao resolver tarefa:', chave, err.message);
    return 0;
  }
}

module.exports = { abrirTarefa, resolverTarefa };
