import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { toApiError } from "./api-error";
import { authStorage } from "./auth.storage";

// Keep /api paths same-origin by default so Vite and production Nginx proxy them.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

export const apiClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: unknown; message?: string }>) => {
    if (error.response?.status === 401) {
      authStorage.clearToken();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(toApiError(error));
  },
);
