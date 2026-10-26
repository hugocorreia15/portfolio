import * as THREE from "three";
import { CANAL, PORTS, type PortDef } from "@/lib/ports";
import { resolveCollisions, WORLD_RADIUS } from "@/lib/colliders";
import {
  AVEIRO_AMBIENT,
  AVEIRO_REGION,
  AVEIRO_PORTS,
  AVEIRO_START,
  buildAveiroRoute,
  constrainAveiro,
  offMapAveiro,
} from "@/lib/aveiro";

export type MapId = "island" | "aveiro";

interface MapBase {
  id: MapId;
  label: string;
  ports: PortDef[];
  start: { pos: THREE.Vector3; heading: number };
  /** push pos back into legal water; true when something was hit */
  constrain: (pos: THREE.Vector3) => boolean;
  /** sailing off the edge of the map (the shark's cue) */
  offMap: (pos: THREE.Vector3, heading: number) => boolean;
  ambientCurve: THREE.CatmullRomCurve3;
  /** size of the moliceiro relative to the island map (Aveiro is at real scale) */
  boatScale: number;
  /** rough extent of the world: clouds, gulls and the water plane follow it */
  bounds: { cx: number; cz: number; r: number };
  /** shown in the toggle but not yet selectable */
  comingSoon?: boolean;
}

export type MapDef = MapBase &
  (
    | { kind: "loop"; loopCurve: THREE.CatmullRomCurve3 }
    | {
        kind: "network";
        buildRoute: (
          from: THREE.Vector3,
          portIndex: number
        ) => { curve: THREE.CatmullRomCurve3; length: number } | null;
      }
  );

const islandStartTangent = CANAL.getTangentAt(0.93);

export const MAPS: Record<MapId, MapDef> = {
  island: {
    id: "island",
    label: "Ilha",
    kind: "loop",
    ports: PORTS,
    loopCurve: CANAL,
    start: {
      pos: CANAL.getPointAt(0.93),
      heading: Math.atan2(islandStartTangent.x, islandStartTangent.z),
    },
    constrain: resolveCollisions,
    // pressing on the lagoon's outer edge, heading out to sea
    offMap: (pos, heading) =>
      Math.hypot(pos.x, pos.z) > WORLD_RADIUS - 0.5 && Math.sin(heading) * pos.x + Math.cos(heading) * pos.z > 0,
    ambientCurve: CANAL,
    boatScale: 1,
    bounds: { cx: 0, cz: 0, r: 70 },
  },
  aveiro: {
    id: "aveiro",
    label: "Aveiro",
    kind: "network",
    ports: AVEIRO_PORTS,
    buildRoute: buildAveiroRoute,
    start: AVEIRO_START,
    constrain: constrainAveiro,
    offMap: (pos) => offMapAveiro(pos),
    ambientCurve: AVEIRO_AMBIENT,
    boatScale: 0.62,
    bounds: {
      cx: (AVEIRO_REGION[0] + AVEIRO_REGION[2]) / 2,
      cz: (AVEIRO_REGION[1] + AVEIRO_REGION[3]) / 2,
      r: Math.hypot(AVEIRO_REGION[2] - AVEIRO_REGION[0], AVEIRO_REGION[3] - AVEIRO_REGION[1]) / 2,
    },
  },
};
