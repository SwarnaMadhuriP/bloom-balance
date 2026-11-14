"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Flower2,
  Leaf,
  Package,
  Sprout,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

type InventoryItem = {
  batch_id: string;
  flower_id: string;
  flower_name: string;
  variety: string;
  location_id: string;
  location_name: string;
  harvest_date: string;
  expiry_date: string;
  price_per_unit: string;
  available_quantity: number;
  reserved_quantity: number;
  freshness_status: "FRESH" | "EXPIRING_SOON" | "EXPIRED";
  days_until_expiry: number;
};

type InventoryResponse = {
  organization_id: string;
  total_records: number;
  inventory: InventoryItem[];
};

const organizationId = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

const statStyles = [
  "bg-white/85",
  "bg-[#FFF5F3]/90",
  "bg-[#F1F8F2]/90",
  "bg-[#FFF9E9]/90",
];

function formatDate(date: string) {
  const parts = date.slice(0, 10).split("-");

  if (parts.length !== 3) return date;

  const [year, month, day] = parts.map(Number);

  if (!year || !month || !day) return date;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getFreshnessStyle(status: InventoryItem["freshness_status"]) {
  switch (status) {
    case "FRESH":
      return "bg-green-100 text-green-800";
    case "EXPIRING_SOON":
      return "bg-amber-100 text-amber-800";
    case "EXPIRED":
      return "bg-red-100 text-red-800";
  }
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    if (!organizationId) {
      setError("NEXT_PUBLIC_GROWER_ORGANIZATION_ID is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<InventoryResponse>("/inventory", {
        params: { organization_id: organizationId },
      });

      setItems(response.data.inventory);
    } catch (err) {
      console.error("Inventory request failed:", err);
      setError("Unable to load inventory. Please check the backend API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const available = items.reduce(
    (sum, item) => sum + item.available_quantity,
    0
  );

  const reserved = items.reduce((sum, item) => sum + item.reserved_quantity, 0);

  const expiring = items.filter(
    (item) => item.freshness_status === "EXPIRING_SOON"
  ).length;

  const stats = [
    {
      label: "Available Quantity",
      value: available,
      icon: Sprout,
    },
    {
      label: "Reserved Quantity",
      value: reserved,
      icon: Package,
    },
    {
      label: "Inventory Records",
      value: items.length,
      icon: Flower2,
    },
    {
      label: "Expiring Soon",
      value: expiring,
      icon: Clock3,
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
        <Link
          href="/grow"
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/65 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/90"
        >
          <ArrowLeft size={16} />
          Back to the Greenhouse
        </Link>

        {/* Header */}
        <div className="mb-9 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">
              The Grower&apos;s Greenhouse
            </p>

            <h1 className="font-serif text-4xl md:text-5xl">
              My Flower Inventory
            </h1>

            <p className="mt-3 italic text-[#73836F]">
              A little care for every bloom.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[#91AD83]">
              <span className="h-px w-10 bg-[#A8BE9B]" />
              <Leaf size={17} />
              <span className="h-px w-10 bg-[#A8BE9B]" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadInventory()}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur-md transition-colors hover:bg-[#E5EDDF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {/* Inventory statistics */}
        <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }, index) => (
            <div
              key={label}
              className={`relative overflow-hidden rounded-2xl border border-white/80 p-5 shadow-md backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 ${statStyles[index]}`}
            >
              <Icon className="mb-4 text-[#8DA58A]" size={25} />

              <p className="text-3xl font-semibold tabular-nums">
                {loading ? "—" : value.toLocaleString("en-IN")}
              </p>

              <p className="mt-2 text-sm text-[#73836F]">{label}</p>

              <Leaf
                size={48}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-2 -right-2 rotate-[-25deg] text-[#9BB997]/25"
              />
            </div>
          ))}
        </div>

        {/* Flower batches */}
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-[#E2E8DC] p-6">
            <Leaf size={23} className="text-[#8DA58A]" />
            <h2 className="font-serif text-2xl">Flower Batches</h2>
          </div>

          {loading ? (
            <p className="p-8 text-[#73836F]">Gathering your flowers...</p>
          ) : error ? (
            <p className="p-8 text-[#73836F]">
              Inventory could not be displayed.
            </p>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Flower2 className="mx-auto mb-4 text-[#8DA58A]" size={38} />

              <p className="font-serif text-xl">No flowers in inventory yet</p>

              <p className="mt-2 text-sm text-[#73836F]">
                Received flower batches will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#F0F5EB]/90 text-[#60765D]">
                  <tr>
                    <th scope="col" className="px-6 py-4">
                      Flower
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Available
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Reserved
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Expiry
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Freshness
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={`${item.batch_id}-${item.location_id}`}
                      className="border-t border-[#EDF0E9] transition-colors hover:bg-[#F6FAF2]"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <Flower2
                            size={23}
                            className="shrink-0 text-[#D98F8F]"
                          />

                          <div>
                            <p className="font-semibold">{item.flower_name}</p>

                            <p className="text-xs text-[#879485]">
                              {item.variety}
                            </p>

                            <p className="mt-1 text-xs text-[#879485]">
                              Harvested {formatDate(item.harvest_date)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">{item.location_name}</td>

                      <td className="px-6 py-5 font-semibold tabular-nums">
                        {item.available_quantity.toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-5 tabular-nums">
                        {item.reserved_quantity.toLocaleString("en-IN")}
                      </td>

                      <td className="px-6 py-5 whitespace-nowrap">
                        {formatDate(item.expiry_date)}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${getFreshnessStyle(
                            item.freshness_status
                          )}`}
                        >
                          {item.freshness_status.replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-center font-serif text-sm italic text-[#73836F]">
          Every flower has a purpose. Every bloom has a story.
        </p>
      </div>
    </main>
  );
}
