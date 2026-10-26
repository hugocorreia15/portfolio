"use client";

import {
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { shortestDelta, wrap1 } from "@/lib/ports";
import type { MapDef } from "@/lib/maps";
import type { PortDef } from "@/lib/ports";
import { MoliceiroModel } from "@/components/three/moliceiroModel";
import { hideFromMirror } from "@/lib/reflection";
import { DAY } from "@/lib/daynight";
import { cloudUniforms } from "@/lib/clouds";

const MAX_SPEED = 8.5;
const MAX_REVERSE = -3.4;
const DOCK_RANGE = 5.2;
const BOAT_CLEARANCE = 4.4; // min centre distance between any two hulls

// shared positions of every boat (slot 0 = player, 1/2 = ambient) so hulls
// collide instead of passing through each other; lives at module scope because
// the player and the ambient boats are separate components.
type BoatMark = { x: number; z: number; active: boolean };
const BOATS: BoatMark[] = [
  { x: 0, z: 0, active: false },
  { x: 0, z: 0, active: false },
  { x: 0, z: 0, active: false },
];

/** Push pos out of every other boat's clearance circle. Returns true on contact. */
function avoidBoats(pos: THREE.Vector3, selfIndex: number, clearance = BOAT_CLEARANCE) {
  let hit = false;
  for (let i = 0; i < BOATS.length; i++) {
    if (i === selfIndex) continue;
    const b = BOATS[i];
    if (!b.active) continue;
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.0001 && d < clearance) {
      const push = clearance - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
      hit = true;
    }
  }
  return hit;
}

// scratch vectors reused every frame to avoid per-frame allocations
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _scan = new THREE.Vector3();
const _wp = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

// the same three-wave surface the Water shader displaces its plane by, evaluated
// on the CPU so foam can ride the swell exactly. Water mesh sits at y = -0.02 and
// is rotated so local (x, y) maps to world (x, -z); amplitude scaled by 0.34.
function waterHeight(x: number, z: number, t: number) {
  const w1 = Math.sin(x * 0.16 + t * 0.8);
  const w2 = Math.sin(-z * 0.23 - t * 0.6);
  const w3 = Math.sin((x - z) * 0.11 + t * 0.45);
  return -0.02 + (0.42 * w1 + 0.26 * w2 + 0.18 * w3) * 0.34;
}

const _fwd = new THREE.Vector3();
const _port = new THREE.Vector3();

/**
 * Float a hull on the swell: height from the mean of bow, midship and stern,
 * pitch and roll from the slope of the water under it (rotation order YXZ).
 */
function rideWaves(
  obj: THREE.Object3D,
  x: number,
  z: number,
  heading: number,
  t: number,
  scale: number,
  roll = 0
) {
  const half = 2.8 * scale;
  const beam = 0.55 * scale;
  _fwd.set(Math.sin(heading), 0, Math.cos(heading));
  _port.set(Math.cos(heading), 0, -Math.sin(heading));
  const hBow = waterHeight(x + _fwd.x * half, z + _fwd.z * half, t);
  const hStern = waterHeight(x - _fwd.x * half, z - _fwd.z * half, t);
  const hPort = waterHeight(x + _port.x * beam, z + _port.z * beam, t);
  const hStar = waterHeight(x - _port.x * beam, z - _port.z * beam, t);
  const hMid = waterHeight(x, z, t);
  obj.rotation.order = "YXZ";
  obj.position.set(x, (hBow + hStern + hMid) / 3 + 0.03 * scale, z);
  obj.rotation.y = heading;
  obj.rotation.x = -Math.atan2(hBow - hStern, 2 * half);
  obj.rotation.z = Math.atan2(hPort - hStar, 2 * beam) + roll;
}

const WAKE_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec4 aWake;
  varying vec4 vWake;
  varying vec2 vXZ;
  void main() {
    vWake = aWake;
    vXZ = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WAKE_FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D uFoam;
  uniform float uTime;
  uniform float uNight;
  uniform float uStern;
  uniform float uBeam;
  // x: side (-1.25..1.25 of the half-width), y: 0 at the bow .. 1 at the tail,
  // z: half-width of the V here (world units), w: strength (speed, fading)
  varying vec4 vWake;
  varying vec2 vXZ;
  void main() {
    float t = vWake.y;
    float W = vWake.z;
    float d = abs(vWake.x) * W;
    // foam is a lace of bubbles: cell borders plus fine streaks, drifting
    float cells = 1.0 - texture2D(uFoam, vXZ * 0.35 + vec2(uTime * 0.01, 0.0)).b;
    float fine = texture2D(uFoam, vXZ * 0.9 - uTime * 0.015).g;
    float lace = cells * 0.65 + fine * 0.55;
    // bow waves: a thin crest along each arm of the V (the Kelvin angle),
    // spreading and fading astern, with a fainter echo inside it
    float crest = (0.08 + t * 0.32) * uBeam * 2.0;
    float arms = exp(-pow((W - d) / crest, 2.0)) * pow(1.0 - t, 1.3);
    arms += exp(-pow((W * 0.8 - d) / (crest * 0.7), 2.0)) * 0.4 * pow(1.0 - t, 1.8);
    // churned water from the stern on, about a beam wide and widening
    float ta = clamp((t - uStern) / (1.0 - uStern), 0.0, 1.0);
    float churn = step(uStern * 0.92, t) * smoothstep(uBeam * (1.2 + ta * 1.6), uBeam * 0.2, d) * pow(1.0 - ta, 1.4);
    // and a faint sheen of disturbed water inside the V
    float sheen = smoothstep(W, W * 0.2, d) * pow(1.0 - t, 2.0) * 0.1;
    float foam = churn * smoothstep(0.2, 0.75, lace + churn * 0.25) + arms * smoothstep(0.35, 0.8, lace + 0.15);
    float a = clamp(foam * 0.9 + sheen, 0.0, 0.95) * vWake.w;
    #ifdef USE_FOG
      a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor = vec4(mix(vec3(0.94, 0.97, 1.0), vec3(0.32, 0.38, 0.5), uNight), a);
  }
`;

// Kelvin wake: the bow waves diverge at ~19.5° either side of the track
const KELVIN = Math.tan((19.5 * Math.PI) / 180);
const RIB = [-1.25, -0.6, 0, 0.6, 1.25];

/**
 * The boat's wake, laid along its path history and re-seated on the live
 * water surface every frame so it rolls with the swell: two thin bow-wave
 * crests opening into a V at the Kelvin angle, churned foam from the stern on,
 * all broken into bubbly lace. Its strength follows the boat's speed.
 */
function WakeTrail({
  target,
  width = 1.0,
  emit = 2.8,
  segments = 96,
}: {
  target: RefObject<THREE.Group | null>;
  /** 1.6 × the boat's scale */
  width?: number;
  /** distance from the boat's origin to its bow */
  emit?: number;
  segments?: number;
}) {
  const k = width / 1.6;
  const spacing = 0.32 * k;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segments * RIB.length * 3), 3));
    g.setAttribute("aWake", new THREE.BufferAttribute(new Float32Array(segments * RIB.length * 4), 4));
    const idx: number[] = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * RIB.length;
      const b = (i + 1) * RIB.length;
      for (let j = 0; j < RIB.length - 1; j++) {
        idx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
      }
    }
    g.setIndex(idx);
    return g;
  }, [segments]);
  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uFoam: { value: cloudUniforms().uCloudNoise.value },
      uTime: { value: 0 },
      uNight: { value: 0 },
      // the hull ends ~6.6 boat-units astern of the bow
      uStern: { value: (6.6 * k) / ((segments - 1) * spacing) },
      uBeam: { value: 0.5 * k },
    }),
    [k, segments, spacing]
  );
  const material = useRef<THREE.ShaderMaterial>(null);

  // h[0] is the live head, glued to the bow; h[1..] are fixed samples one
  // `spacing` apart, each remembering when it was laid and how fast the boat went
  const hist = useRef<Array<{ x: number; z: number; nx: number; nz: number; t0: number; p: number }> | null>(
    null
  );
  if (hist.current == null) {
    hist.current = Array.from({ length: segments }, () => ({ x: 0, z: 0, nx: 1, nz: 0, t0: -99, p: 0 }));
  }
  const lastTime = useRef(0);
  const seeded = useRef(false);
  // the wake lies on the surface: it isn't mirrored
  const wake = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (wake.current) hideFromMirror(wake.current);
  }, []);

  useFrame((state) => {
    const t = target.current;
    const h = hist.current;
    if (!t || !h) return;
    const time = state.clock.elapsedTime;
    if (material.current) {
      const u = material.current.uniforms;
      u.uTime.value = time;
      u.uNight.value = DAY.night;
    }
    t.getWorldPosition(_wp);
    // emit from the bow: the bow waves peel off the hull's shoulders
    const px = _wp.x + Math.sin(t.rotation.y) * emit;
    const pz = _wp.z + Math.cos(t.rotation.y) * emit;
    const head = h[0];

    // (re)seed on the first frame and after a teleport (deep link, map load, shark)
    if (!seeded.current || Math.hypot(px - head.x, pz - head.z) > 6) {
      for (const s of h) Object.assign(s, { x: px, z: pz, t0: -99, p: 0 });
      lastTime.current = time;
      seeded.current = true;
    }

    head.x = px;
    head.z = pz;
    // lay fixed samples every `spacing` behind the head — several in one frame
    // when the boat is fast or the frame slow, so the wake never stutters
    let gap = Math.hypot(px - h[1].x, pz - h[1].z);
    if (gap >= spacing) {
      const speed = gap / Math.max(time - lastTime.current, 1e-3);
      const power = THREE.MathUtils.clamp(speed / (4.5 * k), 0.25, 1);
      const ux = (px - h[1].x) / gap;
      const uz = (pz - h[1].z) / gap;
      while (gap >= spacing) {
        const prev = h[1];
        const last = h[segments - 1];
        for (let i = segments - 1; i > 1; i--) h[i] = h[i - 1];
        h[1] = Object.assign(last, {
          x: prev.x + ux * spacing,
          z: prev.z + uz * spacing,
          nx: -uz,
          nz: ux,
          t0: time,
          p: power,
        });
        gap -= spacing;
      }
      lastTime.current = time;
    }
    head.nx = h[1].nx;
    head.nz = h[1].nz;
    head.t0 = time;
    head.p = h[1].p;

    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const wk = geo.getAttribute("aWake") as THREE.BufferAttribute;
    for (let i = 0; i < segments; i++) {
      const s = h[i];
      // foam lives ~5 s, then it has dissolved
      const life = Math.max(0, 1 - (time - s.t0) / 5);
      const tt = i / (segments - 1);
      const W = 0.42 * k + KELVIN * i * spacing;
      for (let j = 0; j < RIB.length; j++) {
        const x = s.x + s.nx * RIB[j] * W;
        const z = s.z + s.nz * RIB[j] * W;
        const v = i * RIB.length + j;
        pos.setXYZ(v, x, waterHeight(x, z, time) + 0.05, z);
        wk.setXYZW(v, RIB[j], tt, W, life * s.p);
      }
    }
    pos.needsUpdate = true;
    wk.needsUpdate = true;
  });

  return (
    <mesh ref={wake} geometry={geo} frustumCulled={false} renderOrder={3}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={WAKE_VERTEX}
        fragmentShader={WAKE_FRAGMENT}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        fog
      />
    </mesh>
  );
}

const MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

/** Camera position for a moored boat: behind it across the water, off-axis. */
function dockFraming(port: PortDef, boat: THREE.Vector3, bs: number, out: THREE.Vector3) {
  const city = bs < 1;
  return out
    .copy(boat)
    .addScaledVector(port.outward, city ? -12 : -15)
    .addScaledVector(port.tangent, city ? 4.5 : 6.5)
    .setY(city ? 11.5 : 8.2);
}

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

function nearestT(curve: THREE.CatmullRomCurve3, pos: THREE.Vector3) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const t = i / 256;
    const p = curve.getPointAt(t, _scan);
    const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export default function Moliceiro({
  map,
  targetIndex,
  dockedIndex,
  startIndex,
  joystick,
  onArrive,
  onManualStart,
  onNearPort,
  onRequestDock,
}: {
  map: MapDef;
  targetIndex: number | null;
  dockedIndex: number | null;
  /** start moored at this port instead of sailing in */
  startIndex: number | null;
  joystick: { current: { x: number; y: number } };
  onArrive: (index: number) => void;
  onManualStart: () => void;
  onNearPort: (index: number | null) => void;
  onRequestDock: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();

  // physical boat state — position, heading and speed live here, not in React state
  const phys = useRef<{
    pos: THREE.Vector3;
    heading: number;
    speed: number;
    turn: number;
  } | null>(null);
  if (phys.current == null) {
    phys.current = {
      pos: map.start.pos.clone(),
      heading: map.start.heading,
      speed: 0,
      turn: 0,
    };
  }

  const autoT = useRef(-1); // loop-map curve parameter; -1 = not yet located
  const route = useRef<{
    curve: THREE.CatmullRomCurve3;
    length: number;
    s: number;
  } | null>(null);

  const arrived = useRef(false);
  const engagedTarget = useRef<number | null>(0);
  const wasManual = useRef(false);
  const nearPortRef = useRef<number | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const cam = useRef({
    yawOff: 0,
    pitch: 0.46,
    dist: 13.5,
    dragging: false,
    lastDrag: 0,
    lastX: 0,
    lastY: 0,
  });
  const camPos = useRef(new THREE.Vector3(6, 10, 46));
  const camLook = useRef(new THREE.Vector3(0, 1, 30));

  useEffect(() => {
    arrived.current = false;
  }, [targetIndex]);

  // deep link: drop anchor at the requested pier straight away
  useEffect(() => {
    if (startIndex === null) return;
    const port = map.ports[startIndex];
    const ph = phys.current!;
    ph.pos.copy(port.point);
    ph.heading = Math.atan2(port.tangent.x, port.tangent.z);
    ph.speed = 0;
    autoT.current = port.t;
    // already alongside: no route to sail, the arrival fires on the next frame
    engagedTarget.current = startIndex;
    route.current = null;
    arrived.current = false;
    dockFraming(port, port.point, map.boatScale, camPos.current);
    camLook.current.copy(port.dockPos).lerp(port.landmarkPos, 0.4).setY(2.1);
  }, [startIndex, map]);

  // drop the player's collider when the scene unmounts (e.g. map switch)
  useEffect(() => {
    return () => {
      BOATS[0].active = false;
    };
  }, []);

  // keyboard: WASD/arrows take the helm, E/Enter docks when alongside a pier
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (MOVE_CODES.has(e.code)) {
        e.preventDefault();
        keys.current.add(e.code);
        onManualStart();
      } else if (
        (e.code === "KeyE" || e.code === "Enter") &&
        nearPortRef.current !== null
      ) {
        onRequestDock(nearPortRef.current);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [onManualStart, onRequestDock]);

  // mouse: drag to orbit the boat, wheel to zoom
  useEffect(() => {
    const el = gl.domElement;
    const c = cam.current;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      c.dragging = true;
      c.lastX = e.clientX;
      c.lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!c.dragging) return;
      const dx = e.clientX - c.lastX;
      const dy = e.clientY - c.lastY;
      c.lastX = e.clientX;
      c.lastY = e.clientY;
      c.yawOff -= dx * 0.0055;
      c.pitch = THREE.MathUtils.clamp(c.pitch + dy * 0.004, 0.15, 1.15);
      c.lastDrag = performance.now();
    };
    const onUp = () => {
      if (!c.dragging) return;
      c.dragging = false;
      c.lastDrag = performance.now();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      c.dist = THREE.MathUtils.clamp(c.dist * (1 + e.deltaY * 0.0012), 7, 26);
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  // the camera pulls in for the smaller, real-scale boat on the Aveiro map
  const bs = map.boatScale;
  const camK = Math.pow(bs, 0.8);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const ph = phys.current!;
    const time = state.clock.elapsedTime;
    const manual = targetIndex === null;
    const k = keys.current;

    if (!manual) {
      if (nearPortRef.current !== null) {
        nearPortRef.current = null;
        onNearPort(null);
      }
      if (map.kind === "loop") {
        // autopilot: ride the canal loop toward the target pier
        if (engagedTarget.current !== targetIndex) {
          if (autoT.current < 0 || wasManual.current) {
            autoT.current = nearestT(map.loopCurve, ph.pos);
          }
          engagedTarget.current = targetIndex;
        }
        const port = map.ports[targetIndex];
        const d = shortestDelta(autoT.current, port.t);
        const tSpeed = THREE.MathUtils.clamp(Math.abs(d) * 0.6, 0.012, 0.085);
        autoT.current = wrap1(
          autoT.current + Math.sign(d) * Math.min(Math.abs(d), tSpeed * dt)
        );
        const remaining = shortestDelta(autoT.current, port.t);
        if (!arrived.current && Math.abs(remaining) < 0.0008) {
          arrived.current = true;
          onArrive(targetIndex);
        }
        const p = map.loopCurve.getPointAt(autoT.current, _pos);
        const tan = map.loopCurve.getTangentAt(autoT.current, _tan);
        // pull the hull smoothly onto the route (it may be coming back from free sailing)
        ph.pos.x = THREE.MathUtils.damp(ph.pos.x, p.x, 3, dt);
        ph.pos.z = THREE.MathUtils.damp(ph.pos.z, p.z, 3, dt);
        ph.heading = dampAngle(ph.heading, Math.atan2(tan.x, tan.z), 3.5, dt);
        const moving = Math.abs(remaining) > 0.004;
        ph.speed = THREE.MathUtils.damp(ph.speed, moving ? 6.5 : 0, 2, dt);
        ph.turn = 0;
      } else {
        // autopilot: shortest route through the canal graph
        if (engagedTarget.current !== targetIndex) {
          const r = map.buildRoute(ph.pos, targetIndex);
          route.current = r ? { ...r, s: 0 } : null;
          engagedTarget.current = targetIndex;
        }
        const rt = route.current;
        if (rt) {
          // long canal crossings on the real map: let the autopilot open up
          const v = THREE.MathUtils.clamp(
            Math.min(rt.s + 2, rt.length - rt.s) * 0.9,
            1.6,
            rt.length > 150 ? 22 : 14
          );
          rt.s = Math.min(rt.s + v * dt, rt.length);
          const u = THREE.MathUtils.clamp(rt.s / rt.length, 0, 1);
          const p = rt.curve.getPointAt(u, _pos);
          const tan = rt.curve.getTangentAt(u, _tan);
          ph.pos.x = THREE.MathUtils.damp(ph.pos.x, p.x, 3, dt);
          ph.pos.z = THREE.MathUtils.damp(ph.pos.z, p.z, 3, dt);
          ph.heading = dampAngle(ph.heading, Math.atan2(tan.x, tan.z), 3.5, dt);
          ph.speed = THREE.MathUtils.damp(
            ph.speed,
            rt.length - rt.s > 0.5 ? v : 0,
            2,
            dt
          );
          ph.turn = 0;
          if (!arrived.current && rt.length - rt.s < 0.3) {
            arrived.current = true;
            onArrive(targetIndex);
          }
        } else {
          // already alongside the pier
          ph.speed = THREE.MathUtils.damp(ph.speed, 0, 2, dt);
          ph.turn = 0;
          if (!arrived.current) {
            arrived.current = true;
            onArrive(targetIndex);
          }
        }
      }
    } else {
      // free helm: thrust + rudder with momentum (keyboard and joystick blend)
      const joy = joystick.current;
      const fwd = THREE.MathUtils.clamp(
        (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) -
          (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) +
          joy.y,
        -1,
        1
      );
      const turn = THREE.MathUtils.clamp(
        (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) -
          (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
          joy.x,
        -1,
        1
      );

      if (Math.abs(fwd) > 0.01) ph.speed += fwd * (fwd > 0 ? 7 : 5) * dt;
      else ph.speed = THREE.MathUtils.damp(ph.speed, 0, 1.1, dt);
      ph.speed = THREE.MathUtils.clamp(ph.speed, MAX_REVERSE, MAX_SPEED);

      // the rudder bites harder with way on; reversed when going astern
      const bite = 0.35 + 0.65 * Math.min(Math.abs(ph.speed) / MAX_SPEED, 1);
      ph.heading += turn * 1.7 * bite * dt * (ph.speed < -0.2 ? -1 : 1);
      ph.turn = turn;

      ph.pos.x += Math.sin(ph.heading) * ph.speed * dt;
      ph.pos.z += Math.cos(ph.heading) * ph.speed * dt;
      if (avoidBoats(ph.pos, 0, BOAT_CLEARANCE * bs)) ph.speed *= Math.max(0, 1 - 5 * dt);
      if (map.constrain(ph.pos)) ph.speed *= Math.max(0, 1 - 3 * dt);

      // alongside a pier? offer to dock
      let near: number | null = null;
      let best = DOCK_RANGE * bs;
      for (let i = 0; i < map.ports.length; i++) {
        const dd = Math.hypot(
          ph.pos.x - map.ports[i].point.x,
          ph.pos.z - map.ports[i].point.z
        );
        if (dd < best) {
          best = dd;
          near = i;
        }
      }
      if (near !== nearPortRef.current) {
        nearPortRef.current = near;
        onNearPort(near);
      }
    }
    wasManual.current = manual;

    // publish the player's hull so the ambient boats steer clear of it
    BOATS[0].x = ph.pos.x;
    BOATS[0].z = ph.pos.z;
    BOATS[0].active = true;

    if (group.current) {
      const lean =
        -ph.turn * Math.min(Math.abs(ph.speed) / MAX_SPEED, 1) * 0.14;
      rideWaves(group.current, ph.pos.x, ph.pos.z, ph.heading, time, bs, lean);
    }

    // camera: pier framing when docked, otherwise an orbitable chase cam
    const c = cam.current;
    if (dockedIndex !== null) {
      const port = map.ports[dockedIndex];
      // frame the boat and its landmark together, from a little off-axis
      // (from higher up over the real city, above the far bank's rooftops)
      dockFraming(port, ph.pos, bs, _desired);
      _lookAt.copy(port.dockPos).lerp(port.landmarkPos, 0.4).setY(2.1);
      // on wide screens the chapter panel covers the right third: aim to the
      // right of the scene so it sits in the free space on the left
      if (state.size.width >= 768) {
        _normal.subVectors(_lookAt, _desired).cross(_UP).normalize();
        _lookAt.addScaledVector(_normal, 5.5);
      }
    } else {
      // ease the manual orbit back behind the boat once it's underway
      if (
        !c.dragging &&
        Math.abs(ph.speed) > 0.8 &&
        performance.now() - c.lastDrag > 1200
      ) {
        c.yawOff = dampAngle(c.yawOff, 0, 1.1, dt);
      }
      const yaw = ph.heading + Math.PI + c.yawOff;
      const dist = c.dist * camK;
      const horiz = Math.cos(c.pitch) * dist;
      _desired.set(
        ph.pos.x + Math.sin(yaw) * horiz,
        // stay above the rooftops on the real-scale city
        Math.max(1.2 * bs + Math.sin(c.pitch) * dist, bs < 1 ? 7.5 : 0),
        ph.pos.z + Math.cos(yaw) * horiz
      );
      _lookAt.set(
        ph.pos.x + Math.sin(ph.heading) * 2.5 * bs,
        1.5 * bs,
        ph.pos.z + Math.cos(ph.heading) * 2.5 * bs
      );
    }
    const posLambda = manual ? 2.4 : 1.6;
    const lookLambda = manual ? 3.2 : 2.2;
    camPos.current.x = THREE.MathUtils.damp(camPos.current.x, _desired.x, posLambda, dt);
    camPos.current.y = THREE.MathUtils.damp(camPos.current.y, _desired.y, posLambda, dt);
    camPos.current.z = THREE.MathUtils.damp(camPos.current.z, _desired.z, posLambda, dt);
    camLook.current.x = THREE.MathUtils.damp(camLook.current.x, _lookAt.x, lookLambda, dt);
    camLook.current.y = THREE.MathUtils.damp(camLook.current.y, _lookAt.y, lookLambda, dt);
    camLook.current.z = THREE.MathUtils.damp(camLook.current.z, _lookAt.z, lookLambda, dt);
    state.camera.position.copy(camPos.current);
    state.camera.lookAt(camLook.current);
  });

  return (
    <>
      <group ref={group} scale={bs}>
        <MoliceiroModel palette={0} lampPriority />
      </group>
      <WakeTrail target={group} width={1.6 * bs} emit={3.0 * bs} />
      <Shark ref={shark} />
      <Splash ref={splash} />
    </>
  );
}

/** Two slow boats circling for ambience, following the given closed curve. */
export function AmbientBoats({
  curve,
  scale = 1,
  center,
}: {
  curve: THREE.CatmullRomCurve3;
  scale?: number;
  /** centre of the ambient loop, so "inner lane" means inside the loop */
  center: { x: number; z: number };
}) {
  const boatA = useRef<THREE.Group>(null);
  const boatB = useRef<THREE.Group>(null);
  const ts = useRef([0.45, 0.78]);

  useFrame((state, dt) => {
    const refs = [boatA, boatB];
    const speeds = [0.0065, 0.005];
    refs.forEach((ref, i) => {
      ts.current[i] = wrap1(ts.current[i] + speeds[i] * dt);
      const g = ref.current;
      if (!g) return;
      const p = curve.getPointAt(ts.current[i], _pos);
      const tan = curve.getTangentAt(ts.current[i], _tan);
      const n = _normal.set(-tan.z, 0, tan.x).normalize();
      if (n.x * (p.x - center.x) + n.z * (p.z - center.z) < 0) n.negate();
      // sail an inner lane so they never overlap a docked moliceiro
      let bx = p.x - n.x * 2.1 * scale;
      let bz = p.z - n.z * 2.1 * scale;
      // yield to the player (slot 0) and the other ambient boat
      const slot = i + 1;
      for (const j of [0, i === 0 ? 2 : 1]) {
        const b = BOATS[j];
        if (!b.active) continue;
        const dx = bx - b.x;
        const dz = bz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.0001 && d < BOAT_CLEARANCE * scale) {
          const push = BOAT_CLEARANCE * scale - d;
          bx += (dx / d) * push;
          bz += (dz / d) * push;
        }
      }
      BOATS[slot].x = bx;
      BOATS[slot].z = bz;
      BOATS[slot].active = true;
      rideWaves(g, bx, bz, Math.atan2(tan.x, tan.z), state.clock.elapsedTime, 0.8 * scale);
    });
  });

  useEffect(() => {
    return () => {
      BOATS[1].active = false;
      BOATS[2].active = false;
    };
  }, []);


  return (
    <>
      <group ref={boatA} scale={0.8 * scale}>
        <MoliceiroModel palette={1} />
      </group>
      <group ref={boatB} scale={0.75 * scale}>
        <MoliceiroModel palette={2} />
      </group>
      <WakeTrail target={boatA} width={1.2 * scale} emit={2.3 * scale} />
      <WakeTrail target={boatB} width={1.15 * scale} emit={2.2 * scale} />
    </>
  );
}
