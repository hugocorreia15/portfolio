import { useSyncExternalStore } from "react";
import * as THREE from "three";

/** Seconds for one full day → night → day loop (≈10 min of daylight). */
export const CYCLE_SECONDS = 1200;

/**
 * Shared atmosphere state, updated once per frame by the DayNightController
 * and read by the water shader, lamps and stars. Module scope so unrelated
 * components can read it without prop-drilling.
 */
export const DAY = {
  t: 0.3, // 0..1 time of day (0 midnight · 0.25 sunrise · 0.5 noon · 0.75 sunset)
  sunDir: new THREE.Vector3(0.5, 0.6, 0.3).normalize(),
  night: 0, // 0 full day .. 1 deep night
  sunUp: 1, // clamp(sun elevation, 0, 1)
  dusk: 0, // warm-horizon factor
  paused: false, // frozen by the time slider
};

/**
 * The lighthouse beacon, written each frame by the Lighthouse and read by the
 * water shader so the sweeping beam glances across the surface.
 */
export const BEACON = {
  pos: new THREE.Vector3(),
  dir: 0, // world heading of the beam, atan2(x, z)
  on: 0, // 0..1 night intensity
};

// shared "is it night" flag — lamps mount their point lights only at night, so
// the renderer's per-fragment light loop stays short during the day
let _night = false;
const _nightSubs = new Set<() => void>();
export function setNight(v: boolean) {
  if (v === _night) return;
  _night = v;
  _nightSubs.forEach((f) => f());
}
function subscribeNight(cb: () => void) {
  _nightSubs.add(cb);
  return () => {
    _nightSubs.delete(cb);
  };
}
/** Subscribe a component to the night flag (flips at most twice per cycle). */
export function useIsNight() {
  return useSyncExternalStore(
    subscribeNight,
    () => _night,
    () => false
  );
}

/** Advance the clock (unless paused) and recompute the sun. Returns elevation. */
export function advanceDay(dt: number) {
  if (!DAY.paused) DAY.t = (DAY.t + dt / CYCLE_SECONDS) % 1;
  const a = (DAY.t - 0.25) * Math.PI * 2; // 0 at sunrise, π/2 at noon
  const elev = Math.sin(a);
  const along = Math.cos(a);
  DAY.sunDir.set(along * 0.82, elev, 0.34).normalize();
  DAY.sunUp = THREE.MathUtils.clamp(elev, 0, 1);
  DAY.night = THREE.MathUtils.clamp(-elev * 2.4 - 0.04, 0, 1);
  DAY.dusk = Math.max(0, 1 - Math.abs(elev) * 3.4) * (1 - DAY.night * 0.7);
  return elev;
}
