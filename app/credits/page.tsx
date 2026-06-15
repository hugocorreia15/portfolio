import type { Metadata } from "next";
import Link from "next/link";
import { ASSET_CREDITS } from "@/data/credits";

export const metadata: Metadata = {
  title: "3D Credits — Hugo Correia",
  description: "Attribution for the 3D models used in the Ria de Aveiro portfolio.",
};

export default function CreditsPage() {
  return (
    <main className="h-screen overflow-y-auto bg-foam text-ink">
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50 transition-colors hover:text-azulejo"
        >
          ← back to the ria
        </Link>

        <header className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/50">
            Ria de Aveiro · Portfólio
          </p>
          <h1 className="mt-2 font-display text-4xl text-ink">3D Credits</h1>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink/70">
            The 3D models below were made by their respective creators and are
            used here under their Creative Commons licenses. The rest of the
            world — water, town, props and the rest — is hand-built.
          </p>
        </header>

        <ul className="mt-10 space-y-3">
          {ASSET_CREDITS.map((c) => (
            <li
              key={c.modelUrl}
              className="rounded-2xl border border-ink/10 bg-salt/70 p-5 shadow-[0_1px_0_rgba(22,50,74,0.05)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-xl text-ink">{c.name}</h2>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
                  {c.role}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink/75">
                by{" "}
                <a
                  href={c.authorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-azulejo underline-offset-2 hover:underline"
                >
                  {c.author}
                </a>{" "}
                on Sketchfab
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <a
                  href={c.modelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-ink/15 bg-white/60 px-3 py-1 text-ink/70 transition-colors hover:border-azulejo hover:text-azulejo"
                >
                  view model ↗
                </a>
                <a
                  href={c.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-ink/15 bg-white/60 px-3 py-1 text-ink/70 transition-colors hover:border-azulejo hover:text-azulejo"
                >
                  {c.license}
                </a>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 font-mono text-[10px] leading-relaxed text-ink/40">
          Textures: ambientCG (CC0). Map geometry: © OpenStreetMap contributors
          (ODbL). Built with Next.js + React Three Fiber.
        </p>
      </div>
    </main>
  );
}
