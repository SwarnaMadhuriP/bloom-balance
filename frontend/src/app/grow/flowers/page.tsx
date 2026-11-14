"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  Flower2,
  Plus,
  X,
  RefreshCw,
  Leaf,
  Sprout,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

type Flower = {
  id: string;
  name: string;
  variety: string;
  color: string | null;
  unit: "stem" | "bunch" | "kg";
  created_at: string;
  updated_at: string;
};

type FlowerForm = {
  name: string;
  variety: string;
  color: string;
  unit: Flower["unit"];
};

type BatchForm = {
  harvest_date: string;
  expiry_date: string;
  initial_quantity: string;
  price_per_unit: string;
};

type FlowerBatch = {
  id: string;
  flower_id: string;
  grower_organization_id: string;
  harvest_date: string;
  expiry_date: string;
  initial_quantity: number;
  price_per_unit: string;
  created_at: string;
};

type InventoryLocation = {
  id: string;
  organization_id: string;
  name: string;
  location_type: string;
};

type PendingReceipt = {
  batch: FlowerBatch;
  flower: Flower;
};

const organizationId = process.env.NEXT_PUBLIC_GROWER_ORGANIZATION_ID;

const emptyFlowerForm: FlowerForm = {
  name: "",
  variety: "",
  color: "",
  unit: "stem",
};

const emptyBatchForm: BatchForm = {
  harvest_date: "",
  expiry_date: "",
  initial_quantity: "",
  price_per_unit: "",
};

const fieldClass =
  "w-full rounded-xl border border-[#D6E1D1] bg-white px-4 py-3 text-[#344E41] outline-none transition-colors focus:border-[#8DA58A] focus:ring-2 focus:ring-[#8DA58A]/20";

const labelClass = "mb-2 block text-sm font-medium";

function getFlowerIllustration(name: string) {
  const illustrations: Record<string, string> = {
    rose: "/images/flowers/rose.png",
    sunflower: "/images/flowers/sunflower.png",
    tulip: "/images/flowers/tulip.png",
    lavender: "/images/flowers/lavender.png",
  };

  return (
    illustrations[name.trim().toLowerCase()] ??
    "/images/flowers/default-flower.png"
  );
}

function apiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

export default function FlowersPage() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showFlowerForm, setShowFlowerForm] = useState(false);
  const [flowerForm, setFlowerForm] = useState<FlowerForm>(emptyFlowerForm);
  const [flowerSaving, setFlowerSaving] = useState(false);
  const [flowerError, setFlowerError] = useState("");

  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const [batchForm, setBatchForm] = useState<BatchForm>(emptyBatchForm);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState("");

  const [pendingReceipt, setPendingReceipt] = useState<PendingReceipt | null>(
    null
  );
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receiveError, setReceiveError] = useState("");

  const loadFlowers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<Flower[]>("/flowers");
      setFlowers(response.data);
    } catch (err) {
      console.error(err);
      setError("Unable to load flowers. Check your backend API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFlowers();
  }, [loadFlowers]);

  async function addFlower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFlowerSaving(true);
    setFlowerError("");
    setSuccess("");

    try {
      const response = await api.post<Flower>("/flowers", {
        name: flowerForm.name.trim(),
        variety: flowerForm.variety.trim(),
        color: flowerForm.color.trim() || null,
        unit: flowerForm.unit,
      });

      setShowFlowerForm(false);
      setFlowerForm(emptyFlowerForm);

      setSuccess(`${response.data.name} was added to the flower catalog!`);

      await loadFlowers();
    } catch (err) {
      setFlowerError(apiError(err, "Unable to add flower. Please try again."));
    } finally {
      setFlowerSaving(false);
    }
  }

  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFlower) return;

    setBatchError("");

    if (!organizationId) {
      setBatchError("NEXT_PUBLIC_GROWER_ORGANIZATION_ID is not configured.");
      return;
    }

    const quantity = Number(batchForm.initial_quantity);
    const price = batchForm.price_per_unit.trim();

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setBatchError("Quantity must be a positive whole number.");
      return;
    }

    if (!/^\d{1,8}(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
      setBatchError("Enter a positive price with at most two decimal places.");
      return;
    }

    if (
      !batchForm.harvest_date ||
      !batchForm.expiry_date ||
      batchForm.expiry_date < batchForm.harvest_date
    ) {
      setBatchError("Expiry date must be on or after harvest date.");
      return;
    }

    setBatchSaving(true);

    try {
      const response = await api.post<FlowerBatch>("/flower-batches", {
        flower_id: selectedFlower.id,
        grower_organization_id: organizationId,
        harvest_date: batchForm.harvest_date,
        expiry_date: batchForm.expiry_date,
        initial_quantity: quantity,
        price_per_unit: price,
      });

      const receipt: PendingReceipt = {
        batch: response.data,
        flower: selectedFlower,
      };

      setSelectedFlower(null);
      setBatchForm(emptyBatchForm);
      setPendingReceipt(receipt);
      setReceiveQuantity(String(response.data.initial_quantity));
      setLocationId("");
      setLocations([]);
      setReceiveError("");

      setSuccess(
        "Harvest batch created! Receive it into a location to make stock available."
      );

      setLocationsLoading(true);

      try {
        const locationsResponse = await api.get<InventoryLocation[]>(
          "/inventory/locations",
          {
            params: {
              organization_id: organizationId,
            },
          }
        );

        setLocations(locationsResponse.data);

        if (locationsResponse.data.length > 0) {
          setLocationId(locationsResponse.data[0].id);
        }
      } catch (err) {
        setReceiveError(
          apiError(
            err,
            "Could not load inventory locations. You can retry loading them."
          )
        );
      } finally {
        setLocationsLoading(false);
      }
    } catch (err) {
      setBatchError(apiError(err, "Unable to create harvest batch."));
    } finally {
      setBatchSaving(false);
    }
  }

  async function reloadLocations() {
    if (!organizationId) {
      setReceiveError("Grower organization ID is missing.");
      return;
    }

    setLocationsLoading(true);
    setReceiveError("");

    try {
      const response = await api.get<InventoryLocation[]>(
        "/inventory/locations",
        {
          params: {
            organization_id: organizationId,
          },
        }
      );

      setLocations(response.data);

      setLocationId((previous) =>
        response.data.some((location) => location.id === previous)
          ? previous
          : response.data[0]?.id ?? ""
      );
    } catch (err) {
      setReceiveError(apiError(err, "Unable to load inventory locations."));
    } finally {
      setLocationsLoading(false);
    }
  }

  async function receiveInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingReceipt) return;

    const quantity = Number(receiveQuantity);
    setReceiveError("");

    if (!locationId) {
      setReceiveError("Select an inventory location.");
      return;
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > pendingReceipt.batch.initial_quantity
    ) {
      setReceiveError(
        `Enter a whole number between 1 and ${pendingReceipt.batch.initial_quantity}.`
      );
      return;
    }

    setReceiveSaving(true);

    try {
      await api.post("/inventory/receive", {
        batch_id: pendingReceipt.batch.id,
        location_id: locationId,
        quantity,
      });

      setSuccess(
        `${quantity} ${pendingReceipt.flower.unit}(s) of ${pendingReceipt.flower.name} received successfully!`
      );

      setPendingReceipt(null);
      setReceiveQuantity("");
      setLocationId("");
    } catch (err) {
      setReceiveError(
        apiError(err, "Unable to receive inventory. Please try again.")
      );
    } finally {
      setReceiveSaving(false);
    }
  }

  return (
    <main
      className="relative min-h-screen bg-[#FAF7F0] bg-cover bg-center bg-fixed px-5 py-10 text-[#344E41] md:px-12"
      style={{
        backgroundImage: "url('/images/inventory-background.png')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#FFF9EF]/10" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Back navigation */}
        <Link
          href="/grow"
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white"
        >
          <ArrowLeft size={16} />
          Back to the Greenhouse
        </Link>

        {/* Page heading */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">
              The Grower&apos;s Greenhouse
            </p>

            <h1 className="font-serif text-4xl md:text-5xl">
              My Flower Collection
            </h1>

            <p className="mt-3 italic text-[#73836F]">
              Every beautiful harvest begins with a flower.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[#91AD83]">
              <span className="h-px w-10 bg-[#A8BE9B]" />
              <Leaf size={17} />
              <span className="h-px w-10 bg-[#A8BE9B]" />
            </div>
          </div>

          {/* Page actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/grow/pending-harvests"
              className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-4 py-3 text-sm backdrop-blur-md transition-colors hover:bg-[#E5EDDF]"
            >
              Pending Harvests
            </Link>

            <button
              type="button"
              onClick={() => void loadFlowers()}
              disabled={loading}
              className="flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-4 py-3 text-sm transition-colors hover:bg-[#E5EDDF] disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setFlowerError("");
                setFlowerForm(emptyFlowerForm);
                setShowFlowerForm(true);
              }}
              className="flex items-center gap-2 rounded-full bg-[#344E41] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#456653]"
            >
              <Plus size={17} />
              Add Flower
            </button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B8D5B0] bg-[#F0F8EC]/95 p-4 text-[#456653]"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={19} />
              {success}
            </span>

            {!pendingReceipt && (
              <Link href="/grow/inventory" className="font-medium underline">
                View Inventory
              </Link>
            )}
          </div>
        )}

        {/* Flower collection */}
        {loading ? (
          <div className="rounded-2xl bg-white/85 p-10 text-center">
            Gathering your flowers...
          </div>
        ) : flowers.length === 0 ? (
          <div className="rounded-2xl bg-white/90 p-12 text-center shadow-md">
            <Flower2 className="mx-auto mb-4 text-[#8DA58A]" size={42} />

            <h2 className="font-serif text-2xl">
              Your flower garden is waiting
            </h2>

            <p className="mt-2 text-[#73836F]">
              Add your first flower to begin your collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {flowers.map((flower) => (
              <article
                key={flower.id}
                className="
                  group flex h-full flex-col overflow-hidden
                  rounded-2xl border border-white/80
                  bg-white/95 shadow-md
                  backdrop-blur-md
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:border-[#C7D5B8]
                  hover:shadow-xl
                "
              >
                {/* Botanical illustration */}
                <div className="flex h-56 items-center justify-center overflow-hidden bg-[#F7F2E9]">
                  <Image
                    src={getFlowerIllustration(flower.name)}
                    alt={`${flower.name} watercolor illustration`}
                    width={260}
                    height={240}
                    unoptimized
                    className="
                      h-full w-full object-contain p-3
                      transition-transform duration-500
                      group-hover:scale-105
                    "
                  />
                </div>

                {/* Flower details */}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-serif text-2xl">{flower.name}</h2>

                  <p className="mt-1 min-h-5 text-sm text-[#73836F]">
                    {flower.variety}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {flower.color && (
                      <span className="rounded-full bg-[#F4D9D5]/70 px-3 py-1 text-xs">
                        {flower.color}
                      </span>
                    )}

                    <span className="rounded-full bg-[#E5EDDF] px-3 py-1 text-xs">
                      Per {flower.unit}
                    </span>
                  </div>

                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFlower(flower);
                        setBatchForm(emptyBatchForm);
                        setBatchError("");
                        setSuccess("");
                      }}
                      className="
                        flex w-full items-center justify-center
                        gap-2 rounded-full bg-[#344E41]
                        px-4 py-3 text-sm font-medium text-white
                        transition-colors hover:bg-[#456653]
                      "
                    >
                      <Sprout size={17} />
                      Create Harvest Batch
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-center font-serif text-sm italic text-[#73836F]">
          Every flower has a purpose. Every bloom has a story.
        </p>
      </div>

      {/* Add Flower dialog */}
      {showFlowerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203629]/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-flower-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#FFFCF6] p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-[#8DA58A]">
                  Grow a little beauty
                </p>

                <h2 id="add-flower-title" className="font-serif text-3xl">
                  Add a Flower
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close form"
                disabled={flowerSaving}
                onClick={() => setShowFlowerForm(false)}
                className="rounded-full p-2 hover:bg-[#E5EDDF]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={addFlower} className="space-y-5">
              <div>
                <label htmlFor="flower-name" className={labelClass}>
                  Flower Name
                </label>

                <input
                  id="flower-name"
                  required
                  maxLength={100}
                  value={flowerForm.name}
                  onChange={(event) =>
                    setFlowerForm({
                      ...flowerForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. Rose"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="flower-variety" className={labelClass}>
                  Variety
                </label>

                <input
                  id="flower-variety"
                  required
                  maxLength={100}
                  value={flowerForm.variety}
                  onChange={(event) =>
                    setFlowerForm({
                      ...flowerForm,
                      variety: event.target.value,
                    })
                  }
                  placeholder="e.g. Hybrid Tea"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="flower-color" className={labelClass}>
                  Color (optional)
                </label>

                <input
                  id="flower-color"
                  maxLength={50}
                  value={flowerForm.color}
                  onChange={(event) =>
                    setFlowerForm({
                      ...flowerForm,
                      color: event.target.value,
                    })
                  }
                  placeholder="e.g. Pink"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="flower-unit" className={labelClass}>
                  Unit
                </label>

                <select
                  id="flower-unit"
                  value={flowerForm.unit}
                  onChange={(event) =>
                    setFlowerForm({
                      ...flowerForm,
                      unit: event.target.value as Flower["unit"],
                    })
                  }
                  className={fieldClass}
                >
                  <option value="stem">Stem</option>
                  <option value="bunch">Bunch</option>
                  <option value="kg">Kilogram</option>
                </select>
              </div>

              {flowerError && (
                <p role="alert" className="text-sm text-red-700">
                  {flowerError}
                </p>
              )}

              <button
                type="submit"
                disabled={flowerSaving}
                className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white hover:bg-[#456653] disabled:opacity-50"
              >
                {flowerSaving ? "Planting your flower..." : "Add to Collection"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Harvest Batch dialog */}
      {selectedFlower && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203629]/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-batch-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#FFFCF6] p-7 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-[#8DA58A]">
                  A new harvest begins
                </p>

                <h2 id="create-batch-title" className="font-serif text-3xl">
                  Create Harvest Batch
                </h2>

                <p className="mt-2 text-sm text-[#73836F]">
                  {selectedFlower.name} · {selectedFlower.variety}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close batch form"
                disabled={batchSaving}
                onClick={() => setSelectedFlower(null)}
                className="rounded-full p-2 hover:bg-[#E5EDDF]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createBatch} className="space-y-5">
              <div>
                <label htmlFor="batch-quantity" className={labelClass}>
                  Initial Quantity
                </label>

                <input
                  id="batch-quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={batchForm.initial_quantity}
                  onChange={(event) =>
                    setBatchForm({
                      ...batchForm,
                      initial_quantity: event.target.value,
                    })
                  }
                  placeholder="e.g. 300"
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="batch-harvest" className={labelClass}>
                    Harvest Date
                  </label>

                  <input
                    id="batch-harvest"
                    type="date"
                    required
                    value={batchForm.harvest_date}
                    onChange={(event) =>
                      setBatchForm({
                        ...batchForm,
                        harvest_date: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="batch-expiry" className={labelClass}>
                    Expiry Date
                  </label>

                  <input
                    id="batch-expiry"
                    type="date"
                    min={batchForm.harvest_date || undefined}
                    required
                    value={batchForm.expiry_date}
                    onChange={(event) =>
                      setBatchForm({
                        ...batchForm,
                        expiry_date: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="batch-price" className={labelClass}>
                  Price Per Unit (₹)
                </label>

                <input
                  id="batch-price"
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  required
                  value={batchForm.price_per_unit}
                  onChange={(event) =>
                    setBatchForm({
                      ...batchForm,
                      price_per_unit: event.target.value,
                    })
                  }
                  placeholder="e.g. 12.50"
                  className={fieldClass}
                />

                <p className="mt-2 text-xs text-[#879485]">
                  Price per {selectedFlower.unit}
                </p>
              </div>

              <div className="rounded-xl bg-[#F0F5EB] p-4 text-sm text-[#60765D]">
                🌿 Creating a batch records the harvest. You can receive its
                flowers into inventory in the next step.
              </div>

              {batchError && (
                <p role="alert" className="text-sm text-red-700">
                  {batchError}
                </p>
              )}

              <button
                type="submit"
                disabled={batchSaving}
                className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white hover:bg-[#456653] disabled:opacity-50"
              >
                {batchSaving ? "Creating harvest..." : "Create Harvest Batch"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Receive Harvest dialog */}
      {pendingReceipt && (
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
                  Receive Your Harvest
                </h2>

                <p className="mt-2 text-sm text-[#73836F]">
                  {pendingReceipt.flower.name} · {pendingReceipt.flower.variety}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close receive form"
                disabled={receiveSaving}
                onClick={() => {
                  setPendingReceipt(null);
                  setSuccess(
                    "Batch saved but not received. You can receive it later using its batch ID."
                  );
                }}
                className="rounded-full p-2 hover:bg-[#E5EDDF] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 rounded-xl bg-[#F0F5EB] p-4">
              <div className="flex items-center gap-2 font-medium">
                <Warehouse size={18} />
                Harvest batch created
              </div>

              <p className="mt-2 font-serif text-2xl">
                {pendingReceipt.batch.initial_quantity}{" "}
                {pendingReceipt.flower.unit}(s)
              </p>

              <p className="mt-1 break-all text-xs text-[#73836F]">
                Batch ID: {pendingReceipt.batch.id}
              </p>
            </div>

            <form onSubmit={receiveInventory} className="space-y-5">
              <div>
                <label htmlFor="receive-location" className={labelClass}>
                  Storage Location
                </label>

                <select
                  id="receive-location"
                  required
                  disabled={locationsLoading || locations.length === 0}
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a location</option>

                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} (
                      {location.location_type.replaceAll("_", " ")})
                    </option>
                  ))}
                </select>

                {locationsLoading && (
                  <p className="mt-2 text-sm text-[#73836F]">
                    Loading greenhouse locations...
                  </p>
                )}

                {!locationsLoading && locations.length === 0 && (
                  <p className="mt-2 text-sm text-[#73836F]">
                    No locations found. Add an inventory location in the backend
                    before receiving stock.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void reloadLocations()}
                  disabled={locationsLoading}
                  className="mt-2 text-sm font-medium text-[#456653] underline disabled:opacity-50"
                >
                  Reload locations
                </button>
              </div>

              <div>
                <label htmlFor="receive-quantity" className={labelClass}>
                  Quantity to Receive
                </label>

                <input
                  id="receive-quantity"
                  type="number"
                  min="1"
                  max={pendingReceipt.batch.initial_quantity}
                  step="1"
                  required
                  value={receiveQuantity}
                  onChange={(event) => setReceiveQuantity(event.target.value)}
                  className={fieldClass}
                />

                <p className="mt-2 text-xs text-[#73836F]">
                  You can receive part of this batch now and the remainder
                  later.
                </p>
              </div>

              {receiveError && (
                <p role="alert" className="text-sm text-red-700">
                  {receiveError}
                </p>
              )}

              <button
                type="submit"
                disabled={receiveSaving || locationsLoading || !locationId}
                className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white hover:bg-[#456653] disabled:opacity-50"
              >
                {receiveSaving
                  ? "Receiving harvest..."
                  : "Receive into Inventory"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
