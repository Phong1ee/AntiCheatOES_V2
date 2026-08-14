export interface AdminAuditActor { school_id: string | null; full_name: string | null; role: string | null; }
export interface AdminAuditLog { audit_log_id: number; created_at: string | null; actor: AdminAuditActor; action: string; action_label: string; category: string; entity: { type: string; id: string }; outcome: "SUCCESS" | "FAILED"; request_id: string | null; }
export interface AdminAuditLogDetail extends AdminAuditLog { entity_type: string; entity_id: string; client_ip: string | null; user_agent: string | null; metadata: Record<string, unknown>; }
export interface AdminAuditLogList { items: AdminAuditLog[]; page: number; page_size: number; total: number; }
export interface AdminAuditStats { total_events: number; events_last_24h: number; admin_actions: number; teacher_actions: number; failed_operations: number; }
export interface AdminAuditAction { code: string; label: string; category: string; }
export interface AdminAuditListParams { page?: number; page_size?: number; search?: string; actor_role?: string; category?: string; action?: string; outcome?: string; date_from?: string; date_to?: string; }
