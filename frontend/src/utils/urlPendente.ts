// Link testado no "Teste agora" (página inicial): fica guardado até virar alerta
const CHAVE = "notifica:url-pendente";

export function guardarUrlPendente(url: string) {
  try { localStorage.setItem(CHAVE, url); } catch { /* sem localStorage */ }
}

export function lerUrlPendente(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}

export function limparUrlPendente() {
  try { localStorage.removeItem(CHAVE); } catch { /* sem localStorage */ }
}
