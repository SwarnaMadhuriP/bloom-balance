"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  RefreshCw,
  Leaf,
  Flower2,
  Sprout,
  Package,
  PackageCheck,
  Truck,
  Check,
  Clock3,
  ShoppingBasket,
  CalendarDays,
} from "lucide-react";
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

const floristId = process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID;

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

function getFlowerImage(name: string | null) {
  const value = name?.toLowerCase() ?? "";

  if (value.includes("rose")) {
    return "/images/flowers/rose.png";
  }

  if (value.includes("lavender")) {
    return "/images/flowers/lavender.png";
  }

  return null;
}

function statusStyle(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800";
    case "DISPATCHED":
      return "bg-sky-100 text-sky-800";
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

    if (typeof detail === "string") return detail;

    return error.message;
  }

  if (error instanceof Error) return error.message;

  return "Unable to load your orders.";
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function OrderTimeline({ status }: { status: string }) {
  if (status === "CANCELLED" || status === "REJECTED") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
        <Package size={18} className="mt-0.5 shrink-0" />
        <span>This order was {status.toLowerCase()}.</span>
      </div>
    );
  }

  const currentIndex = TRACKING_STEPS.indexOf(status);

  const descriptions: Record<string, string> = {
    PENDING: "Waiting for grower confirmation.",
    ACCEPTED: "The grower accepted your order.",
    PREPARING: "Your flowers are being prepared.",
    DISPATCHED: "Your flowers are on their way!",
    DELIVERED: "Your blooms have arrived!",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#456653]">Order Journey</p>

        <p className="text-xs text-[#73836F]">
          {descriptions[status] ?? "Order status unavailable."}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1 sm:gap-3">
        {TRACKING_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const reached = index <= currentIndex;

          return (
            <div key={step} className="min-w-0 text-center">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:h-11 sm:w-11 ${
                  reached
                    ? "border-[#799777] bg-[#799777] text-white"
                    : "border-[#D8E3D3] bg-white text-[#A8B6A2]"
                }`}
              >
                {completed ? (
                  <Check size={18} />
                ) : index === 0 ? (
                  <Clock3 size={18} />
                ) : index === 1 ? (
                  <Sprout size={18} />
                ) : index === 2 ? (
                  <Package size={18} />
                ) : index === 3 ? (
                  <Truck size={18} />
                ) : (
                  <PackageCheck size={18} />
                )}
              </div>

              <div
                className={`mx-auto my-3 h-1.5 rounded-full ${
                  reached ? "bg-[#799777]" : "bg-[#E2E9DC]"
                }`}
              />

              <p
                className={`break-words text-[9px] sm:text-xs ${
                  current
                    ? "font-bold text-[#344E41]"
                    : completed
                    ? "font-medium text-[#607A5C]"
                    : "text-[#9CAA97]"
                }`}
              >
                {step.charAt(0) + step.slice(1).toLowerCase()}
              </p>

              {current && (
                <p className="mt-1 text-[10px] font-medium text-[#799777]">
                  Current
                </p>
              )}
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

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  );
  const [cancelError, setCancelError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
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

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function cancelOrder(orderId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this flower order?"
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
  }

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
      className="relative min-h-screen bg-[#FAF7F0] bg-cover bg-center bg-fixed px-5 py-10 text-[#344E41] md:px-12"
      style={{
        backgroundImage: "url('/images/inventory-background.png')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#FFF9EF]/15" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/florist/marketplace"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back to Flower Market
          </Link>

          <div className="flex items-center gap-3">
            {floristId && <NotificationBell organizationId={floristId} />}

            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing..." : "Refresh Orders"}
            </button>
          </div>
        </div>

        {/* Heading */}
        <header className="mb-10 mt-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#718E6D]">
            BloomBalance · Florist
          </p>

          <h1 className="font-serif text-4xl md:text-6xl">My Flower Orders</h1>

          <p className="mx-auto mt-4 max-w-xl text-[#73836F]">
            Every bloom has a journey. Follow yours from the grower&apos;s
            garden to your doorstep.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 text-[#91AD83]">
            <span className="h-px w-12 bg-[#A8BE9B]" />
            <Leaf size={17} />
            <span className="h-px w-12 bg-[#A8BE9B]" />
          </div>
        </header>

        {/* Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total Orders",
              value: orders.length,
              icon: ShoppingBasket,
            },
            {
              label: "Active Orders",
              value: activeOrders,
              icon: Sprout,
            },
            {
              label: "Delivered",
              value: deliveredOrders,
              icon: PackageCheck,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/80 bg-white/90 p-6 text-center shadow-md backdrop-blur-md"
              >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#EDF3E8] text-[#799777]">
                  <Icon size={22} strokeWidth={1.6} />
                </div>

                <p className="text-sm text-[#73836F]">{item.label}</p>

                <p className="mt-2 font-serif text-4xl">{item.value}</p>
              </div>
            );
          })}
        </section>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              aria-pressed={filter === status}
              className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                filter === status
                  ? "bg-[#344E41] text-white shadow-sm"
                  : "border border-white/80 bg-white/90 text-[#60765D] hover:bg-white"
              }`}
            >
              {status === "ALL"
                ? "All"
                : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50/95 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {cancelError && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/95 p-4 text-sm text-rose-700"
          >
            {cancelError}
          </div>
        )}

        {/* Orders */}
        {loading ? (
          <div className="rounded-2xl bg-white/85 py-20 text-center text-[#73836F]">
            Gathering your flower orders...
          </div>
        ) : error ? null : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 px-6 py-16 text-center shadow-md">
            <Flower2
              size={42}
              strokeWidth={1.5}
              className="mx-auto text-[#8DA58A]"
            />

            <h2 className="mt-4 font-serif text-2xl">No orders found</h2>

            <p className="mt-3 text-sm text-[#73836F]">
              {filter === "ALL"
                ? "Your next beautiful bloom is waiting in the market."
                : `You don't have any ${filter.toLowerCase()} orders yet.`}
            </p>

            <Link
              href="/florist/marketplace"
              className="mt-6 inline-flex rounded-full bg-[#344E41] px-6 py-3 text-sm font-medium text-white hover:bg-[#456653]"
            >
              Explore Flower Market
            </Link>
          </div>
        ) : (
          <section className="space-y-6">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-white/80 bg-white/95 p-5 shadow-md backdrop-blur-md sm:p-8"
              >
                {/* Order header */}
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#879485]">
                      Flower Order
                    </p>

                    <h2 className="mt-2 font-serif text-2xl">
                      Order #{order.id.slice(0, 8)}
                    </h2>

                    <p className="mt-2 flex items-center gap-2 text-sm text-[#60765D]">
                      <Sprout size={15} />
                      From{" "}
                      <span className="font-semibold">
                        {order.seller_name ?? "Unknown Grower"}
                      </span>
                    </p>

                    <p className="mt-2 flex items-center gap-2 text-xs text-[#879485]">
                      <CalendarDays size={13} />
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

                {/* Order journey */}
                <div className="rounded-2xl border border-[#E5EDDF] bg-[#F8FAF3]/90 p-4 sm:p-6">
                  <OrderTimeline status={order.status} />
                </div>

                {/* Flower items */}
                <div className="mt-6 border-t border-[#E5EDDF] pt-5">
                  <h3 className="mb-4 text-sm font-semibold">
                    Flowers in this order
                  </h3>

                  <div className="space-y-3">
                    {order.items.map((item) => {
                      const imageSrc = getFlowerImage(item.flower_name);

                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F9FAF5] p-4"
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F0F1E8]">
                              {imageSrc ? (
                                <Image
                                  src={imageSrc}
                                  alt={
                                    item.flower_name ?? "Flower illustration"
                                  }
                                  width={64}
                                  height={64}
                                  className="h-14 w-14 object-contain"
                                />
                              ) : (
                                <Flower2
                                  size={30}
                                  strokeWidth={1.4}
                                  className="text-[#8DA58A]"
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-serif text-lg">
                                {item.flower_name ??
                                  `Flower #${item.flower_id.slice(0, 8)}`}
                              </p>

                              <p className="mt-1 text-xs text-[#73836F]">
                                {[item.flower_variety, item.flower_color]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>

                              <p className="mt-2 text-xs text-[#73836F]">
                                {item.quantity} {item.flower_unit ?? "units"} ×{" "}
                                {formatMoney(item.unit_price)}
                              </p>
                            </div>
                          </div>

                          <p className="font-semibold tabular-nums">
                            {formatMoney(
                              item.quantity * Number(item.unit_price)
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total */}
                <div className="mt-6 flex items-center justify-between border-t border-[#E5EDDF] pt-5">
                  <span className="font-medium">Order Total</span>

                  <span className="font-serif text-2xl">
                    {formatMoney(order.total_amount)}
                  </span>
                </div>

                {/* Cancellation */}
                {["PENDING", "ACCEPTED"].includes(order.status) && (
                  <div className="mt-6 flex justify-end border-t border-[#E5EDDF] pt-5">
                    <button
                      type="button"
                      onClick={() => void cancelOrder(order.id)}
                      disabled={cancellingOrderId !== null}
                      className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                    >
                      {cancellingOrderId === order.id
                        ? "Cancelling..."
                        : "Cancel Order"}
                    </button>
                  </div>
                )}

                <p className="mt-5 break-all border-t border-[#E5EDDF] pt-4 text-xs text-[#9CAA97]">
                  Order ID: {order.id}
                </p>
              </article>
            ))}
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <Link
            href="/florist/marketplace"
            className="inline-flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-7 py-3 text-sm font-medium transition-colors hover:bg-white"
          >
            <Flower2 size={17} />
            Continue Exploring Flowers
          </Link>

          <p className="mt-6 font-serif text-sm italic text-[#73836F]">
            Every flower has a journey. Every bloom has a story.
          </p>
        </div>
      </div>
    </main>
  );
}
