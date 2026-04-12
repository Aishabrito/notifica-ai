/// <reference types="vite/client" />
import axios from "axios";

/**
 * Instância global do axios configurada para o backend Notifica.ai.
 * - baseURL lida via variável de ambiente do Vite
 * - withCredentials envia o cookie JWT automaticamente em toda requisição
 *
 * Use sempre este arquivo ao invés de importar axios diretamente.
 */
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "http://localhost:3000",
  withCredentials: true,
});

// Interceptor de resposta: em caso de 401 redireciona para login automaticamente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpa sessão local e redireciona sem depender do React Router
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;