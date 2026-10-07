// Gera um arquivo .ics (iCalendar) com eventos de dia inteiro.
// Funciona em Google Agenda, Outlook e Apple Calendar.

function escaparIcs(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// "2026-05-20" → "20260520"; dia seguinte para o DTEND exclusivo
function dataIcs(iso, somarDias = 0) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + somarDias);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * @param {Array<{ data: string, descricao: string }>} eventos – data em YYYY-MM-DD
 * @param {{ titulo: string, url: string, uidBase: string }} contexto
 */
function gerarIcs(eventos, { titulo, url, uidBase }) {
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notifica.ai//Prazos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  eventos.forEach((evento, i) => {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${uidBase}-${i}@notifica.dev.br`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${dataIcs(evento.data)}`,
      `DTEND;VALUE=DATE:${dataIcs(evento.data, 1)}`,
      `SUMMARY:${escaparIcs(`${evento.descricao} — ${titulo}`)}`,
      `DESCRIPTION:${escaparIcs(`Detectado pelo Notifica.ai. Confira no documento oficial: ${url}`)}`,
      `URL:${escaparIcs(url)}`,
      'END:VEVENT'
    );
  });

  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n');
}

module.exports = { gerarIcs };
