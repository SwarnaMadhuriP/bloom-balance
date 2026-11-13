import Image from "next/image";
import Link from "next/link";

const greenhouseAreas = [
  {
    name: "My Flowers",
    href: "/grow/flowers",
    left: "10%",
    top: "48%",
    width: "16%",
    height: "16%",
  },
  {
    name: "Inventory",
    href: "/grow/inventory",
    left: "40%",
    top: "58%",
    width: "18%",
    height: "14%",
  },
  {
    name: "Orders",
    href: "/grow/orders",
    left: "76%",
    top: "48%",
    width: "16%",
    height: "15%",
  },
];

const navigationAreas = [
  {
    name: "BloomBalance Home",
    href: "/",
    left: "11%",
    width: "16%",
  },
  {
    name: "Explore Village",
    href: "/#home",
    left: "34%",
    width: "9%",
  },
  {
    name: "How It Works",
    href: "/#how-it-works",
    left: "45%",
    width: "9%",
  },
  {
    name: "Our Impact",
    href: "/#our-impact",
    left: "55%",
    width: "8%",
  },
  {
    name: "About",
    href: "/#about",
    left: "65%",
    width: "6%",
  },
];

export default function GrowPage() {
  return (
    <main className="min-h-screen bg-[#FFF9EE]">
      <div className="relative w-full">
        <Image
          src="/images/grow-greenhouse.png"
          alt="A whimsical flower greenhouse with illustrated navigation signs for My Flowers, Inventory, and Orders"
          width={1648}
          height={928}
          priority
          className="h-auto w-full"
        />

        {/* Navigation hotspots over image-embedded labels */}
        {navigationAreas.map((area) => (
          <Link
            key={area.name}
            href={area.href}
            aria-label={area.name}
            title={area.name}
            className="absolute z-20 h-[7%] rounded-md focus-visible:outline-4 focus-visible:outline-[#344E41]"
            style={{
              left: area.left,
              top: "1%",
              width: area.width,
            }}
          />
        ))}

        {/* Greenhouse wooden signboards */}
        {greenhouseAreas.map((area) => (
          <Link
            key={area.name}
            href={area.href}
            aria-label={`Explore ${area.name}`}
            title={`Explore ${area.name}`}
            className="
              absolute z-10 cursor-pointer rounded-xl
              transition-colors duration-300
              hover:bg-white/10
              focus-visible:bg-white/15
              focus-visible:outline-4
              focus-visible:outline-[#344E41]
            "
            style={{
              left: area.left,
              top: area.top,
              width: area.width,
              height: area.height,
            }}
          />
        ))}

        {/* Secondary greenhouse navigation */}
        <div
          className="
            absolute bottom-[7%] right-[4%] z-20
            flex flex-col items-end gap-2
            sm:flex-row sm:items-center sm:gap-3
          "
        >
          <Link
            href="/grow/pending-harvests"
            className="
              rounded-full border border-[#C7D5B8]
              bg-[#FFF9EE]/95 px-4 py-2
              font-serif text-xs font-semibold text-[#476B48]
              shadow-md backdrop-blur-sm
              transition-all duration-300
              hover:-translate-y-1 hover:bg-white hover:shadow-lg
              focus-visible:outline-4
              focus-visible:outline-[#344E41]
              sm:px-5 sm:py-3 sm:text-sm
            "
          >
            🌱 Pending Harvests →
          </Link>

          <Link
            href="/grow/bloomtrace"
            className="
              rounded-full border border-[#C7D5B8]
              bg-[#FFF9EE]/95 px-4 py-2
              font-serif text-xs font-semibold text-[#476B48]
              shadow-md backdrop-blur-sm
              transition-all duration-300
              hover:-translate-y-1 hover:bg-white hover:shadow-lg
              focus-visible:outline-4
              focus-visible:outline-[#344E41]
              sm:px-5 sm:py-3 sm:text-sm
            "
          >
            🌿 BloomTrace Analytics →
          </Link>
        </div>
      </div>
    </main>
  );
}
