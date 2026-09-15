/**
 * Smooth, deterministic teaching masks for the Weathering Lab's canonical case.
 * These fields illustrate deposition, shielding and contact; they are not a
 * particle simulation, measured ageing model, or a model of an Adobe product.
 * Points, normals and part bounds are in the same axis-aligned world space.
 * Gravity is -Y and the front is +Z. Geometry may not be rotated independently.
 * Material response, chips and visual noise belong to the surface shader.
 */

export const CONTACT_MODES = Object.freeze({ handle: 0, edges: 1, base: 2 });

export const EFFECTS = Object.freeze({
  dust: Object.freeze({label: '먼지', color: '#e6bd69', description: '위에서 내려앉는 가루', amount: 0.86}),
  wear: Object.freeze({label: '스크래치·마모', color: '#67dce5', description: '접촉이 남긴 긁힘', amount: 0.82}),
  rust: Object.freeze({label: '녹', color: '#f08463', description: '벗겨진 강철의 부식', amount: 0.90}),
  moss: Object.freeze({label: '이끼', color: '#91c96b', description: '표면에 자리 잡은 군락', amount: 0.85}),
  runoff: Object.freeze({label: '물자국', color: '#b49aef', description: '먼지가 씻기고 흐른 자리', amount: 0.90}),
});

export const DEFAULT_STATE = Object.freeze({
  effects: Object.freeze({dust: true, wear: false, rust: false, moss: false, runoff: false}),
  material: 'paint',
  view: 'surface',
  inspect: 'all',
  compare: false,
  dust: EFFECTS.dust.amount,
  wear: EFFECTS.wear.amount,
  rust: EFFECTS.rust.amount,
  moss: EFFECTS.moss.amount,
  runoff: EFFECTS.runoff.amount,
  contact: 'edges',
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

/** Layer switches preserve the authored amounts while controlling rendering. */
export function getEffectUniforms(state = {}) {
  const effects = state.effects ?? DEFAULT_STATE.effects;
  const amount = key => effects[key] && !(key === 'rust' && state.material === 'plastic')
    ? clamp(finite(state[key], EFFECTS[key].amount)) : 0;
  return {uDust: amount('dust'), uWear: amount('wear'), uRust: amount('rust'),
    uMoss: amount('moss'), uRunoff: amount('runoff')};
}

/**
 * Contact around the case's front-right upper vertex, shared across body/lid.
 * Both part bounds resolve to the same canonical anchor [1.29, .95, .69].
 * The footprint spreads across the top/front/right and becomes narrower and
 * weaker below the vertex. Handles, hardware and every other corner stay clear.
 */
export function sampleCornerContact(point, part = {}) {
  const p = vector3(point, [0, 0, 0]);
  const center = vector3(part?.center, [0, 0, 0]);
  const half = vector3(part?.half, [1, 1, 1]).map(v => Math.max(0.00001, v));
  const kind = finite(part?.kind, 0);
  const body = kindMask(kind, 0), lid = kindMask(kind, 1);
  if (!body && !lid) return 0;
  const offset = lid ? [-0.03, -0.02, -0.03] : [0.04, 0.18, 0.04];
  const corner = center.map((value, axis) => value + half[axis] + offset[axis]);
  const drop = Math.max(corner[1] - p[1], 0);
  const taper = smoothstep(0, 0.76, drop);
  const reachX = 0.58 * (1 - taper) + 0.18 * taper;
  const reachZ = 0.48 * (1 - taper) + 0.14 * taper;
  const distance = Math.hypot((p[0] - corner[0]) / reachX, (p[2] - corner[2]) / reachZ);
  const spread = 1 - smoothstep(0.04, 1, distance);
  const down = Math.pow(1 - smoothstep(0, 0.86, drop), 1.35);
  return clamp(spread * down);
}

/**
 * Reference evaluator for valid UI state, with finite fallbacks for inspectors.
 * `part.kind`: 0 body, 1 lid, 2 handle, 3 reserved, 4 details.
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
  const dustAmount = clamp(finite(state.dust, DEFAULT_STATE.dust));
  const wearAmount = clamp(finite(state.wear, DEFAULT_STATE.wear));
  const contactMode = CONTACT_MODES[state.contact] ?? CONTACT_MODES[DEFAULT_STATE.contact];
  const heuristic = state.heuristic === true ? 1 : clamp(finite(state.heuristic, 0));

  // Relative distances detect proximity to TWO box faces, not a face centre.
  const q = p.map((v, i) => Math.abs(v - center[i]) / half[i]);
  const edgeAxes = q.map(v => smoothstep(0.76, 0.99, v));
  const edge = Math.max(
    Math.min(edgeAxes[0], edgeAxes[1]),
    Math.min(edgeAxes[1], edgeAxes[2]),
    Math.min(edgeAxes[2], edgeAxes[0]),
  );
  const up = clamp(n[1]);
  const side = 1 - Math.abs(n[1]);
  const body = kindMask(kind, 0);
  const lid = kindMask(kind, 1);
  const handle = kindMask(kind, 2);

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
  const cornerContact = sampleCornerContact(p, {center, half, kind});
  // The case rests directly on its bottom. Dragging mainly abrades the bottom
  // perimeter; a narrow, weaker skirt catches the rounded lower side edges.
  // Use the body's bounds so this footprint follows its actual ground plane.
  const heightAboveBase = p[1] - (center[1] - half[1]);
  const baseBand = 1 - smoothstep(0.018, 0.14, heightAboveBase);
  const basePerimeter = smoothstep(0.56, 0.95, Math.max(q[0], q[2]));
  const underside = smoothstep(0.12, 0.85, -n[1]);
  const baseContact = body * baseBand * (0.22 + 0.78 * basePerimeter)
    * (0.35 + 0.65 * underside);
  const contact = clamp(contactMode === 0 ? gripContact
    : contactMode === 1 ? cornerContact : baseContact);

  // Gravity-only settling. Projected arrival and weaker retention on a slope
  // each follow the upward normal: their product fades across the WHOLE arc.
  // No flat plateau on the first half of a bevel, or side-facing dust floor.
  const incoming = 0.92 * up * up;
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

// GLSL counterpart of sampleCornerContact. Body and lid meet around one world
// anchor, avoiding a full-height wear stripe or a reset at the lid/body seam.
float wCornerContact(vec3 p, vec3 center, vec3 halfSize, float kind) {
  float wBody = wKindMask(kind, 0.0), wLid = wKindMask(kind, 1.0);
  if (wBody + wLid < 0.5) return 0.0;
  vec3 wHalf = max(halfSize, vec3(0.00001));
  vec3 wCorner = center + wHalf
    + mix(vec3(0.04, 0.18, 0.04), vec3(-0.03, -0.02, -0.03), wLid);
  float wDrop = max(wCorner.y - p.y, 0.0);
  float wTaper = smoothstep(0.0, 0.76, wDrop);
  vec2 wReach = mix(vec2(0.58, 0.48), vec2(0.18, 0.14), wTaper);
  float wDistance = length((p.xz - wCorner.xz) / wReach);
  float wSpread = 1.0 - smoothstep(0.04, 1.0, wDistance);
  float wDown = pow(1.0 - smoothstep(0.0, 0.86, wDrop), 1.35);
  return clamp(wSpread * wDown, 0.0, 1.0);
}

vec4 weatherSignals(
  vec3 p, vec3 n, vec3 center, vec3 halfSize, float kind,
  float dustAmount, float wearAmount,
  float contactMode, float heuristic
) {
  float wNormalLength = length(n);
  vec3 wN = wNormalLength > 0.000001 ? n / wNormalLength : vec3(0.0, 1.0, 0.0);
  vec3 wHalf = max(halfSize, vec3(0.00001));
  vec3 wQ = abs(p - center) / wHalf;
  vec3 wEdgeAxes = smoothstep(vec3(0.76), vec3(0.99), wQ);
  float wEdge = max(max(min(wEdgeAxes.x, wEdgeAxes.y),
    min(wEdgeAxes.y, wEdgeAxes.z)), min(wEdgeAxes.z, wEdgeAxes.x));
  float wUp = clamp(wN.y, 0.0, 1.0);
  float wSide = 1.0 - abs(wN.y);
  float wBody = wKindMask(kind, 0.0);
  float wLid = wKindMask(kind, 1.0);
  float wHandle = wKindMask(kind, 2.0);

  float wUnderLid = wBody * wSide * smoothstep(0.22, 0.64, p.y)
    * (1.0 - smoothstep(0.76, 0.9, p.y));
  float wLidUnderside = wLid * smoothstep(0.05, 0.85, -wN.y);
  float wHandleUnderside = 0.4 * wHandle * smoothstep(0.1, 0.9, -wN.y);
  float wShelter = clamp(max(max(wUnderLid, wLidUnderside), wHandleUnderside), 0.0, 1.0);

  float wGripContact = wHandle * smoothstep(1.1, 1.15, center.y)
    * (1.0 - smoothstep(0.56, 0.94, wQ.x));
  float wCornerFootprint = wCornerContact(p, center, wHalf, kind);
  float wHeightAboveBase = p.y - (center.y - wHalf.y);
  float wBaseBand = 1.0 - smoothstep(0.018, 0.14, wHeightAboveBase);
  float wBasePerimeter = smoothstep(0.56, 0.95, max(wQ.x, wQ.z));
  float wUnderside = smoothstep(0.12, 0.85, -wN.y);
  float wBaseContact = wBody * wBaseBand * (0.22 + 0.78 * wBasePerimeter)
    * (0.35 + 0.65 * wUnderside);
  float wContact = clamp(contactMode < 0.5 ? wGripContact
    : (contactMode < 1.5 ? wCornerFootprint : wBaseContact), 0.0, 1.0);

  float wDustAmount = clamp(dustAmount, 0.0, 1.0);
  float wWearAmount = clamp(wearAmount, 0.0, 1.0);
  float wHeuristic = clamp(heuristic, 0.0, 1.0);
  float wIncoming = 0.92 * wUp * wUp;
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
