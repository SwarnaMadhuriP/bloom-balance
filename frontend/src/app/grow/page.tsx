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

        <Link
          href="/"
          aria-label="Back to BloomBalance village"
          className="absolute left-[33%] top-[1%] h-[7%] w-[12%] rounded-lg focus-visible:outline-4 focus-visible:outline-[#344E41]"
        />
      </div>
    </main>
  );
}
