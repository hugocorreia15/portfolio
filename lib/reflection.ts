import * as THREE from "three";
import { applyLampView } from "@/lib/lampLights";

/**
 * Everything in the scene is mirrored except what sits on this layer: the
 * water itself, the sky (dome, stars, discs, clouds — the water draws its own
 * sky), the wakes lying on the surface, and small props whose reflections
 * nobody would miss but which cost draw calls. The main camera (and the
 * pointer raycaster) also see this layer; the mirror camera doesn't.
 */
export const NO_MIRROR_LAYER = 2;

/** Keep an object and everything under it out of the water's reflection. */
export function hideFromMirror(obj: THREE.Object3D) {
  obj.traverse((o) => o.layers.set(NO_MIRROR_LAYER));
}

/** Let the main camera and the raycaster see the mirror-less layer. */
export function showNoMirrorLayer(camera: THREE.Camera, raycaster: THREE.Raycaster) {
  camera.layers.enable(NO_MIRROR_LAYER);
  raycaster.layers.enable(NO_MIRROR_LAYER);
}

/** Reflections end here; the water fades them out before (see Water.tsx). */
export const MIRROR_FAR = 120;

let quality = 1;
/**
 * 0..1 from the scene's performance monitor: on slow machines the mirror
 * renders at a lower resolution (in one step, so the target isn't reallocated
 * every time the monitor changes its mind).
 */
export function setMirrorQuality(q: number) {
  quality = q < 0.4 ? 0 : 1;
}

/** Draw calls of the last mirror pass (read by ?stats). */
export const mirrorStats = { calls: 0 };

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _rot = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _plane = new THREE.Plane();
const _clip = new THREE.Vector4();
const _q = new THREE.Vector4();
const _size = new THREE.Vector2();
const _clear = new THREE.Color();

/** The uniforms a water shader needs to sample the mirror. */
export function mirrorUniforms() {
  return {
    uRefl: { value: null as THREE.Texture | null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflOn: { value: 0 },
  };
}
export type MirrorUniforms = ReturnType<typeof mirrorUniforms>;

/**
 * Planar reflection of the scene about the water level, rendered at a
 * fraction of the screen resolution from a mirrored camera (the classic
 * Reflector set-up, with an oblique near plane on the water) and a shorter
 * far plane. The water samples it through `uReflMatrix`.
 */
export class WaterMirror {
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly camera = new THREE.PerspectiveCamera();
  private busy = false;

  constructor(
    private readonly resolution = 0.4,
    private readonly level = 0
  ) {
    this.camera.layers.set(0);
  }

  /**
   * Call from the water's onBeforeRender, with the uniforms of the material
   * being drawn (the mirror writes its texture and matrix into them).
   */
  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, uniforms: MirrorUniforms) {
    if (this.busy || !(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return;
    const cam = camera as THREE.PerspectiveCamera;
    _pos.setFromMatrixPosition(cam.matrixWorld);
    // half floats keep the glows bright, where the GPU can render to them
    if (!this.target) {
      const half =
        gl.extensions.has("EXT_color_buffer_half_float") || gl.extensions.has("EXT_color_buffer_float");
      this.target = new THREE.WebGLRenderTarget(1, 1, {
        type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
        // anti-aliased, so thin edges (quay tops, masts) don't shimmer as the camera moves
        samples: 4,
      });
    }
    const target = this.target;
    uniforms.uReflOn.value = _pos.y > this.level + 0.05 ? 1 : 0;
    uniforms.uRefl.value = target.texture;
    if (!uniforms.uReflOn.value) return;

    gl.getDrawingBufferSize(_size);
    const res = this.resolution * (quality ? 1 : 0.7);
    const w = Math.max(64, Math.round(_size.x * res));
    const h = Math.max(64, Math.round(_size.y * res));
    if (target.width !== w || target.height !== h) target.setSize(w, h);

    // the mirrored camera: position, view target and up reflected in the plane
    const v = this.camera;
    _rot.extractRotation(cam.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_pos);
    v.position.set(_pos.x, 2 * this.level - _pos.y, _pos.z);
    _look.y = 2 * this.level - _look.y;
    v.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_up);
    v.lookAt(_look);
    v.updateMatrixWorld();
    v.fov = cam.fov;
    v.aspect = cam.aspect;
    v.zoom = cam.zoom;
    v.near = cam.near;
    v.far = Math.min(cam.far, MIRROR_FAR);
    v.updateProjectionMatrix();

    uniforms.uReflMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(v.projectionMatrix)
      .multiply(v.matrixWorldInverse);

    // oblique near plane on the water, so nothing below it gets mirrored
    _plane.set(_up, -this.level).applyMatrix4(v.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const e = v.projectionMatrix.elements;
    _q.set((Math.sign(_clip.x) + e[8]) / e[0], (Math.sign(_clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    _clip.multiplyScalar(2 / _clip.dot(_q));
    e[2] = _clip.x;
    e[6] = _clip.y;
    e[10] = _clip.z + 1;
    e[14] = _clip.w;

    // the scene minus the water and sky, over a transparent background
    const calls0 = gl.info.render.calls;
    const prevTarget = gl.getRenderTarget();
    const prevBackground = scene.background;
    const prevAutoUpdate = scene.matrixWorldAutoUpdate;
    const prevShadows = gl.shadowMap.autoUpdate;
    const prevAlpha = gl.getClearAlpha();
    gl.getClearColor(_clear);
    this.busy = true;
    scene.background = null;
    scene.matrixWorldAutoUpdate = false;
    gl.shadowMap.autoUpdate = false;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, v);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(_clear, prevAlpha);
    scene.background = prevBackground;
    scene.matrixWorldAutoUpdate = prevAutoUpdate;
    gl.shadowMap.autoUpdate = prevShadows;
    mirrorStats.calls = gl.info.render.calls - calls0;
    this.busy = false;
    // the mirror pass moved the lamps into its own view space: put them back
    applyLampView(cam);
  }

  dispose() {
    this.target?.dispose();
    this.target = null;
  }
}
