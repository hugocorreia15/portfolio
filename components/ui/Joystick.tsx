"use client";

import { useEffect, useRef, useState } from "react";

const TRAVEL = 44; // knob travel in px
const DEADZONE = 0.18;

export default function Joystick({
  onChange,
  onEngage,
}: {
  /** x: -1 (port) .. 1 (starboard) · y: -1 (astern) .. 1 (ahead) */
  onChange: (x: number, y: number) => void;
  onEngage: () => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  // let go of the helm if the joystick unmounts mid-drag
  useEffect(() => {
    return () => onChange(0, 0);
  }, [onChange]);

  const apply = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > TRAVEL) {
      dx *= TRAVEL / len;
      dy *= TRAVEL / len;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / TRAVEL;
    const ny = dy / TRAVEL;
    onChange(
      Math.abs(nx) < DEADZONE ? 0 : nx,
      Math.abs(ny) < DEADZONE ? 0 : -ny // push up = ahead
    );
  };

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointerId.current = e.pointerId;
    try {
      baseRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no real pointer to capture */
    }
    setActive(true);
    onEngage();
    apply(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    apply(e.clientX, e.clientY);
  };

  const handleEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      role="application"
      aria-label="Sailing joystick"
      className="pointer-events-auto absolute bottom-28 left-5 z-40 grid size-28 touch-none select-none place-items-center rounded-full border border-ink/15 bg-salt/60 shadow-xl shadow-ink/10 backdrop-blur-md"
    >
      <span className="absolute top-1 font-mono text-[9px] text-ink/30">▲</span>
      <span className="absolute bottom-1 font-mono text-[9px] text-ink/30">▼</span>
      <span className="absolute left-1.5 font-mono text-[9px] text-ink/30">◀</span>
      <span className="absolute right-1.5 font-mono text-[9px] text-ink/30">▶</span>
      <div
        className={`grid size-12 place-items-center rounded-full bg-ink/85 text-[15px] text-salt shadow-lg ${
          active ? "" : "transition-transform duration-300"
        }`}
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      >
        ⚓
      </div>
    </div>
  );
}
