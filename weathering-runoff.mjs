import { sampleEnvironment } from './weathering-environment.mjs?v=98d844ff44b3';

/**
 * Relative dust wash/transport fields for the canonical, axis-aligned case.
 * +Y is up; the body spans +/-[1.25,.77,.65], with the lid above it.
 * Two paths begin under the front latches at x=+/-.89. Back paths represent
 * small lid-rim drainage irregularities, not holes or rear latches in the mesh.
 * This is a deterministic teaching approximation, not conserved fluid flow.
 * Source dust is sampled BEFORE transport; final contact cleaning belongs to
 * the surface shader. No rust transport, material tint, or live clock is here.
 */

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (low, high, value) => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};
// Match GLSL's float32 hard boundaries, including exact threshold samples.
const bounds = { top: Math.fround(.77), height: Math.fround(1.54), x: 1.25,
  zMin: Math.fround(.56), zMax: Math.fround(.651) };

function paths(p, strength) {
  const drop = bounds.top - p[1];
  if (drop < 0 || drop > bounds.height || Math.abs(p[0]) > bounds.x
    || Math.abs(p[2]) < bounds.zMin || Math.abs(p[2]) > bounds.zMax) return [0, 0, 0];
  const reach = 0.20 + 1.25 * Math.sqrt(strength);
  const down = smooth(0, 0.04, drop) * (1 - smooth(reach - 0.09, reach + 0.06, drop));
  const tail = smooth(reach - 0.20, reach, drop);
  const result = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    const sign = i === 0 ? -1 : 1;
    const phase = sign * 0.9 + (p[2] < 0 ? -1.7 : 1.7);
    const wander = (0.018 * Math.sin(drop * 10 + phase)
      + 0.007 * Math.sin(drop * 23 + phase * 1.7)) * (1 - Math.exp(-8 * drop));
    const width = (0.032 + 0.023 * (0.5 + 0.5 * Math.sin(drop * 8 + phase)))
      * (1 - 0.38 * clamp(drop / 1.54));
    const offset = Math.abs(p[0] - sign * 0.89 - wander);
    const wide = 1 - smooth(width * 0.55, width * 1.4, offset);
    const core = 1 - smooth(width * 0.20, width * 0.72, offset);
    const sediment = 0.55 * Math.max(wide - core, 0) + 0.75 * tail * core;
    [wide, core, sediment].forEach((value, j) => { result[j] = Math.max(result[j], value * down); });
  }
  return result;
}

/**
 * source={dust,wetDose}: actual pre-transport lid-top weather/environment at
 * [point.x,.97,point.z<0?-.58:.58], normal +Y, kind 1 and lid bounds.
 * Do not reuse the receiving body's shelter for the source sample.
 * Returns {flow,wash,sediment,sourceLoad}, all in [0,1]. Source load describes
 * upstream available dirty water; sediment is its local deposit footprint.
 */
export function sampleRunoff(point, normal, part = {}, state = {}, weather = {}, source = {}) {
  const amount = clamp(finite(state.runoff, 0));
  const wetness = clamp(finite(state.wetness, 0));
  const exposure = clamp(finite(state.exposure, 0));
  if (amount === 0 || wetness === 0 || exposure === 0)
    return { flow: 0, wash: 0, sediment: 0, sourceLoad: 0 };
  const p = [0, 0, 0].map((fallback, i) => finite(point?.[i], fallback));
  let n = [0, 1, 0].map((fallback, i) => finite(normal?.[i], fallback));
  const length = Math.hypot(...n);
  n = length > 0.000001 ? n.map(value => value / length) : [0, 1, 0];
  const env = sampleEnvironment(p, n, part, state, weather);
  const directWash = amount * env.wetDose * smooth(0.20, 0.85, n[1]);
  const strength = amount * clamp(finite(source.wetDose, 0));
  const sourceLoad = strength * clamp(finite(source.dust, 0));
  const body = Math.abs(finite(part.kind, 0)) < 0.5 ? 1 : 0;
  const face = body * smooth(0.55, 0.90, Math.abs(n[2]))
    * (1 - smooth(0.12, 0.60, Math.abs(n[1])));
  const path = paths(p, strength);
  return {
    flow: clamp(Math.max(directWash, strength * face * path[0])),
    wash: clamp(Math.max(directWash, strength * face * path[1])),
    sediment: clamp(sourceLoad * face * path[2]),
    sourceLoad,
  };
}

/** Append AFTER ENVIRONMENT_GLSL. source.xy = upstream dust, upstream wetDose. */
export const RUNOFF_GLSL = /* glsl */ `
vec3 wxRunoffPaths(vec3 p, float strength) {
  float drop = 0.77 - p.y;
  if (drop < 0.0 || drop > 1.54 || abs(p.x) > 1.25
    || abs(p.z) < 0.56 || abs(p.z) > 0.651) return vec3(0.0);
  float reach = 0.20 + 1.25 * sqrt(strength);
  float down = smoothstep(0.0, 0.04, drop)
    * (1.0 - smoothstep(reach - 0.09, reach + 0.06, drop));
  float tail = smoothstep(reach - 0.20, reach, drop);
  vec3 result = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float sideSign = i == 0 ? -1.0 : 1.0;
    float phase = sideSign * 0.9 + (p.z < 0.0 ? -1.7 : 1.7);
    float wander = (0.018 * sin(drop * 10.0 + phase)
      + 0.007 * sin(drop * 23.0 + phase * 1.7)) * (1.0 - exp(-8.0 * drop));
    float width = (0.032 + 0.023 * (0.5 + 0.5 * sin(drop * 8.0 + phase)))
      * (1.0 - 0.38 * clamp(drop / 1.54, 0.0, 1.0));
    float offset = abs(p.x - sideSign * 0.89 - wander);
    float wide = 1.0 - smoothstep(width * 0.55, width * 1.4, offset);
    float core = 1.0 - smoothstep(width * 0.20, width * 0.72, offset);
    float deposit = 0.55 * max(wide - core, 0.0) + 0.75 * tail * core;
    result = max(result, vec3(wide, core, deposit) * down);
  }
  return result;
}

vec4 wxRunoffSignals(
  vec3 p, vec3 n, float kind, float runoff,
  float wetness, float exposure, float drying, float wind, float shelter, vec2 source
) {
  float amount = clamp(runoff, 0.0, 1.0);
  if (amount == 0.0 || clamp(wetness, 0.0, 1.0) == 0.0
    || clamp(exposure, 0.0, 1.0) == 0.0) return vec4(0.0);
  float normalLength = length(n);
  vec3 normal = normalLength > 0.000001 ? n / normalLength : vec3(0.0, 1.0, 0.0);
  vec4 env = envSignals(p, normal, kind, wetness, exposure, drying, wind, shelter);
  float directWash = amount * env.z * smoothstep(0.20, 0.85, normal.y);
  float strength = amount * clamp(source.y, 0.0, 1.0);
  float sourceLoad = strength * clamp(source.x, 0.0, 1.0);
  float body = 1.0 - step(0.5, abs(kind));
  float face = body * smoothstep(0.55, 0.90, abs(normal.z))
    * (1.0 - smoothstep(0.12, 0.60, abs(normal.y)));
  vec3 path = wxRunoffPaths(p, strength);
  return clamp(vec4(max(directWash, strength * face * path.x),
    max(directWash, strength * face * path.y), sourceLoad * face * path.z, sourceLoad), 0.0, 1.0);
}
`;
