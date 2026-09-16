import { Bell, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { StudentNotification } from '../../types/student-notification';
import { relativeTime } from '../../utils/relative-time';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface NotificationBellProps {
  notifications: StudentNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onMarkOneRead: (notificationId: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

const badgeText = (count: number) => (count > 99 ? '99+' : String(count));

export function NotificationBell({
  notifications,
  unreadCount,
  loading,
  error,
  onRefresh,
  onMarkOneRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const markOneRead = async (notification: StudentNotification) => {
    if (notification.is_read) return;
    try {
      await onMarkOneRead(notification.notification_id);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to mark notification as read.');
    }
  };

  const markAllRead = async () => {
    try {
      await onMarkAllRead();
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Unable to mark notifications as read.');
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void onRefresh(); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-teal-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
              {badgeText(unreadCount)}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0" sideOffset={10}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">Notifications</h2>
          {loading && <LoaderCircle className="size-4 animate-spin text-teal-600" aria-label="Loading notifications" />}
        </div>

        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading notifications...</div>
        ) : error ? (
          <div className="space-y-3 p-5 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={() => void onRefresh()} className="text-sm font-medium text-teal-700 hover:text-teal-800">Retry</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No notifications</div>
        ) : (
          <ScrollArea className="h-[min(24rem,60vh)]">
            <div className="p-2">
              {notifications.map((notification) => (
                <button
                  key={notification.notification_id}
                  type="button"
                  onClick={() => void markOneRead(notification)}
                  className={`w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    notification.is_read ? 'text-gray-500' : 'bg-teal-50/70 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? 'bg-gray-300' : 'bg-teal-600'}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`text-sm ${notification.is_read ? 'font-medium' : 'font-semibold'}`}>{notification.title}</span>
                        <time className="shrink-0 text-xs text-gray-400" dateTime={notification.created_at}>{relativeTime(notification.created_at)}</time>
                      </div>
                      <p className="mt-1 text-sm leading-5">{notification.message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="border-t p-2">
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
          >
            Mark all as read
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
