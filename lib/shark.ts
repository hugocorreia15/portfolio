/**
 * The "sailed off the map" gag (a shark eats the boat, GTA-style). The scene
 * plays the attack and sets the phase here; a DOM overlay reads it to show the
 * message and black out the screen while the boat is put back at the start.
 */
export type SharkPhase = "idle" | "attack" | "veil";

let phase: SharkPhase = "idle";
const listeners = new Set<() => void>();

export function setSharkPhase(next: SharkPhase) {
  if (next === phase) return;
  phase = next;
  listeners.forEach((l) => l());
}

export function subscribeShark(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getSharkPhase = () => phase;
