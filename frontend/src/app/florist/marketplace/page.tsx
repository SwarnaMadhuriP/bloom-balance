"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
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

function getDaysUntilExpiry(expiryDate: string) {
  const today = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  return Math.round((expiry.getTime() - today.getTime()) / 86400000);
}

function getFreshness(expiryDate: string) {
  const days = getDaysUntilExpiry(expiryDate);

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

function getFlowerEmoji(name: string) {
  const value = name.toLowerCase();

  if (value.includes("rose")) return "🌹";
  if (value.includes("lavender")) return "🪻";
  if (value.includes("sunflower")) return "🌻";
  if (value.includes("tulip")) return "🌷";
  if (value.includes("hibiscus")) return "🌺";

  return "🌸";
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => item.msg || "Invalid order details")
        .join(", ");
    }

    return error.message || "Unable to complete request.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const handleColorChange = (value: string) => {
    setColor(value);
    setOffset(0);
  };

  const addToCart = (flower: MarketplaceFlower) => {
    setCartError("");
    setCheckoutError("");
    setCheckoutSuccess("");

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
  };

  const updateQuantity = (batchId: string, quantity: number) => {
    setCheckoutError("");
    setCartError("");

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
  };

  const removeFromCart = (batchId: string) => {
    setCheckoutError("");
    setCartError("");

    setCart((current) =>
      current.filter((item) => item.flower.batch_id !== batchId)
    );
  };

  const clearCart = () => {
    setCart([]);
    setCartError("");
    setCheckoutError("");
  };

  const placeOrder = async () => {
    if (cart.length === 0 || checkoutLoading) return;

    setCheckoutLoading(true);
    setCheckoutError("");
    setCheckoutSuccess("");
    setCartError("");

    try {
      const buyerId = process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID;

      if (!buyerId) {
        throw new Error("Florist organization is not configured.");
      }

      const sellerId = cart[0].flower.grower_organization_id;

      if (buyerId === sellerId) {
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

      // Recheck marketplace availability before ordering.
      // This does not reserve inventory.
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

        if (currentBatch.available_quantity < item.quantity) {
          throw new Error(
            `Only ${currentBatch.available_quantity} ` +
              `${item.flower.unit} of ${item.flower.name} remain.`
          );
        }

        if (currentBatch.price_per_unit !== item.flower.price_per_unit) {
          throw new Error(
            `The price of ${item.flower.name} has changed. ` +
              "Please refresh your basket."
          );
        }
      }

      const payload = {
        buyer_organization_id: buyerId,
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
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.flower.price_per_unit),
    0
  );

  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed px-4 py-10 text-[#42513e] sm:px-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,250,239,0.35),rgba(255,250,239,0.60)),url('/images/inventory-background.png')",
      }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-[#687c60] hover:underline"
          >
            ← Back to BloomBalance
          </Link>

          <div className="flex items-center gap-3">
            {process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID && (
              <NotificationBell
                organizationId={process.env.NEXT_PUBLIC_FLORIST_ORGANIZATION_ID}
              />
            )}

            <Link
              href="/florist/orders"
              className="rounded-full bg-white/80 px-5 py-2 text-sm font-medium text-[#526a4c] hover:bg-white"
            >
              📦 My Orders
            </Link>
          </div>
        </div>

        <header className="mb-10 mt-8 text-center">
          <p className="mb-3 text-sm tracking-[0.2em] text-[#879a77]">
            BLOOMBALANCE · FLORIST MARKET
          </p>

          <h1 className="font-serif text-4xl text-[#50664c] sm:text-6xl">
            The Flower Market
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[#73846d]">
            A little marketplace full of beautiful blooms, thoughtfully grown
            and freshly gathered.
          </p>
        </header>

        {/* Search and filters */}
        <section className="mb-8 rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search roses, lavender, tulips..."
                className="min-w-0 flex-1 rounded-full border border-[#dce5d6] bg-[#fffdf8] px-5 py-3 text-sm outline-none focus:border-[#8fa98b]"
              />

              <button
                type="submit"
                className="rounded-full bg-[#698567] px-6 py-3 text-sm font-medium text-white hover:bg-[#536e51]"
              >
                Search
              </button>
            </form>

            <select
              value={color}
              onChange={(event) => handleColorChange(event.target.value)}
              className="rounded-full border border-[#dce5d6] bg-[#fffdf8] px-5 py-3 text-sm text-[#526a4c] outline-none"
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
          <p className="text-sm font-medium text-[#647b60]">
            {total} flower batch
            {total === 1 ? "" : "es"} available
          </p>

          <button
            type="button"
            onClick={() => void loadFlowers()}
            className="rounded-full border border-[#cad8c5] bg-white/80 px-5 py-2 text-sm text-[#526a4c] hover:bg-white"
          >
            Refresh Flowers
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {checkoutSuccess && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800"
          >
            <p className="font-semibold">🌸 Your order has been planted!</p>
            <p className="mt-2 break-words text-sm">{checkoutSuccess}</p>
            <p className="mt-2 text-sm">
              The grower can now review your order.
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[#73846d]">
            Gathering fresh blooms from the gardens...
          </div>
        ) : flowers.length === 0 ? (
          <div className="rounded-3xl border border-white/80 bg-white/80 px-6 py-20 text-center shadow-sm">
            <div className="mb-4 text-5xl">🌷</div>

            <h2 className="font-serif text-2xl text-[#526a4c]">
              No flowers found
            </h2>

            <p className="mt-3 text-[#819078]">
              Try another flower name or color.
            </p>
          </div>
        ) : (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {flowers.map((flower) => {
              const freshness = getFreshness(flower.expiry_date);

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

              const cannotAdd =
                differentGrower ||
                differentBatch ||
                checkoutLoading ||
                (inCart?.quantity ?? 0) >= flower.available_quantity;

              return (
                <article
                  key={flower.batch_id}
                  className="overflow-hidden rounded-3xl border border-white/80 bg-white/85 shadow-sm backdrop-blur-md transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-44 items-center justify-center bg-gradient-to-b from-[#f6eee8] to-[#f1f3e8]">
                    <span className="text-7xl" aria-hidden="true">
                      {getFlowerEmoji(flower.name)}
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-2xl text-[#50664c]">
                          {flower.name}
                        </h2>

                        <p className="mt-1 text-sm text-[#819078]">
                          {flower.variety}
                          {flower.color ? ` · ${flower.color}` : ""}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${freshness.style}`}
                      >
                        {freshness.label}
                      </span>
                    </div>

                    <p className="mb-5 text-sm text-[#819078]">
                      Grown with care by{" "}
                      <span className="font-medium text-[#526a4c]">
                        {flower.grower_name}
                      </span>
                    </p>

                    <div className="space-y-3 border-t border-[#e7e9df] pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#819078]">Available</span>

                        <span className="font-semibold text-[#526a4c]">
                          {flower.available_quantity} {flower.unit}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-[#819078]">Harvested</span>
                        <span>{flower.harvest_date}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-[#819078]">Best before</span>
                        <span>{flower.expiry_date}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-[#e7e9df] pt-5">
                      <div>
                        <p className="font-serif text-2xl text-[#526a4c]">
                          {Number(flower.price_per_unit).toFixed(2)}
                        </p>

                        <p className="text-xs text-[#819078]">
                          per {flower.unit}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(flower)}
                        disabled={cannotAdd}
                        className="rounded-full bg-[#698567] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#536e51] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {inCart
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
              className="rounded-full border border-[#cad8c5] bg-white/85 px-5 py-2 text-sm text-[#526a4c] disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-[#647b60]">
              Page {Math.floor(offset / PAGE_SIZE) + 1}
              {" of "}
              {Math.ceil(total / PAGE_SIZE)}
            </span>

            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              className="rounded-full border border-[#cad8c5] bg-white/85 px-5 py-2 text-sm text-[#526a4c] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Floating basket button */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-8 right-8 z-40 rounded-full bg-[#698567] px-6 py-4 font-medium text-white shadow-xl transition hover:bg-[#536e51]"
      >
        🧺 Basket ({cartCount})
      </button>

      {/* Basket panel */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Flower Basket"
            className="flex h-full w-full max-w-md flex-col bg-[#fffdf7] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#e7e9df] pb-5">
              <div>
                <p className="text-xs tracking-widest text-[#819078]">
                  YOUR FLOWER SELECTION
                </p>

                <h2 className="mt-1 font-serif text-3xl text-[#50664c]">
                  Flower Basket 🧺
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="text-2xl text-[#819078]"
                aria-label="Close basket"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto py-6">
              {cart.length === 0 ? (
                <p className="py-12 text-center text-[#819078]">
                  Your basket is waiting for its first bloom.
                </p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.flower.batch_id}
                    className="rounded-2xl border border-[#e7e9df] bg-white p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl text-[#50664c]">
                          {getFlowerEmoji(item.flower.name)} {item.flower.name}
                        </h3>

                        <p className="mt-1 text-sm text-[#819078]">
                          {item.flower.variety}
                        </p>

                        <p className="mt-1 text-xs text-[#819078]">
                          {item.flower.grower_name}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={checkoutLoading}
                        onClick={() => removeFromCart(item.flower.batch_id)}
                        className="text-sm text-rose-600 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={checkoutLoading || item.quantity <= 1}
                          onClick={() =>
                            updateQuantity(
                              item.flower.batch_id,
                              item.quantity - 1
                            )
                          }
                          className="h-8 w-8 rounded-full border border-[#dce5d6] disabled:opacity-40"
                        >
                          −
                        </button>

                        <span className="min-w-5 text-center">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
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
                          className="h-8 w-8 rounded-full border border-[#dce5d6] disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <p className="font-semibold text-[#526a4c]">
                        {(
                          item.quantity * Number(item.flower.price_per_unit)
                        ).toFixed(2)}
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-[#819078]">
                      {item.quantity} {item.flower.unit} ×{" "}
                      {Number(item.flower.price_per_unit).toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#e7e9df] pt-5">
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

              <div className="mb-5 flex justify-between">
                <span className="font-medium">Basket Total</span>

                <span className="font-serif text-2xl text-[#50664c]">
                  {cartTotal.toFixed(2)}
                </span>
              </div>

              <p className="mb-4 text-xs text-[#819078]">
                Orders are submitted for grower approval. Inventory is reserved
                only when the grower accepts the order.
              </p>

              <button
                type="button"
                onClick={placeOrder}
                disabled={cart.length === 0 || checkoutLoading}
                className="w-full rounded-full bg-[#698567] py-3 font-medium text-white transition hover:bg-[#536e51] disabled:opacity-40"
              >
                {checkoutLoading ? "Placing Order..." : "Place Order 🌸"}
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={clearCart}
                  className="mt-3 w-full py-2 text-sm text-[#819078] hover:underline disabled:opacity-40"
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
