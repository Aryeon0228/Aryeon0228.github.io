/**
 * Smooth, deterministic teaching masks for the Weathering Lab's canonical case.
 * These fields illustrate deposition, shielding and contact; they are not a
 * particle simulation, measured ageing model, or a model of an Adobe product.
 * Points, normals and part bounds are in the same axis-aligned world space.
 * Gravity is -Y and the front is +Z. Geometry may not be rotated independently.
 * Material response, chips and visual noise belong to the surface shader.
 */

export const CONTACT_MODES = Object.freeze({ handle: 0, edges: 1, base: 2 });

export const PRESETS = Object.freeze({
  storage: Object.freeze({
    label: '실내 보관',
    description: '덮개 없이 보관해 먼지가 내려앉고, 접촉은 적은 상태입니다.',
    dust: 0.86,
    wear: 0.16,
    wind: 0,
    contact: 'base',
  }),
  outdoor: Object.freeze({
    label: '먼지 부는 야외',
    description: '건조한 먼지가 오른쪽에서 들어오며, 앞쪽 오른 모서리에 부딪힌 흔적이 있습니다.',
    dust: 0.74,
    wear: 0.58,
    wind: 0.88,
    contact: 'edges',
  }),
  handled: Object.freeze({
    label: '자주 운반',
    description: '손잡이를 자주 잡아 먼지가 닦이고, 그 자리에 마모가 남은 예시입니다.',
    dust: 0.58,
    wear: 0.9,
    wind: -0.22,
    contact: 'handle',
  }),
});

export const DEFAULT_STATE = Object.freeze({
  preset: 'storage',
  material: 'paint',
  layer: 'surface',
  compare: false,
  dust: PRESETS.storage.dust,
  wear: PRESETS.storage.wear,
  wind: PRESETS.storage.wind,
  contact: PRESETS.storage.contact,
  heuristic: false,
});

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const vector3 = (value, fallback) => fallback.map((v, i) => finite(value?.[i], v));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};
const kindMask = (kind, expected) => Math.abs(kind - expected) < 0.5 ? 1 : 0;

/**
 * Reference evaluator for valid UI state, with finite fallbacks for inspectors.
 * `part.kind`: 0 body, 1 lid, 2 handle, 3 feet, 4 details.
 * `state.heuristic`: true selects an intentionally shape-only comparison.
 * Increasing wear also represents repeated contact, so it clears nearby dust.
 * The returned contact and shelter are geometry masks, independent of amounts.
 */
export function sampleWeather(point, normal, part = {}, state = {}) {
  const p = vector3(point, [0, 0, 0]);
  const center = vector3(part.center, [0, 0, 0]);
  const half = vector3(part.half, [1, 1, 1]).map(v => Math.max(0.00001, v));
  let n = vector3(normal, [0, 1, 0]);
  const normalLength = Math.hypot(...n);
  n = normalLength > 0.000001 ? n.map(v => v / normalLength) : [0, 1, 0];
  const kind = finite(part.kind, 0);
  const preset = PRESETS[state.preset] ?? PRESETS[DEFAULT_STATE.preset];
  const dustAmount = clamp(finite(state.dust, preset.dust));
  const wearAmount = clamp(finite(state.wear, preset.wear));
  const wind = clamp(finite(state.wind, preset.wind), -1, 1);
  const contactMode = CONTACT_MODES[state.contact] ?? CONTACT_MODES[preset.contact];
  const heuristic = state.heuristic === true ? 1 : clamp(finite(state.heuristic, 0));

  // Relative distances detect proximity to TWO box faces, not a face centre.
  const q = p.map((v, i) => Math.abs(v - center[i]) / half[i]);
  const edgeAxes = q.map(v => smoothstep(0.76, 0.99, v));
  const edge = Math.max(
    Math.min(edgeAxes[0], edgeAxes[1]),
    Math.min(edgeAxes[1], edgeAxes[2]),
    Math.min(edgeAxes[2], edgeAxes[0]),
  );
  const up = smoothstep(-0.08, 0.72, n[1]);
  const side = 1 - Math.abs(n[1]);
  const body = kindMask(kind, 0);
  const lid = kindMask(kind, 1);
  const handle = kindMask(kind, 2);
  const feet = kindMask(kind, 3);

  // Canonical lid overhang shields the upper body. An underside is also
  // sheltered, but shielding alone is not a source of incoming dust.
  const underLid = body * side * smoothstep(0.22, 0.64, p[1])
    * (1 - smoothstep(0.76, 0.9, p[1]));
  const lidUnderside = lid * smoothstep(0.05, 0.85, -n[1]);
  const handleUnderside = 0.4 * handle * smoothstep(0.1, 0.9, -n[1]);
  const shelter = clamp(Math.max(underLid, lidUnderside, handleUnderside));

  // The high-centred crossgrip is touched; the two lower handle posts are not.
  const gripContact = handle * smoothstep(1.1, 1.15, center[1])
    * (1 - smoothstep(0.56, 0.94, q[0]));
  // A localized front-right footprint, rather than a blanket edge-wear rule.
  const cornerContact = (body + lid) * smoothstep(0.78, 1.12, p[0])
    * smoothstep(0.26, 0.6, p[2])
    * (1 - smoothstep(0.45, 1.05, Math.abs(p[1] - 0.35)));
  const footContact = feet * (1 - smoothstep(-0.9, -0.81, p[1]))
    * (0.35 + 0.65 * smoothstep(0.05, 0.9, -n[1]));
  // The feet hold the body above the ground, so dragging touches the feet only.
  const baseContact = footContact;
  const contact = clamp(contactMode === 0 ? gripContact
    : contactMode === 1 ? cornerContact : baseContact);

  // Wind is a signed X-direction input; pure downward faces get no deposition.
  const windFacing = Math.max(n[0] * wind, 0);
  const incoming = clamp(0.92 * up + 0.06 * side + 0.28 * windFacing);
  const depositedDust = incoming * (1 - 0.78 * shelter)
    * (1 - 0.96 * contact * wearAmount);
  const contactWear = contact * (0.78 + 0.22 * edge);

  // Deliberately simplified contrast: cavities collect dirt, all edges wear.
  // It ignores direction and contact. This is NOT a claim about other tools.
  const shapeDust = clamp(0.3 * up + 0.8 * shelter + 0.22 * edge * (1 - up));
  const dust = dustAmount * (depositedDust * (1 - heuristic) + shapeDust * heuristic);
  const wear = wearAmount * (contactWear * (1 - heuristic) + edge * heuristic);
  return { dust, wear, up, shelter, contact, edge };
}

/**
 * GLSL counterpart of sampleWeather. Pass finite values and axis-aligned bounds.
 * contactMode: 0 handle, 1 edges, 2 base. heuristic: 0 contact model, 1 shape-only.
 * Returns vec4(dust, wear, contact, shelter), all in [0, 1].
 * Helpers and locals are prefixed to coexist with Three.js shader chunks.
 */
export const WEATHER_GLSL = /* glsl */ `
float wKindMask(float wKind, float wExpected) {
  return 1.0 - step(0.5, abs(wKind - wExpected));
}

vec4 weatherSignals(
  vec3 p, vec3 n, vec3 center, vec3 halfSize, float kind,
  float dustAmount, float wearAmount, float wind,
  float contactMode, float heuristic
) {
  float wNormalLength = length(n);
  vec3 wN = wNormalLength > 0.000001 ? n / wNormalLength : vec3(0.0, 1.0, 0.0);
  vec3 wHalf = max(halfSize, vec3(0.00001));
  vec3 wQ = abs(p - center) / wHalf;
  vec3 wEdgeAxes = smoothstep(vec3(0.76), vec3(0.99), wQ);
  float wEdge = max(max(min(wEdgeAxes.x, wEdgeAxes.y),
    min(wEdgeAxes.y, wEdgeAxes.z)), min(wEdgeAxes.z, wEdgeAxes.x));
  float wUp = smoothstep(-0.08, 0.72, wN.y);
  float wSide = 1.0 - abs(wN.y);
  float wBody = wKindMask(kind, 0.0);
  float wLid = wKindMask(kind, 1.0);
  float wHandle = wKindMask(kind, 2.0);
  float wFeet = wKindMask(kind, 3.0);

  float wUnderLid = wBody * wSide * smoothstep(0.22, 0.64, p.y)
    * (1.0 - smoothstep(0.76, 0.9, p.y));
  float wLidUnderside = wLid * smoothstep(0.05, 0.85, -wN.y);
  float wHandleUnderside = 0.4 * wHandle * smoothstep(0.1, 0.9, -wN.y);
  float wShelter = clamp(max(max(wUnderLid, wLidUnderside), wHandleUnderside), 0.0, 1.0);

  float wGripContact = wHandle * smoothstep(1.1, 1.15, center.y)
    * (1.0 - smoothstep(0.56, 0.94, wQ.x));
  float wCornerContact = (wBody + wLid) * smoothstep(0.78, 1.12, p.x)
    * smoothstep(0.26, 0.6, p.z)
    * (1.0 - smoothstep(0.45, 1.05, abs(p.y - 0.35)));
  float wFootContact = wFeet * (1.0 - smoothstep(-0.9, -0.81, p.y))
    * (0.35 + 0.65 * smoothstep(0.05, 0.9, -wN.y));
  float wBaseContact = wFootContact;
  float wContact = clamp(contactMode < 0.5 ? wGripContact
    : (contactMode < 1.5 ? wCornerContact : wBaseContact), 0.0, 1.0);

  float wDustAmount = clamp(dustAmount, 0.0, 1.0);
  float wWearAmount = clamp(wearAmount, 0.0, 1.0);
  float wWind = clamp(wind, -1.0, 1.0);
  float wHeuristic = clamp(heuristic, 0.0, 1.0);
  float wWindFacing = max(wN.x * wWind, 0.0);
  float wIncoming = clamp(0.92 * wUp + 0.06 * wSide + 0.28 * wWindFacing, 0.0, 1.0);
  float wDepositedDust = wIncoming * (1.0 - 0.78 * wShelter)
    * (1.0 - 0.96 * wContact * wWearAmount);
  float wContactWear = wContact * (0.78 + 0.22 * wEdge);
  float wShapeDust = clamp(0.3 * wUp + 0.8 * wShelter
    + 0.22 * wEdge * (1.0 - wUp), 0.0, 1.0);
  float wDust = wDustAmount * mix(wDepositedDust, wShapeDust, wHeuristic);
  float wWear = wWearAmount * mix(wContactWear, wEdge, wHeuristic);
  return vec4(wDust, wWear, wContact, wShelter);
}
`;
