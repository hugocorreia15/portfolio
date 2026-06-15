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
};

/** Advance the clock and recompute the sun. Returns the raw elevation. */
export function advanceDay(dt: number) {
  DAY.t = (DAY.t + dt / CYCLE_SECONDS) % 1;
  const a = (DAY.t - 0.25) * Math.PI * 2; // 0 at sunrise, π/2 at noon
  const elev = Math.sin(a);
  const along = Math.cos(a);
  DAY.sunDir.set(along * 0.82, elev, 0.34).normalize();
  DAY.sunUp = THREE.MathUtils.clamp(elev, 0, 1);
  DAY.night = THREE.MathUtils.clamp(-elev * 2.4 - 0.04, 0, 1);
  DAY.dusk = Math.max(0, 1 - Math.abs(elev) * 3.4) * (1 - DAY.night * 0.7);
  return elev;
}
