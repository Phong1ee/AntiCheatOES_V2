import { useCallback, useEffect, useState } from 'react';
import { studentNotificationService } from '../services/student-notification.service';
import type { StudentNotification } from '../types/student-notification';

const messageFor = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function useStudentNotifications() {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studentNotificationService.getNotifications();
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
    } catch (loadError) {
      setError(messageFor(loadError, 'Unable to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markOneRead = useCallback(async (notificationId: number) => {
    const target = notifications.find((notification) => notification.notification_id === notificationId);
    if (!target || target.is_read) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((current) => current.map((notification) => (
      notification.notification_id === notificationId
        ? { ...notification, is_read: true }
        : notification
    )));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await studentNotificationService.markNotificationRead(notificationId);
    } catch (mutationError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      throw mutationError;
    }
  }, [notifications, unreadCount]);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    setUnreadCount(0);

    try {
      await studentNotificationService.markAllNotificationsRead();
    } catch (mutationError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      throw mutationError;
    }
  }, [notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markOneRead,
    markAllRead,
  };
}
