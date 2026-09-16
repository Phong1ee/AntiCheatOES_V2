export type StudentNotificationType =
  | 'NEW_EXAM_ASSIGNED'
  | 'EXAM_SCHEDULE_CHANGED'
  | 'EXAM_DURATION_CHANGED'
  | 'EXAM_CANCELLED'
  | 'EXAM_OPENED'
  | 'EXAM_CLOSED'
  | 'EXAM_CODE_CHANGED';

export interface StudentNotification {
  notification_id: number;
  exam_id: number | null;
  type: StudentNotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface StudentNotificationListResponse {
  notifications: StudentNotification[];
  unread_count: number;
}

export interface MarkAllNotificationsReadResponse {
  updated_count: number;
  unread_count: number;
}
