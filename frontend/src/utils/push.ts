import api from "../services/Api";

// 📲 Notificações no celular (Web Push)

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* sem SW: segue só com e-mail */ });
  });
}

export type EstadoPush = "indisponivel" | "precisa-instalar" | "bloqueado" | "desativado" | "ativo";

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

function base64ParaUint8(base64: string) {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

export async function estadoPush(): Promise<EstadoPush> {
  // iPhone só aceita notificação com o site instalado na tela de início
  if (ehIOS() && !instalado()) return "precisa-instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "indisponivel";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao && Notification.permission === "granted" ? "ativo" : "desativado";
}

export async function ativarPush(): Promise<{ ok: boolean; mensagem: string }> {
  const { data } = await api.get("/api/push/chave");
  if (!data.disponivel) return { ok: false, mensagem: "As notificações ainda não estão disponíveis. Tente mais tarde." };
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return { ok: false, mensagem: "Você não permitiu as notificações. Dá para liberar nas configurações do navegador." };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const inscricao = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(data.chave) }));
  await api.post("/api/push/inscrever", inscricao.toJSON());
  return { ok: true, mensagem: "Pronto! Os avisos vão chegar neste aparelho." };
}

export async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  if (!inscricao) return;
  await api.post("/api/push/desinscrever", { endpoint: inscricao.endpoint }).catch(() => {});
  await inscricao.unsubscribe();
}
