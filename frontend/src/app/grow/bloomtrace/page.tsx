"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
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
  const label = unit === "stem" ? (quantity === 1 ? "stem" : "stems") : unit;

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

export default function BloomTracePage() {
  const [summary, setSummary] = useState<BloomTraceSummary | null>(null);

  const [rescued, setRescued] = useState<RescuedFlowers | null>(null);

  const [wasteByFlower, setWasteByFlower] = useState<WasteByFlower[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const organizationId = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

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
            params: {
              organization_id: organizationId,
            },
          }),

          api.get<RescuedFlowers>("/bloomtrace/analytics/rescued-flowers", {
            params: {
              organization_id: organizationId,
            },
          }),

          api.get<WasteByFlower[]>("/bloomtrace/analytics/waste-by-flower", {
            params: {
              organization_id: organizationId,
            },
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
  }, [organizationId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const cards = [
    {
      title: "Flowers Wasted",
      value: summary ? formatQuantities(summary.waste_by_unit) : "—",
      emoji: "🥀",
      description: "All-time recorded flower waste",
    },
    {
      title: "Surplus Delivered",
      value: rescued ? formatQuantities(rescued.rescued_by_unit) : "—",
      emoji: "🌷",
      description: "All-time delivered surplus quantities",
    },
    {
      title: "Waste Records",
      value: summary
        ? summary.total_waste_records.toLocaleString("en-IN")
        : "—",
      emoji: "🍂",
      description: "Recorded waste incidents",
    },
    {
      title: "Surplus Orders",
      value: rescued
        ? rescued.delivered_surplus_orders.toLocaleString("en-IN")
        : "—",
      emoji: "📦",
      description: "Successfully delivered surplus orders",
    },
  ];

  // Keep each measurement unit separate.
  const reasonGroups = Object.groupBy(
    summary?.waste_by_reason ?? [],
    (item) => item.unit
  );

  const flowerGroups = Object.groupBy(wasteByFlower, (item) => item.unit);

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-4 py-10 text-[#42513e] sm:px-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,250,239,0.45),rgba(255,250,239,0.65)),url('/images/inventory-background.png')",
      }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/grow"
            className="rounded-full border border-[#d8dfcf] bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white"
          >
            ← Grower Dashboard
          </Link>

          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="rounded-full bg-[#536c4b] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#40583a] disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Heading */}
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#849276]">
            BloomBalance · Grower Intelligence
          </p>

          <h1 className="font-serif text-5xl font-semibold tracking-tight text-[#40583a] sm:text-6xl">
            BloomTrace 🌿
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-[#74816d]">
            Every bloom has a story worth saving. Discover what was lost, what
            found a new home, and where your garden can grow wiser.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"
          >
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-[28px] border border-white/90 bg-white/80 p-6 shadow-[0_12px_40px_rgba(80,100,70,0.08)] backdrop-blur-md"
            >
              <div className="mb-6 flex items-start justify-between">
                <span className="text-3xl">{card.emoji}</span>

                <span className="rounded-full bg-[#eef2e7] px-3 py-1 text-[11px] font-medium text-[#698063]">
                  All time
                </span>
              </div>

              <p className="text-sm font-medium text-[#7a8972]">{card.title}</p>

              <h2 className="mt-2 break-words font-serif text-2xl font-semibold text-[#40583a]">
                {loading && !summary ? "Loading..." : card.value}
              </h2>

              <p className="mt-3 text-xs leading-relaxed text-[#8a9684]">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        {/* Daily Waste Trends */}
        {organizationId && (
          <BloomTraceWasteChart organizationId={organizationId} />
        )}

        {/* Waste Breakdown Charts */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Waste by Reason */}
          <section className="rounded-[30px] border border-white/90 bg-white/85 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b9a80]">
              Understanding Losses
            </p>

            <h2 className="mt-2 font-serif text-3xl text-[#40583a]">
              Waste by Reason 🍂
            </h2>

            <p className="mt-2 text-sm text-[#7a8972]">
              Discover why flowers were discarded.
            </p>

            {loading && !summary ? (
              <p className="mt-8 text-sm text-[#849276]">
                Loading waste reasons...
              </p>
            ) : !summary?.waste_by_reason.length ? (
              <div className="mt-8 rounded-2xl bg-[#f5f7ef] p-8 text-center">
                <span className="text-4xl">🌱</span>

                <p className="mt-3 text-sm text-[#74816d]">
                  No waste reasons recorded yet.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-7">
                {Object.entries(reasonGroups).map(([unit, items]) => {
                  const rows = items ?? [];

                  const max = Math.max(1, ...rows.map((item) => item.quantity));

                  return (
                    <div key={unit}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#849276]">
                        {unit}
                      </p>

                      <div className="space-y-5">
                        {rows.map((item) => (
                          <div key={`${unit}-${item.reason}`}>
                            <div className="mb-2 flex justify-between gap-3 text-sm">
                              <span className="text-[#536c4b]">
                                {formatReason(item.reason)}
                              </span>

                              <span className="font-medium text-[#40583a]">
                                {formatUnit(item.quantity, item.unit)}
                              </span>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-[#edf2e7]">
                              <div
                                className="h-full rounded-full bg-[#c69a78] transition-all"
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
          <section className="rounded-[30px] border border-white/90 bg-white/85 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b9a80]">
              Flower Insights
            </p>

            <h2 className="mt-2 font-serif text-3xl text-[#40583a]">
              Most Wasted Flowers 🥀
            </h2>

            <p className="mt-2 text-sm text-[#7a8972]">
              Identify flowers with the highest recorded losses.
            </p>

            {loading && !summary ? (
              <p className="mt-8 text-sm text-[#849276]">
                Loading flower insights...
              </p>
            ) : wasteByFlower.length === 0 ? (
              <div className="mt-8 rounded-2xl bg-[#f5f7ef] p-8 text-center">
                <span className="text-4xl">🌼</span>

                <p className="mt-3 text-sm text-[#74816d]">
                  No flower losses recorded yet.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-7">
                {Object.entries(flowerGroups).map(([unit, items]) => {
                  const rows = [...(items ?? [])].sort(
                    (a, b) => b.total_wasted - a.total_wasted
                  );

                  const max = Math.max(
                    1,
                    ...rows.map((item) => item.total_wasted)
                  );

                  return (
                    <div key={unit}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#849276]">
                        {unit}
                      </p>

                      <div className="space-y-5">
                        {rows.map((flower) => (
                          <div key={flower.flower_id}>
                            <div className="mb-2 flex justify-between gap-3 text-sm">
                              <span className="text-[#536c4b]">
                                {flower.flower_name}
                                {flower.variety ? ` · ${flower.variety}` : ""}
                              </span>

                              <span className="shrink-0 font-medium text-[#40583a]">
                                {formatUnit(flower.total_wasted, flower.unit)}
                              </span>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-[#edf2e7]">
                              <div
                                className="h-full rounded-full bg-[#91ad88] transition-all"
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
        <div className="mt-10 text-center">
          <p className="font-serif text-lg text-[#74816d]">
            A little more care, a little less waste. 🌷
          </p>
        </div>
      </div>
    </main>
  );
}
