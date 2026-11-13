import Image from "next/image";
import Link from "next/link";

const greenhouseAreas = [
  {
    name: "My Flowers",
    href: "/grow/flowers",
    left: "10%",
    top: "46%",
    width: "18%",
    height: "18%",
  },
  {
    name: "Inventory",
    href: "/grow/inventory",
    left: "40%",
    top: "53%",
    width: "20%",
    height: "18%",
  },
  {
    name: "Orders",
    href: "/grow/orders",
    left: "76%",
    top: "45%",
    width: "17%",
    height: "18%",
  },
];

export default function GrowPage() {
  return (
    <main className="min-h-screen bg-cream">
      <div className="relative w-full">
        <Image
          src="/images/grow-greenhouse.png"
          alt="The Grower's Greenhouse"
          width={1648}
          height={928}
          priority
          className="h-auto w-full"
        />

        {greenhouseAreas.map((area) => (
          <Link
            key={area.name}
            href={area.href}
            aria-label={`Explore ${area.name}`}
            title={`Explore ${area.name}`}
            className="absolute z-10 cursor-pointer rounded-xl transition-colors hover:bg-white/15 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#344E41]"
            style={{
              left: area.left,
              top: area.top,
              width: area.width,
              height: area.height,
            }}
          />
        ))}

        {/* BloomTrace Analytics */}
        <Link
          href="/grow/bloomtrace"
          aria-label="Open BloomTrace Analytics"
          className="absolute bottom-[8%] right-[5%] z-20
    rounded-full border border-[#d8dfcf]
    bg-[#fffaf0]/95 px-5 py-3
    font-serif text-sm font-semibold text-[#40583a]
    shadow-lg transition-all duration-300
    hover:-translate-y-1 hover:bg-white
    hover:shadow-xl
    focus-visible:outline-4
    focus-visible:outline-[#344E41]
    sm:text-base"
        >
          🌿 BloomTrace Analytics →
        </Link>

        <Link
          href="/"
          aria-label="Back to BloomBalance village"
          className="absolute left-[33%] top-[1%] h-[7%] w-[12%] rounded-lg focus-visible:outline-4 focus-visible:outline-[#344E41]"
        />
      </div>
    </main>
  );
}
