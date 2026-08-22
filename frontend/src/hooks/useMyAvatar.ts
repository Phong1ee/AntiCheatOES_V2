import { useSyncExternalStore } from 'react';
import { avatarService } from '../services/avatar.service';
import { authStorage } from '../services/auth.storage';

/**
 * One shared copy of the signed-in user's avatar.
 *
 * The header and the profile page both render it, and uploading on one has to
 * show up on the other, so the object URL lives here rather than in either
 * component. Consumers never revoke it - the store owns it and revokes the old
 * URL when it is replaced, which is why two components can hold it at once
 * without one unmounting and breaking the other's <img>.
 *
 * The cache is keyed on the token, so signing in as someone else refetches
 * instead of showing the previous user's face.
 */

type AvatarState = {
  url: string | null;
  loading: boolean;
};

let state: AvatarState = { url: null, loading: false };
let cachedForToken: string | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: AvatarState) {
  state = next;
  emit();
}

function replaceUrl(url: string | null) {
  if (state.url && state.url !== url) URL.revokeObjectURL(state.url);
  setState({ url, loading: false });
}

function load(force = false): Promise<void> {
  const token = authStorage.getToken();
  if (!token) {
    cachedForToken = null;
    replaceUrl(null);
    return Promise.resolve();
  }
  if (!force && token === cachedForToken) return inFlight ?? Promise.resolve();
  if (inFlight && !force) return inFlight;

  cachedForToken = token;
  setState({ url: state.url, loading: true });
  inFlight = avatarService
    .fetchMyAvatar()
    .then((url) => replaceUrl(url))
    // A failed avatar fetch is cosmetic: fall back to the generated picture
    // rather than surfacing an error over the whole page.
    .catch(() => replaceUrl(null))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Refetches after an upload or removal so every avatar on screen updates. */
export function refreshMyAvatar(): Promise<void> {
  return load(true);
}

/** Drops the cached picture. Call on sign-out. */
export function clearMyAvatar(): void {
  cachedForToken = null;
  replaceUrl(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // First subscriber triggers the fetch; later ones reuse the same result.
  void load();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** The current user's avatar URL, or null to fall back to a generated one. */
export function useMyAvatar(): AvatarState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

if (typeof window !== 'undefined') {
  // The api-client fires this when a request comes back 401.
  window.addEventListener('auth:unauthorized', clearMyAvatar);
}
