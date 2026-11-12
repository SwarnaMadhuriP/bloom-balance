"use client";

import Link from "next/link";
import { motion } from "motion/react";

const destinations = [
  {
    name: "Grow",
    href: "/grow",
    description: "Manage your flower farm",
    left: "14%",
    top: "56%",
  },
  {
    name: "Trade",
    href: "/florist/marketplace",
    description: "Explore the flower marketplace",
    left: "39%",
    top: "54%",
  },
  {
    name: "Rescue",
    href: "/surplus",
    description: "Give flowers a second chance",
    left: "64%",
    top: "56%",
  },
  {
    name: "BloomTrace",
    href: "/bloomtrace",
    description: "Discover your sustainability impact",
    left: "86%",
    top: "43%",
  },
];

export default function Village() {
  return (
    <section className="relative w-full overflow-hidden">
      <div
        className="relative mx-auto w-full max-w-[1800px]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <img
          src="/images/bloom-village.png"
          alt="Whimsical BloomBalance flower village"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {destinations.map((destination) => (
          <motion.div
            key={destination.name}
            className="absolute z-10"
            style={{
              left: destination.left,
              top: destination.top,
              transform: "translate(-50%, -50%)",
            }}
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 0.96 }}
          >
            <Link
              href={destination.href}
              aria-label={`${destination.name}: ${destination.description}`}
              className="group block rounded-full border border-white/70 bg-[#344e41]/90 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-[#243b30] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#344e41]"
            >
              {destination.name}
              <span className="ml-2">↗</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
