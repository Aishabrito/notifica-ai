export type EventoCalendario = {
  id: string; titulo: string; publico: 'vestibulando' | 'concurseiro'; data: string; dataFim: string | null;
  previsao: boolean; descricao: string; link: string | null; diasRestantes: number;
};

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function buscarCalendario(): Promise<EventoCalendario[]> {
  const r = await fetch(`${API_URL}/api/calendario`);
  const d = await r.json();
  return d?.eventos ?? [];
}

// "08/11" · "08 a 12/11" · previsão: "jan/2027"
export function quandoEvento(e: EventoCalendario) {
  const [a, m, d] = e.data.split('-');
  if (e.previsao) return `${MESES[Number(m) - 1]}/${a}`;
  if (e.dataFim && e.dataFim !== e.data) {
    const [, m2, d2] = e.dataFim.split('-');
    return m2 === m ? `${d} a ${d2}/${m}` : `${d}/${m} a ${d2}/${m2}`;
  }
  return `${d}/${m}`;
}

export function faltaTexto(e: EventoCalendario) {
  if (e.previsao) return 'previsão';
  if (e.diasRestantes <= 0) return 'é hoje';
  if (e.diasRestantes === 1) return 'amanhã';
  return `em ${e.diasRestantes} dias`;
}
