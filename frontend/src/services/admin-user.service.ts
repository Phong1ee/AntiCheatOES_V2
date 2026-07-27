import { apiClient } from "./api-client";
import type {
  AdminManagedUser,
  AdminManagedUserRole,
  AdminUserListResponse,
  ChangeOwnAdminPasswordRequest,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from "../types/admin-user";

export interface AdminUserListParams {
  search?: string;
  role?: AdminManagedUserRole;
  locked?: boolean;
  page?: number;
  page_size?: number;
}

export const adminUserService = {
  async list(params: AdminUserListParams = {}): Promise<AdminUserListResponse> {
    const { data } = await apiClient.get<AdminUserListResponse>("/api/admin/users", {
      params: { page: 1, page_size: 100, ...params },
    });
    return data;
  },

  async get(userId: number): Promise<AdminManagedUser> {
    const { data } = await apiClient.get<AdminManagedUser>(`/api/admin/users/${userId}`);
    return data;
  },

  async create(payload: CreateAdminUserRequest): Promise<AdminManagedUser> {
    const { data } = await apiClient.post<AdminManagedUser>("/api/admin/users", payload);
    return data;
  },

  async update(userId: number, payload: UpdateAdminUserRequest): Promise<AdminManagedUser> {
    const { data } = await apiClient.patch<AdminManagedUser>(`/api/admin/users/${userId}`, payload);
    return data;
  },

  async lock(userId: number): Promise<AdminManagedUser> {
    const { data } = await apiClient.post<AdminManagedUser>(`/api/admin/users/${userId}/lock`);
    return data;
  },

  async unlock(userId: number): Promise<AdminManagedUser> {
    const { data } = await apiClient.post<AdminManagedUser>(`/api/admin/users/${userId}/unlock`);
    return data;
  },

  async remove(userId: number): Promise<void> {
    await apiClient.delete(`/api/admin/users/${userId}`);
  },

  async changeOwnPassword(payload: ChangeOwnAdminPasswordRequest): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.put<{ success: boolean; message: string }>("/api/admin/me/password", payload);
    return data;
  },
};
