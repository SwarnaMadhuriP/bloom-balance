"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

type OrderItem = {
  id: string;
  flower_id: string;
  flower_name: string | null;
  flower_variety: string | null;
  flower_color: string | null;
  flower_unit: string | null;
  quantity: number;
  unit_price: string;
};

type Order = {
  id: string;
  buyer_organization_id: string;
  seller_organization_id: string;
  buyer_name: string | null;
  seller_name: string | null;
  status: string;
  total_amount: string;
  created_at: string;
  items: OrderItem[];
};

const STATUSES = [
  "ALL",
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
];

const TRACKING_STEPS = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
];

function statusStyle(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800";
    case "DISPATCHED":
      return "bg-blue-100 text-blue-800";
    case "PREPARING":
      return "bg-amber-100 text-amber-800";
    case "ACCEPTED":
      return "bg-lime-100 text-lime-800";
    case "CANCELLED":
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-stone-100 text-stone-700";
  }
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load your orders.";
}

function formatMoney(value: string | number) {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFlowerEmoji(name: string | null) {
  const flower = name?.toLowerCase() ?? "";

  if (flower.includes("rose")) return "🌹";
  if (flower.includes("tulip")) return "🌷";
  if (flower.includes("sunflower")) return "🌻";
  if (flower.includes("lavender")) return "🪻";
  if (flower.includes("hibiscus")) return "🌺";
  if (flower.includes("cherry")) return "🌸";

  return "💐";
}

function OrderTimeline({ status }: { status: string }) {
  if (status === "CANCELLED" || status === "REJECTED") {
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
        This order was {status.toLowerCase()}.
      </div>
    );
  }

  const currentIndex = TRACKING_STEPS.indexOf(status);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#526a4c]">Order Journey</p>

        <p className="text-xs text-[#819078]">
          {status === "DELIVERED"
            ? "Your blooms have arrived!"
            : status === "DISPATCHED"
            ? "Your flowers are on their way!"
            : status === "PREPARING"
            ? "Your flowers are being prepared."
            : status === "ACCEPTED"
            ? "The grower accepted your order."
            : "Waiting for grower confirmation."}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {TRACKING_STEPS.map((step, index) => {
          const completed = index <= currentIndex;
          const current = index === currentIndex;

          return (
            <div key={step} className="text-center">
              <div
                className={`mb-2 h-2 rounded-full transition-all ${
                  completed ? "bg-[#799777]" : "bg-[#e3e8de]"
                }`}
              />

              <p
                className={`text-[9px] sm:text-xs ${
                  current
                    ? "font-bold text-[#526a4c]"
                    : completed
                    ? "font-medium text-[#728a6d]"
                    : "text-[#a0ab99]"
                }`}
              >
                {step}
              </p>

              {current && <span className="mt-1 inline-block text-xs">🌿</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FloristOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const floristId = process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID;

      if (!floristId) {
        throw new Error("Florist organization is not configured.");
      }

      const response = await api.get<Order[]>("/orders", {
        params: {
          buyer_organization_id: floristId,
        },
      });

      setOrders(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  );
  const [cancelError, setCancelError] = useState("");

  const cancelOrder = async (orderId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this flower order? 🌸"
    );

    if (!confirmed) return;

    setCancellingOrderId(orderId);
    setCancelError("");

    try {
      await api.post(`/orders/${orderId}/cancel`);

      await loadOrders();
    } catch (err) {
      setCancelError(getErrorMessage(err));
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders =
    filter === "ALL"
      ? orders
      : orders.filter((order) => order.status === filter);

  const activeOrders = orders.filter(
    (order) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(order.status)
  ).length;

  const deliveredOrders = orders.filter(
    (order) => order.status === "DELIVERED"
  ).length;

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-4 py-10 text-[#42513e] sm:px-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,250,239,0.35),rgba(255,250,239,0.60)),url('/images/inventory-background.png')",
      }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Navigation */}

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/florist/marketplace"
            className="text-sm font-medium text-[#687c60] hover:underline"
          >
            ← Back to Flower Market
          </Link>

          <div className="flex items-center gap-3">
            {process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID && (
              <NotificationBell
                organizationId={process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID}
              />
            )}

            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="rounded-full border border-[#cad8c5] bg-white/80 px-5 py-2 text-sm font-medium text-[#526a4c] transition hover:bg-white disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh Orders"}
            </button>
          </div>
        </div>

        {/* Page Header */}
        <header className="my-10 text-center">
          <p className="mb-3 text-sm tracking-[0.2em] text-[#879a77]">
            BLOOMBALANCE · FLORIST
          </p>

          <h1 className="font-serif text-4xl text-[#50664c] sm:text-6xl">
            My Flower Orders
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[#73846d]">
            Every bloom has a journey. Follow yours from the grower's garden to
            your doorstep.
          </p>
        </header>

        {/* Summary Cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total Orders",
              value: orders.length,
              emoji: "💐",
            },
            {
              label: "Active Orders",
              value: activeOrders,
              emoji: "🌱",
            },
            {
              label: "Delivered",
              value: deliveredOrders,
              emoji: "🌸",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-white/80 bg-white/80 p-6 text-center shadow-sm backdrop-blur-md"
            >
              <div className="mb-2 text-2xl">{item.emoji}</div>

              <p className="text-sm text-[#819078]">{item.label}</p>

              <p className="mt-2 font-serif text-4xl text-[#50664c]">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        {/* Status Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                filter === status
                  ? "bg-[#698567] text-white shadow-sm"
                  : "border border-white/80 bg-white/80 text-[#647b60] hover:bg-white"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {cancelError && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {cancelError}
          </div>
        )}

        {/* Loading / Empty / Orders */}
        {loading ? (
          <div className="py-20 text-center text-[#73846d]">
            🌸 Gathering your flower orders...
          </div>
        ) : error ? null : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/80 bg-white/85 px-6 py-20 text-center shadow-sm">
            <div className="mb-4 text-5xl">🪻</div>

            <h2 className="font-serif text-2xl text-[#526a4c]">
              No orders found
            </h2>

            <p className="mt-3 text-[#819078]">
              {filter === "ALL"
                ? "Your next beautiful bloom is waiting in the market."
                : `You don't have any ${filter.toLowerCase()} orders yet.`}
            </p>

            <Link
              href="/florist/marketplace"
              className="mt-6 inline-block rounded-full bg-[#698567] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#587455]"
            >
              Explore Flower Market
            </Link>
          </div>
        ) : (
          <section className="space-y-6">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-sm backdrop-blur-md sm:p-8"
              >
                {/* Order Header */}
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-widest text-[#819078]">
                      FLOWER ORDER
                    </p>

                    <h2 className="mt-1 font-serif text-xl text-[#50664c] sm:text-2xl">
                      Order #{order.id.slice(0, 8)}
                    </h2>

                    <p className="mt-2 text-sm text-[#647b60]">
                      🌿 From{" "}
                      <span className="font-semibold">
                        {order.seller_name ?? "Unknown Grower"}
                      </span>
                    </p>

                    <p className="mt-2 text-xs text-[#819078]">
                      Placed on {formatDate(order.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${statusStyle(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Order Tracking */}
                <div className="rounded-2xl border border-[#e8eddf] bg-[#f8faf3]/80 p-4 sm:p-6">
                  <OrderTimeline status={order.status} />
                </div>

                {/* Flower Items */}
                <div className="mt-6 border-t border-[#e7e9df] pt-5">
                  <p className="mb-4 text-sm font-semibold text-[#526a4c]">
                    Flowers in this order
                  </p>

                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-[#f9faf5]/80 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#edf2e6] text-3xl">
                            {getFlowerEmoji(item.flower_name)}
                          </div>

                          <div className="min-w-0">
                            <p className="font-serif text-lg font-medium text-[#526a4c]">
                              {item.flower_name ??
                                `Flower #${item.flower_id.slice(0, 8)}`}
                            </p>

                            <p className="mt-1 text-xs text-[#819078]">
                              {[item.flower_variety, item.flower_color]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>

                            <p className="mt-2 text-xs text-[#819078]">
                              Quantity: {item.quantity}{" "}
                              {item.flower_unit ?? "units"}
                            </p>

                            <p className="mt-1 text-xs text-[#819078]">
                              {formatMoney(item.unit_price)} per{" "}
                              {item.flower_unit ?? "unit"}
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 font-semibold text-[#526a4c]">
                          {formatMoney(item.quantity * Number(item.unit_price))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="mt-6 flex items-center justify-between border-t border-[#e7e9df] pt-5">
                  <span className="font-medium text-[#526a4c]">
                    Order Total
                  </span>

                  <span className="font-serif text-2xl text-[#50664c]">
                    {formatMoney(order.total_amount)}
                  </span>
                </div>

                {/* Order Actions */}
                {["PENDING", "ACCEPTED"].includes(order.status) && (
                  <div className="mt-6 flex justify-end border-t border-[#e7e9df] pt-5">
                    <button
                      type="button"
                      onClick={() => void cancelOrder(order.id)}
                      disabled={cancellingOrderId !== null}
                      className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancellingOrderId === order.id
                        ? "Cancelling..."
                        : "Cancel Order"}
                    </button>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-5 border-t border-[#e7e9df] pt-4">
                  <p className="break-all text-xs text-[#9aa694]">
                    Order ID: {order.id}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Bottom Navigation */}
        <div className="mt-12 text-center">
          <Link
            href="/florist/marketplace"
            className="inline-block rounded-full border border-[#cad8c5] bg-white/80 px-7 py-3 text-sm font-medium text-[#526a4c] transition hover:bg-white"
          >
            🌸 Continue Exploring Flowers
          </Link>
        </div>
      </div>
    </main>
  );
}
