"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Notification = {
  id: string;
  organization_id: string;
  order_id: string;
  notification_type: string;
  message: string;
  status: "READ" | "UNREAD";
  created_at: string;
};

type NotificationBellProps = {
  organizationId: string;
};

function notificationEmoji(type: string) {
  switch (type) {
    case "ORDER_ACCEPTED":
      return "🌸";
    case "ORDER_PREPARING":
      return "💐";
    case "ORDER_DISPATCHED":
      return "🚚";
    case "ORDER_DELIVERED":
      return "🎉";
    case "ORDER_CANCELLED":
      return "🍂";
    default:
      return "🌿";
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationBell({
  organizationId,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const [notificationsResponse, countResponse] = await Promise.all([
        api.get<Notification[]>("/notifications", {
          params: {
            organization_id: organizationId,
            limit: 20,
          },
        }),
        api.get<{ unread_count: number }>("/notifications/unread-count", {
          params: {
            organization_id: organizationId,
          },
        }),
      ]);

      setNotifications(notificationsResponse.data);
      setUnreadCount(countResponse.data.unread_count);
      setError("");
    } catch {
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadNotifications();

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function markAsRead(notification: Notification) {
    if (notification.status === "READ") return;

    try {
      await api.patch(`/notifications/${notification.id}/read`, null, {
        params: {
          organization_id: organizationId,
        },
      });

      await loadNotifications();
    } catch {
      setError("Unable to mark notification as read.");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#cad8c5] bg-white/85 text-xl shadow-sm transition hover:bg-white"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#d77b77] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#e4e9dd] bg-[#fffdf7] shadow-xl"
        >
          <div className="border-b border-[#e9ecdf] bg-[#f6f8ef] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-[#526a4c]">
                  Your Bloom Updates
                </h2>
                <p className="mt-1 text-xs text-[#87977e]">
                  {unreadCount} unread notifications
                </p>
              </div>

              <span className="text-2xl">🌷</span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#819078]">
                Gathering your bloom updates...
              </p>
            ) : notifications.length === 0 && !error ? (
              <div className="px-5 py-12 text-center">
                <p className="text-4xl">🌱</p>
                <p className="mt-3 font-serif text-lg text-[#526a4c]">
                  All quiet in the garden
                </p>
                <p className="mt-2 text-sm text-[#819078]">
                  Your flower updates will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void markAsRead(notification)}
                  className={`flex w-full items-start gap-3 border-b border-[#eef0e8] px-5 py-4 text-left transition hover:bg-[#f5f8ef] ${
                    notification.status === "UNREAD"
                      ? "bg-[#f0f5e9]/70"
                      : "bg-transparent"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-xl">
                    {notificationEmoji(notification.notification_type)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-relaxed text-[#526a4c]">
                      {notification.message}
                    </span>

                    <span className="mt-2 block text-xs text-[#95a18d]">
                      {formatTime(notification.created_at)}
                    </span>
                  </span>

                  {notification.status === "UNREAD" && (
                    <span
                      aria-label="Unread"
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#799777]"
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {error && (
            <p role="alert" className="px-5 py-3 text-xs text-rose-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-[#e9ecdf] bg-[#fffdf7] px-5 py-3">
            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="text-xs font-medium text-[#728a6d] hover:underline"
            >
              ↻ Refresh
            </button>

            <Link
              href="/florist/orders"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#526a4c] hover:underline"
            >
              View My Orders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
