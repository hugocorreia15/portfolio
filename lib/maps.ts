import * as THREE from "three";
import { CANAL, PORTS, type PortDef } from "@/lib/ports";
import { resolveCollisions } from "@/lib/colliders";
import {
  AVEIRO_AMBIENT,
  AVEIRO_PORTS,
  AVEIRO_START,
  buildAveiroRoute,
  constrainAveiro,
} from "@/lib/aveiro";

export type MapId = "island" | "aveiro";

interface MapBase {
  id: MapId;
  label: string;
  ports: PortDef[];
  start: { pos: THREE.Vector3; heading: number };
  /** push pos back into legal water; true when something was hit */
  constrain: (pos: THREE.Vector3) => boolean;
  ambientCurve: THREE.CatmullRomCurve3;
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
    ambientCurve: CANAL,
  },
  aveiro: {
    id: "aveiro",
    label: "Aveiro",
    comingSoon: true,
    kind: "network",
    ports: AVEIRO_PORTS,
    buildRoute: buildAveiroRoute,
    start: AVEIRO_START,
    constrain: constrainAveiro,
    ambientCurve: AVEIRO_AMBIENT,
  },
};
