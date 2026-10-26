"use client";

import { forwardRef, useImperativeHandle, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tinted } from "@/lib/geometry";
import { getTexture } from "@/lib/textures";

/**
 * A great white for the "you sailed off the map" gag: a lofted, countershaded
 * body (grey back, white belly), dorsal, pectoral and tail fins, and a hinged
 * lower jaw lined with teeth. Built along +x (snout), about 8 units long.
 * The parent animates it; `jaw` and `tail` are exposed through the returned
 * group's userData so the attack can open the mouth and wag the tail.
 */

export const SHARK_LENGTH = 8;
const L = SHARK_LENGTH;
const BACK = new THREE.Color("#5d7180");
const BELLY = new THREE.Color("#eef0ee");

// thickness along the body, u = 0 at the tail stock .. 1 at the snout
function girth(u: number) {
  // thickest just ahead of the middle, a slim tail stock, a pointed snout
  const body = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, u * 0.94 + 0.03), 1.35)), 0.75);
  const snout = u > 0.8 ? 1 - Math.pow((u - 0.8) / 0.2, 1.6) * 0.82 : 1;
  return Math.max(0.05, body * snout);
}

function bodyGeometry() {
  const SECTIONS = 40;
  const AROUND = 18;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= SECTIONS; i++) {
    const u = i / SECTIONS;
    const x = (u - 0.5) * L;
    const g = girth(u);
    const hy = 0.78 * g;
    const hz = 0.6 * g;
    // the snout dips a little, the belly is flatter than the back
    const yc = u > 0.8 ? -(u - 0.8) * 0.6 : 0;
    for (let j = 0; j < AROUND; j++) {
      const a = (j / AROUND) * Math.PI * 2;
      const sy = Math.sin(a);
      const y = yc + (sy > 0 ? sy * hy : sy * hy * 0.8);
      const z = Math.cos(a) * hz;
      pos.push(x, y, z);
      // countershading: a soft line along the flank
      c.copy(BELLY).lerp(BACK, THREE.MathUtils.smoothstep(sy, -0.35, 0.05));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SECTIONS; i++) {
    for (let j = 0; j < AROUND; j++) {
      const a = i * AROUND + j;
      const b = i * AROUND + ((j + 1) % AROUND);
      const a2 = a + AROUND;
      const b2 = b + AROUND;
      idx.push(a, a2, b, b, a2, b2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A flat fin from an outline in its own (x, y) plane, given a little thickness. */
function fin(points: Array<[number, number]>, depth = 0.06) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

const PARTS = (() => {
  const body = bodyGeometry();
  const finBits = mergeGeometries([
    // dorsal fin, swept back
    tinted(fin([[0.9, 0.6], [-0.4, 1.9], [-0.7, 0.55]]), BACK),
    // pectoral fins
    tinted(fin([[1.3, 0], [0.1, -0.15], [-0.3, -1.25]], 0.05).rotateX(Math.PI / 2 - 0.5).translate(0, -0.35, 0.5), BACK),
    tinted(fin([[1.3, 0], [0.1, -0.15], [-0.3, -1.25]], 0.05).rotateX(-Math.PI / 2 + 0.5).translate(0, -0.35, -0.5), BACK),
  ]);
  // the tail: a tall crescent, upper lobe longer, hinged at the tail stock
  const tail = tinted(fin([[0, 0.15], [-1.1, 1.5], [-0.75, 0.1], [-0.95, -0.95], [0, -0.15]], 0.08), BACK);
  // lower jaw: a shallow wedge hinged at the corners of the mouth
  const jaw = tinted(
    new THREE.CylinderGeometry(0.42, 0.05, 1.5, 12, 1, false, Math.PI, Math.PI)
      .rotateZ(Math.PI / 2)
      .scale(1, 0.55, 1)
      .translate(0.75, 0, 0),
    BELLY
  );
  // two rows of teeth (upper on the head, lower on the jaw)
  const row = (y: number, down: boolean) =>
    mergeGeometries(
      Array.from({ length: 11 }, (_, i) => {
        const a = ((i / 10) - 0.5) * Math.PI * 0.9;
        return new THREE.ConeGeometry(0.05, 0.16, 4)
          .rotateZ(down ? Math.PI : 0)
          .translate(0.5 + Math.cos(a) * 0.6, y, Math.sin(a) * 0.34);
      })
    );
  const upperTeeth = row(-0.07, true);
  const lowerTeeth = row(0.07, false);
  // the dark inside of the mouth
  const mouth = new THREE.CircleGeometry(0.42, 16).rotateY(Math.PI / 2).scale(1, 0.75, 1);
  return { body, finBits, tail, jaw, upperTeeth, lowerTeeth, mouth };
})();

const SKIN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
const TEETH = new THREE.MeshStandardMaterial({ color: "#fbfaf2", roughness: 0.4 });
const MOUTH = new THREE.MeshBasicMaterial({ color: "#3a0d10", side: THREE.DoubleSide });
const EYE = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.2 });

export const Shark = forwardRef<THREE.Group>(function Shark(_, ref) {
  const eyes = useMemo(() => [0.33, -0.33], []);
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={PARTS.body} material={SKIN} castShadow />
      <mesh geometry={PARTS.finBits} material={SKIN} castShadow />
      {/* tail, hinged at the stock so it can sweep */}
      <group name="tail" position={[-L / 2 + 0.15, 0, 0]}>
        <mesh geometry={PARTS.tail} material={SKIN} castShadow />
      </group>
      {/* head: the mouth opens below the snout */}
      <group position={[L / 2 - 1.55, -0.32, 0]}>
        <mesh geometry={PARTS.mouth} material={MOUTH} position={[0.55, 0, 0]} rotation-z={0.35} />
        <mesh geometry={PARTS.upperTeeth} material={TEETH} />
        <group name="jaw">
          <mesh geometry={PARTS.jaw} material={SKIN} />
          <mesh geometry={PARTS.lowerTeeth} material={TEETH} />
        </group>
      </group>
      {eyes.map((z) => (
        <mesh key={z} position={[L / 2 - 0.75, 0.12, z]} material={EYE}>
          <sphereGeometry args={[0.07, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
});

// ── the attack ──────────────────────────────────────────────────────────────

/** The bite point in the shark's own (unscaled) frame. */
const BITE_POINT = new THREE.Vector3(L / 2 - 0.55, -0.42, 0);

/** Seconds into the attack: the bite, the black-out and the respawn. */
export const ATTACK = { bite: 2.5, veil: 3.3, respawn: 3.75 };

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YZX");
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Vector3();
const _ACROSS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

/** Orientation that points the shark's snout (+x) along `dir`, banked by `roll`. */
function facing(dir: THREE.Vector3, roll: number, out: THREE.Quaternion) {
  const d = _d.copy(dir).normalize();
  _e.set(roll, Math.atan2(-d.z, d.x), Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), "YZX");
  return out.setFromEuler(_e);
}

const smooth = (x: number) => THREE.MathUtils.smootherstep(x, 0, 1);

/**
 * One attack on a boat at `boat` (heading `heading`, scale `k`): the dorsal fin
 * cuts in from ahead, the shark sounds, breaches through the hull with its jaws
 * open, bites, and carries the boat back under in an arc.
 */
export class SharkAttack {
  t = 0;
  private readonly b: THREE.Vector3;
  private readonly fwd: THREE.Vector3;
  private readonly side: THREE.Vector3;
  private readonly k: number;
  private readonly breach: THREE.CatmullRomCurve3;
  private splashes = 0;

  constructor(boat: THREE.Vector3, heading: number, k: number) {
    this.b = boat.clone().setY(0);
    this.fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    this.side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    this.k = k;
    const at = (s: number, up: number) => this.b.clone().addScaledVector(this.side, s * k).setY(up * k);
    // the mouth's path: up from the deep beside the boat, through the hull, over and down
    this.breach = new THREE.CatmullRomCurve3([at(1.6, -3.6), at(0, 0.45), at(-1.2, 2.6), at(-3.4, -4.2)]);
  }

  /** The fin's run-in: the shark cruising just under the surface toward the boat. */
  private finPose(u: number, out: THREE.Vector3, dir: THREE.Vector3) {
    const k = this.k;
    const p0 = _v.copy(this.b).addScaledVector(this.fwd, 15 * k).addScaledVector(this.side, 6 * k);
    const p1 = _m.copy(this.b).addScaledVector(this.fwd, 3.2 * k).addScaledVector(this.side, 2.4 * k);
    out.lerpVectors(p0, p1, u).addScaledVector(this.side, Math.sin(u * Math.PI) * 2.5 * k).setY(-1.15 * k);
    dir.subVectors(p1, p0).addScaledVector(this.side, Math.cos(u * Math.PI) * Math.PI * 2.5 * k);
  }

  /** Where the mouth is at time t of the breach, and which way the shark faces. */
  private breachPose(t: number, out: THREE.Vector3, dir: THREE.Vector3) {
    // the curve's knots fall at 0, 1/3, 2/3, 1: map the timeline onto them
    const u =
      t < ATTACK.bite
        ? THREE.MathUtils.mapLinear(t, 2.0, ATTACK.bite, 0, 1 / 3)
        : t < 2.85
          ? THREE.MathUtils.mapLinear(t, ATTACK.bite, 2.85, 1 / 3, 2 / 3)
          : THREE.MathUtils.mapLinear(t, 2.85, 3.6, 2 / 3, 1);
    const c = THREE.MathUtils.clamp(u, 0, 1);
    this.breach.getPoint(c, out);
    this.breach.getTangent(c, dir);
  }

  /**
   * Pose the shark (and the boat, once caught) for this moment. `burst` throws
   * a splash where the shark breaks the surface.
   */
  pose(shark: THREE.Object3D, boat: THREE.Object3D, time: number, burst: (x: number, z: number) => void) {
    const { t, k } = this;
    shark.visible = true;
    shark.scale.setScalar(k);
    const jaw = shark.getObjectByName("jaw");
    const tail = shark.getObjectByName("tail");
    if (tail) tail.rotation.y = Math.sin(time * (t < 2 ? 9 : 15)) * 0.35;

    if (t < 1.6) {
      const u = smooth(t / 1.6);
      this.finPose(u, shark.position, _d);
      shark.quaternion.copy(facing(_d, -Math.sin(u * Math.PI) * 0.2, _q));
    } else if (t < 2.0) {
      // sound: from the end of the run-in down to where the breach starts
      const v = smooth((t - 1.6) / 0.4);
      const finEnd = new THREE.Vector3();
      const finDir = new THREE.Vector3();
      this.finPose(1, finEnd, finDir);
      facing(finDir, 0, _q);
      this.breachPose(2.0, _m, _d);
      facing(_d, 0, _q2);
      const start = _v.copy(BITE_POINT).multiplyScalar(k).applyQuaternion(_q2);
      const breachCentre = _m.sub(start);
      shark.position.lerpVectors(finEnd, breachCentre, v);
      shark.quaternion.slerpQuaternions(_q, _q2, v);
    } else {
      this.breachPose(t, _m, _d);
      facing(_d, 0, _q);
      shark.quaternion.copy(_q);
      shark.position.copy(_m).sub(_v.copy(BITE_POINT).multiplyScalar(k).applyQuaternion(_q));
      // splashes where the shark breaks out of the water and back into it
      if (this.splashes === 0) {
        burst(this.b.x + this.side.x * 1.6 * k, this.b.z + this.side.z * 1.6 * k);
        this.splashes = 1;
      } else if (this.splashes === 1 && t > 2.85 && _m.y < 0) {
        burst(_m.x, _m.z);
        this.splashes = 2;
      }
    }

    // jaws: open on the way up, snap shut on the hull
    if (jaw) {
      const open =
        t < 1.9 ? 0 : t < 2.3 ? smooth((t - 1.9) / 0.4) : t < 2.45 ? 1 : 1 - smooth((t - 2.45) / 0.07);
      jaw.rotation.z = -0.85 * open;
    }

    // caught: the hull lies across the jaws and goes where the shark goes
    if (t >= ATTACK.bite) {
      boat.position.copy(_m);
      boat.quaternion.copy(shark.quaternion).multiply(_ACROSS);
    }
  }
}

// ── splash ──────────────────────────────────────────────────────────────────

const DROPS = 70;

export interface SplashHandle {
  burst: (x: number, z: number, k: number) => void;
}

/** A burst of spray: white drops thrown up and out, falling back into the water. */
export const Splash = forwardRef<SplashHandle>(function Splash(_, ref) {
  const state = useMemo(
    () => ({
      p: new Float32Array(DROPS * 3),
      v: new Float32Array(DROPS * 3),
      life: new Float32Array(DROPS),
      next: 0,
    }),
    []
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(state.p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(DROPS * 4), 4));
    return g;
  }, [state]);

  useImperativeHandle(ref, () => ({
    burst(x, z, k) {
      for (let n = 0; n < 34; n++) {
        const i = state.next;
        state.next = (state.next + 1) % DROPS;
        const a = Math.random() * Math.PI * 2;
        const r = (0.4 + Math.random() * 1.2) * k;
        state.p.set([x + Math.cos(a) * r, 0.1, z + Math.sin(a) * r], i * 3);
        const out = (1.5 + Math.random() * 2.5) * k;
        state.v.set([Math.cos(a) * out, (4 + Math.random() * 5) * k, Math.sin(a) * out], i * 3);
        state.life[i] = 1;
      }
    },
  }));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    for (let i = 0; i < DROPS; i++) {
      if (state.life[i] <= 0) {
        col.setW(i, 0);
        continue;
      }
      state.life[i] -= dt * 0.9;
      state.v[i * 3 + 1] -= 14 * dt;
      for (let c = 0; c < 3; c++) state.p[i * 3 + c] += state.v[i * 3 + c] * dt;
      col.setXYZW(i, 1, 1, 1, Math.max(0, state.life[i]) * 0.9);
    }
    geo.getAttribute("position").needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        map={getTexture("foam")}
        size={0.9}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
      />
    </points>
  );
});
