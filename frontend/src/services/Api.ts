/// <reference types="vite/client" />
import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "http://localhost:3000",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? "";
    const ignorar = ["/api/auth/me", "/api/auth/login", "/api/auth/cadastro"];
    const deveIgnorar = ignorar.some((rota) => url.includes(rota));

    if (error.response?.status === 401 && !deveIgnorar) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;