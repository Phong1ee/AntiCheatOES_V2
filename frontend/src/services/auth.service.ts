import { apiClient } from "./api-client";
import { authStorage } from "./auth.storage";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/auth";

export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/login", payload);
    if (data.token) authStorage.setToken(data.token);
    return data;
  },
  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/api/auth/register", payload);
    return data;
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      authStorage.clearToken();
    }
  },
};
