"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  RefreshCw,
  Sprout,
  X,
  Leaf,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

type ReceiptStatus = "NOT_RECEIVED" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED";

type Batch = {
  id: string;
  flower_id: string;
  flower_name: string;
  variety: string;
  unit: string;
  harvest_date: string;
  expiry_date: string;
  initial_quantity: number;
  received_quantity: number;
  remaining_quantity: number;
  receipt_status: ReceiptStatus;
  price_per_unit: string;
  created_at: string;
};

type Location = {
  id: string;
  organization_id: string;
  name: string;
  location_type: string;
};

const organizationId = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

const fieldClass =
  "w-full rounded-xl border border-[#D6E1D1] bg-white px-4 py-3 text-[#344E41] outline-none transition-colors focus:border-[#8DA58A] focus:ring-2 focus:ring-[#8DA58A]/20";

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function isExpired(expiryDate: string) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const localToday = `${year}-${month}-${day}`;

  // The expiry date itself is still valid.
  return expiryDate.slice(0, 10) < localToday;
}

function receiptBadge(status: ReceiptStatus) {
  switch (status) {
    case "NOT_RECEIVED":
      return "bg-[#E5EDDF] text-[#456653]";
    case "PARTIALLY_RECEIVED":
      return "bg-amber-100 text-amber-800";
    case "FULLY_RECEIVED":
      return "bg-emerald-100 text-emerald-800";
  }
}

export default function PendingHarvestsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selected, setSelected] = useState<Batch | null>(null);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiveError, setReceiveError] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [showCompleted, setShowCompleted] = useState(false);

  const loadBatches = useCallback(async () => {
    if (!organizationId) {
      setError("NEXT_PUBLIC_GROWER_ORGANIZATION_ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<Batch[]>("/flower-batches", {
        params: {
          organization_id: organizationId,
        },
      });

      setBatches(response.data);
    } catch (err) {
      setError(errorMessage(err, "Unable to load harvest batches."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function openReceive(batch: Batch) {
    if (!organizationId) return;

    if (isExpired(batch.expiry_date)) {
      setError(
        `${batch.flower_name} expired on ${formatDate(
          batch.expiry_date
        )}. Expired harvests cannot be received into sellable inventory.`
      );
      return;
    }

    setSelected(batch);
    setQuantity(String(batch.remaining_quantity));
    setReceiveError("");
    setLocations([]);
    setLocationId("");
    setLocationsLoading(true);
    setError("");

    try {
      const response = await api.get<Location[]>("/inventory/locations", {
        params: {
          organization_id: organizationId,
        },
      });

      setLocations(response.data);

      if (response.data.length > 0) {
        setLocationId(response.data[0].id);
      }
    } catch (err) {
      setReceiveError(errorMessage(err, "Unable to load inventory locations."));
    } finally {
      setLocationsLoading(false);
    }
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;

    setReceiveError("");

    if (isExpired(selected.expiry_date)) {
      setReceiveError(
        "This harvest has expired and cannot be received into sellable inventory."
      );
      return;
    }

    const count = Number(quantity);

    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > selected.remaining_quantity
    ) {
      setReceiveError(
        `Enter a whole number from 1 to ${selected.remaining_quantity}.`
      );
      return;
    }

    if (!locationId) {
      setReceiveError("Choose a storage location.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/inventory/receive", {
        batch_id: selected.id,
        location_id: locationId,
        quantity: count,
      });

      setSuccess(
        `Received ${count} ${selected.unit} of ${selected.flower_name} into inventory.`
      );

      setSelected(null);
      await loadBatches();
    } catch (err) {
      setReceiveError(
        errorMessage(err, "Unable to receive inventory. Refresh and try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  const pending = batches.filter((batch) => batch.remaining_quantity > 0);

  const completed = batches.filter((batch) => batch.remaining_quantity === 0);

  const visible = showCompleted ? batches : pending;

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
          href="/grow/flowers"
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white"
        >
          <ArrowLeft size={16} />
          Back to My Flowers
        </Link>

        {/* Header */}
        <div className="mb-9 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">
              The Grower&apos;s Greenhouse
            </p>

            <h1 className="font-serif text-4xl md:text-5xl">
              Pending Harvests
            </h1>

            <p className="mt-3 italic text-[#73836F]">
              A little home for blooms awaiting storage.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[#91AD83]">
              <span className="h-px w-10 bg-[#A8BE9B]" />
              <Leaf size={17} />
              <span className="h-px w-10 bg-[#A8BE9B]" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSuccess("");
              void loadBatches();
            }}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur-md transition-colors hover:bg-[#E5EDDF] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Feedback */}
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B8D5B0] bg-[#F0F8EC]/95 p-4 text-[#456653]"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              {success}
            </span>

            <Link
              href="/grow/inventory"
              className="text-sm font-medium underline"
            >
              View Inventory
            </Link>
          </div>
        )}

        {/* Harvest summary */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-md">
          <p className="text-sm">
            <strong>{pending.length}</strong> awaiting receipt
            <span className="mx-2 text-[#A8BE9B]">·</span>
            <strong>{completed.length}</strong> fully received
          </p>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
              className="accent-[#456653]"
            />
            Show completed batches
          </label>
        </div>

        {/* Harvest cards */}
        {loading ? (
          <div className="rounded-2xl bg-white/90 p-8 text-[#73836F]">
            Gathering your harvests...
          </div>
        ) : error && batches.length === 0 ? (
          <div className="rounded-2xl bg-white/90 p-8 text-[#73836F]">
            Harvest batches could not be displayed.
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 p-10 text-center shadow-md">
            <Sprout className="mx-auto mb-3 text-[#8DA58A]" size={38} />

            <p className="font-serif text-xl">
              {showCompleted
                ? "No harvest batches yet"
                : "No harvests awaiting receipt"}
            </p>

            <p className="mt-2 text-sm text-[#73836F]">
              {showCompleted
                ? "Create a harvest batch from My Flower Collection to begin."
                : "Your received harvests are safely tucked away. Create a new batch whenever you're ready."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {visible.map((batch) => {
              const progress =
                batch.initial_quantity > 0
                  ? Math.min(
                      100,
                      (batch.received_quantity / batch.initial_quantity) * 100
                    )
                  : 0;

              const expired = isExpired(batch.expiry_date);
              const complete = batch.remaining_quantity === 0;

              return (
                <article
                  key={batch.id}
                  className="rounded-2xl border border-white/80 bg-white/95 p-6 shadow-md backdrop-blur-md transition-colors hover:border-[#C7D5B8]"
                >
                  {/* Flower and status */}
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-2xl">
                        {batch.flower_name}
                      </h2>

                      <p className="mt-1 text-sm text-[#73836F]">
                        {batch.variety} · Harvested{" "}
                        {formatDate(batch.harvest_date)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${receiptBadge(
                        batch.receipt_status
                      )}`}
                    >
                      {batch.receipt_status.replaceAll("_", " ")}
                    </span>
                  </div>

                  {/* Quantities */}
                  <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[#73836F]">Harvested</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {batch.initial_quantity.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[#73836F]">Received</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {batch.received_quantity.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[#73836F]">Remaining</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {batch.remaining_quantity.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  {/* Receipt progress */}
                  <div
                    className="mb-4 h-2 overflow-hidden rounded-full bg-[#E5EDDF]"
                    role="progressbar"
                    aria-label={`${batch.flower_name} received`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  >
                    <div
                      className="h-full rounded-full bg-[#87A88A] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Expiry information */}
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[#73836F]">
                    <span>Expiry: {formatDate(batch.expiry_date)}</span>
                    <span>·</span>
                    <span>Unit: {batch.unit}</span>
                  </div>

                  {expired && !complete && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle size={16} className="shrink-0" />
                      This harvest has expired. Remaining stock cannot be
                      received as sellable inventory.
                    </div>
                  )}

                  {/* Receive action */}
                  {complete ? (
                    <p className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-[#60765D]">
                      <CheckCircle2 size={17} />
                      All harvested stock received
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={expired}
                      onClick={() => void openReceive(batch)}
                      className="w-full rounded-full bg-[#344E41] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#456653] disabled:cursor-not-allowed disabled:bg-[#C7D2C5] disabled:text-[#637461]"
                    >
                      {expired ? "Harvest Expired" : "Receive Remaining Stock"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center font-serif text-sm italic text-[#73836F]">
          Every flower has a purpose. Every bloom has a story.
        </p>
      </div>

      {/* Receive inventory dialog */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203629]/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receive-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#FFFCF6] p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-[#8DA58A]">
                  The harvest has arrived
                </p>

                <h2 id="receive-title" className="font-serif text-3xl">
                  Receive Remaining Stock
                </h2>

                <p className="mt-2 text-sm text-[#73836F]">
                  {selected.flower_name} · {selected.remaining_quantity}{" "}
                  {selected.unit} remaining
                </p>
              </div>

              <button
                type="button"
                aria-label="Close receive dialog"
                disabled={saving}
                onClick={() => setSelected(null)}
                className="rounded-full p-2 transition-colors hover:bg-[#E5EDDF] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={receive} className="space-y-5">
              <div>
                <label
                  htmlFor="receive-location"
                  className="mb-2 block text-sm font-medium"
                >
                  Storage Location
                </label>

                <select
                  id="receive-location"
                  required
                  disabled={locationsLoading}
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">
                    {locationsLoading
                      ? "Loading locations..."
                      : "Select a location"}
                  </option>

                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} (
                      {location.location_type.replaceAll("_", " ")})
                    </option>
                  ))}
                </select>

                {!locationsLoading && locations.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No inventory locations found for this grower.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="receive-quantity"
                  className="mb-2 block text-sm font-medium"
                >
                  Quantity to Receive
                </label>

                <input
                  id="receive-quantity"
                  type="number"
                  min="1"
                  max={selected.remaining_quantity}
                  step="1"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className={fieldClass}
                />

                <p className="mt-2 text-xs text-[#879485]">
                  You can receive part of the remaining stock and complete the
                  rest later.
                </p>
              </div>

              {receiveError && (
                <p role="alert" className="text-sm text-red-700">
                  {receiveError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  saving ||
                  locationsLoading ||
                  locations.length === 0 ||
                  !locationId
                }
                className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white transition-colors hover:bg-[#456653] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Receiving..." : "Receive into Inventory"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
