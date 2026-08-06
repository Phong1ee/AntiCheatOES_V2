const DEVICE_ID_KEY = "oes_device_id";
const SESSION_PREFIX = "oes_attempt_session_";
const REFRESH_EVENT_PREFIX = "oes_page_refresh_event_";
const PENDING_REFRESH_PREFIX = "oes_pending_refresh_";

const requireBrowser = () => {
  if (typeof window === "undefined") throw new Error("Attempt session storage is unavailable.");
};

export const attemptSessionStorage = {
  getDeviceId(): string {
    requireBrowser();
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const deviceId = window.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  },

  setSessionToken(attemptId: number, token: string): void {
    requireBrowser();
    window.sessionStorage.setItem(`${SESSION_PREFIX}${attemptId}`, token);
  },

  getSessionToken(attemptId: number): string {
    requireBrowser();
    const token = window.sessionStorage.getItem(`${SESSION_PREFIX}${attemptId}`);
    if (!token) throw new Error("Attempt session is missing. Resume the attempt from My Exams.");
    return token;
  },

  clearSessionToken(attemptId: number): void {
    requireBrowser();
    window.sessionStorage.removeItem(`${SESSION_PREFIX}${attemptId}`);
  },

  getOrCreatePageRefreshEventId(attemptId: number): string {
    requireBrowser();
    const key = `${REFRESH_EVENT_PREFIX}${attemptId}`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const clientEventId = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, clientEventId);
    return clientEventId;
  },

  clearPageRefreshEventId(attemptId: number): void {
    requireBrowser();
    window.sessionStorage.removeItem(`${REFRESH_EVENT_PREFIX}${attemptId}`);
  },

  markPendingRefresh(attemptId: number): string {
    const clientEventId = this.getOrCreatePageRefreshEventId(attemptId);
    window.localStorage.setItem(`${PENDING_REFRESH_PREFIX}${attemptId}`, clientEventId);
    return clientEventId;
  },

  getPendingRefresh(attemptId: number): string | null {
    requireBrowser();
    return window.localStorage.getItem(`${PENDING_REFRESH_PREFIX}${attemptId}`);
  },

  clearPendingRefresh(attemptId: number): void {
    requireBrowser();
    window.localStorage.removeItem(`${PENDING_REFRESH_PREFIX}${attemptId}`);
    this.clearPageRefreshEventId(attemptId);
  },

  headers(attemptId: number): Record<string, string> {
    return {
      "X-Device-Id": this.getDeviceId(),
      "X-Attempt-Session": this.getSessionToken(attemptId),
    };
  },
};
