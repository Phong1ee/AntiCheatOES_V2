export type AdminManagedUserRole = "student" | "teacher" | "admin";
export type AdminManagedUserStatus = "active" | "locked" | "deleted";

export interface AdminManagedUser {
  id: number;
  school_id: string;
  full_name: string;
  email: string;
  role: AdminManagedUserRole;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_locked: boolean;
  locked_at: string | null;
  deleted_at: string | null;
  status: AdminManagedUserStatus;
}

export interface AdminUserListResponse {
  items: AdminManagedUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateAdminUserRequest {
  school_id: string;
  full_name: string;
  email: string;
  password: string;
  role: AdminManagedUserRole;
}

export interface UpdateAdminUserRequest {
  school_id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: AdminManagedUserRole;
}

export interface ChangeOwnAdminPasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
