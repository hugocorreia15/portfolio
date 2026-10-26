"use client";

import { useSyncExternalStore } from "react";
import { getSharkPhase, subscribeShark } from "@/lib/shark";

/** The shark gag's message, and the black-out that hides the respawn. */
export default function SharkOverlay() {
  const phase = useSyncExternalStore(subscribeShark, getSharkPhase, () => "idle" as const);
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-300 ${
          phase === "veil" ? "opacity-100" : "opacity-0"
        }`}
      />
      {phase !== "idle" && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-[13rem] z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-ink/10 bg-salt/90 px-4 py-2 text-center font-mono text-[12px] tracking-wide text-ink/80 backdrop-blur md:top-40"
        >
          🦈 That&apos;s the open sea — it belongs to the sharks. Back to the start!
        </div>
      )}
    </>
  );
}
