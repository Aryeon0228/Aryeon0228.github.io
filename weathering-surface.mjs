import * as THREE from './vendor/three/build/three.module.js';
import { WEATHER_GLSL } from './weathering-model.mjs?v=fcd8c5bc1129';

// CSS palette entries are converted once into Three.js's linear working space.
// Only uCoatColor is user-editable; powder, primer and hardware stay independent.
const linearColor = hex => {
  const color = new THREE.Color(hex);
  return `vec3(${color.toArray().map(value => value.toFixed(8)).join(', ')})`;
};

const SURFACE_HELPERS = /* glsl */ `
const vec3 wxPowderColor = ${linearColor('#c8b99b')};
const vec3 wxPowderGrainColor = ${linearColor('#ded2bc')};
const vec3 wxPrimerColor = ${linearColor('#20262a')};
const vec3 wxMetalColor = ${linearColor('#a4adb0')};
const vec3 wxHardwareColor = ${linearColor('#899397')};

float wxHash(vec3 wxP) {
  wxP = fract(wxP * 0.3183099 + vec3(0.17, 0.31, 0.53));
  wxP *= 19.0;
  return fract(wxP.x * wxP.y * wxP.z * (wxP.x + wxP.y + wxP.z));
}

float wxNoise(vec3 wxP) {
  vec3 wxI = floor(wxP);
  vec3 wxF = fract(wxP);
  wxF = wxF * wxF * (3.0 - 2.0 * wxF);
  return mix(
    mix(mix(wxHash(wxI), wxHash(wxI + vec3(1.0, 0.0, 0.0)), wxF.x),
      mix(wxHash(wxI + vec3(0.0, 1.0, 0.0)), wxHash(wxI + vec3(1.0, 1.0, 0.0)), wxF.x), wxF.y),
    mix(mix(wxHash(wxI + vec3(0.0, 0.0, 1.0)), wxHash(wxI + vec3(1.0, 0.0, 1.0)), wxF.x),
      mix(wxHash(wxI + vec3(0.0, 1.0, 1.0)), wxHash(wxI + vec3(1.0, 1.0, 1.0)), wxF.x), wxF.y), wxF.z);
}

float wxFilteredNoise(vec3 wxP) {
  float wxFootprint = max(length(dFdx(wxP)), length(dFdy(wxP)));
  return mix(wxNoise(wxP), 0.5, smoothstep(0.65, 1.8, wxFootprint));
}

// Dominant-axis coordinates avoid texture UV requirements. fwidth naturally
// suppresses fine detail at the projection transition on a rounded bevel.
vec2 wxSurfaceUV(vec3 wxP, vec3 wxN) {
  vec3 wxA = abs(wxN);
  if (wxA.y >= wxA.x && wxA.y >= wxA.z) return wxP.xz;
  if (wxA.x >= wxA.z) return wxP.zy;
  return wxP.xy;
}

// A sparse layer of separate rounded grains, rather than another cloud octave.
// Their centres and radii vary; subpixel grains fade into the powder film.
float wxPowderGrains(vec2 wxUV) {
  vec2 wxGrid = wxUV * 94.0;
  vec2 wxCell = floor(wxGrid);
  vec2 wxF = fract(wxGrid);
  float wxSeed = wxHash(vec3(wxCell, 7.13));
  vec2 wxCentre = vec2(0.25) + 0.5 * vec2(wxSeed, wxHash(vec3(wxCell, 19.71)));
  float wxRadius = mix(0.105, 0.235, wxHash(vec3(wxCell, 3.27)));
  float wxAA = max(max(fwidth(wxGrid.x), fwidth(wxGrid.y)), 0.0001);
  float wxDisk = 1.0 - smoothstep(wxRadius - wxAA * 0.55,
    wxRadius + wxAA * 0.55, length(wxF - wxCentre));
  float wxVisible = 1.0 - smoothstep(0.65, 1.6, wxAA);
  return wxDisk * wxVisible;
}

// Short, staggered line segments. Each cell has a different position, length,
// slight slope and probability; no line continues across the whole surface.
// Returns a narrow groove and its wider, shallow shoulder.
vec2 wxScratchSegments(vec2 wxUV, vec2 wxScale, float wxStagger) {
  vec2 wxGrid = wxUV * wxScale;
  vec2 wxAA = max(fwidth(wxGrid), vec2(0.0001));
  // Offset dragged rows so short scratches do not line up as a dash grid.
  wxGrid.x += wxStagger * (wxHash(vec3(floor(wxGrid.y), 5.73, 31.19)) - 0.5);
  vec2 wxCell = floor(wxGrid);
  float wxSeed = wxHash(vec3(wxCell, 41.57));
  float wxSeed2 = wxHash(vec3(wxCell, 11.31));
  vec2 wxF = fract(wxGrid) - vec2(mix(0.38, 0.62, wxSeed2), mix(0.3, 0.7, wxSeed));
  float wxLength = mix(0.17, 0.35, wxSeed);
  float wxWidth = mix(0.028, 0.061, wxSeed2);
  float wxDistance = abs(wxF.y - wxF.x * (wxSeed2 - 0.5) * 0.14);
  float wxEnds = 1.0 - smoothstep(wxLength - wxAA.x * 0.6,
    wxLength + wxAA.x * 0.6, abs(wxF.x));
  float wxCore = 1.0 - smoothstep(wxWidth - wxAA.y * 0.55,
    wxWidth + wxAA.y * 0.55, wxDistance);
  float wxShoulder = 1.0 - smoothstep(wxWidth + 0.06 - wxAA.y * 0.55,
    wxWidth + 0.06 + wxAA.y * 0.55, wxDistance);
  float wxVisible = (1.0 - smoothstep(0.65, 1.6, max(wxAA.x, wxAA.y)))
    * step(0.23, wxSeed2);
  return vec2(wxCore, wxShoulder) * wxEnds * wxVisible;
}

// Screen-derivative surface gradient in view space. Unlike a texture bump map,
// this reads the already-computed height once. Epsilon and slope limits keep
// grazing silhouettes and tiny projected triangles finite and restrained.
vec3 wxPerturbNormal(vec3 wxViewPosition, vec3 wxNormal, float wxHeight) {
  vec3 wxDx = dFdx(wxViewPosition);
  vec3 wxDy = dFdy(wxViewPosition);
  vec3 wxR1 = cross(wxDy, wxNormal);
  vec3 wxR2 = cross(wxNormal, wxDx);
  float wxDet = dot(wxDx, wxR1);
  vec3 wxGradient = sign(wxDet)
    * (dFdx(wxHeight) * wxR1 + dFdy(wxHeight) * wxR2)
    / max(abs(wxDet), 0.00000001);
  wxGradient *= min(1.0, 0.28 / max(length(wxGradient), 0.0001));
  return normalize(wxNormal - wxGradient);
}
`;

const SURFACE_COLOR = /* glsl */ `
vec3 wxP = vWxPosition;
vec3 wxN = normalize(vWxNormal);
vec3 wxLocal = wxP - uCenter;
vec4 ws = weatherSignals(wxP, wxN, uCenter, uHalf, uKind,
  uDust, uWear, uWind, uContact, uHeuristic);

// The same geometric edge field is reused for pooling and the existing
// shape-only wear overlay; the causal weatherSignals output is never altered.
vec3 wxQ = abs(wxLocal) / max(uHalf, vec3(0.00001));
vec3 wxEdgeAxes = smoothstep(vec3(0.76), vec3(0.99), wxQ);
float wxEdge = max(max(min(wxEdgeAxes.x, wxEdgeAxes.y),
  min(wxEdgeAxes.y, wxEdgeAxes.z)), min(wxEdgeAxes.z, wxEdgeAxes.x));
float wxHandle = wKindMask(uKind, 2.0);
float wxFeet = wKindMask(uKind, 3.0);
float wxBody = wKindMask(uKind, 0.0);
float wxBaseMode = wKindMask(uContact, 2.0);
float wxDragged = max(wxFeet, wxBody * wxBaseMode);
float wxHardware = clamp(uHardware, 0.0, 1.0);
float wxPlastic = clamp(uPlastic, 0.0, 1.0);
float wxChippable = (1.0 - wxHandle) * (1.0 - wxDragged) * (1.0 - wxHardware);

float wxClump = wxFilteredNoise(wxP * 7.3);
float wxChipNoise = 0.76 * wxFilteredNoise(wxP * 39.0)
  + 0.24 * wxFilteredNoise(wxP * 103.0);
float wxGrains = wxPowderGrains(wxSurfaceUV(wxP, wxN));

// A matte powder film supplies readable coverage; isolated grains interrupt
// its boundary and catch light. Multiplication by ws.x forbids footprint spread.
float wxDustMask = clamp(ws.x * (0.88 + 0.12 * wxClump
  + 0.26 * wxGrains + 0.10 * wxEdge), 0.0, 1.0);
vec3 wxDustColor = mix(wxPowderColor * (0.95 + 0.06 * wxClump),
  wxPowderGrainColor, wxGrains * 0.63);

// Fingertip contact rubs a soft, slightly polished patch. It does not generate
// the broken-paint islands used at the case corners.
float wxRub = ws.y * wxHandle * (0.68 + 0.27 * wxClump);
vec2 wxDragUV = vec2(wxLocal.x + 0.32 * wxLocal.z,
  wxLocal.z - 0.20 * wxLocal.x + 0.65 * wxLocal.y) + uCenter.xz * 0.43;
vec2 wxHandUV = vec2(wxLocal.x, wxLocal.y + wxLocal.z * 0.72);
vec2 wxScratchUV = mix(wxDragUV, wxHandUV, wxHandle);
vec2 wxScratches = wxScratchSegments(wxScratchUV,
  mix(vec2(13.0, 48.0), vec2(24.0, 150.0), wxHandle), wxDragged);
float wxRubLines = ws.y * wxHandle * wxScratches.x * 0.24;
float wxDragWear = ws.y * wxDragged * (1.0 - wxHardware);
float wxScratchCore = wxDragWear * wxScratches.x;
float wxScratchRim = wxDragWear * wxScratches.y;
float wxDragScuff = wxDragWear * (0.20 + 0.25 * wxClump);

// Two offset thresholds leave a visible neutral primer rim around the deeper
// substrate. Wear intensity opens more islands; edges bias their density.
float wxChipStrength = ws.y * (0.38 + 0.62 * wxEdge);
float wxChipThreshold = mix(0.82, 0.30, wxChipStrength);
float wxChipAA = max(fwidth(wxChipNoise) * 0.7, 0.018);
float wxChipUnder = ws.y * wxChippable
  * smoothstep(wxChipThreshold - 0.085 - wxChipAA,
    wxChipThreshold - 0.085 + wxChipAA, wxChipNoise);
float wxChipCore = ws.y * wxChippable
  * smoothstep(wxChipThreshold + 0.05 - wxChipAA,
    wxChipThreshold + 0.05 + wxChipAA, wxChipNoise);
float wxExposed = clamp(wxChipCore + wxScratchCore * (1.0 - wxChipCore), 0.0, 1.0);

vec3 wxCoat = clamp(uCoatColor * (0.982 + 0.036 * wxClump), 0.0, 1.0);
vec3 wxAged = wxCoat;
// Plastic contact changes surface relief only: no whitening, exposed inner
// colour or primer tint. The painted-steel colour path is unchanged.
if (wxPlastic < 0.5) {
  float wxCoatLuma = dot(wxCoat, vec3(0.2126, 0.7152, 0.0722));
  vec3 wxRubbedCoat = clamp(mix(wxCoat, vec3(wxCoatLuma), 0.24) + vec3(0.019), 0.0, 1.0);
  wxAged = mix(wxCoat, wxRubbedCoat, clamp(wxRub + wxDragScuff, 0.0, 1.0));
  wxAged = mix(wxAged, wxRubbedCoat + vec3(0.012), wxRubLines);
  wxAged = mix(wxAged, wxPrimerColor, wxChipUnder);
  wxAged = mix(wxAged, wxMetalColor, wxChipCore);
  wxAged = mix(wxAged, wxPrimerColor, wxScratchRim * 0.72);
  wxAged = mix(wxAged, wxMetalColor, wxScratchCore);
}
// Real metal hardware remains independent of the painted/plastic case option.
wxAged = mix(wxAged, wxHardwareColor * (0.97 + 0.06 * wxClump), wxHardware);
wxAged = mix(wxAged, wxDustColor, wxDustMask);
diffuseColor.rgb = wxAged;

float wxHeight = wxDustMask * (0.0008 + 0.00085 * wxGrains)
  - wxChipUnder * 0.00035 - wxChipCore * 0.0008
  - wxScratchCore * 0.0011 + wxRubLines * 0.00012;
// Readable plastic grooves replace albedo/roughness cues. The dust height is
// identical; metal hardware and painted steel retain their original heights.
// wxPerturbNormal still caps the slope at 0.28 to avoid torn/glittering surfaces.
float wxPlasticHeight = wxDustMask * (0.0008 + 0.00085 * wxGrains)
  - wxChipUnder * 0.0008 - wxChipCore * 0.0018
  - wxScratchCore * 0.0022 - wxRubLines * 0.0026;
wxHeight = mix(wxHeight, wxPlasticHeight, wxPlastic * (1.0 - wxHardware));

// Preserve the existing diagnostic overlay colours, values and lighting split.
vec3 causeColor = vec3(0.012, 0.016, 0.017);
float causeStrength = 0.0;
if (uLayer > 0.5 && uLayer < 1.5) {
  causeStrength = ws.x;
  causeColor = mix(causeColor, vec3(0.64, 0.45, 0.19), causeStrength);
}
if (uLayer > 1.5) {
  causeStrength = uHeuristic > 0.5 ? wxEdge : ws.z;
  causeColor = mix(causeColor, vec3(0.29, 0.66, 0.56), causeStrength);
}
if (uLayer > 0.5) diffuseColor.rgb = causeColor * 0.48;
`;

/**
 * Creates a surface material for an axis-aligned Weathering Lab case part.
 * Shared uniforms use Three.js's { value } shape and retain their references.
 * uCoatColor is a linear THREE.Color; omitted values default to #26333b.
 * The caller owns the material, renderer updates and eventual disposal.
 */
export function createWeatherMaterial({ center, half, kind, hardware = false, uniforms = {} }) {
  const material = new THREE.MeshStandardMaterial({
    color: '#26333b',
    metalness: hardware ? 0.85 : 0,
    roughness: hardware ? 0.32 : 0.53,
    envMapIntensity: hardware ? 0.65 : 0.55,
  });
  const coatUniform = uniforms.uCoatColor?.isColor
    ? { value: uniforms.uCoatColor }
    : uniforms.uCoatColor ?? { value: new THREE.Color('#26333b') };
  const shaderUniforms = {
    uDust: { value: 0 },
    uWear: { value: 0 },
    uWind: { value: 0 },
    uContact: { value: 0 },
    uHeuristic: { value: 0 },
    uLayer: { value: 0 },
    uPlastic: { value: 0 },
    ...uniforms,
    uCoatColor: coatUniform,
    uCenter: { value: new THREE.Vector3(...center) },
    uHalf: { value: new THREE.Vector3(...half) },
    uKind: { value: kind },
    uHardware: { value: hardware ? 1 : 0 },
  };

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, shaderUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWxPosition;
varying vec3 vWxNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWxPosition = (modelMatrix * vec4(position, 1.0)).xyz;
vWxNormal = normalize(mat3(modelMatrix) * normal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWxPosition;
varying vec3 vWxNormal;
uniform vec3 uCenter, uHalf, uCoatColor;
uniform float uKind, uHardware, uDust, uWear, uWind, uContact, uHeuristic, uLayer, uPlastic;
${WEATHER_GLSL}
${SURFACE_HELPERS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${SURFACE_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = 0.53;
roughnessFactor = mix(roughnessFactor, 0.29, wxRub * 0.8);
roughnessFactor = mix(roughnessFactor, 0.78, wxChipUnder * (1.0 - wxChipCore));
roughnessFactor = mix(roughnessFactor, 0.36, wxExposed);
// Bare plastic keeps one roughness regardless of contact; dust still overlays it.
roughnessFactor = mix(roughnessFactor, 0.60, wxPlastic);
roughnessFactor = mix(roughnessFactor, 0.32, wxHardware);
roughnessFactor = mix(roughnessFactor, 0.97 + 0.03 * wxGrains, wxDustMask);
if (uLayer > 0.5) roughnessFactor = 1.0;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(wxExposed * 0.86 * (1.0 - wxPlastic), 0.85, wxHardware)
  * (1.0 - wxDustMask);
if (uLayer > 0.5) metalnessFactor = 0.0;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// r160 defines normal and vViewPosition before this chunk. Standard/physical
// materials already enable derivatives on WebGL 1; WebGL 2 has them natively.
if (uLayer < 0.5) {
  vec3 wxBumpedNormal = wxPerturbNormal(-vViewPosition, normal, wxHeight);
  // No derivative spill may change a point outside both causal supports.
  normal = normalize(mix(normal, wxBumpedNormal, clamp(max(ws.x, ws.y), 0.0, 1.0)));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uLayer > 0.5) totalEmissiveRadiance = causeColor * 0.66;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// High roughness only broadens a highlight. Suppress both the direct-light
// and environment specular lobes where opaque powder covers the substrate.
// Bare paint/metal and the diagnostic overlays retain their original response.
if (uLayer < 0.5) {
  float wxPowderSpecular = mix(1.0, 0.01, smoothstep(0.0, 0.75, wxDustMask));
  reflectedLight.directSpecular *= wxPowderSpecular;
  reflectedLight.indirectSpecular *= wxPowderSpecular;
}`);
  };

  material.customProgramCacheKey = () => 'weathering-surface-v4-plastic-normal-only';
  return material;
}
