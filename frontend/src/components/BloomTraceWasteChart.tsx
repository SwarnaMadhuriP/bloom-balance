"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { api } from "@/lib/api";

type DailyWaste = {
  date: string;
  unit: string;
  total_wasted: number;
  record_count: number;
};

type Props = {
  organizationId: string;
};

// Convert a Date to YYYY-MM-DD using local time.
function dateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// Calculate a date range from a supplied date.
// Do not call new Date() without arguments during rendering.
function getDateRange(days: number, today: string) {
  const end = new Date(`${today}T12:00:00`);
  const start = new Date(end);

  start.setDate(end.getDate() - (days - 1));

  return {
    start_date: dateString(start),
    end_date: today,
  };
}

export default function BloomTraceWasteChart({ organizationId }: Props) {
  const [days, setDays] = useState(30);
  const [selectedUnit, setSelectedUnit] = useState("stem");

  const [records, setRecords] = useState<DailyWaste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Initialize today's date only after the browser mounts.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(dateString(new Date()));
  }, []);

  // Fetch daily waste records whenever the date range changes.
  useEffect(() => {
    if (!today) return;

    let active = true;

    async function loadTrends() {
      setLoading(true);
      setError("");

      try {
        // The guard above ensures today is initialized.
        const range = getDateRange(days, today!);

        const response = await api.get<DailyWaste[]>(
          "/bloomtrace/analytics/daily-waste",
          {
            params: {
              organization_id: organizationId,
              ...range,
            },
          }
        );

        if (active) {
          setRecords(response.data);
        }
      } catch (err) {
        if (active) {
          let message = "Unable to load waste trends.";

          if (axios.isAxiosError(err)) {
            const detail = err.response?.data?.detail;

            message = typeof detail === "string" ? detail : err.message;
          }

          setError(message);
          setRecords([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTrends();

    return () => {
      active = false;
    };
  }, [organizationId, days, today]);

  // Identify available flower units.
  const availableUnits = useMemo(() => {
    return [...new Set(records.map((record) => record.unit))];
  }, [records]);

  const activeUnit = availableUnits.includes(selectedUnit)
    ? selectedUnit
    : availableUnits[0] ?? "stem";

  // Prepare chart data, including dates with zero waste.
  const chartData = useMemo(() => {
    if (!today) return [];

    const quantities = new Map<string, number>();

    records
      .filter((record) => record.unit === activeUnit)
      .forEach((record) => {
        quantities.set(
          record.date,
          (quantities.get(record.date) ?? 0) + record.total_wasted
        );
      });

    const { start_date } = getDateRange(days, today);
    const start = new Date(`${start_date}T12:00:00`);

    return Array.from({ length: days }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);

      const date = dateString(current);

      return {
        date,
        label: current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        quantity: quantities.get(date) ?? 0,
      };
    });
  }, [records, activeUnit, days, today]);

  const hasWaste = chartData.some((record) => record.quantity > 0);

  return (
    <section className="mt-8 rounded-[30px] border border-white/90 bg-white/85 p-6 shadow-sm sm:p-8">
      {/* Chart Header */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b9a80]">
            Your Garden Over Time
          </p>

          <h2 className="mt-2 font-serif text-3xl text-[#40583a]">
            Daily Waste Trends 🍂
          </h2>

          <p className="mt-2 text-sm text-[#7a8972]">
            See when flowers were lost and discover patterns.
          </p>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={`rounded-full px-4 py-2 text-sm transition ${
                days === value
                  ? "bg-[#536c4b] text-white"
                  : "bg-[#edf2e7] text-[#536c4b] hover:bg-[#e1ead9]"
              }`}
            >
              {value}D
            </button>
          ))}
        </div>
      </div>

      {/* Flower Unit Filters */}
      {!loading && !error && availableUnits.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {availableUnits.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setSelectedUnit(unit)}
              aria-pressed={activeUnit === unit}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeUnit === unit
                  ? "border-[#536c4b] bg-[#edf2e7] text-[#40583a]"
                  : "border-[#e2e8db] text-[#849276] hover:bg-[#f5f7ef]"
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div
          role="status"
          className="flex h-72 items-center justify-center text-[#849276]"
        >
          Loading waste trends...
        </div>
      ) : error ? (
        /* Error State */
        <div role="alert" className="rounded-2xl bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : !hasWaste ? (
        /* Empty State */
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl bg-[#f5f7ef] px-4 text-center">
          <span className="text-5xl">🌱</span>

          <p className="mt-4 font-serif text-xl text-[#40583a]">
            No waste recorded in this period
          </p>

          <p className="mt-2 text-sm text-[#849276]">
            There are no recorded flower losses for these dates.
          </p>
        </div>
      ) : (
        /* Waste Trend Chart */
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 12,
                right: 12,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="wasteGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a7b99a" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#a7b99a" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#e7eadf"
                strokeDasharray="4 4"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{
                  fill: "#829079",
                  fontSize: 11,
                }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />

              <YAxis
                allowDecimals={false}
                tick={{
                  fill: "#829079",
                  fontSize: 11,
                }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                formatter={(value) => [`${value ?? 0} ${activeUnit}`, "Wasted"]}
              />

              <Area
                type="monotone"
                dataKey="quantity"
                stroke="#66835c"
                strokeWidth={3}
                fill="url(#wasteGradient)"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
