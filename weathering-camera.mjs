import {Box3, Spherical, Vector3} from './vendor/three/build/three.module.js';

const PIVOT = new Vector3(0, .15, 0);
const VIEWS = {
  top: {position: [-1.2, 2.75, 1.65], target: [-.35, .94, .02]},
  handle: {position: [.9, 1.9, 1.5], target: [0, 1.19, .02]},
  edge: {position: [2.55, 1.9, 2.08], target: [1.17, .75, .59]},
  base: {position: [2.32, -2.05, 2.28], target: [.70, -.73, .34]},
  runoff: {position: [.25, 1.1, 3.3], target: [0, .1, .65]},
};
const DURATION = 700;
const ease = t => t * t * (3 - 2 * t);
// Body and lid only, with .13 clearance for the near clipping plane.
const BLOCKERS = [
  new Box3(new Vector3(-1.38, -.90, -.78), new Vector3(1.38, .90, .78)),
  new Box3(new Vector3(-1.45, .64, -.85), new Vector3(1.45, 1.10, .85)),
];

/**
 * The owner drives update(now) with its RAF timestamp, renders that frame, and
 * invalidates again while isMoving. This controller never starts its own loop.
 * View changes are reported at selection; manual orbit cancels at the current
 * position. Preset paths stay outside the canonical case, via a central orbit.
 */
export function createWeatheringCamera({camera, controls, stage, invalidate, onViewChange = () => {}}) {
  let transition = null, disposed = false;
  const motion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const maxDistance = controls.maxDistance;
  const offset = new Vector3(), spherical = new Spherical();

  function cancel() {
    if (!transition) return;
    controls.enableDamping = transition.damping;
    controls.maxDistance = Math.max(maxDistance, camera.position.distanceTo(controls.target));
    transition = null;
  }

  // OrbitControls has no public damping-reset method. Drain its delta with
  // damping disabled, then restore the visible pose before beginning a path.
  function flushDamping() {
    const position = camera.position.clone(), target = controls.target.clone();
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    controls.enableDamping = damping;
  }

  function destination(name) {
    if (name === 'overview') {
      const scale = stage?.clientWidth / stage?.clientHeight > 1.4 ? .8 : 1;
      return {position: new Vector3(4.3, 3.1, 5.1).multiplyScalar(scale),
        target: new Vector3(0, .10, 0), minDistance: 3.7};
    }
    const view = VIEWS[name];
    const position = new Vector3(...view.position), target = new Vector3(...view.target);
    if (name === 'runoff') {
      // Keep both latch-fed water paths in frame on tall mobile previews.
      const ratio = stage?.clientWidth / stage?.clientHeight;
      const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5;
      position.sub(target).multiplyScalar(Math.max(1, 1.5 / aspect)).add(target);
    }
    return {position, target, minDistance: 1.15};
  }

  function finish() {
    const current = transition;
    camera.position.copy(current.end.position);
    controls.target.copy(current.end.target);
    controls.minDistance = current.end.minDistance;
    controls.maxDistance = Math.max(maxDistance, camera.position.distanceTo(controls.target));
    controls.update();
    controls.enableDamping = current.damping;
    transition = null;
  }

  function moveTo(name, animate) {
    if (disposed) return false;
    cancel();
    flushDamping();
    const end = destination(name);
    const start = new Spherical().setFromVector3(camera.position.clone().sub(PIVOT));
    const stop = new Spherical().setFromVector3(end.position.clone().sub(PIVOT));
    transition = {
      start, stop, end, target: controls.target.clone(), started: null,
      damping: controls.enableDamping,
      radius: Math.max(3.25, start.radius, stop.radius),
      angle: Math.atan2(Math.sin(stop.theta - start.theta), Math.cos(stop.theta - start.theta)),
    };
    controls.enableDamping = false;
    // Raising this to the overview limit before reaching it would cause a snap.
    controls.minDistance = Math.min(controls.minDistance, 1.15);
    // The orbit pivot differs from the close-up target; its radius may exceed
    // the user's zoom limit. Do not let OrbitControls truncate this safe path.
    controls.maxDistance = Math.max(maxDistance, transition.radius + Math.max(
      transition.target.distanceTo(PIVOT), end.target.distanceTo(PIVOT)));
    if (!animate || motion?.matches) finish();
    onViewChange(name);
    invalidate();
    return true;
  }

  function update(now) {
    if (!transition || disposed) return false;
    if (motion?.matches) {finish(); return false;}
    const current = transition;
    if (!Number.isFinite(now)) return true;
    if (current.started === null) current.started = now;
    const elapsed = Math.max(0, (now - current.started) / DURATION);
    if (elapsed >= 1) {finish(); return false;}
    if (elapsed < .22) {
      const t = ease(elapsed / .22);
      spherical.set(current.start.radius + (current.radius - current.start.radius) * t,
        current.start.phi, current.start.theta);
      controls.target.lerpVectors(current.target, PIVOT, t);
    } else if (elapsed < .78) {
      const t = ease((elapsed - .22) / .56);
      spherical.set(current.radius, current.start.phi + (current.stop.phi - current.start.phi) * t,
        current.start.theta + current.angle * t);
      controls.target.copy(PIVOT);
    } else {
      const t = ease((elapsed - .78) / .22);
      spherical.set(current.radius + (current.stop.radius - current.radius) * t,
        current.stop.phi, current.stop.theta);
      controls.target.lerpVectors(PIVOT, current.end.target, t);
    }
    camera.position.copy(PIVOT).add(offset.setFromSpherical(spherical));
    controls.update();
    return true;
  }

  // Call after controls.update(). Outside cameras are untouched; an inside
  // camera exits along the same viewing ray, preserving its observation target.
  function constrain() {
    if (disposed) return false;
    let changed = false;
    offset.subVectors(camera.position, controls.target);
    if (offset.lengthSq() < 1e-12) offset.set(0, 0, 1);
    else offset.normalize();
    // Exiting the lid can enter the body (or vice versa), hence a second pass.
    for (let pass = 0; pass < BLOCKERS.length; pass++) {
      for (const box of BLOCKERS) {
        if (!box.containsPoint(camera.position)) continue;
        let exit = Infinity;
        for (const axis of ['x', 'y', 'z']) {
          if (Math.abs(offset[axis]) < 1e-12) continue;
          const edge = offset[axis] > 0 ? box.max[axis] : box.min[axis];
          exit = Math.min(exit, (edge - controls.target[axis]) / offset[axis]);
        }
        camera.position.copy(controls.target).addScaledVector(offset, exit + .02);
        changed = true;
      }
    }
    if (changed) camera.lookAt(controls.target);
    return changed;
  }

  controls.addEventListener('start', cancel);
  return {
    focus(name) {return Object.hasOwn(VIEWS, name) ? moveTo(name, true) : false;},
    reset({animate = true} = {}) {return moveTo('overview', animate);},
    update, cancel, constrain,
    dispose() {
      if (disposed) return;
      cancel(); disposed = true;
      controls.removeEventListener('start', cancel);
    },
    get isMoving() {return transition !== null;},
  };
}
