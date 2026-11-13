"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { api } from "@/lib/api";
import CreateSurplusListing from "@/components/CreateSurplusListing";

type SurplusListing = {
  id: string;
  batch_id: string;
  grower_organization_id: string;
  listed_quantity: number;
  remaining_quantity: number;
  price_per_unit: string;
  expires_at: string;
  status: string;
};

type Flower = {
  id: string;
  name: string;
  variety: string;
  unit: string;
};

type FlowerBatch = {
  id: string;
  flower_id: string;
  flower_name: string;
  variety: string;
  unit: string;
  price_per_unit: string;
  expiry_date: string;
};

type RescueItem = {
  listing: SurplusListing;
  batch?: FlowerBatch;
  flower?: Flower;
};

const GROWER_ID = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID ?? "";

const FLORIST_ID = process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID ?? "";

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function RescuePage() {
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [batches, setBatches] = useState<FlowerBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [view, setView] = useState<"florist" | "grower">("florist");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [listingResponse, flowerResponse, batchResponse] =
        await Promise.all([
          api.get<SurplusListing[]>("/surplus-listings"),
          api.get<Flower[]>("/flowers"),
          api.get<FlowerBatch[]>("/flower-batches", {
            params: { organization_id: GROWER_ID },
          }),
        ]);

      setListings(listingResponse.data);
      setFlowers(flowerResponse.data);
      setBatches(batchResponse.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const items = useMemo<RescueItem[]>(() => {
    const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
    const flowerMap = new Map(flowers.map((flower) => [flower.id, flower]));

    return listings.map((listing) => {
      const batch = batchMap.get(listing.batch_id);

      return {
        listing,
        batch,
        flower: batch ? flowerMap.get(batch.flower_id) : undefined,
      };
    });
  }, [listings, batches, flowers]);

  const visibleItems = items.filter(
    ({ listing }) =>
      view === "florist" || listing.grower_organization_id === GROWER_ID
  );

  async function purchase(listing: SurplusListing) {
    if (!FLORIST_ID) {
      setError("Florist organization ID is not configured.");
      return;
    }

    const quantity = quantities[listing.id] ?? 1;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > listing.remaining_quantity
    ) {
      setError("Enter a valid quantity within the available stock.");
      return;
    }

    if (!window.confirm(`Purchase ${quantity} surplus flower units?`)) {
      return;
    }

    setBusyId(listing.id);
    setError("");
    setMessage("");

    try {
      const response = await api.post<{
        order_id: string;
        status: string;
      }>(`/surplus-listings/${listing.id}/purchase`, {
        buyer_organization_id: FLORIST_ID,
        quantity,
      });

      setMessage(
        `Rescue order created! Order ${response.data.order_id} is ${response.data.status}.`
      );
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function cancelListing(listing: SurplusListing) {
    if (!window.confirm("Cancel this surplus listing?")) return;

    setBusyId(listing.id);
    setError("");
    setMessage("");

    try {
      await api.patch(`/surplus-listings/${listing.id}/cancel`, null, {
        params: { grower_organization_id: GROWER_ID },
      });

      setMessage("Surplus listing cancelled.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main
      className="min-h-screen bg-cover bg-center px-5 py-10 text-[#40543b] sm:px-10"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,250,239,0.55),rgba(255,250,239,0.75)),url('/images/inventory-background.png')",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm font-semibold text-[#557b4e] hover:underline"
        >
          ← Back to BloomBalance Village
        </Link>

        <header className="py-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#668b55]">
            A second chance for every flower
          </p>

          <h1 className="font-serif text-5xl font-bold text-[#345436] sm:text-6xl">
            Rescue a Bloom 🌼
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#576b50]">
            Not every beautiful bloom finds its home the first time. Discover
            surplus flowers, give them a new purpose, and help reduce floral
            waste.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 rounded-full bg-white/85 p-1 shadow-sm">
            <button
              onClick={() => setView("florist")}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                view === "florist"
                  ? "bg-[#537b4c] text-white"
                  : "text-[#537b4c] hover:bg-[#edf4e7]"
              }`}
            >
              🌷 Rescue Flowers
            </button>

            <button
              onClick={() => setView("grower")}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                view === "grower"
                  ? "bg-[#537b4c] text-white"
                  : "text-[#537b4c] hover:bg-[#edf4e7]"
              }`}
            >
              🌱 My Surplus Listings
            </button>
          </div>

          <button
            onClick={() => void loadData()}
            className="rounded-full border border-[#9fb996] bg-white/85 px-5 py-3 text-sm font-semibold hover:bg-white"
          >
            ↻ Refresh
          </button>
        </div>

        {message && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {message}
            <Link href="/florist/orders" className="ml-3 font-bold underline">
              View Orders →
            </Link>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </div>
        )}
        {view === "grower" && (
          <CreateSurplusListing growerId={GROWER_ID} onCreated={loadData} />
        )}
        {loading ? (
          <div className="rounded-3xl bg-white/85 p-12 text-center">
            Gathering rescued blooms...
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-3xl border border-[#d5dfc9] bg-white/90 p-12 text-center shadow-sm">
            <div className="mb-4 text-5xl">🌼</div>
            <h2 className="font-serif text-2xl font-bold">
              No surplus blooms available yet
            </h2>
            <p className="mt-3 text-[#708068]">
              {view === "grower"
                ? "Your active surplus listings will appear here."
                : "Check back soon. New flowers may be ready for rescue!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map(({ listing, batch, flower }) => {
              const quantity = quantities[listing.id] ?? 1;
              const originalPrice = batch ? Number(batch.price_per_unit) : null;
              const rescuePrice = Number(listing.price_per_unit);
              const discount =
                originalPrice && originalPrice > rescuePrice
                  ? Math.round(
                      ((originalPrice - rescuePrice) / originalPrice) * 100
                    )
                  : null;

              return (
                <article
                  key={listing.id}
                  className="rounded-[28px] border border-[#d4dfc7] bg-[#fffdf7]/95 p-6 shadow-[0_12px_35px_rgba(55,75,45,0.09)]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="rounded-full bg-[#e9f3dd] px-3 py-1 text-xs font-bold text-[#52734c]">
                      🌿 Surplus Rescue
                    </span>
                    {discount !== null && (
                      <span className="rounded-full bg-[#fff0d5] px-3 py-1 text-xs font-bold text-[#a66c26]">
                        {discount}% off
                      </span>
                    )}
                  </div>

                  <div className="mb-3 text-4xl">💐</div>

                  <h2 className="font-serif text-2xl font-bold text-[#38583c]">
                    {batch?.flower_name ?? flower?.name ?? "Surplus Flowers"}
                  </h2>

                  <p className="mt-1 text-sm text-[#819078]">
                    {batch?.variety ??
                      flower?.variety ??
                      "Fresh seasonal blooms"}
                  </p>

                  <div className="mt-6 flex items-end gap-3">
                    <span className="text-3xl font-bold text-[#456b43]">
                      ₹{rescuePrice.toFixed(2)}
                    </span>

                    {originalPrice !== null && (
                      <span className="pb-1 text-sm text-[#9a9d90] line-through">
                        ₹{originalPrice.toFixed(2)}
                      </span>
                    )}

                    <span className="pb-1 text-sm text-[#778675]">
                      / {batch?.unit ?? flower?.unit ?? "unit"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 border-t border-[#e5eadc] pt-4 text-sm">
                    <p>
                      🌸 Available:{" "}
                      <strong>
                        {listing.remaining_quantity}{" "}
                        {batch?.unit ?? flower?.unit ?? "units"}
                      </strong>
                    </p>

                    <p>
                      ⏳ Rescue before:{" "}
                      <strong>
                        {new Date(listing.expires_at).toLocaleDateString()}
                      </strong>
                    </p>
                  </div>

                  {view === "florist" ? (
                    <div className="mt-6 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={listing.remaining_quantity}
                        step={1}
                        value={quantity}
                        onChange={(event) =>
                          setQuantities((previous) => ({
                            ...previous,
                            [listing.id]: Number(event.target.value),
                          }))
                        }
                        aria-label="Purchase quantity"
                        className="w-20 rounded-xl border border-[#cddbc5] bg-white px-3 py-3"
                      />

                      <button
                        disabled={busyId !== null}
                        onClick={() => void purchase(listing)}
                        className="flex-1 rounded-xl bg-[#567e4d] px-4 py-3 font-bold text-white transition hover:bg-[#416b3a] disabled:opacity-50"
                      >
                        {busyId === listing.id
                          ? "Rescuing..."
                          : "Rescue These Blooms"}
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={busyId !== null}
                      onClick={() => void cancelListing(listing)}
                      className="mt-6 w-full rounded-xl border border-[#b7c8aa] bg-white px-4 py-3 font-semibold text-[#56764c] hover:bg-[#f2f7ec] disabled:opacity-50"
                    >
                      {busyId === listing.id
                        ? "Cancelling..."
                        : "Cancel Listing"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <footer className="mt-16 text-center text-sm text-[#6d8165]">
          Every rescued bloom is a little less waste and a little more wonder.
          🌷
        </footer>
      </div>
    </main>
  );
}
