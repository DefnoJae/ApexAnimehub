import { useCallback, useEffect, useState } from "react";
export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  kind: "success" | "error" | "info";
  time: number;
  read: boolean;
}
export function useNotifications(scope: string) {
  const key = "apex_notifications_v1_" + scope;
  const [store, setStore] = useState<{ key: string; items: AppNotification[] }>(
    { key, items: [] },
  );
  useEffect(() => {
    let items: AppNotification[] = [];
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(data))
        items = data
          .filter(
            (n) =>
              typeof n.id === "string" &&
              typeof n.title === "string" &&
              Number.isFinite(n.time),
          )
          .slice(0, 50);
    } catch {}
    setStore({ key, items });
  }, [key]);
  const update = useCallback(
    (change: (items: AppNotification[]) => AppNotification[]) => {
      setStore((previous) => {
        const items = change(previous.key === key ? previous.items : []).slice(
          0,
          50,
        );
        try {
          localStorage.setItem(key, JSON.stringify(items));
        } catch {}
        return { key, items };
      });
    },
    [key],
  );
  const notify = useCallback(
    (input: Pick<AppNotification, "title" | "detail" | "kind">) =>
      update((items) => [
        {
          ...input,
          id: Date.now() + "-" + Math.random().toString(36).slice(2),
          time: Date.now(),
          read: false,
        },
        ...items,
      ]),
    [update],
  );
  const notifications = store.key === key ? store.items : [];
  return {
    notifications,
    notify,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAllRead: () =>
      update((items) => items.map((n) => ({ ...n, read: true }))),
    clearNotifications: () => update(() => []),
    markRead: (id: string) =>
      update((items) =>
        items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      ),
  };
}
