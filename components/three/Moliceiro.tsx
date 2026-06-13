"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { shortestDelta, wrap1 } from "@/lib/ports";
import type { MapDef } from "@/lib/maps";
import { getSurface, getTexture } from "@/lib/textures";

const GLB_URL = "/models/moliceiro.glb";
/** Tweak these if the Sketchfab model sits oddly (flip extraRotY to Math.PI if it sails backwards).
 *  draft = how deep the hull's bounding-box bottom sits below the waterline. */
const GLB_TUNE = { length: 7.2, draft: -0.35, extraRotY: 0 };

const MAX_SPEED = 9.5;
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
function avoidBoats(pos: THREE.Vector3, selfIndex: number) {
  let hit = false;
  for (let i = 0; i < BOATS.length; i++) {
    if (i === selfIndex) continue;
    const b = BOATS[i];
    if (!b.active) continue;
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.0001 && d < BOAT_CLEARANCE) {
      const push = BOAT_CLEARANCE - d;
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
const _wakeMat = new THREE.Matrix4();
const _wakeQuat = new THREE.Quaternion();
const _wakeV = new THREE.Vector3();
const _wakeS = new THREE.Vector3();
const _wakeCol = new THREE.Color();

const WAKE_COUNT = 64;
const WAKE_LIFE = 1.8;

// one shared probe so every boat agrees on whether the GLB exists
let glbProbe: Promise<boolean> | null = null;
function probeGlb() {
  glbProbe ??= fetch(GLB_URL, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);
  return glbProbe;
}

function useHasGlb() {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let on = true;
    probeGlb().then((v) => {
      if (on) setHas(v);
    });
    return () => {
      on = false;
    };
  }, []);
  return has;
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

export function ProceduralMoliceiro({
  accent = "#f2b705",
  accent2 = "#c93a2e",
}: {
  accent?: string;
  accent2?: string;
}) {
  const hull = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.6, 0);
    s.lineTo(2.3, 0);
    s.quadraticCurveTo(3.0, 0.1, 3.55, 1.75); // swan-neck bow
    s.quadraticCurveTo(3.1, 0.9, 2.2, 0.72);
    s.lineTo(-2.0, 0.66);
    s.quadraticCurveTo(-2.8, 0.7, -3.05, 1.2); // raised stern
    s.quadraticCurveTo(-2.85, 0.35, -2.6, 0);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 1.3,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 2,
      steps: 1,
    });
    g.translate(0, 0, -0.65);
    return g;
  }, []);

  return (
    <group rotation-y={-Math.PI / 2} scale={0.92}>
      <mesh geometry={hull} castShadow>
        <meshStandardMaterial color="#1d2b29" roughness={0.75} />
      </mesh>
      {/* deck */}
      <mesh position={[-0.15, 0.56, 0]} castShadow>
        <boxGeometry args={[4.1, 0.1, 1.05]} />
        <meshStandardMaterial color="#cbb393" {...getSurface("wood", 2, 0.5)} />
      </mesh>
      {/* painted bow panels */}
      <group position={[2.35, 0.92, 0]} rotation-z={0.55}>
        <mesh castShadow>
          <boxGeometry args={[1.3, 0.55, 1.62]} />
          <meshStandardMaterial color={accent} roughness={0.7} />
        </mesh>
        <mesh position-y={0.33}>
          <boxGeometry args={[1.34, 0.15, 1.64]} />
          <meshStandardMaterial color={accent2} roughness={0.7} />
        </mesh>
      </group>
      {/* painted stern panel */}
      <group position={[-2.45, 0.78, 0]} rotation-z={-0.45}>
        <mesh castShadow>
          <boxGeometry args={[0.95, 0.45, 1.58]} />
          <meshStandardMaterial color={accent2} roughness={0.7} />
        </mesh>
        <mesh position-y={0.27}>
          <boxGeometry args={[0.99, 0.12, 1.6]} />
          <meshStandardMaterial color={accent} roughness={0.7} />
        </mesh>
      </group>
      {/* boatman with his vara */}
      <group position={[-1.55, 0.6, 0]}>
        <mesh position-y={0.34} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.62, 8]} />
          <meshStandardMaterial color="#2b2b35" roughness={0.9} />
        </mesh>
        <mesh position-y={0.78} castShadow>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshStandardMaterial color="#e8b88f" roughness={0.8} />
        </mesh>
        <mesh position-y={0.9}>
          <cylinderGeometry args={[0.19, 0.19, 0.04, 10]} />
          <meshStandardMaterial color="#1c1c22" roughness={0.9} />
        </mesh>
        <mesh position={[0.32, 0.45, 0.25]} rotation-z={-0.55} rotation-x={0.2}>
          <cylinderGeometry args={[0.025, 0.025, 2.6, 6]} />
          <meshStandardMaterial color="#8a6b43" roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

function GlbMoliceiro() {
  const { scene } = useGLTF(GLB_URL);

  const prepared = useMemo(() => {
    const obj = scene.clone(true);
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(obj);
    // normalise: longest horizontal side becomes the boat length, and the
    // bounding-box bottom sits at a fixed draft — independent of mast height,
    // which is why a fraction-of-height lift sank the hull
    if (size.z > size.x) obj.rotation.y = Math.PI / 2;
    const s = GLB_TUNE.length / Math.max(size.x, size.z);
    wrapper.scale.setScalar(s);
    wrapper.position.y = (size.y * s) / 2 - GLB_TUNE.draft;
    wrapper.rotation.y = GLB_TUNE.extraRotY;
    return wrapper;
  }, [scene]);

  return (
    <group rotation-y={-Math.PI / 2}>
      <primitive object={prepared} />
    </group>
  );
}

export default function Moliceiro({
  map,
  targetIndex,
  dockedIndex,
  joystick,
  onArrive,
  onManualStart,
  onNearPort,
  onRequestDock,
}: {
  map: MapDef;
  targetIndex: number | null;
  dockedIndex: number | null;
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

  // wake foam particles (ring buffer; age >= WAKE_LIFE means free slot)
  const wakeMesh = useRef<THREE.InstancedMesh>(null);
  const wake = useRef<{
    parts: Array<{ x: number; z: number; vx: number; vz: number; age: number }>;
    next: number;
    timer: number;
  } | null>(null);
  if (wake.current == null) {
    wake.current = {
      parts: Array.from({ length: WAKE_COUNT }, () => ({
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        age: WAKE_LIFE,
      })),
      next: 0,
      timer: 0,
    };
  }
  const wakeGeom = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
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

  const hasGlb = useHasGlb();

  useEffect(() => {
    arrived.current = false;
  }, [targetIndex]);

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
          const v = THREE.MathUtils.clamp(
            Math.min(rt.s + 2, rt.length - rt.s) * 0.9,
            1.6,
            14
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
      if (avoidBoats(ph.pos, 0)) ph.speed *= Math.max(0, 1 - 5 * dt);
      if (map.constrain(ph.pos)) ph.speed *= Math.max(0, 1 - 3 * dt);

      // alongside a pier? offer to dock
      let near: number | null = null;
      let best = DOCK_RANGE;
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
      group.current.position.set(ph.pos.x, Math.sin(time * 1.6) * 0.06 + 0.02, ph.pos.z);
      group.current.rotation.y = ph.heading;
      group.current.rotation.z = Math.sin(time * 1.1) * 0.025 + lean;
      group.current.rotation.x = Math.sin(time * 1.4 + 1) * 0.02;
    }

    // wake foam: prop wash astern + bow waves drifting out into a V
    const wk = wake.current!;
    const wm = wakeMesh.current;
    if (wm) {
      const spd = Math.abs(ph.speed);
      wk.timer -= dt;
      if (spd > 1.2 && wk.timer <= 0) {
        wk.timer = THREE.MathUtils.clamp(0.8 / spd, 0.12, 0.4);
        const fx = Math.sin(ph.heading);
        const fz = Math.cos(ph.heading);
        const sx = fz;
        const sz = -fx;
        const emit = (px: number, pz: number, vx: number, vz: number) => {
          const p = wk.parts[wk.next];
          wk.next = (wk.next + 1) % WAKE_COUNT;
          p.x = px + (Math.random() - 0.5) * 0.35;
          p.z = pz + (Math.random() - 0.5) * 0.35;
          p.vx = vx;
          p.vz = vz;
          p.age = 0;
        };
        const drift = 0.55 + spd * 0.07;
        emit(ph.pos.x - fx * 2.4, ph.pos.z - fz * 2.4, -fx * 0.5, -fz * 0.5);
        emit(
          ph.pos.x + fx * 2.0 + sx * 1.1,
          ph.pos.z + fz * 2.0 + sz * 1.1,
          sx * drift,
          sz * drift
        );
        emit(
          ph.pos.x + fx * 2.0 - sx * 1.1,
          ph.pos.z + fz * 2.0 - sz * 1.1,
          -sx * drift,
          -sz * drift
        );
      }
      for (let i = 0; i < WAKE_COUNT; i++) {
        const p = wk.parts[i];
        if (p.age < WAKE_LIFE) {
          p.age += dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
        }
        const t = Math.min(p.age / WAKE_LIFE, 1);
        const scale = t >= 1 ? 0 : 0.35 + t * 1.6;
        _wakeMat.compose(
          _wakeV.set(p.x, 0.3, p.z),
          _wakeQuat,
          _wakeS.setScalar(scale)
        );
        wm.setMatrixAt(i, _wakeMat);
        wm.setColorAt(i, _wakeCol.setScalar(t >= 1 ? 0 : (1 - t) * (1 - t) * 0.32));
      }
      wm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
    }

    // camera: pier framing when docked, otherwise an orbitable chase cam
    const c = cam.current;
    if (dockedIndex !== null) {
      const port = map.ports[dockedIndex];
      _desired
        .copy(ph.pos)
        .addScaledVector(port.outward, -14.5)
        .addScaledVector(port.tangent, 4.5)
        .setY(7.4);
      _lookAt.copy(port.dockPos).setY(1.8);
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
      const horiz = Math.cos(c.pitch) * c.dist;
      _desired.set(
        ph.pos.x + Math.sin(yaw) * horiz,
        1.2 + Math.sin(c.pitch) * c.dist,
        ph.pos.z + Math.cos(yaw) * horiz
      );
      _lookAt.set(
        ph.pos.x + Math.sin(ph.heading) * 2.5,
        1.5,
        ph.pos.z + Math.cos(ph.heading) * 2.5
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
      <group ref={group}>
        {hasGlb ? (
          <Suspense fallback={<ProceduralMoliceiro />}>
            <GlbMoliceiro />
          </Suspense>
        ) : (
          <ProceduralMoliceiro />
        )}
      </group>
      <instancedMesh
        ref={wakeMesh}
        args={[undefined, undefined, WAKE_COUNT]}
        frustumCulled={false}
      >
        <primitive object={wakeGeom} attach="geometry" />
        <meshBasicMaterial
          map={getTexture("foam")}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}

/** Two slow boats circling for ambience, following the given closed curve. */
export function AmbientBoats({ curve }: { curve: THREE.CatmullRomCurve3 }) {
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
      if (n.dot(p) < 0) n.negate();
      // sail an inner lane so they never overlap a docked moliceiro
      let bx = p.x - n.x * 2.1;
      let bz = p.z - n.z * 2.1;
      // yield to the player (slot 0) and the other ambient boat
      const slot = i + 1;
      for (const j of [0, i === 0 ? 2 : 1]) {
        const b = BOATS[j];
        if (!b.active) continue;
        const dx = bx - b.x;
        const dz = bz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.0001 && d < BOAT_CLEARANCE) {
          const push = BOAT_CLEARANCE - d;
          bx += (dx / d) * push;
          bz += (dz / d) * push;
        }
      }
      BOATS[slot].x = bx;
      BOATS[slot].z = bz;
      BOATS[slot].active = true;
      g.position.set(bx, Math.sin(state.clock.elapsedTime * 1.3 + i * 2) * 0.05, bz);
      g.rotation.y = Math.atan2(tan.x, tan.z);
    });
  });

  useEffect(() => {
    return () => {
      BOATS[1].active = false;
      BOATS[2].active = false;
    };
  }, []);

  const hasGlb = useHasGlb();
  const boat = (accent: string, accent2: string) =>
    hasGlb ? (
      <Suspense fallback={<ProceduralMoliceiro accent={accent} accent2={accent2} />}>
        <GlbMoliceiro />
      </Suspense>
    ) : (
      <ProceduralMoliceiro accent={accent} accent2={accent2} />
    );

  return (
    <>
      <group ref={boatA} scale={0.8}>
        {boat("#2f7fbf", "#f2b705")}
      </group>
      <group ref={boatB} scale={0.75}>
        {boat("#3f9d6b", "#d6452e")}
      </group>
    </>
  );
}
