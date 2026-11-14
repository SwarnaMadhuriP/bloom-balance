"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  ShoppingBasket,
  Package,
  Flower2,
  Leaf,
  Sprout,
  X,
  Minus,
  Plus,
  Trash2,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

type MarketplaceFlower = {
  batch_id: string;
  flower_id: string;
  name: string;
  variety: string;
  color: string | null;
  unit: string;
  grower_organization_id: string;
  grower_name: string;
  available_quantity: number;
  harvest_date: string;
  expiry_date: string;
  price_per_unit: string;
};

type MarketplaceResponse = {
  flowers: MarketplaceFlower[];
  total: number;
  limit: number;
  offset: number;
};

type CartItem = {
  flower: MarketplaceFlower;
  quantity: number;
};

type OrderResponse = {
  id: string;
  status: string;
  total_amount: string;
};

const PAGE_SIZE = 12;

const floristId = process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID;

// Watercolor artwork stored in public/images/flowers.
function getFlowerImage(name: string): string | null {
  const flower = name.toLowerCase();

  if (flower.includes("rose")) {
    return "/images/flowers/rose.png";
  }

  if (flower.includes("lavender")) {
    return "/images/flowers/lavender.png";
  }

  return null;
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function daysUntilExpiry(value: string) {
  const today = new Date();

  const todayUTC = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const expiry = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  return Math.round((expiry.getTime() - todayUTC) / 86400000);
}

function freshnessInfo(expiryDate: string) {
  const days = daysUntilExpiry(expiryDate);

  if (days < 0) {
    return {
      label: "Expired",
      style: "bg-rose-100 text-rose-800",
    };
  }

  if (days <= 2) {
    return {
      label: "Expiring Soon",
      style: "bg-amber-100 text-amber-800",
    };
  }

  if (days <= 5) {
    return {
      label: "Fresh",
      style: "bg-lime-100 text-lime-800",
    };
  }

  return {
    label: "Very Fresh",
    style: "bg-emerald-100 text-emerald-800",
  };
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item: { msg?: string }) => item.msg || "Invalid order details")
        .join(", ");
    }

    return error.message || "Unable to complete request.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function flowerPalette(name: string, color: string | null) {
  const text = `${name} ${color ?? ""}`.toLowerCase();

  if (text.includes("rose") || text.includes("red")) {
    return {
      background: "from-[#F8E6E3] to-[#F6F0E8]",
      foreground: "text-[#C7797B]",
    };
  }

  if (text.includes("lavender") || text.includes("purple")) {
    return {
      background: "from-[#EEE8F5] to-[#F4F1E8]",
      foreground: "text-[#9885BA]",
    };
  }

  if (text.includes("sunflower") || text.includes("yellow")) {
    return {
      background: "from-[#FAEECF] to-[#F6F2E6]",
      foreground: "text-[#D1A84E]",
    };
  }

  if (text.includes("pink")) {
    return {
      background: "from-[#F9E8EF] to-[#F7F1E9]",
      foreground: "text-[#D59AAE]",
    };
  }

  return {
    background: "from-[#EAF1E4] to-[#F8F4EA]",
    foreground: "text-[#8DA58A]",
  };
}

export default function FloristMarketplacePage() {
  const [flowers, setFlowers] = useState<MarketplaceFlower[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState("");

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");

  const loadFlowers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<MarketplaceResponse>(
        "/marketplace/flowers",
        {
          params: {
            search: search || undefined,
            color: color || undefined,
            min_quantity: 1,
            limit: PAGE_SIZE,
            offset,
          },
        }
      );

      setFlowers(response.data.flowers);
      setTotal(response.data.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, color, offset]);

  useEffect(() => {
    void loadFlowers();
  }, [loadFlowers]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  function handleColorChange(value: string) {
    setColor(value);
    setOffset(0);
  }

  function addToCart(flower: MarketplaceFlower) {
    setCartError("");
    setCheckoutError("");
    setCheckoutSuccess("");

    if (daysUntilExpiry(flower.expiry_date) < 0) {
      setCartError("This flower batch has expired.");
      setCartOpen(true);
      return;
    }

    if (
      cart.length > 0 &&
      cart[0].flower.grower_organization_id !== flower.grower_organization_id
    ) {
      setCartError(
        "Your basket contains flowers from another grower. " +
          "Complete that order or clear the basket first."
      );
      setCartOpen(true);
      return;
    }

    const otherBatch = cart.find(
      (item) =>
        item.flower.flower_id === flower.flower_id &&
        item.flower.batch_id !== flower.batch_id
    );

    if (otherBatch) {
      setCartError(
        `You already selected another batch of ${flower.name}. ` +
          "Only one batch per flower type is supported."
      );
      setCartOpen(true);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.flower.batch_id === flower.batch_id
      );

      if (existing) {
        return current.map((item) =>
          item.flower.batch_id === flower.batch_id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  item.flower.available_quantity
                ),
              }
            : item
        );
      }

      return [...current, { flower, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function updateQuantity(batchId: string, quantity: number) {
    setCartError("");
    setCheckoutError("");

    setCart((current) =>
      current.map((item) =>
        item.flower.batch_id === batchId
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(quantity, item.flower.available_quantity)
              ),
            }
          : item
      )
    );
  }

  function removeFromCart(batchId: string) {
    setCartError("");
    setCheckoutError("");

    setCart((current) =>
      current.filter((item) => item.flower.batch_id !== batchId)
    );
  }

  function clearCart() {
    setCart([]);
    setCartError("");
    setCheckoutError("");
  }

  async function placeOrder() {
    if (cart.length === 0 || checkoutLoading) return;

    setCheckoutLoading(true);
    setCheckoutError("");
    setCheckoutSuccess("");
    setCartError("");

    try {
      if (!floristId) {
        throw new Error("Florist organization is not configured.");
      }

      const sellerId = cart[0].flower.grower_organization_id;

      if (floristId === sellerId) {
        throw new Error("Buyer and seller cannot be the same organization.");
      }

      if (
        cart.some((item) => item.flower.grower_organization_id !== sellerId)
      ) {
        throw new Error("All flowers must come from the same grower.");
      }

      const flowerIds = cart.map((item) => item.flower.flower_id);

      if (new Set(flowerIds).size !== flowerIds.length) {
        throw new Error("Only one batch per flower type is supported.");
      }

      // Availability check only.
      // Inventory is not reserved at this stage.
      const availability = await api.get<MarketplaceResponse>(
        "/marketplace/flowers",
        {
          params: {
            grower_id: sellerId,
            limit: 100,
            offset: 0,
          },
        }
      );

      if (availability.data.total > 100) {
        throw new Error(
          "Too many batches to verify. Please contact the grower."
        );
      }

      for (const item of cart) {
        const currentBatch = availability.data.flowers.find(
          (flower) => flower.batch_id === item.flower.batch_id
        );

        if (!currentBatch) {
          throw new Error(`${item.flower.name} is no longer available.`);
        }

        if (daysUntilExpiry(currentBatch.expiry_date) < 0) {
          throw new Error(`${item.flower.name} has expired.`);
        }

        if (currentBatch.available_quantity < item.quantity) {
          throw new Error(
            `Only ${currentBatch.available_quantity} ` +
              `${item.flower.unit} of ${item.flower.name} remain.`
          );
        }

        if (
          Number(currentBatch.price_per_unit) !==
          Number(item.flower.price_per_unit)
        ) {
          throw new Error(
            `The price of ${item.flower.name} has changed. ` +
              "Please refresh your basket."
          );
        }
      }

      const payload = {
        buyer_organization_id: floristId,
        seller_organization_id: sellerId,
        items: cart.map((item) => ({
          flower_id: item.flower.flower_id,
          quantity: item.quantity,
          unit_price: item.flower.price_per_unit,
        })),
      };

      const response = await api.post<OrderResponse>("/orders", payload);

      setCheckoutSuccess(
        `Order ${response.data.id} placed successfully! ` +
          `Status: ${response.data.status}`
      );

      setCart([]);
      await loadFlowers();
    } catch (err) {
      setCheckoutError(getErrorMessage(err));
    } finally {
      setCheckoutLoading(false);
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.flower.price_per_unit),
    0
  );

  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <main
      className="relative min-h-screen bg-[#FAF7F0] bg-cover bg-center bg-fixed px-5 py-10 text-[#344E41] md:px-12"
      style={{
        backgroundImage: "url('/images/inventory-background.png')",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#FFF9EF]/15" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back to BloomBalance
          </Link>

          <div className="flex items-center gap-3">
            {floristId && <NotificationBell organizationId={floristId} />}

            <Link
              href="/florist/orders"
              className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-white"
            >
              <Package size={16} />
              My Orders
            </Link>
          </div>
        </div>

        {/* Heading */}
        <header className="mb-10 mt-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#718E6D]">
            BloomBalance · Florist Market
          </p>

          <h1 className="font-serif text-4xl md:text-6xl">The Flower Market</h1>

          <p className="mx-auto mt-4 max-w-xl text-[#73836F]">
            A little marketplace full of beautiful blooms, thoughtfully grown
            and freshly gathered.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 text-[#91AD83]">
            <span className="h-px w-12 bg-[#A8BE9B]" />
            <Leaf size={17} />
            <span className="h-px w-12 bg-[#A8BE9B]" />
          </div>
        </header>

        {/* Search */}
        <section className="mb-8 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-md backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row">
            <form onSubmit={handleSearch} className="flex min-w-0 flex-1 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8DA58A]"
                />

                <input
                  aria-label="Search flowers"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search roses, lavender, tulips..."
                  className="w-full rounded-full border border-[#D6E1D1] bg-[#FFFCF7] py-3 pl-11 pr-4 text-sm outline-none focus:border-[#8DA58A]"
                />
              </div>

              <button
                type="submit"
                className="rounded-full bg-[#344E41] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#456653]"
              >
                Search
              </button>
            </form>

            <select
              aria-label="Filter by color"
              value={color}
              onChange={(event) => handleColorChange(event.target.value)}
              className="rounded-full border border-[#D6E1D1] bg-[#FFFCF7] px-5 py-3 text-sm outline-none focus:border-[#8DA58A]"
            >
              <option value="">All Colors</option>
              <option value="Red">Red</option>
              <option value="Pink">Pink</option>
              <option value="Purple">Purple</option>
              <option value="White">White</option>
              <option value="Yellow">Yellow</option>
              <option value="Orange">Orange</option>
            </select>
          </div>
        </section>

        {/* Marketplace summary */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#60765D]">
            {total} flower {total === 1 ? "batch" : "batches"} available
          </p>

          <button
            type="button"
            onClick={() => void loadFlowers()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-2.5 text-sm shadow-sm transition-colors hover:bg-white disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh Flowers
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {checkoutSuccess && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-[#B8D5B0] bg-[#F0F8EC]/95 p-5 text-[#456653]"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={19} />
              Your order has been placed!
            </div>

            <p className="mt-2 break-words text-sm">{checkoutSuccess}</p>

            <p className="mt-2 text-sm">
              The grower can now review your order.
            </p>

            <Link
              href="/florist/orders"
              className="mt-3 inline-block text-sm font-medium underline"
            >
              View My Orders
            </Link>
          </div>
        )}

        {/* Flower cards */}
        {loading ? (
          <div className="rounded-2xl bg-white/85 py-20 text-center text-[#73836F]">
            Gathering fresh blooms from the gardens...
          </div>
        ) : flowers.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 px-6 py-16 text-center shadow-md">
            <Flower2
              size={42}
              strokeWidth={1.5}
              className="mx-auto text-[#8DA58A]"
            />

            <h2 className="mt-4 font-serif text-2xl">No flowers found</h2>

            <p className="mt-3 text-sm text-[#73836F]">
              Try another flower name or color.
            </p>
          </div>
        ) : (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {flowers.map((flower) => {
              const freshness = freshnessInfo(flower.expiry_date);

              const palette = flowerPalette(flower.name, flower.color);

              const imageSrc = getFlowerImage(flower.name);

              const inCart = cart.find(
                (item) => item.flower.batch_id === flower.batch_id
              );

              const differentGrower =
                cart.length > 0 &&
                cart[0].flower.grower_organization_id !==
                  flower.grower_organization_id;

              const differentBatch = cart.some(
                (item) =>
                  item.flower.flower_id === flower.flower_id &&
                  item.flower.batch_id !== flower.batch_id
              );

              const expired = daysUntilExpiry(flower.expiry_date) < 0;

              const cannotAdd =
                expired ||
                differentGrower ||
                differentBatch ||
                checkoutLoading ||
                (inCart?.quantity ?? 0) >= flower.available_quantity;

              return (
                <article
                  key={flower.batch_id}
                  className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Watercolor illustration */}
                  <div
                    className={`relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-b ${palette.background}`}
                  >
                    <div className="absolute left-5 top-4 flex items-center gap-1 text-xs text-[#718E6D]">
                      <Sprout size={14} />
                      Garden grown
                    </div>

                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={`${flower.name} watercolor illustration`}
                        width={210}
                        height={190}
                        className="h-44 w-48 object-contain transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <Flower2
                        size={88}
                        strokeWidth={1.05}
                        className={palette.foreground}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="p-6">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-2xl">{flower.name}</h2>

                        <p className="mt-1 text-sm text-[#73836F]">
                          {flower.variety}
                          {flower.color ? ` · ${flower.color}` : ""}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${freshness.style}`}
                      >
                        {freshness.label}
                      </span>
                    </div>

                    <p className="mb-5 text-sm text-[#73836F]">
                      Grown with care by{" "}
                      <span className="font-medium text-[#456653]">
                        {flower.grower_name}
                      </span>
                    </p>

                    <div className="space-y-3 border-t border-[#E5EDDF] pt-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#73836F]">Available</span>

                        <span className="font-semibold">
                          {flower.available_quantity.toLocaleString("en-IN")}{" "}
                          {flower.unit}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-[#73836F]">Harvested</span>

                        <span>{formatDate(flower.harvest_date)}</span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-[#73836F]">Best before</span>

                        <span>{formatDate(flower.expiry_date)}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-[#E5EDDF] pt-5">
                      <div>
                        <p className="font-serif text-2xl">
                          {formatMoney(Number(flower.price_per_unit))}
                        </p>

                        <p className="text-xs text-[#73836F]">
                          per {flower.unit}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(flower)}
                        disabled={cannotAdd}
                        className="inline-flex items-center gap-2 rounded-full bg-[#344E41] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#456653] disabled:cursor-not-allowed disabled:bg-[#C7D2C5]"
                      >
                        <ShoppingBasket size={16} />

                        {expired
                          ? "Expired"
                          : inCart
                          ? `In Basket (${inCart.quantity})`
                          : "Add to Basket"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() =>
                setOffset((current) => Math.max(0, current - PAGE_SIZE))
              }
              className="rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-2.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm">
              Page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
              {Math.ceil(total / PAGE_SIZE)}
            </span>

            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              className="rounded-full border border-[#B8C8B2] bg-white/90 px-5 py-2.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        <p className="mt-12 text-center font-serif text-sm italic text-[#73836F]">
          Fresh from the garden, thoughtfully shared.
        </p>
      </div>

      {/* Floating basket */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full bg-[#344E41] px-6 py-4 font-medium text-white shadow-xl transition-colors hover:bg-[#456653]"
      >
        <ShoppingBasket size={20} />
        Basket ({cartCount})
      </button>

      {/* Basket drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#203629]/45">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Flower Basket"
            className="flex h-full w-full max-w-md flex-col bg-[#FFFCF6] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5EDDF] pb-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#8DA58A]">
                  Your Flower Selection
                </p>

                <h2 className="mt-1 font-serif text-3xl">Flower Basket</h2>
              </div>

              <button
                type="button"
                aria-label="Close basket"
                onClick={() => setCartOpen(false)}
                className="rounded-full p-2 hover:bg-[#E5EDDF]"
              >
                <X size={21} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-6">
              {cart.length === 0 ? (
                <div className="py-12 text-center">
                  <Flower2 size={40} className="mx-auto text-[#8DA58A]" />

                  <p className="mt-4 text-sm text-[#73836F]">
                    Your basket is waiting for its first bloom.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.flower.batch_id}
                    className="rounded-2xl border border-[#E5EDDF] bg-white p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl">
                          {item.flower.name}
                        </h3>

                        <p className="mt-1 text-sm text-[#73836F]">
                          {item.flower.variety}
                        </p>

                        <p className="mt-1 text-xs text-[#73836F]">
                          {item.flower.grower_name}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={checkoutLoading}
                        onClick={() => removeFromCart(item.flower.batch_id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        aria-label={`Remove ${item.flower.name}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.flower.name} quantity`}
                          disabled={checkoutLoading || item.quantity <= 1}
                          onClick={() =>
                            updateQuantity(
                              item.flower.batch_id,
                              item.quantity - 1
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6E1D1] disabled:opacity-40"
                        >
                          <Minus size={15} />
                        </button>

                        <span className="min-w-6 text-center tabular-nums">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          aria-label={`Increase ${item.flower.name} quantity`}
                          disabled={
                            checkoutLoading ||
                            item.quantity >= item.flower.available_quantity
                          }
                          onClick={() =>
                            updateQuantity(
                              item.flower.batch_id,
                              item.quantity + 1
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6E1D1] disabled:opacity-40"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <p className="font-semibold tabular-nums">
                        {formatMoney(
                          item.quantity * Number(item.flower.price_per_unit)
                        )}
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-[#73836F]">
                      {item.quantity} {item.flower.unit} ×{" "}
                      {formatMoney(Number(item.flower.price_per_unit))}
                    </p>

                    <p className="mt-2 flex items-center gap-1 text-xs text-[#879485]">
                      <CalendarDays size={13} />
                      Best before {formatDate(item.flower.expiry_date)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#E5EDDF] pt-5">
              {cartError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {cartError}
                </p>
              )}

              {checkoutError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {checkoutError}
                </p>
              )}

              {checkoutSuccess && (
                <p
                  role="status"
                  className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800"
                >
                  {checkoutSuccess}
                </p>
              )}

              <div className="mb-5 flex items-center justify-between">
                <span className="font-medium">Basket Total</span>

                <span className="font-serif text-2xl">
                  {formatMoney(cartTotal)}
                </span>
              </div>

              <p className="mb-4 text-xs leading-relaxed text-[#73836F]">
                Orders are submitted for grower approval. Inventory is reserved
                only when the grower accepts the order.
              </p>

              <button
                type="button"
                onClick={() => void placeOrder()}
                disabled={cart.length === 0 || checkoutLoading}
                className="w-full rounded-full bg-[#344E41] py-3 font-medium text-white transition-colors hover:bg-[#456653] disabled:opacity-40"
              >
                {checkoutLoading ? "Placing Order..." : "Place Order"}
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={clearCart}
                  className="mt-3 w-full py-2 text-sm text-[#73836F] hover:underline disabled:opacity-40"
                >
                  Clear Basket
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
