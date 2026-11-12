"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
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

const ORGANIZATION_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID;

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

  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadOrders = useCallback(
    async (showLoading = true): Promise<boolean> => {
      if (!ORGANIZATION_ID) {
        setError("NEXT_PUBLIC_ORGANIZATION_ID is missing from .env.local");
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

  const visibleOrders = useMemo(
    () => orders.filter((order) => filter === "ALL" || order.status === filter),
    [orders, filter]
  );

  const pendingCount = orders.filter(
    (order) => order.status === "PENDING"
  ).length;

  const activeCount = orders.filter((order) =>
    ["ACCEPTED", "PREPARING", "DISPATCHED"].includes(order.status)
  ).length;

  const deliveredCount = orders.filter(
    (order) => order.status === "DELIVERED"
  ).length;

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-4 py-10 text-[#42513e] sm:px-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,250,239,0.30),rgba(255,250,239,0.50)),url('/images/inventory-background.png')",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/grow"
          className="text-sm font-medium text-[#687c60] hover:underline"
        >
          ← Back to Greenhouse
        </Link>

        <header className="mb-9 mt-8 text-center">
          <p className="mb-2 text-sm tracking-[0.2em] text-[#879a77]">
            THE GROWER&apos;S GREENHOUSE
          </p>

          <h1 className="font-serif text-4xl text-[#50664c] sm:text-5xl">
            Incoming Orders
          </h1>

          <p className="mt-3 text-[#7b8872]">
            From your garden to someone&apos;s special day.
          </p>
        </header>

        {/* Dashboard statistics */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "New Orders",
              value: pendingCount,
            },
            {
              label: "In Progress",
              value: activeCount,
            },
            {
              label: "Delivered",
              value: deliveredCount,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/80 bg-white/75 p-6 text-center shadow-sm backdrop-blur-md"
            >
              <p className="text-sm text-[#819078]">{stat.label}</p>

              <p className="mt-2 font-serif text-4xl text-[#526a4c]">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Status filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  filter === status
                    ? "bg-[#698567] text-white"
                    : "border border-[#dce5d6] bg-white/80 text-[#71826a] hover:bg-white"
                }`}
              >
                {status === "ALL" ? "All" : status}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading || updatingOrderId !== null}
            onClick={() => {
              setSuccessMessage("");
              setActionError("");
              void loadOrders();
            }}
            className="rounded-full border border-[#cad8c5] bg-white/80 px-5 py-2 text-sm text-[#526a4c] hover:bg-white disabled:opacity-50"
          >
            Refresh Orders
          </button>
        </div>

        {/* Loading and error feedback */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {actionError}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
          >
            {successMessage}
          </div>
        )}

        {/* Orders */}
        {loading ? (
          <div className="py-20 text-center">
            Gathering your garden orders...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/80 bg-white/75 px-6 py-20 text-center shadow-sm backdrop-blur-md">
            <div className="mb-4 text-5xl">🌷</div>

            <h2 className="font-serif text-2xl text-[#526a4c]">
              No orders in this garden yet
            </h2>

            <p className="mt-3 text-[#819078]">
              {filter === "ALL"
                ? "Incoming orders will bloom here when florists place their requests."
                : `There are no ${filter.toLowerCase()} orders right now.`}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur-md"
              >
                {/* Order heading */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#91a087]">
                      Order #{order.id.slice(0, 8)}
                    </p>

                    <h2 className="mt-2 font-serif text-xl text-[#50664c]">
                      Florist Order
                    </h2>

                    <p className="mt-1 text-xs text-[#899487]">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      STATUS_STYLES[order.status] ??
                      "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Flower items */}
                <div className="mt-5 divide-y divide-[#e7e9df]">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {flowerNames.get(item.flower_id) ?? "Flower"}
                        </p>

                        <p className="text-sm text-[#899487]">
                          {item.quantity} units ×{" "}
                          {Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>

                      <p className="font-semibold">
                        {(item.quantity * Number(item.unit_price)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Order total */}
                <div className="mt-5 flex items-center justify-between border-t border-[#e7e9df] pt-5">
                  <p className="text-sm text-[#819078]">
                    {order.items.length} flower varieties
                  </p>

                  <p className="font-serif text-2xl text-[#526a4c]">
                    {Number(order.total_amount).toFixed(2)}
                  </p>
                </div>

                {/* Order actions */}
                {ORDER_ACTIONS[order.status].length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-[#e7e9df] pt-5">
                    {ORDER_ACTIONS[order.status].map(({ label, action }) => (
                      <button
                        key={action}
                        type="button"
                        disabled={updatingOrderId !== null}
                        onClick={() => void handleOrderAction(order.id, action)}
                        className={`rounded-full px-6 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          action === "cancel"
                            ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                            : "bg-[#698567] text-white hover:bg-[#536e51]"
                        }`}
                      >
                        {updatingOrderId === order.id ? "Updating..." : label}
                      </button>
                    ))}
                  </div>
                )}

                {order.status === "DELIVERED" && (
                  <p className="mt-5 border-t border-[#e7e9df] pt-5 text-sm font-medium text-emerald-700">
                    ✓ Successfully delivered
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
