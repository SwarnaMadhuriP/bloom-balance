"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "@/lib/api";

type InventoryRow = {
  batch_id: string;
  flower_name: string;
  variety: string;
  location_name: string;
  expiry_date: string;
  price_per_unit: string | number;
  available_quantity: number;
  freshness_status: string;
};

type InventoryResponse = {
  inventory: InventoryRow[];
};

type Props = {
  growerId: string;
  onCreated: () => void | Promise<void>;
};

function getError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }

  return error instanceof Error
    ? error.message
    : "Unable to create surplus listing.";
}

export default function CreateSurplusListing({ growerId, onCreated }: Props) {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      try {
        const response = await api.get<InventoryResponse>("/inventory", {
          params: { organization_id: growerId },
        });

        if (!cancelled) {
          setInventory(response.data.inventory);
        }
      } catch (err) {
        if (!cancelled) setError(getError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (growerId) void loadInventory();
    else {
      setError("Grower organization ID is missing.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [growerId]);

  // Inventory may exist across multiple storage locations.
  const batches = useMemo(() => {
    const grouped = new Map<
      string,
      InventoryRow & { totalAvailable: number }
    >();

    for (const row of inventory) {
      const existing = grouped.get(row.batch_id);

      if (existing) {
        existing.totalAvailable += row.available_quantity;
      } else {
        grouped.set(row.batch_id, {
          ...row,
          totalAvailable: row.available_quantity,
        });
      }
    }

    return [...grouped.values()].filter(
      (batch) =>
        batch.totalAvailable > 0 && batch.freshness_status !== "EXPIRED"
    );
  }, [inventory]);

  const selectedBatch = batches.find((batch) => batch.batch_id === batchId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedBatch) {
      setError("Please select a flower batch.");
      return;
    }

    const amount = Number(quantity);
    const discountedPrice = Number(price);
    const originalPrice = Number(selectedBatch.price_per_unit);

    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (amount > selectedBatch.totalAvailable) {
      setError("Quantity exceeds currently available inventory.");
      return;
    }

    if (
      !Number.isFinite(discountedPrice) ||
      discountedPrice <= 0 ||
      discountedPrice >= originalPrice
    ) {
      setError("Surplus price must be positive and below the original price.");
      return;
    }

    if (!expiresAt) {
      setError("Please select an expiration date and time.");
      return;
    }

    const expiration = new Date(expiresAt);

    if (
      Number.isNaN(expiration.getTime()) ||
      expiration.getTime() <= Date.now()
    ) {
      setError("Listing expiration must be in the future.");
      return;
    }

    if (expiration.toISOString().slice(0, 10) > selectedBatch.expiry_date) {
      setError("Listing cannot expire after the flower batch.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/surplus-listings", {
        batch_id: batchId,
        grower_organization_id: growerId,
        listed_quantity: amount,
        price_per_unit: discountedPrice.toFixed(2),
        expires_at: expiration.toISOString(),
      });

      setSuccess("Your surplus flowers are now listed for rescue! 🌼");

      setBatchId("");
      setQuantity("");
      setPrice("");
      setExpiresAt("");

      await onCreated();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-[28px] border border-[#d4dfc7] bg-[#fffdf7]/95 p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#77916c]">
          For Growers
        </p>

        <h2 className="mt-2 font-serif text-3xl font-bold text-[#38583c]">
          Give Your Flowers Another Chance 🌱
        </h2>

        <p className="mt-3 text-[#6d8065]">
          Have extra blooms? Offer them at a discounted price before their
          freshness fades.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-green-50 p-3 text-green-800"
        >
          {success}
        </p>
      )}

      {loading ? (
        <p>Checking your flower inventory...</p>
      ) : batches.length === 0 ? (
        <p>No available flower batches to list yet.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Flower Batch
            <select
              required
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="rounded-xl border border-[#cddbc5] bg-white p-3"
            >
              <option value="">Select a flower batch</option>
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>
                  {batch.flower_name} — {batch.variety} ({batch.totalAvailable}{" "}
                  available)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Surplus Quantity
            <input
              required
              type="number"
              min="1"
              step="1"
              max={selectedBatch?.totalAvailable}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 20"
              className="rounded-xl border border-[#cddbc5] bg-white p-3"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Discounted Price (per unit)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              max={
                selectedBatch
                  ? Math.max(0, Number(selectedBatch.price_per_unit) - 0.01)
                  : undefined
              }
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="e.g. 12.00"
              className="rounded-xl border border-[#cddbc5] bg-white p-3"
            />
            {selectedBatch && (
              <span className="text-xs font-normal text-[#829078]">
                Original price: ₹
                {Number(selectedBatch.price_per_unit).toFixed(2)}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Listing Expires At
            <input
              required
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="rounded-xl border border-[#cddbc5] bg-white p-3"
            />
            {selectedBatch && (
              <span className="text-xs font-normal text-[#829078]">
                Batch expiry: {selectedBatch.expiry_date}
              </span>
            )}
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || !growerId}
              className="rounded-full bg-[#567e4d] px-8 py-3 font-bold text-white transition hover:bg-[#416b3a] disabled:opacity-50"
            >
              {saving ? "Creating Listing..." : "🌼 List Surplus Flowers"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
