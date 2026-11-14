"use client";

import { useSyncExternalStore } from "react";

/** Unread badge counts shared by every menu, the tab title and the app icon. */
export type Unread = { notifications: number; messages: number };
const NONE: Unread = { notifications: 0, messages: 0 };

let state: Unread = NONE;
const listeners = new Set<() => void>();

export const unreadStore = {
  get: () => state,
  set(next: Unread | ((u: Unread) => Unread)) {
    const v = typeof next === "function" ? next(state) : next;
    if (v.notifications === state.notifications && v.messages === state.messages) return;
    state = { notifications: Math.max(0, v.notifications), messages: Math.max(0, v.messages) };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useUnread() {
  return useSyncExternalStore(unreadStore.subscribe, unreadStore.get, () => NONE);
}
