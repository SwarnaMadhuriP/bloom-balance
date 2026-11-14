import Image from "next/image";
import Link from "next/link";

// Clickable wooden signboards
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

// Navigation labels embedded in the illustration
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

const secondaryLinks = [
  {
    name: "Pending Harvests",
    href: "/grow/pending-harvests",
  },
  {
    name: "BloomTrace Analytics",
    href: "/grow/bloomtrace",
  },
];

export default function GrowPage() {
  return (
    <main className="min-h-screen bg-[#FFF9EE]">
      <div className="relative w-full">
        {/* Greenhouse illustration */}
        <Image
          src="/images/grow-greenhouse.png"
          alt="The Grower's Greenhouse, featuring flowers, inventory crates, and an orders desk"
          width={1648}
          height={928}
          priority
          className="h-auto w-full"
        />

        {/* Top navigation hotspots */}
        {navigationAreas.map((area) => (
          <Link
            key={area.name}
            href={area.href}
            aria-label={area.name}
            title={area.name}
            className="
              absolute top-[1%] z-20 h-[7%]
              cursor-pointer rounded-md
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#344E41]
            "
            style={{
              left: area.left,
              width: area.width,
            }}
          />
        ))}

        {/* Interactive wooden signboards */}
        {greenhouseAreas.map((area) => (
          <Link
            key={area.name}
            href={area.href}
            aria-label={`Explore ${area.name}`}
            title={`Explore ${area.name}`}
            className="
              absolute z-10 cursor-pointer
              rounded-xl
              transition-colors duration-300
              hover:bg-white/15
              focus-visible:bg-white/20
              focus-visible:outline-2
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

        {/* Secondary navigation */}
        <nav
          aria-label="More grower tools"
          className="
            absolute bottom-[6%] right-[4%] z-30
            flex flex-wrap justify-end gap-3
          "
        >
          {secondaryLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="
                rounded-full
                border border-[#C7D5B8]
                bg-[#FFF9EE]/95
                px-4 py-2
                font-serif text-xs font-semibold
                text-[#476B48]
                shadow-md
                backdrop-blur-sm
                transition-all duration-300
                hover:-translate-y-1
                hover:border-[#78916B]
                hover:bg-white
                hover:shadow-lg
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#344E41]
                sm:px-5 sm:py-2.5 sm:text-sm
              "
            >
              {link.name} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
