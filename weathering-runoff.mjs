import { sampleEnvironment } from './weathering-environment.mjs?v=c55ba2b7eaa8';

/**
 * Relative dust wash/transport fields for the canonical, axis-aligned case.
 * +Y is up; the body spans +/-[1.25,.77,.65], with the lid above it.
 * A broken film below the lid feeds sparse, unequal, mostly vertical runnels.
 * The front latches at x=+/-.89 are strong sources; the other front/back paths
 * represent rim drainage irregularities, not extra holes in the mesh.
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
// Receiver bounds include a one-millionth allowance for transformed vertices.
const receiverBounds = { lidTop: Math.fround(.970001), lidBottom: Math.fround(.769999),
  lidX: Math.fround(1.320001), lidZMin: Math.fround(.664999), lidZMax: Math.fround(.720001),
  ribTop: Math.fround(.220001), ribBottom: Math.fround(-.500001),
  ribZMin: Math.fround(.640999), ribZMax: Math.fround(.691001), ribHalfX: Math.fround(.034001) };
// Root X, root half-width, nominal travel, and a fixed variation parameter.
const frontLanes = [[-.89,.082,1.36,.16],[.89,.104,.86,.64],[-.45,.045,.64,.32],
  [.18,.073,1.07,.82],[.55,.028,.43,.48],[-1.14,.031,.36,.75]];
const backLanes = [[-.98,.055,.74,.63],[-.62,.091,1.25,.24],[-.13,.032,.48,.87],
  [.37,.063,.94,.41],[.78,.039,.60,.74],[1.09,.036,1.39,.19]];
const cell = value => { const q = value + 32; return ((q * q * 13 + q * 7 + 19) % 97) / 96; };
function rimNoise(value) {
  const index = Math.floor(value), blend = smooth(0, 1, value - index);
  return cell(index) * (1 - blend) + cell(index + 1) * blend;
}

function paths(p, strength, startBridge = 0, halfWidth = bounds.x) {
  const drop = bounds.top - p[1];
  if (strength <= 0 || drop < 0 || drop > bounds.height || Math.abs(p[0]) > halfWidth
    || Math.abs(p[2]) < bounds.zMin || Math.abs(p[2]) > bounds.zMax) return [0, 0, 0];
  const rear = p[2] < 0, volume = Math.sqrt(strength);
  const rimPatch = smooth(.18, .72, rimNoise(p[0] * 3.7 + (rear ? 4.1 : .3)));
  const depth = (.09 + .19 * rimNoise(p[0] * 5.3 + (rear ? .8 : 6.2))) * (.3 + .7 * volume);
  const start = Math.max(smooth(0, .025, drop), startBridge);
  const header = rimPatch * start * (1 - smooth(depth * .4, depth, drop));
  const result = [header * .72, header * .08, header * .64];
  for (const [root, rootWidth, travel, variation] of rear ? backLanes : frontLanes) {
    const reach = travel * (.24 + .76 * volume), t = clamp(drop / reach);
    const drift = (variation - .5) * .035 * t + (variation < .5 ? .006 : -.006) * smooth(.35, .75, t);
    const center = root + drift;
    const width = rootWidth * (1 - .88 * smooth(.10, 1, t)) + .0025;
    const offset = Math.abs(p[0] - center);
    const wide = 1 - smooth(width * .50, width * 1.25, offset);
    const core = 1 - smooth(width * .12, width * .78, offset);
    const end = 1 - smooth(reach * .90, reach + .035, drop);
    const flush = smooth(.22, .40, t) * (1 - smooth(.57, .78, t));
    const tail = smooth(.78, 1, t);
    const thinOffset = Math.abs(p[0] - root - (variation < .5 ? -1 : 1) * rootWidth * .64);
    const thin = variation > .55 ? (1 - smooth(.002, .0055, thinOffset))
      * smooth(.035, .10, drop) * (1 - smooth(reach * .68, reach * .84, drop)) : 0;
    const flow = Math.max(wide * end, thin * .55) * start;
    const wash = core * (.10 + .70 * variation) * (.28 + .72 * flush) * end * start;
    const dirt = wide * (.30 + .55 * (1 - variation)) * (1 - .80 * variation * flush)
      + .10 * tail * core;
    const sediment = Math.max(dirt * end, thin * .46) * start;
    [flow, wash, sediment].forEach((value, j) => { result[j] = Math.max(result[j], value); });
  }
  return result;
}

/**
 * source={dust,wetDose}: actual pre-transport lid-top weather/environment at
 * [clamp(point.x,-1.265,1.265),.97,point.z<0?-.58:.58], normal +Y,
 * kind 1 and lid bounds. The X clamp keeps rim sources on the flat lid top.
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
  const kind = finite(part.kind, 0), b = receiverBounds;
  const body = Math.abs(kind) < .5;
  const lid = Math.abs(kind - 1) < .5 && p[1] >= b.lidBottom && p[1] <= b.lidTop
    && Math.abs(p[0]) <= b.lidX && Math.abs(p[2]) >= b.lidZMin && Math.abs(p[2]) <= b.lidZMax;
  // Match GPU subtraction precision at the narrow rib receiver boundaries.
  const ribCoordinate = Math.fround(p[0]), ribCenter = Math.fround(.78);
  const ribX = Math.min(Math.abs(ribCoordinate), Math.abs(Math.fround(ribCoordinate - ribCenter)),
    Math.abs(Math.fround(ribCoordinate + ribCenter)));
  const rib = Math.abs(kind - 4) < .5 && p[1] >= b.ribBottom && p[1] <= b.ribTop
    && Math.abs(p[2]) >= b.ribZMin && Math.abs(p[2]) <= b.ribZMax && ribX <= b.ribHalfX;
  // Side/top planes remain excluded. Front/back bevels fade only at their tangent.
  const face = (body || lid || rib ? 1 : 0) * smooth(.02, .35, Math.abs(n[2]));
  const projected = lid ? [p[0], bounds.top, p[2] < 0 ? -.65 : .65]
    : rib ? [p[0], p[1], p[2] < 0 ? -.65 : .65] : p;
  const bridge = lid ? smooth(0, .025, .97 - p[1]) : body ? smooth(0, .20, n[1]) : 0;
  const path = paths(projected, strength, bridge, lid ? b.lidX : bounds.x);
  return {
    flow: clamp(Math.max(directWash, strength * face * path[0])),
    wash: clamp(Math.max(directWash, strength * face * path[1])),
    sediment: clamp(sourceLoad * face * path[2]),
    sourceLoad,
  };
}

/** Append AFTER ENVIRONMENT_GLSL. source.xy = upstream dust, upstream wetDose. */
export const RUNOFF_GLSL = /* glsl */ `
float wxRunoffCell(float value) {
  float q = value + 32.0;
  return mod(q * q * 13.0 + q * 7.0 + 19.0, 97.0) / 96.0;
}
float wxRunoffRimNoise(float value) {
  float index = floor(value), blend = smoothstep(0.0, 1.0, value - index);
  return mix(wxRunoffCell(index), wxRunoffCell(index + 1.0), blend);
}
vec4 wxRunoffLane(int index, bool rear) {
${frontLanes.map((lane, i) => `  ${i < 5 ? `if (index == ${i}) ` : ''}return rear ? vec4(${backLanes[i].map(v => v.toFixed(5)).join(', ')}) : vec4(${lane.map(v => v.toFixed(5)).join(', ')});`).join('\n')}
}
vec3 wxRunoffPaths(vec3 p, float strength, float startBridge, float halfWidth) {
  float drop = 0.77 - p.y;
  if (strength <= 0.0 || drop < 0.0 || drop > 1.54 || abs(p.x) > halfWidth
    || abs(p.z) < 0.56 || abs(p.z) > 0.651) return vec3(0.0);
  bool rear = p.z < 0.0;
  float volume = sqrt(strength);
  float rimPatch = smoothstep(.18, .72, wxRunoffRimNoise(p.x * 3.7 + (rear ? 4.1 : .3)));
  float depth = (.09 + .19 * wxRunoffRimNoise(p.x * 5.3 + (rear ? .8 : 6.2))) * (.3 + .7 * volume);
  float start = max(smoothstep(0.0, .025, drop), startBridge);
  float header = rimPatch * start * (1.0 - smoothstep(depth * .4, depth, drop));
  vec3 result = vec3(header * .72, header * .08, header * .64);
  for (int i = 0; i < 6; i++) {
    vec4 lane = wxRunoffLane(i, rear);
    float reach = lane.z * (.24 + .76 * volume), t = clamp(drop / reach, 0.0, 1.0);
    float drift = (lane.w - .5) * .035 * t + (lane.w < .5 ? .006 : -.006) * smoothstep(.35, .75, t);
    float center = lane.x + drift;
    float width = lane.y * (1.0 - .88 * smoothstep(.10, 1.0, t)) + .0025;
    float offset = abs(p.x - center);
    float wide = 1.0 - smoothstep(width * .50, width * 1.25, offset);
    float core = 1.0 - smoothstep(width * .12, width * .78, offset);
    float end = 1.0 - smoothstep(reach * .90, reach + .035, drop);
    float flush = smoothstep(.22, .40, t) * (1.0 - smoothstep(.57, .78, t));
    float tail = smoothstep(.78, 1.0, t);
    float thinOffset = abs(p.x - lane.x - (lane.w < .5 ? -1.0 : 1.0) * lane.y * .64);
    float thin = lane.w > .55 ? (1.0 - smoothstep(.002, .0055, thinOffset))
      * smoothstep(.035, .10, drop) * (1.0 - smoothstep(reach * .68, reach * .84, drop)) : 0.0;
    float flow = max(wide * end, thin * .55) * start;
    float wash = core * (.10 + .70 * lane.w) * (.28 + .72 * flush) * end * start;
    float dirt = wide * (.30 + .55 * (1.0 - lane.w)) * (1.0 - .80 * lane.w * flush) + .10 * tail * core;
    float deposit = max(dirt * end, thin * .46) * start;
    result = max(result, vec3(flow, wash, deposit));
  }
  return result;
}

vec4 wxRunoffSignals(
  vec3 p, vec3 n, float kind, float runoff,
  float wetness, float exposure, float drying, float shelter, vec2 source
) {
  float amount = clamp(runoff, 0.0, 1.0);
  if (amount == 0.0 || clamp(wetness, 0.0, 1.0) == 0.0
    || clamp(exposure, 0.0, 1.0) == 0.0) return vec4(0.0);
  float normalLength = length(n);
  vec3 normal = normalLength > 0.000001 ? n / normalLength : vec3(0.0, 1.0, 0.0);
  vec4 env = envSignals(p, normal, kind, wetness, exposure, drying, shelter);
  float directWash = amount * env.z * smoothstep(0.20, 0.85, normal.y);
  float strength = amount * clamp(source.y, 0.0, 1.0);
  float sourceLoad = strength * clamp(source.x, 0.0, 1.0);
  bool body = abs(kind) < .5;
  bool lid = abs(kind - 1.0) < .5 && p.y >= .769999 && p.y <= .970001
    && abs(p.x) <= 1.320001 && abs(p.z) >= .664999 && abs(p.z) <= .720001;
  float ribX = min(abs(p.x), min(abs(p.x - .78), abs(p.x + .78)));
  bool rib = abs(kind - 4.0) < .5 && p.y >= -.500001 && p.y <= .220001
    && abs(p.z) >= .640999 && abs(p.z) <= .691001 && ribX <= .034001;
  float face = (body || lid || rib ? 1.0 : 0.0) * smoothstep(.02, .35, abs(normal.z));
  vec3 projected = lid ? vec3(p.x, .77, p.z < 0.0 ? -.65 : .65)
    : (rib ? vec3(p.xy, p.z < 0.0 ? -.65 : .65) : p);
  float bridge = lid ? smoothstep(0.0, .025, .97 - p.y)
    : (body ? smoothstep(0.0, .20, normal.y) : 0.0);
  vec3 path = wxRunoffPaths(projected, strength, bridge, lid ? 1.320001 : 1.25);
  return clamp(vec4(max(directWash, strength * face * path.x),
    max(directWash, strength * face * path.y), sourceLoad * face * path.z, sourceLoad), 0.0, 1.0);
}
`;
