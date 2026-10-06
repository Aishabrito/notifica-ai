const { escaparHtml } = require('./html');

const emailPremium = (nome, validoAte) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Notifica.ai Pro</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:900;color:#f5f2eb;letter-spacing:-1px;">
                Notifica<span style="color:#10b981;">.ai</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(108,52,131,0.04));border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:40px;">
              <p style="font-family:monospace;font-size:10px;color:#a855f7;text-transform:uppercase;letter-spacing:4px;margin:0 0 16px;">// plano pro ativo</p>
              <h1 style="font-size:28px;font-weight:900;color:#f5f2eb;margin:0 0 16px;letter-spacing:-1px;">
                Agora é Pro, ${escaparHtml(nome)}! 🚀
              </h1>
              <p style="font-size:15px;color:#a3a3a3;line-height:1.6;margin:0 0 24px;">
                Seu pagamento foi confirmado. A partir de agora você tem:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr><td style="padding:6px 0;font-size:14px;color:#f5f2eb;">✅ Alertas ilimitados</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#f5f2eb;">⚡ Checagens a cada 1h ou 15 minutos</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#f5f2eb;">🔁 Alertas pausados pelo limite do plano gratuito foram reativados</td></tr>
              </table>
              ${validoAte ? `<p style="font-size:13px;color:#737373;margin:0;">Próxima renovação: ${new Date(validoAte).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#525252;">
              Você pode cancelar a assinatura a qualquer momento pelo painel. O acesso Pro continua até o fim do período pago.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { emailPremium };
