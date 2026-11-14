"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  Leaf,
  RefreshCw,
  Flower2,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

type OrderAction = "accept" | "prepare" | "dispatch" | "deliver" | "cancel";

type OrderItem = {
  id: string;
  flower_id: string;
  quantity: number;
  unit_price: string;
};

type Order = {
  id: string;
  buyer_organization_id: string;
  seller_organization_id: string;
  status: OrderStatus;
  total_amount: string;
  created_at: string;
  items: OrderItem[];
};

type Flower = {
  id: string;
  name: string;
  variety: string;
};

const ORGANIZATION_ID = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-sky-100 text-sky-800",
  PREPARING: "bg-violet-100 text-violet-800",
  DISPATCHED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-stone-200 text-stone-700",
  REJECTED: "bg-rose-100 text-rose-800",
};

const ORDER_ACTIONS: Record<
  OrderStatus,
  { label: string; action: OrderAction }[]
> = {
  PENDING: [
    { label: "Accept Order", action: "accept" },
    { label: "Cancel Order", action: "cancel" },
  ],
  ACCEPTED: [
    { label: "Prepare Order", action: "prepare" },
    { label: "Cancel Order", action: "cancel" },
  ],
  PREPARING: [{ label: "Dispatch Order", action: "dispatch" }],
  DISPATCHED: [{ label: "Mark Delivered", action: "deliver" }],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

const FILTERS = [
  "ALL",
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
] as const;

const STATUS_PRIORITY: Record<OrderStatus, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  DISPATCHED: 3,
  DELIVERED: 4,
  CANCELLED: 5,
  REJECTED: 6,
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item?.msg === "string" ? item.msg : "Validation error"
        )
        .join(", ");
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function GrowerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flowers, setFlowers] = useState<Flower[]>([]);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadOrders = useCallback(
    async (showLoading = true): Promise<boolean> => {
      if (!ORGANIZATION_ID) {
        setError(
          "NEXT_PUBLIC_GROWER_ORGANIZATION_ID is missing from .env.local"
        );
        setLoading(false);
        return false;
      }

      if (showLoading) {
        setLoading(true);
      }

      setError("");

      try {
        const [ordersResponse, flowersResponse] = await Promise.all([
          api.get<Order[]>("/orders", {
            params: {
              seller_organization_id: ORGANIZATION_ID,
            },
          }),
          api.get<Flower[]>("/flowers"),
        ]);

        setOrders(ordersResponse.data);
        setFlowers(flowersResponse.data);
        return true;
      } catch (err) {
        setError(getErrorMessage(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleOrderAction = async (orderId: string, action: OrderAction) => {
    if (updatingOrderId !== null) return;

    if (
      action === "cancel" &&
      !window.confirm("Are you sure you want to cancel this order?")
    ) {
      return;
    }

    setUpdatingOrderId(orderId);
    setActionError("");
    setSuccessMessage("");

    try {
      await api.post(`/orders/${orderId}/${action}`);

      const refreshed = await loadOrders(false);

      if (refreshed) {
        const labels: Record<OrderAction, string> = {
          accept: "accepted",
          prepare: "moved to preparing",
          dispatch: "dispatched",
          deliver: "marked as delivered",
          cancel: "cancelled",
        };

        setSuccessMessage(
          `Order #${orderId.slice(0, 8)} ${labels[action]} successfully.`
        );
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const flowerNames = useMemo(
    () =>
      new Map(
        flowers.map((flower) => [
          flower.id,
          `${flower.name} · ${flower.variety}`,
        ])
      ),
    [flowers]
  );

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter(
      (order) => filter === "ALL" || order.status === filter
    );

    return [...filtered].sort((a, b) => {
      if (filter === "ALL") {
        const priorityDifference =
          STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }
      }

      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [orders, filter]);

  const pendingCount = orders.filter(
    (order) => order.status === "PENDING"
  ).length;

  const activeCount = orders.filter((order) =>
    ["ACCEPTED", "PREPARING", "DISPATCHED"].includes(order.status)
  ).length;

  const deliveredCount = orders.filter(
    (order) => order.status === "DELIVERED"
  ).length;

  const stats = [
    {
      label: "New Orders",
      value: pendingCount,
      background: "bg-white/85",
    },
    {
      label: "In Progress",
      value: activeCount,
      background: "bg-[#F1F8F2]/90",
    },
    {
      label: "Delivered",
      value: deliveredCount,
      background: "bg-[#FFF9E9]/90",
    },
  ];

  return (
    <main
      className="relative min-h-screen bg-[#FAF7F0] bg-cover bg-center bg-fixed px-5 py-10 text-[#344E41] md:px-12"
      style={{
        backgroundImage: "url('/images/inventory-background.png')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#FFF9EF]/15" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Back navigation */}
        <Link
          href="/grow"
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/65 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/90"
        >
          <ArrowLeft size={16} />
          Back to the Greenhouse
        </Link>

        {/* Header */}
        <div className="mb-9 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">
              The Grower&apos;s Greenhouse
            </p>

            <h1 className="font-serif text-4xl md:text-5xl">Incoming Orders</h1>

            <p className="mt-3 italic text-[#73836F]">
              From your garden to someone&apos;s special day.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[#91AD83]">
              <span className="h-px w-10 bg-[#A8BE9B]" />
              <Leaf size={17} />
              <span className="h-px w-10 bg-[#A8BE9B]" />
            </div>
          </div>

          <button
            type="button"
            disabled={loading || updatingOrderId !== null}
            onClick={() => {
              setSuccessMessage("");
              setActionError("");
              void loadOrders();
            }}
            className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur-md transition-colors hover:bg-[#E5EDDF] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh Orders
          </button>
        </div>

        {/* Dashboard statistics */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border border-white/80 p-5 text-center shadow-md backdrop-blur-md ${stat.background}`}
            >
              <p className="text-sm text-[#73836F]">{stat.label}</p>

              <p className="mt-2 font-serif text-4xl tabular-nums text-[#344E41]">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Status filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              aria-pressed={filter === status}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                filter === status
                  ? "bg-[#344E41] text-white"
                  : "border border-[#D6E1D1] bg-white/90 text-[#60765D] hover:bg-[#E5EDDF]"
              }`}
            >
              {status === "ALL" ? "All" : status}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {actionError}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-6 flex items-center gap-2 rounded-xl border border-[#B8D5B0] bg-[#F0F8EC]/95 p-4 text-[#456653]"
          >
            <CheckCircle2 size={19} />
            {successMessage}
          </div>
        )}

        {/* Orders */}
        {loading ? (
          <div className="rounded-2xl bg-white/85 py-16 text-center text-[#73836F]">
            Gathering your garden orders...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white/85 px-6 py-12 text-center text-[#73836F]">
            Orders could not be displayed. Please try refreshing.
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 px-6 py-16 text-center shadow-md backdrop-blur-md">
            <Flower2 size={40} className="mx-auto mb-4 text-[#8DA58A]" />

            <h2 className="font-serif text-2xl">
              No orders in this garden yet
            </h2>

            <p className="mt-3 text-sm text-[#73836F]">
              {filter === "ALL"
                ? "Incoming orders will bloom here when florists place their requests."
                : `There are no ${filter.toLowerCase()} orders right now.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-white/80 bg-white/95 p-5 shadow-md backdrop-blur-md transition-colors hover:border-[#C7D5B8] sm:p-6"
              >
                {/* Order heading */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#91A087]">
                      Order #{order.id.slice(0, 8)}
                    </p>

                    <h2 className="mt-1 font-serif text-xl">Florist Order</h2>

                    <p className="mt-1 text-xs text-[#879485]">
                      {new Date(order.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      STATUS_STYLES[order.status]
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Flower items */}
                <div className="mt-4 divide-y divide-[#E7E9DF]">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {flowerNames.get(item.flower_id) ?? "Flower"}
                        </p>

                        <p className="mt-1 text-sm text-[#879485]">
                          {item.quantity}{" "}
                          {item.quantity === 1 ? "unit" : "units"} ×{" "}
                          {formatCurrency(item.unit_price)}
                        </p>
                      </div>

                      <p className="font-semibold tabular-nums">
                        {formatCurrency(
                          item.quantity * Number(item.unit_price)
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Order total */}
                <div className="mt-3 flex items-center justify-between border-t border-[#E7E9DF] pt-4">
                  <p className="text-sm text-[#73836F]">
                    {order.items.length}{" "}
                    {order.items.length === 1
                      ? "flower variety"
                      : "flower varieties"}
                  </p>

                  <div className="text-right">
                    <p className="text-xs text-[#879485]">Order Total</p>

                    <p className="font-serif text-2xl tabular-nums text-[#344E41]">
                      {formatCurrency(order.total_amount)}
                    </p>
                  </div>
                </div>

                {/* Order actions */}
                {ORDER_ACTIONS[order.status].length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-[#E7E9DF] pt-4">
                    {ORDER_ACTIONS[order.status].map(({ label, action }) => (
                      <button
                        key={action}
                        type="button"
                        disabled={updatingOrderId !== null}
                        onClick={() => void handleOrderAction(order.id, action)}
                        className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          action === "cancel"
                            ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                            : "bg-[#344E41] text-white hover:bg-[#456653]"
                        }`}
                      >
                        {updatingOrderId === order.id ? "Updating..." : label}
                      </button>
                    ))}
                  </div>
                )}

                {order.status === "DELIVERED" && (
                  <p className="mt-4 flex items-center gap-2 border-t border-[#E7E9DF] pt-4 text-sm font-medium text-emerald-700">
                    <CheckCircle2 size={17} />
                    Successfully delivered
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-center font-serif text-sm italic text-[#73836F]">
          Every flower has a purpose. Every bloom has a story.
        </p>
      </div>
    </main>
  );
}
