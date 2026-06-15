"use client";

import { useEffect, useRef, useState } from "react";
import { DAY } from "@/lib/daynight";

function formatTime(t: number) {
  const total = Math.round(t * 24 * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const isDay = (t: number) => t > 0.25 && t < 0.75;

/** Scrubbable time-of-day control; reflects and edits the day-night clock. */
export default function TimeSlider() {
  const input = useRef<HTMLInputElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const userPaused = useRef(false);
  const [paused, setPaused] = useState(false);

  // mirror the live clock onto the control without re-rendering each frame
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!dragging.current && input.current) {
        input.current.value = String(Math.round(DAY.t * 1000));
      }
      if (label.current) label.current.textContent = formatTime(DAY.t);
      if (icon.current) icon.current.textContent = isDay(DAY.t) ? "☀" : "☾";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onScrub = (e: React.FormEvent<HTMLInputElement>) => {
    dragging.current = true;
    DAY.paused = true;
    DAY.t = Number(e.currentTarget.value) / 1000;
    if (label.current) label.current.textContent = formatTime(DAY.t);
  };
  const onRelease = () => {
    dragging.current = false;
    DAY.paused = userPaused.current;
  };
  const togglePlay = () => {
    userPaused.current = !userPaused.current;
    DAY.paused = userPaused.current;
    setPaused(userPaused.current);
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-40 flex w-[min(20rem,82vw)] -translate-x-1/2 items-center gap-2 rounded-full border border-ink/10 bg-salt/85 px-3 py-1.5 shadow-lg shadow-ink/10 backdrop-blur">
      <button
        onClick={togglePlay}
        aria-label={paused ? "Resume time" : "Pause time"}
        className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] text-ink/70 transition-colors hover:bg-ink/[0.06]"
      >
        {paused ? "▶" : "❙❙"}
      </button>
      <span ref={icon} className="shrink-0 text-[13px] text-amber-500" aria-hidden>
        ☀
      </span>
      <input
        ref={input}
        type="range"
        min={0}
        max={1000}
        defaultValue={Math.round(DAY.t * 1000)}
        onInput={onScrub}
        onChange={onScrub}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onBlur={onRelease}
        aria-label="Time of day"
        className="day-range h-1 flex-1 cursor-pointer"
      />
      <span
        ref={label}
        className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink/70"
      >
        06:00
      </span>
    </div>
  );
}
