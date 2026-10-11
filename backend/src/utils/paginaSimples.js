// Página HTML mínima servida pelo próprio backend (links de e-mail:
// cancelar alerta, confirmar e-mail). `corpo` já deve vir escapado.
function pagina(titulo, corpo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo} — Notifica.ai</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #0a0a0a; color: #f5f2eb; font-family: Arial, sans-serif; padding: 16px; box-sizing: border-box; }
    .card { max-width: 420px; width: 100%; background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { color: #a3a3a3; line-height: 1.5; word-break: break-word; }
    button { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 10px;
             background: #dc2626; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body><div class="card">${corpo}</div></body>
</html>`;
}

module.exports = { pagina };
