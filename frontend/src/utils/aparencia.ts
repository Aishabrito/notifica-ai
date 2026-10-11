// Preferências de aparência (tema, cor de destaque, visual leve).
// Ficam no navegador da pessoa e são aplicadas como atributos no <html>;
// as cores em si estão em src/tema.css.

export type Tema = "escuro" | "claro" | "auto";
export type Destaque = "verde" | "azul" | "roxo" | "rosa" | "laranja";
export type Aparencia = { tema: Tema; destaque: Destaque; suave: boolean };

export const DESTAQUES: { id: Destaque; nome: string; cor: string }[] = [
  { id: "verde", nome: "Verde", cor: "#34d399" },
  { id: "azul", nome: "Azul", cor: "#38bdf8" },
  { id: "roxo", nome: "Roxo", cor: "#a78bfa" },
  { id: "rosa", nome: "Rosa", cor: "#f472b6" },
  { id: "laranja", nome: "Laranja", cor: "#fbbf24" },
];

const CHAVE = "notifica:aparencia";
const PADRAO: Aparencia = { tema: "escuro", destaque: "verde", suave: false };

export function lerAparencia(): Aparencia {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return { ...PADRAO, ...(salvo ?? {}) };
  } catch {
    return PADRAO;
  }
}

let ativa = true; // o painel admin desliga (tem visual próprio)

export function aplicarAparencia(a: Aparencia = lerAparencia()) {
  const html = document.documentElement;
  if (!ativa) {
    delete html.dataset.tema; delete html.dataset.destaque; delete html.dataset.suave;
    return;
  }
  const claro = a.tema === "claro" || (a.tema === "auto" && window.matchMedia?.("(prefers-color-scheme: light)").matches);
  if (claro) html.dataset.tema = "claro"; else delete html.dataset.tema;
  if (a.destaque !== "verde") html.dataset.destaque = a.destaque; else delete html.dataset.destaque;
  if (a.suave) html.dataset.suave = "1"; else delete html.dataset.suave;
}

export function salvarAparencia(a: Aparencia) {
  try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch { /* modo privado: só nesta visita */ }
  aplicarAparencia(a);
  window.dispatchEvent(new CustomEvent("notifica:aparencia", { detail: a }));
}

export function ativarAparencia(sim: boolean) {
  ativa = sim;
  aplicarAparencia();
}

// "Automático" acompanha o celular/computador quando ele troca de tema
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => aplicarAparencia());
