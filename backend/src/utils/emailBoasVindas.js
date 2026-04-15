
const emailBoasVindas = (nome) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Notifica.ai</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- LOGO -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:900;color:#f5f2eb;letter-spacing:-1px;">
                Notifica<span style="color:#10b981;">.ai</span>
              </span>
            </td>
          </tr>

          <!-- CARD PRINCIPAL -->
          <tr>
            <td style="background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(108,52,131,0.04));border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:40px;">

              <p style="font-family:monospace;font-size:10px;color:#a855f7;text-transform:uppercase;letter-spacing:4px;margin:0 0 16px;">// bem-vinda</p>

              <h1 style="font-size:28px;font-weight:900;color:#f5f2eb;margin:0 0 16px;letter-spacing:-1px;line-height:1.1;">
                Olá, ${nome}.<br/>
                <span style="color:#10b981;">Você está dentro.</span>
              </h1>

              <p style="font-size:14px;color:#737373;line-height:1.7;margin:0 0 32px;">
                Sua conta no <strong style="color:#f5f2eb;">Notifica.ai</strong> foi criada com sucesso.
                Agora você pode monitorar qualquer site e receber um e-mail assim que algo mudar —
                sem precisar dar F5.
              </p>

              <!-- COMO FUNCIONA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                ${["Cole o link da página que quer monitorar", "A gente checa de hora em hora, todo dia", "Mudou? E-mail na hora. Sem spam."].map((item, i) => `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="font-family:monospace;font-size:11px;color:#10b981;margin-right:12px;">0${i + 1}</span>
                    <span style="font-size:13px;color:#a3a3a3;">${item}</span>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- CTA -->
              <a href="https://notifica.dev.br/dashboard"
                 style="display:inline-block;background:#10b981;color:#000;font-weight:700;font-size:13px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                Criar meu primeiro alerta →
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding-top:24px;">
              <p style="font-family:monospace;font-size:10px;color:#404040;margin:0;">
                © 2025 Notifica.ai · Feito por Aisha Brito · UFRJ
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { emailBoasVindas };