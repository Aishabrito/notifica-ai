// Gera um arquivo .ics (iCalendar) com eventos de dia inteiro.
// Funciona em Google Agenda, Outlook e Apple Calendar.

function escaparIcs(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
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

// Momento limite de um prazo: a hora informada (ou 23:59) no horário de Brasília.
// O Brasil não tem horário de verão desde 2019, então o fuso é sempre -03:00.
function momentoLimite({ data, hora }) {
  return new Date(`${data}T${hora || '23:59'}:00-03:00`);
}

const utcIcs = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Quebra linhas longas (RFC 5545: até 75 octetos por linha)
function dobrar(linha) {
  const partes = [];
  let resto = linha;
  while (Buffer.byteLength(resto) > 74) {
    let corte = 74;
    while (Buffer.byteLength(resto.slice(0, corte)) > 74) corte--;
    partes.push(resto.slice(0, corte));
    resto = ` ${resto.slice(corte)}`;
  }
  partes.push(resto);
  return partes.join('\r\n');
}

/**
 * Agenda assinável com todos os prazos da pessoa, com lembretes 1 dia e
 * 3 horas antes. Google Agenda, Apple e Outlook atualizam sozinhos.
 * @param {Array} prazos – documentos Prazo
 */
function gerarFeedIcs(prazos, { nome = 'Notifica.ai — Prazos', baseUrl = '' } = {}) {
  const agora = utcIcs(new Date());
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notifica.ai//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparIcs(nome)}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const p of prazos) {
    const titulo = `${p.concluidoEm ? '✅ ' : ''}${p.titulo}${p.contexto ? ` — ${p.contexto}` : ''}`;
    const inicio = p.hora
      ? [`DTSTART:${utcIcs(momentoLimite(p))}`, `DTEND:${utcIcs(new Date(momentoLimite(p).getTime() + 30 * 60 * 1000))}`]
      : [`DTSTART;VALUE=DATE:${dataIcs(p.data)}`, `DTEND;VALUE=DATE:${dataIcs(p.data, 1)}`];
    linhas.push(
      'BEGIN:VEVENT',
      `UID:prazo-${p._id}@notifica.dev.br`,
      `DTSTAMP:${agora}`,
      ...inicio,
      `SUMMARY:${escaparIcs(titulo)}`,
      `DESCRIPTION:${escaparIcs(`${p.url ? `Confira no documento oficial: ${p.url}\n` : ''}Gerenciar prazos: ${baseUrl}/prazos`)}`,
      ...(p.url ? [`URL:${escaparIcs(p.url)}`] : []),
    );
    if (!p.concluidoEm) {
      for (const gatilho of ['-P1D', '-PT3H']) {
        linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparIcs(p.titulo)}`, `TRIGGER:${gatilho}`, 'END:VALARM');
      }
    }
    linhas.push('END:VEVENT');
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrar).join('\r\n');
}

module.exports = { gerarIcs, gerarFeedIcs, momentoLimite };
