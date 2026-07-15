export type UserRole = "student" | "teacher" | "admin";

export interface AuthUser {
  id: number;
  school_id: string;
  full_name: string;
  fullname?: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { fullname: string; email: string; password: string; role: UserRole; }
export interface AuthResponse { success: boolean; message: string; token?: string; user?: AuthUser; }
