"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, RefreshCw, Sprout, X } from "lucide-react";
import { api } from "@/lib/api";

type Batch = {
  id: string; flower_id: string; flower_name: string; variety: string;
  unit: string; harvest_date: string; expiry_date: string;
  initial_quantity: number; received_quantity: number; remaining_quantity: number;
  receipt_status: "NOT_RECEIVED" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED";
  price_per_unit: string; created_at: string;
};
type Location = { id: string; organization_id: string; name: string; location_type: string };
const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID;
const fieldClass = "w-full rounded-xl border border-[#D6E1D1] bg-white px-4 py-3 outline-none focus:border-[#8DA58A]";

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err) && typeof err.response?.data?.detail === "string") return err.response.data.detail;
  return fallback;
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
    if (!organizationId) { setError("NEXT_PUBLIC_ORGANIZATION_ID is missing."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const response = await api.get<Batch[]>("/flower-batches", { params: { organization_id: organizationId } });
      setBatches(response.data);
    } catch (err) { setError(errorMessage(err, "Unable to load harvest batches.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadBatches(); }, [loadBatches]);

  async function openReceive(batch: Batch) {
    if (!organizationId) return;
    setSelected(batch); setQuantity(String(batch.remaining_quantity)); setReceiveError("");
    setLocationsLoading(true); setLocationId("");
    try {
      const response = await api.get<Location[]>("/inventory/locations", { params: { organization_id: organizationId } });
      setLocations(response.data);
      if (response.data.length) setLocationId(response.data[0].id);
    } catch (err) { setReceiveError(errorMessage(err, "Unable to load inventory locations.")); }
    finally { setLocationsLoading(false); }
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const count = Number(quantity);
    if (!Number.isSafeInteger(count) || count < 1 || count > selected.remaining_quantity) {
      setReceiveError(`Enter a whole number from 1 to ${selected.remaining_quantity}.`); return;
    }
    if (!locationId) { setReceiveError("Choose a storage location."); return; }
    setSaving(true); setReceiveError("");
    try {
      await api.post("/inventory/receive", { batch_id: selected.id, location_id: locationId, quantity: count });
      setSuccess(`Received ${count} ${selected.unit} of ${selected.flower_name} into inventory.`);
      setSelected(null);
      await loadBatches();
    } catch (err) {
      setReceiveError(errorMessage(err, "Unable to receive inventory. Refresh and try again."));
    } finally { setSaving(false); }
  }

  const pending = batches.filter((batch) => batch.remaining_quantity > 0);
  const completed = batches.filter((batch) => batch.remaining_quantity === 0);
  const visible = showCompleted ? batches : pending;

  return (
    <main className="relative min-h-screen bg-[#FAF7F0] bg-cover bg-center bg-fixed px-5 py-10 text-[#344E41] md:px-12" style={{ backgroundImage: "url('/images/inventory-background.png')" }}>
      <div className="pointer-events-none absolute inset-0 bg-[#FFF9EF]/15" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <Link href="/grow/flowers" className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm hover:bg-white"><ArrowLeft size={16}/> Back to My Flowers</Link>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#718E6D]">The Grower&apos;s Greenhouse</p><h1 className="font-serif text-4xl md:text-5xl">Pending Harvests</h1><p className="mt-3 italic text-[#73836F]">A little home for blooms awaiting storage.</p></div>
          <button type="button" onClick={() => void loadBatches()} disabled={loading} className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-3 text-sm shadow-sm hover:bg-[#E5EDDF] disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {success && <p role="status" className="mb-5 rounded-xl bg-[#F0F8EC] p-4 text-[#456653]">🌸 {success} <Link href="/grow/inventory" className="underline">View inventory</Link></p>}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/85 p-5 shadow-sm backdrop-blur-md">
          <p className="text-sm"><strong>{pending.length}</strong> awaiting receipt · <strong>{completed.length}</strong> fully received</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)}/> Show completed batches</label>
        </div>
        {loading ? <p className="rounded-2xl bg-white/90 p-8">Gathering your harvests...</p> : visible.length === 0 ? <div className="rounded-2xl bg-white/90 p-10 text-center shadow-md"><Sprout className="mx-auto mb-3 text-[#8DA58A]" size={38}/><p className="font-serif text-xl">No harvests awaiting receipt</p><p className="mt-2 text-sm text-[#73836F]">Create a batch from My Flower Collection to get started.</p></div> :
          <div className="grid gap-5 md:grid-cols-2">{visible.map((batch) => {
            const progress = Math.min(100, (batch.received_quantity / batch.initial_quantity) * 100);
            const statusText = batch.receipt_status.replaceAll("_", " ");
            return <article key={batch.id} className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-md backdrop-blur-md">
              <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{batch.flower_name}</h2><p className="text-sm text-[#73836F]">{batch.variety} · Harvested {batch.harvest_date}</p></div><span className={`rounded-full px-3 py-1 text-xs ${batch.remaining_quantity === 0 ? "bg-green-100 text-green-800" : batch.received_quantity > 0 ? "bg-amber-100 text-amber-800" : "bg-[#E5EDDF] text-[#456653]"}`}>{statusText}</span></div>
              <div className="mb-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-[#73836F]">Harvested</p><p className="text-xl font-semibold">{batch.initial_quantity}</p></div><div><p className="text-[#73836F]">Received</p><p className="text-xl font-semibold">{batch.received_quantity}</p></div><div><p className="text-[#73836F]">Remaining</p><p className="text-xl font-semibold">{batch.remaining_quantity}</p></div></div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#E5EDDF]"><div className="h-full rounded-full bg-[#87A88A]" style={{ width: `${progress}%` }}/></div>
              <p className="mb-4 text-xs text-[#73836F]">Expiry: {batch.expiry_date} · Unit: {batch.unit}</p>
              {batch.remaining_quantity > 0 ? <button type="button" onClick={() => void openReceive(batch)} className="w-full rounded-full bg-[#344E41] px-4 py-3 text-sm font-medium text-white hover:bg-[#456653]">Receive Remaining Stock</button> : <p className="text-center text-sm text-[#60765D]">All harvested stock received</p>}
            </article>;
          })}</div>}
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203629]/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="receive-title" className="w-full max-w-lg rounded-3xl bg-[#FFFCF6] p-7 shadow-2xl">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-[#8DA58A]">The harvest has arrived</p><h2 id="receive-title" className="font-serif text-3xl">Receive Remaining Stock</h2><p className="mt-2 text-sm text-[#73836F]">{selected.flower_name} · {selected.remaining_quantity} {selected.unit} remaining</p></div><button type="button" aria-label="Close" disabled={saving} onClick={() => setSelected(null)}><X size={20}/></button></div>
        <form onSubmit={receive} className="space-y-5"><div><label htmlFor="location" className="mb-2 block text-sm font-medium">Storage Location</label><select id="location" required disabled={locationsLoading} className={fieldClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">{locationsLoading ? "Loading locations..." : "Select a location"}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.location_type.replaceAll("_", " ")})</option>)}</select>{!locationsLoading && locations.length === 0 && <p className="mt-2 text-xs text-amber-700">No inventory locations found for this grower.</p>}</div>
        <div><label htmlFor="quantity" className="mb-2 block text-sm font-medium">Quantity to Receive</label><input id="quantity" type="number" min="1" max={selected.remaining_quantity} step="1" required className={fieldClass} value={quantity} onChange={(e) => setQuantity(e.target.value)}/></div>
        {receiveError && <p role="alert" className="text-sm text-red-700">{receiveError}</p>}
        <button type="submit" disabled={saving || locationsLoading || !locations.length} className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white hover:bg-[#456653] disabled:opacity-50">{saving ? "Receiving..." : "Receive into Inventory"}</button></form>
      </div></div>}
    </main>
  );
}
