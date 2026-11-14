"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { markAllNotificationsRead } from "@/app/notifications/actions";
import { relativeTime } from "@/lib/notificationRules.mjs";

const initialState = { error: "", success: false };

export default function NotificationsBell({ notifications, unreadCount, placement = "sidebar" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const router = useRouter();
  const [state, markAllRead, marking] = useActionState(markAllNotificationsRead, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`notify ${placement === "appbar" ? "notify-appbar" : "notify-sidebar"}`} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="notify-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon name="bell" />
        {placement === "sidebar" ? <span>Notifications</span> : null}
        {unreadCount ? <span className="notify-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notify-panel" role="dialog" aria-label="Notifications">
          <div className="notify-head">
            <span className="eyebrow">Notifications</span>
            {unreadCount ? (
              <form action={markAllRead}>
                <button className="notify-mark-read" disabled={marking} type="submit">
                  {marking ? "Marking..." : "Mark all read"}
                </button>
              </form>
            ) : null}
          </div>
          {state.error ? <p className="form-error">{state.error}</p> : null}
          {notifications.length ? (
            <ul className="notify-list">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <span className={notification.read_at ? "notify-dot" : "notify-dot notify-dot-unread"} />
                    <span className="notify-text">
                      <strong>{notification.title}</strong>
                      {notification.body ? <span>{notification.body}</span> : null}
                      <time dateTime={notification.created_at}>{relativeTime(notification.created_at)}</time>
                    </span>
                  </>
                );
                return (
                  <li key={notification.id}>
                    {notification.href ? (
                      <Link className="notify-item" href={notification.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      <span className="notify-item">{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="notify-empty">Nothing yet. Updates about your work will appear here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
