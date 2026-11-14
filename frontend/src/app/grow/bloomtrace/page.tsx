"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  RefreshCw,
  Leaf,
  Flower2,
  PackageCheck,
  ClipboardList,
  Package,
  Sprout,
} from "lucide-react";
import { api } from "@/lib/api";
import BloomTraceWasteChart from "@/components/BloomTraceWasteChart";

type UnitQuantity = {
  unit: string;
  quantity: number;
};

type WasteByReason = UnitQuantity & {
  reason: string;
};

type BloomTraceSummary = {
  organization_id: string;
  total_wasted: number;
  total_waste_records: number;
  waste_by_reason: WasteByReason[];
  waste_by_unit: UnitQuantity[];
};

type RescuedFlowers = {
  organization_id: string;
  total_rescued: number;
  delivered_surplus_orders: number;
  rescued_by_unit: UnitQuantity[];
};

type WasteByFlower = {
  flower_id: string;
  flower_name: string;
  variety: string;
  unit: string;
  total_wasted: number;
};

const organizationId = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    return error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatUnit(quantity: number, unit: string): string {
  const label =
    unit === "stem"
      ? quantity === 1
        ? "stem"
        : "stems"
      : unit === "bunch"
      ? quantity === 1
        ? "bunch"
        : "bunches"
      : unit;

  return `${quantity.toLocaleString("en-IN")} ${label}`;
}

function formatQuantities(values: UnitQuantity[]): string {
  if (values.length === 0) return "0";

  return values
    .map(({ quantity, unit }) => formatUnit(quantity, unit))
    .join(" · ");
}

function formatReason(reason: string): string {
  return reason
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function groupByUnit<T extends { unit: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    (groups[item.unit] ??= []).push(item);
    return groups;
  }, {});
}

export default function BloomTracePage() {
  const [summary, setSummary] = useState<BloomTraceSummary | null>(null);

  const [rescued, setRescued] = useState<RescuedFlowers | null>(null);

  const [wasteByFlower, setWasteByFlower] = useState<WasteByFlower[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!organizationId) {
        throw new Error("NEXT_PUBLIC_GROWER_ORGANIZATION_ID is missing.");
      }

      const [summaryResponse, rescuedResponse, wasteByFlowerResponse] =
        await Promise.all([
          api.get<BloomTraceSummary>("/bloomtrace/analytics/summary", {
            params: { organization_id: organizationId },
          }),
          api.get<RescuedFlowers>("/bloomtrace/analytics/rescued-flowers", {
            params: { organization_id: organizationId },
          }),
          api.get<WasteByFlower[]>("/bloomtrace/analytics/waste-by-flower", {
            params: { organization_id: organizationId },
          }),
        ]);

      setSummary(summaryResponse.data);
      setRescued(rescuedResponse.data);
      setWasteByFlower(wasteByFlowerResponse.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const cards = [
    {
      title: "Flowers Wasted",
      value: summary ? formatQuantities(summary.waste_by_unit) : "—",
      icon: Flower2,
      description: "All-time recorded flower waste",
      background: "bg-[#FFF5F3]/90",
    },
    {
      title: "Surplus Delivered",
      value: rescued ? formatQuantities(rescued.rescued_by_unit) : "—",
      icon: PackageCheck,
      description: "All-time delivered surplus quantities",
      background: "bg-[#F1F8F2]/90",
    },
    {
      title: "Waste Records",
      value: summary
        ? summary.total_waste_records.toLocaleString("en-IN")
        : "—",
      icon: ClipboardList,
      description: "Recorded waste incidents",
      background: "bg-white/90",
    },
    {
      title: "Surplus Orders",
      value: rescued
        ? rescued.delivered_surplus_orders.toLocaleString("en-IN")
        : "—",
      icon: Package,
      description: "Successfully delivered surplus orders",
      background: "bg-[#FFF9E9]/90",
    },
  ];

  const reasonGroups = groupByUnit(summary?.waste_by_reason ?? []);

  const flowerGroups = groupByUnit(wasteByFlower);

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
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white"
        >
          <ArrowLeft size={16} />
          Back to the Greenhouse
        </Link>

        {/* Header */}
        <div className="mb-9 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">
              BloomBalance · Grower Intelligence
            </p>

            <h1 className="flex items-center gap-3 font-serif text-4xl md:text-5xl">
              BloomTrace
              <Sprout size={34} strokeWidth={1.5} className="text-[#78966F]" />
            </h1>

            <p className="mt-3 max-w-2xl text-[#73836F]">
              Every bloom has a story worth saving. Discover what was lost, what
              found a new home, and where your garden can grow wiser.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[#91AD83]">
              <span className="h-px w-10 bg-[#A8BE9B]" />
              <Leaf size={17} />
              <span className="h-px w-10 bg-[#A8BE9B]" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur-md transition-colors hover:bg-[#E5EDDF] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Error feedback */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {/* Summary cards */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className={`rounded-2xl border border-white/80 p-6 shadow-md backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 ${card.background}`}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <Icon
                    size={25}
                    strokeWidth={1.7}
                    className="text-[#8DA58A]"
                  />

                  <span className="rounded-full bg-[#E9F0E5] px-3 py-1 text-[11px] font-medium text-[#60765D]">
                    All time
                  </span>
                </div>

                <p className="text-sm text-[#73836F]">{card.title}</p>

                <h2 className="mt-2 break-words font-serif text-2xl font-semibold">
                  {loading && !summary ? "Loading..." : card.value}
                </h2>

                <p className="mt-3 text-xs leading-relaxed text-[#879485]">
                  {card.description}
                </p>
              </div>
            );
          })}
        </section>

        {/* Daily Waste Trends — existing chart and filters */}
        {organizationId && (
          <BloomTraceWasteChart organizationId={organizationId} />
        )}

        {/* Detailed analytics */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Waste by Reason */}
          <section className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-md backdrop-blur-md sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8DA58A]">
              Understanding Losses
            </p>

            <h2 className="mt-2 font-serif text-3xl">Waste by Reason</h2>

            <p className="mt-2 text-sm text-[#73836F]">
              Discover why flowers were discarded.
            </p>

            {loading && !summary ? (
              <p className="mt-8 text-sm text-[#73836F]">
                Loading waste reasons...
              </p>
            ) : !summary?.waste_by_reason.length ? (
              <div className="mt-8 rounded-2xl bg-[#F0F5EB] p-8 text-center">
                <Leaf size={34} className="mx-auto text-[#8DA58A]" />

                <p className="mt-3 text-sm text-[#73836F]">
                  No waste reasons recorded yet.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-7">
                {Object.entries(reasonGroups).map(([unit, rows]) => {
                  const max = Math.max(1, ...rows.map((item) => item.quantity));

                  return (
                    <div key={unit}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8DA58A]">
                        {unit}
                      </p>

                      <div className="space-y-5">
                        {rows.map((item) => (
                          <div key={`${unit}-${item.reason}`}>
                            <div className="mb-2 flex justify-between gap-3 text-sm">
                              <span className="text-[#456653]">
                                {formatReason(item.reason)}
                              </span>

                              <span className="font-medium tabular-nums">
                                {formatUnit(item.quantity, item.unit)}
                              </span>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-[#EDF2E7]">
                              <div
                                className="h-full rounded-full bg-[#C69A78] transition-all"
                                style={{
                                  width: `${(item.quantity / max) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Most Wasted Flowers */}
          <section className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-md backdrop-blur-md sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8DA58A]">
              Flower Insights
            </p>

            <h2 className="mt-2 font-serif text-3xl">Most Wasted Flowers</h2>

            <p className="mt-2 text-sm text-[#73836F]">
              Identify flowers with the highest recorded losses.
            </p>

            {loading && !summary ? (
              <p className="mt-8 text-sm text-[#73836F]">
                Loading flower insights...
              </p>
            ) : wasteByFlower.length === 0 ? (
              <div className="mt-8 rounded-2xl bg-[#F0F5EB] p-8 text-center">
                <Flower2 size={34} className="mx-auto text-[#8DA58A]" />

                <p className="mt-3 text-sm text-[#73836F]">
                  No flower losses recorded yet.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-7">
                {Object.entries(flowerGroups).map(([unit, items]) => {
                  const rows = [...items].sort(
                    (a, b) => b.total_wasted - a.total_wasted
                  );

                  const max = Math.max(
                    1,
                    ...rows.map((item) => item.total_wasted)
                  );

                  return (
                    <div key={unit}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8DA58A]">
                        {unit}
                      </p>

                      <div className="space-y-5">
                        {rows.map((flower) => (
                          <div key={`${flower.flower_id}-${flower.variety}`}>
                            <div className="mb-2 flex justify-between gap-3 text-sm">
                              <span className="text-[#456653]">
                                {flower.flower_name}
                                {flower.variety ? ` · ${flower.variety}` : ""}
                              </span>

                              <span className="shrink-0 font-medium tabular-nums">
                                {formatUnit(flower.total_wasted, flower.unit)}
                              </span>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-[#EDF2E7]">
                              <div
                                className="h-full rounded-full bg-[#91AD88] transition-all"
                                style={{
                                  width: `${
                                    (flower.total_wasted / max) * 100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <p className="mt-10 text-center font-serif text-sm italic text-[#73836F]">
          A little more care, a little less waste.
        </p>
      </div>
    </main>
  );
}
