"use client";

import { useEffect, useRef } from "react";
import { MAPS, type MapDef, type MapId } from "@/lib/maps";
import { profile } from "@/data/profile";
import { DAY } from "@/lib/daynight";
import TimeSlider from "@/components/ui/TimeSlider";
import { SECTION_CONTENT } from "@/components/ui/Sections";

export default function Overlay({
  map,
  mapId,
  targetIndex,
  dockedIndex,
  nearPort,
  panelOpen,
  showHint,
  onNavigate,
  onRequestDock,
  onSwitchMap,
  onClose,
}: {
  map: MapDef;
  mapId: MapId;
  targetIndex: number | null;
  dockedIndex: number | null;
  nearPort: number | null;
  panelOpen: boolean;
  showHint: boolean;
  onNavigate: (index: number) => void;
  onRequestDock: (index: number) => void;
  onSwitchMap: (id: MapId) => void;
  onClose: () => void;
}) {
  const sailing = targetIndex !== null && dockedIndex !== targetIndex;
  const freeHelm = targetIndex === null;
  const docked = dockedIndex !== null ? map.ports[dockedIndex] : null;
  const Content = docked ? SECTION_CONTENT[docked.id] : null;

  // canvas-floating text (header, coords, credits) lightens at night so it
  // stays readable over the dark scene; panels keep their own colours.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const n = DAY.night;
      const r = Math.round(22 + (228 - 22) * n);
      const g = Math.round(50 + (237 - 50) * n);
      const b = Math.round(74 + (246 - 74) * n);
      const el = rootRef.current;
      if (el) {
        el.style.setProperty("--ink-1", `rgb(${r}, ${g}, ${b})`);
        el.style.setProperty("--ink-2", `rgba(${r}, ${g}, ${b}, 0.62)`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-40 text-ink">
      {/* header */}
      <header className="absolute left-5 top-5 max-w-[60vw] md:left-8 md:top-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-2)] md:text-[11px]">
          Ria de Aveiro · Portfólio
        </p>
        <h1 className="mt-1 font-display text-3xl leading-none text-[color:var(--ink-1)] md:text-4xl">
          {profile.name}
        </h1>
        <p className="mt-1.5 text-sm text-[color:var(--ink-2)] md:text-[15px]">
          {profile.title}
        </p>
      </header>

      {/* map switch — the imagined island or the real Aveiro (coming soon) */}
      <div className="pointer-events-auto absolute right-3 top-4 z-40 flex rounded-full border border-ink/10 bg-salt/85 p-1 font-mono text-[10px] shadow-lg shadow-ink/10 backdrop-blur md:left-1/2 md:right-auto md:top-5 md:-translate-x-1/2 md:text-[11px]">
        {(Object.keys(MAPS) as MapId[]).map((id) => {
          const soon = MAPS[id].comingSoon;
          return (
            <button
              key={id}
              disabled={soon}
              title={soon ? "Coming soon" : undefined}
              onClick={(e) => {
                e.currentTarget.blur();
                if (!soon && id !== mapId) onSwitchMap(id);
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 uppercase tracking-[0.12em] transition-colors md:px-3.5 md:tracking-[0.15em] ${
                id === mapId
                  ? "bg-azulejo text-salt"
                  : soon
                    ? "cursor-not-allowed text-ink/30"
                    : "text-ink/55 hover:text-ink"
              }`}
            >
              {MAPS[id].label}
              {soon && (
                <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[8.5px] tracking-wider text-ink/45">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <TimeSlider />

      {/* social links */}
      <nav className="pointer-events-auto absolute right-5 top-6 hidden gap-2 font-mono text-[11px] md:flex">
        {[
          { label: "github", href: profile.github },
          { label: "linkedin", href: profile.linkedin },
          { label: "orcid", href: profile.orcid },
          { label: "cv", href: "/cv" },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="rounded-full border border-ink/15 bg-salt/80 px-3 py-1.5 backdrop-blur transition-colors hover:border-azulejo hover:text-azulejo"
          >
            {link.label} {link.href.startsWith("http") ? "↗" : "→"}
          </a>
        ))}
      </nav>

      {/* coordinates, like a chart plotter */}
      <p className="absolute bottom-5 left-5 hidden font-mono text-[10px] tracking-wider text-[color:var(--ink-2)] md:block">
        40.6405° N, 8.6538° W — RIA DE AVEIRO
      </p>

      {/* link to the 3D model credits page */}
      <a
        href="/credits"
        className="pointer-events-auto absolute bottom-5 right-5 hidden font-mono text-[10px] text-[color:var(--ink-2)] underline-offset-2 transition-opacity hover:opacity-80 hover:underline md:block"
      >
        {mapId === "aveiro" ? "© OpenStreetMap · credits ↗" : "3D credits ↗"}
      </a>

      {/* sailing toast */}
      {sailing && targetIndex !== null && (
        <div className="absolute left-1/2 top-[9.5rem] -translate-x-1/2 whitespace-nowrap rounded-full border border-ink/10 bg-salt/85 px-4 py-2 font-mono text-[11px] tracking-wide text-ink/70 backdrop-blur md:top-24">
          A navegar para {map.ports[targetIndex].caisName}
          <span className="sailing-dots" aria-hidden />
        </div>
      )}

      {/* free-helm dock prompt — tappable for touch, E for keyboards */}
      {freeHelm && dockedIndex === null && nearPort !== null && (
        <button
          onClick={() => onRequestDock(nearPort)}
          className="pointer-events-auto absolute bottom-44 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-4 py-2 text-[13px] text-salt shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-ink md:bottom-28"
        >
          ⚓ Dock at {map.ports[nearPort].caisName}
          <kbd className="ml-1.5 hidden rounded bg-salt/20 px-1.5 font-mono text-[12px] md:inline">
            E
          </kbd>
        </button>
      )}

      {/* first-visit hint */}
      {showHint && !panelOpen && !sailing && (
        <div className="hint-bob absolute bottom-44 left-1/2 w-max max-w-[88vw] -translate-x-1/2 rounded-2xl bg-ink/85 px-4 py-2 text-center text-[13px] text-salt shadow-lg md:bottom-28">
          ⚓ Sail with{" "}
          <kbd className="rounded bg-salt/20 px-1.5 font-mono text-[12px]">WASD</kbd> or the
          joystick · drag to look around · tap a pier for autopilot
        </div>
      )}

      {/* dock navigation */}
      <nav className="pointer-events-auto absolute inset-x-0 bottom-4 flex justify-center px-3 md:bottom-6">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-salt/85 p-1.5 shadow-xl shadow-ink/10 backdrop-blur-md">
          {map.ports.map((port, i) => {
            const isHere = dockedIndex === i;
            const isTarget = targetIndex === i && sailing;
            return (
              <button
                key={port.id}
                onClick={(e) => {
                  e.currentTarget.blur(); // keep Enter free for dock requests
                  onNavigate(i);
                }}
                style={{ "--accent": port.accent } as React.CSSProperties}
                className={`flex shrink-0 flex-col items-start rounded-xl px-3 py-1.5 text-left transition-all ${
                  isHere
                    ? "bg-(--accent)/15 shadow-inner"
                    : "hover:bg-ink/[0.05]"
                } ${isTarget ? "animate-pulse" : ""}`}
              >
                <span
                  className={`font-mono text-[9px] tracking-widest ${
                    isHere ? "text-(--accent)" : "text-ink/35"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[12.5px] font-medium leading-tight text-ink/85 md:text-[13px]">
                  {port.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* section panel */}
      {panelOpen && docked && Content && (
        <aside
          style={{ "--accent": docked.accent } as React.CSSProperties}
          className="panel-enter pointer-events-auto absolute inset-x-3 bottom-20 top-auto max-h-[56vh] overflow-hidden rounded-2xl border border-ink/10 bg-salt/90 shadow-2xl shadow-ink/20 backdrop-blur-xl md:inset-x-auto md:bottom-24 md:right-6 md:top-24 md:max-h-none md:w-[27rem]"
        >
          <header className="relative border-b border-ink/10 px-5 pb-4 pt-5">
            <span className="absolute inset-x-0 top-0 h-1 bg-(--accent)" />
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-(--accent)">
              {docked.caisName}
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">{docked.label}</h2>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              ✕
            </button>
          </header>
          <div className="panel-body panel-scroll max-h-[calc(56vh-92px-44px)] space-y-5 overflow-y-auto px-5 py-5 md:max-h-[calc(100vh-12rem-92px-44px)]">
            <Content />
          </div>
          {/* sail on to the neighbouring chapters */}
          <footer className="flex h-11 items-center justify-between border-t border-ink/10 px-3 font-mono text-[11px]">
            {[-1, 1].map((step) => {
              const n = map.ports.length;
              const i = ((dockedIndex ?? 0) + step + n) % n;
              return (
                <button
                  key={step}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onNavigate(i);
                  }}
                  className="rounded-full px-3 py-1.5 text-ink/55 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                >
                  {step < 0 ? `← ${map.ports[i].label}` : `${map.ports[i].label} →`}
                </button>
              );
            })}
          </footer>
        </aside>
      )}
    </div>
  );
}
