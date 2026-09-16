import { apiClient } from './api-client';
import type {
  MarkAllNotificationsReadResponse,
  StudentNotification,
  StudentNotificationListResponse,
} from '../types/student-notification';

export const studentNotificationService = {
  async getNotifications(): Promise<StudentNotificationListResponse> {
    const { data } = await apiClient.get<StudentNotificationListResponse>('/api/student/notifications');
    return data;
  },

  async markNotificationRead(notificationId: number): Promise<StudentNotification> {
    const { data } = await apiClient.patch<StudentNotification>(
      `/api/student/notifications/${notificationId}/read`,
    );
    return data;
  },

  async markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
    const { data } = await apiClient.patch<MarkAllNotificationsReadResponse>(
      '/api/student/notifications/read-all',
    );
    return data;
  },
};
