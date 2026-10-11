// Código de convite (?ref=ABC123): guardado no navegador até o cadastro
const CHAVE = "notifica:ref";

export function capturarIndicacao() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{6}$/.test(ref)) localStorage.setItem(CHAVE, ref.toUpperCase());
  } catch { /* sem localStorage: segue sem o convite */ }
}

export function lerIndicacao(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
