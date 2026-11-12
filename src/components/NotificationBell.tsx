import { FollowingStories } from "./FollowingStories";
import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { usePresence } from "../hooks/usePresence";
import { notificationPoster } from "../hooks/useNotifications";
import type { useNotifications } from "../hooks/useNotifications";
export function NotificationBell({
  feed,
  stories,
}: {
  feed: ReturnType<typeof useNotifications>;
  stories?: React.ComponentProps<typeof FollowingStories>;
}) {
  const activeVisitors = usePresence();
  const [open, setOpen] = useState(false),
    [unread, setUnread] = useState(false);
  const [storyHost, setStoryHost] = useState<HTMLSpanElement | null>(null);
  const container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if ((event.target as Element)?.closest?.(".following-story-overlay"))
        return;
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    container.current
      ?.querySelector<HTMLElement>(".notification-panel button")
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="notification-anchor" ref={container}>
      <button
        ref={trigger}
        className={"nav-icon " + (open ? "active" : "")}
        title="Notifications"
        aria-label={
          "Notifications" +
          (feed.unreadCount ? ", " + feed.unreadCount + " unread" : "")
        }
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {feed.unreadCount > 0 && (
          <span className="notification-count">
            {feed.unreadCount > 9 ? "9+" : feed.unreadCount}
          </span>
        )}
        <span className="nav-tooltip">Notifications</span>
      </button>
      {stories && <FollowingStories {...stories} triggerHost={storyHost} />}
      {open && (
        <section
          id="notification-panel"
          className="notification-panel glass"
          aria-label="Notifications"
        >
          <header>
            <h2>
              Notifications{" "}
              {activeVisitors !== null && (
                <span
                  className="notification-presence"
                  role="img"
                  aria-label={
                    activeVisitors +
                    " active " +
                    (activeVisitors === 1 ? "visitor" : "visitors")
                  }
                  title="Visitors with ApexAnimehub visible"
                >
                  <User size={14} aria-hidden="true" />
                  {activeVisitors}
                </span>
              )}
              <small>{feed.unreadCount ? feed.unreadCount + " new" : ""}</small>
            </h2>
            <button
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <div className="notification-actions">
            <div role="group" aria-label="Notification filter">
              <button aria-pressed={!unread} onClick={() => setUnread(false)}>
                All
              </button>
              <button aria-pressed={unread} onClick={() => setUnread(true)}>
                Unread
              </button>
              {stories && (
                <span
                  className="notification-stories-slot"
                  ref={setStoryHost}
                />
              )}
            </div>
            <button disabled={!feed.unreadCount} onClick={feed.markAllRead}>
              Mark all read
            </button>
          </div>
          <div className="notification-items">
            {feed.notifications
              .filter((n) => !unread || !n.read)
              .map((n) => {
                const Icon =
                  n.kind === "error"
                    ? AlertCircle
                    : n.kind === "success"
                      ? CheckCircle2
                      : RefreshCw;
                return (
                  <button
                    key={n.id}
                    className={
                      "notification-item " + n.kind + (n.read ? " is-read" : "")
                    }
                    onClick={() => feed.markRead(n.id)}
                    aria-label={n.title + (n.read ? "" : ", unread")}
                  >
                    {notificationPoster(n) && (
                      <img
                        className="notification-anime-poster"
                        src={notificationPoster(n)}
                        alt={n.anime?.title + " poster"}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <Icon size={24} />
                    <span>
                      <strong>{n.title}</strong>
                      <span>{n.detail}</span>
                      <time dateTime={new Date(n.time).toISOString()}>
                        {new Date(n.time).toLocaleString()}
                      </time>
                    </span>
                    {!n.read && <i aria-hidden="true" />}
                  </button>
                );
              })}
            {!feed.notifications.some((n) => !unread || !n.read) && (
              <p className="notifications-empty">
                {unread
                  ? "You’re all caught up."
                  : "No notifications yet. List updates and account activity will appear here."}
              </p>
            )}
          </div>
          <footer>
            <button
              disabled={!feed.notifications.length}
              onClick={feed.clearNotifications}
            >
              Clear notifications
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
