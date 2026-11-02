// Baixa uma planilha (CSV que o Excel e o Google Planilhas abrem direto)
export function baixarPlanilha(nomeArquivo: string, linhas: (string | number | boolean | null | undefined)[][]) {
  const celula = (v: string | number | boolean | null | undefined) => {
    let t = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(t)) t = `'${t}`; // evita fórmula ao abrir no Excel
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // ";" e BOM: o Excel em português abre com acentos e colunas certas
  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const dataBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
export const dataHoraBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

// "hoje", "ontem", "há 5 dias", "há 3 meses"
export function haQuanto(iso?: string | null) {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 31) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses < 12 ? `há ${meses} ${meses === 1 ? "mês" : "meses"}` : `há ${Math.floor(meses / 12)} ano(s)`;
}

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
