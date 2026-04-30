/// <reference types="vite/client" />
import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "http://localhost:3000",
  withCredentials: true,
});

// Attach stored token as Authorization header (fallback for mobile browsers
// that block cross-site cookies, e.g. iOS Safari ITP).
// Note: localStorage is used intentionally so the session persists across
// browser restarts on mobile, matching the 7-day JWT lifetime.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? "";
    const ignorar = ["/api/auth/me", "/api/auth/login", "/api/auth/cadastro"];
    const deveIgnorar = ignorar.some((rota) => url.includes(rota));

    // Verifica em qual página o usuário está agora
    const paginaAtual = window.location.pathname;

    // Se deu 401, a rota não for ignorada, E a página atual NÃO for o login...
    if (error.response?.status === 401 && !deveIgnorar && paginaAtual !== "/login") {
      window.location.href = "/login";
    }
    
    return Promise.reject(error);
  }
);

export default api;