import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-cream">
      <div className="relative w-full">
        <Image
          src="/images/bloom-village.png"
          alt="BloomBalance flower village"
          width={1648}
          height={928}
          priority
          className="h-auto w-full"
        />

        {/* Grow greenhouse */}
        <Link
          href="/grow"
          aria-label="Explore Grow"
          className="absolute left-[3%] top-[40%] h-[40%] w-[21%] cursor-pointer rounded-2xl transition-all hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-green-700"
        />

        {/* Trade marketplace */}
        <Link
          href="/florist/marketplace"
          aria-label="Explore Trade marketplace"
          className="absolute left-[26%] top-[42%] h-[36%] w-[24%] cursor-pointer rounded-2xl transition-all hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-green-700"
        />

        {/* Rescue surplus */}
        <Link
          href="/surplus"
          aria-label="Explore Rescue surplus flowers"
          className="absolute left-[54%] top-[43%] h-[33%] w-[22%] cursor-pointer rounded-2xl transition-all hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-green-700"
        />

        {/* BloomTrace analytics */}
        <Link
          href="/bloomtrace"
          aria-label="Explore BloomTrace analytics"
          className="absolute left-[77%] top-[30%] h-[47%] w-[22%] cursor-pointer rounded-2xl transition-all hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-green-700"
        />
      </div>
    </main>
  );
}
