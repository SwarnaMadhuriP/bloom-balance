import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: "🌱",
    title: "Grow & Keep Track",
    description:
      "Growers can organize their flowers, track inventory, and see what's available for sale.",
  },
  {
    number: "02",
    icon: "🛒",
    title: "Trade With Ease",
    description:
      "Florists can explore available flowers and place orders, while growers manage each order from acceptance to delivery.",
  },
  {
    number: "03",
    icon: "🌼",
    title: "Give Flowers Another Chance",
    description:
      "Growers can list surplus flowers at discounted prices, helping them find buyers before they go to waste.",
  },
  {
    number: "04",
    icon: "📊",
    title: "Learn From Every Bloom",
    description:
      "BloomTrace brings together flower waste and rescue analytics to help growers understand their operations.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FFF9EE] text-[#344C35]">
      {/* Original illustrated homepage */}
      <div className="relative w-full" id="home">
        <Image
          src="/images/bloom-village.png"
          alt="BloomBalance illustrated flower village"
          width={1648}
          height={928}
          priority
          className="h-auto w-full"
        />

        {/* Invisible navigation hotspots */}

        {/* Explore Village */}
        <a
          href="#home"
          aria-label="Explore Village"
          className="absolute left-[35%] top-[2%] h-[7%] w-[9%] cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-green-700"
        />

        {/* How It Works */}
        <a
          href="#how-it-works"
          aria-label="How It Works"
          className="absolute left-[45%] top-[2%] h-[7%] w-[9%] cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-green-700"
        />

        {/* Our Impact */}
        <a
          href="#our-impact"
          aria-label="Our Impact"
          className="absolute left-[55%] top-[2%] h-[7%] w-[8%] cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-green-700"
        />

        {/* About */}
        <a
          href="#about"
          aria-label="About BloomBalance"
          className="absolute left-[66%] top-[2%] h-[6%] w-[6%] cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-green-700"
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
          href="/grow/bloomtrace"
          aria-label="Explore BloomTrace analytics"
          className="absolute left-[77%] top-[30%] h-[47%] w-[22%] cursor-pointer rounded-2xl transition-all hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-green-700"
        />
      </div>

      {/* How It Works */}
      <section id="how-it-works" className="scroll-mt-8 px-6 py-24 md:px-12">
        <div className="mx-auto max-w-6xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#8B9E73]">
            From garden to doorstep
          </p>

          <h2 className="font-serif text-4xl md:text-5xl">
            How BloomBalance Works
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-8 text-[#6F7B67]">
            A little less paperwork, a little more room to grow. Follow each
            flower from the grower to its next home.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-[28px] border border-[#E6E8D5] bg-white/75 p-7 text-left shadow-sm transition-transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{step.icon}</span>
                  <span className="font-serif text-2xl text-[#B4C3A2]">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-7 font-serif text-2xl">{step.title}</h3>

                <p className="mt-4 text-sm leading-7 text-[#6F7B67]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Our Impact */}
      <section
        id="our-impact"
        className="scroll-mt-8 bg-[#EAF0DF] px-6 py-24 md:px-12"
      >
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#7C9569]">
            Every flower matters
          </p>

          <h2 className="font-serif text-4xl md:text-5xl">
            Small Changes, Meaningful Impact
          </h2>

          <p className="mx-auto mt-6 max-w-2xl leading-8 text-[#64765E]">
            Flowers are beautiful, but their shelf life is short. BloomBalance
            explores how better visibility and timely decisions could help
            growers reduce waste.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-[26px] bg-[#FFF9EE] p-8">
              <div className="text-4xl">🌷</div>

              <h3 className="mt-5 font-serif text-2xl">Reduce Waste</h3>

              <p className="mt-3 text-sm leading-7 text-[#6F7B67]">
                Give surplus flowers another opportunity to reach customers
                before they expire.
              </p>
            </div>

            <div className="rounded-[26px] bg-[#FFF9EE] p-8">
              <div className="text-4xl">📦</div>

              <h3 className="mt-5 font-serif text-2xl">Simplify Operations</h3>

              <p className="mt-3 text-sm leading-7 text-[#6F7B67]">
                Bring flower inventory and order tracking together in one place.
              </p>
            </div>

            <div className="rounded-[26px] bg-[#FFF9EE] p-8">
              <div className="text-4xl">🌿</div>

              <h3 className="mt-5 font-serif text-2xl">
                Make Informed Decisions
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#6F7B67]">
                Understand waste patterns and rescued flower quantities through
                BloomTrace analytics.
              </p>
            </div>
          </div>

          <Link
            href="/grow/bloomtrace"
            className="mt-10 inline-block rounded-full bg-[#476B48] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#345337]"
          >
            Explore BloomTrace →
          </Link>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-8 px-6 py-24 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#8B9E73]">
            The story behind BloomBalance
          </p>

          <h2 className="font-serif text-4xl md:text-5xl">
            A Little Curiosity, A Lot of Flowers 🌸
          </h2>

          <div className="mt-9 space-y-6 text-base leading-9 text-[#66765E]">
            <p>
              BloomBalance began with two things I love: building software and
              flowers.
            </p>

            <p>
              My father grew flowers, which gave me a glimpse into the
              challenges growers face - managing orders, tracking inventory, and
              making sure their flowers find buyers before they go to waste.
            </p>

            <p className="font-serif text-xl italic text-[#476B48]">
              What if technology could make their everyday work a little easier?
            </p>

            <p>
              As a software engineer, I was also eager to explore{" "}
              <span className="font-semibold text-[#476B48]">
                Apache Kafka, event-driven architecture, and distributed systems
              </span>{" "}
              beyond tutorials. BloomBalance became my opportunity to learn by
              building something inspired by a real-world problem.
            </p>

            <p>
              The result is a flower marketplace where growers can manage
              inventory and orders, florists can discover flowers, and surplus
              blooms get a second chance. Behind the scenes, I've been
              experimenting with asynchronous processing, transactional outbox
              patterns, idempotency, and fault tolerance. BloomTrace adds
              analytics to help growers understand waste and make better
              decisions.
            </p>

            <p>
              The visual design draws inspiration from the storybook charm of{" "}
              <span className="font-semibold text-[#476B48]">
                Carmel-by-the-Sea
              </span>
              , with its cozy cottages, winding paths, and whimsical gardens. I
              wanted BloomBalance to feel like a little flower-filled village
              rather than a conventional business dashboard.
            </p>

            <h3 className="pt-5 font-serif text-2xl text-[#476B48]">
              And there's room for this little garden to grow.
            </h3>

            <p>
              What starts with flowers could eventually extend to other
              agricultural products, with integrated payments, digital
              bookkeeping, and more ways for farmers to connect with buyers.
            </p>

            <p>
              For now, BloomBalance is a personal learning project, but I hope
              it can someday become useful for my father and other farmers in
              our communities.
            </p>
          </div>

          <div className="mt-12 text-3xl">🌸 🌿 🌼</div>

          <p className="mt-5 font-serif text-xl italic text-[#78916B]">
            Built with curiosity. Inspired by real life. Growing one bloom at a
            time.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E4E8D9] bg-[#FFF9EE] px-6 py-12 text-center">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3">
          <h3 className="font-serif text-2xl font-semibold text-[#476B48]">
            BloomBalance 🌸
          </h3>

          <p className="text-sm italic text-[#78876B]">
            A little more bloom, a little less waste.
          </p>

          <a
            href="#home"
            className="mt-5 text-sm font-medium text-[#476B48] transition-colors hover:text-[#8B9E73] hover:underline"
          >
            Back to the garden ↑
          </a>
        </div>
      </footer>
    </main>
  );
}
