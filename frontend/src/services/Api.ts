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
  baseURL: import.meta.env.VITE_API_URL as string || "http://localhost:3000",
  withCredentials: true,
});

export default api;