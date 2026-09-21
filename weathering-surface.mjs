import * as THREE from './vendor/three/build/three.module.js';
import { WEATHER_GLSL } from './weathering-model.mjs?v=68cf935e8045';
import { ENVIRONMENT_GLSL } from './weathering-environment.mjs?v=c55ba2b7eaa8';
import { RUNOFF_GLSL } from './weathering-runoff.mjs?v=102ac147d918';

// CSS palette entries are converted once into Three.js's linear working space.
// uCoatColor supplies the fixed case colour; powder, primer and hardware stay independent.
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
const vec3 wxRustDarkColor = ${linearColor('#512d1e')};
const vec3 wxRustLightColor = ${linearColor('#bb7542')};
const vec3 wxMossDarkColor = ${linearColor('#223d20')};
const vec3 wxMossTipColor = ${linearColor('#658342')};
const vec3 wxSedimentDarkColor = ${linearColor('#514b3e')};
const vec3 wxSedimentLightColor = ${linearColor('#a79579')};

// This is visible oxide coverage, bounded by the iron the surface shader
// actually exposes. Contact or primer alone cannot qualify as bare iron.
// wetDose is a relative moisture history, not physical corrosion kinetics.
float wxRustCoverage(float wxExposedIron, float wxWetDose, float wxGrain) {
  float wxGrowth = 1.0 - exp(-5.8 * clamp(wxWetDose, 0.0, 1.0));
  return clamp(wxExposedIron, 0.0, 1.0) * wxGrowth
    * mix(0.66, 1.0, smoothstep(0.18, 0.72, wxGrain));
}

// Relative establishment of persistent colonies, not a biological timescale.
// Both moisture gates must open: a brief wet event cannot create moss. Dust
// helps attachment but is not compulsory, and contact removes establishment.
float wxMossCoverage(float wxPersistence, float wxDose, float wxEstablishment,
  float wxContact, float wxPattern, float wxMicroDensity, float wxAA) {
  float wxMaturity = smoothstep(0.18, 0.70, wxDose)
    * smoothstep(0.20, 0.74, wxPersistence);
  float wxPotential = wxMaturity * clamp(wxEstablishment, 0.0, 1.0)
    * (1.0 - 0.97 * clamp(wxContact, 0.0, 1.0));
  float wxThreshold = mix(0.69, 0.42, wxPotential);
  float wxColonies = smoothstep(wxThreshold - wxAA,
    wxThreshold + 0.035 + wxAA * 1.4, wxPattern);
  // Dense tufts can fully hide pale residue; this curve leaves zero coverage
  // and the ragged boundary support intact instead of expanding the islands.
  wxColonies *= 1.45 - 0.45 * wxColonies;
  return wxColonies * smoothstep(0.06, 0.62, wxPotential)
    * mix(0.58, 1.0, smoothstep(0.20, 0.52, wxMicroDensity));
}

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

// Blend the three projections through rounded edges. Switching a dominant
// axis halfway around a bevel would put a seam in the powder's colour/relief.
float wxSurfacePowder(vec3 wxP, vec3 wxN) {
  vec3 wxWeights = pow(abs(wxN), vec3(4.0));
  wxWeights /= max(dot(wxWeights, vec3(1.0)), 0.00001);
  return dot(wxWeights, vec3(wxPowderGrains(wxP.zy),
    wxPowderGrains(wxP.xz), wxPowderGrains(wxP.xy)));
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

// Analytic pixel coverage of a narrow strip. Integrating its width preserves
// hairlines under minification instead of inflating every line to one pixel.
float wxHairlineCoverage(float wxDistance, float wxRadius, float wxAA) {
  return max(0.0, min(wxDistance + wxAA * 0.5, wxRadius)
    - max(wxDistance - wxAA * 0.5, -wxRadius)) / wxAA;
}

// Contact-only counterpart of weatherSignals.y for an individual stroke centre.
// Keeping arrival, dust and moisture out of this helper limits neighbour cost.
float wxScratchContact(vec3 wxPoint, vec3 wxNormal) {
  vec3 wxRelative = abs(wxPoint - uCenter) / max(uHalf, vec3(0.00001));
  vec3 wxEdges = smoothstep(vec3(0.76), vec3(0.99), wxRelative);
  float wxBoundary = max(max(min(wxEdges.x, wxEdges.y),
    min(wxEdges.y, wxEdges.z)), min(wxEdges.z, wxEdges.x));
  float wxTouch = 0.0;
  if (uContact < 0.5) {
    wxTouch = wKindMask(uKind, 2.0) * smoothstep(1.1, 1.15, uCenter.y)
      * (1.0 - smoothstep(0.56, 0.94, wxRelative.x));
  } else if (uContact < 1.5) {
    wxTouch = wCornerContact(wxPoint, uCenter, uHalf, uKind);
  } else {
    float wxBaseBand = 1.0 - smoothstep(0.018, 0.14, wxPoint.y - (uCenter.y - uHalf.y));
    float wxPerimeter = smoothstep(0.56, 0.95, max(wxRelative.x, wxRelative.z));
    wxTouch = wKindMask(uKind, 0.0) * wxBaseBand * (0.22 + 0.78 * wxPerimeter)
      * (0.35 + 0.65 * smoothstep(0.12, 0.85, -wxNormal.y));
  }
  return clamp(uWear, 0.0, 1.0) * mix(clamp(wxTouch, 0.0, 1.0)
    * (0.78 + 0.22 * wxBoundary), wxBoundary, clamp(uHeuristic, 0.0, 1.0));
}

// Long independently oriented segments, evaluated from neighbouring cells so
// strokes cross cell boundaries without forming a repeated dash/grid pattern.
// Occasional close parallel companions make a scuffed cluster. Returns groove,
// lifted edge and clustered fine abrasion, all anti-aliased in screen space.
vec3 wxContactScratches(vec3 wxPoint, vec3 wxNormal, vec2 wxUV, vec3 wxAxisU, vec3 wxAxisV) {
  float wxCornerStrokes = wKindMask(uContact, 1.0);
  float wxSpacing = mix(7.5, 10.5, wxCornerStrokes);
  vec2 wxGrid = wxUV * wxSpacing;
  vec2 wxCell = floor(wxGrid);
  vec2 wxDx = dFdx(wxGrid), wxDy = dFdy(wxGrid);
  vec3 wxResult = vec3(0.0);
  for (int wxJ = -1; wxJ <= 1; wxJ++) {
    for (int wxI = -1; wxI <= 1; wxI++) {
      vec2 wxNeighbour = wxCell + vec2(float(wxI), float(wxJ));
      float wxSeed = wxHash(vec3(wxNeighbour, 13.19));
      float wxSeed2 = wxHash(vec3(wxNeighbour, 37.71));
      float wxSeed3 = wxHash(vec3(wxNeighbour, 71.43));
      float wxLengthSeed = wxHash(vec3(wxNeighbour, 23.57));
      float wxWidthSeed = wxHash(vec3(wxNeighbour, 53.11));
      float wxAcceptSeed = wxHash(vec3(wxNeighbour, 89.31));
      vec2 wxCentre = wxNeighbour + vec2(0.04) + 0.92 * vec2(wxSeed, wxSeed2);
      vec3 wxCentreWorld = clamp(wxPoint + wxAxisU * ((wxCentre.x - wxGrid.x) / wxSpacing)
        + wxAxisV * ((wxCentre.y - wxGrid.y) / wxSpacing), uCenter - uHalf, uCenter + uHalf);
      float wxDose = wxScratchContact(wxCentreWorld, wxNormal);
      // Correlated acceptance creates dense small groups and genuinely empty
      // gaps, not a cloud-shaped brightness multiplier over a uniform grid.
      float wxPatch = smoothstep(0.27, 0.73,
        wxNoise(wxCentreWorld * 5.3 + vec3(12.4, 5.7, 9.2)));
      float wxDenseCore = smoothstep(0.48, 0.84, wxDose) * wxCornerStrokes;
      float wxDensity = pow(wxDose, mix(1.35, 1.10, wxCornerStrokes))
        * mix(0.10 + 0.36 * wxDenseCore, 1.0, wxPatch);
      vec2 wxDirection = normalize(vec2(wxSeed2 - 0.47, wxSeed3 - 0.51) + vec2(0.001));
      vec2 wxPerpendicular = vec2(-wxDirection.y, wxDirection.x);
      vec2 wxDelta = wxGrid - wxCentre;
      float wxAlong = dot(wxDelta, wxDirection);
      float wxAcross = dot(wxDelta, wxPerpendicular);
      vec2 wxLengths = mix(vec2(0.075, 0.88), vec2(0.10, 0.93), wxCornerStrokes);
      vec2 wxWidths = mix(vec2(0.0032, 0.023), vec2(0.0045, 0.034), wxCornerStrokes);
      float wxLength = mix(wxLengths.x, wxLengths.y, pow(wxLengthSeed, 0.70));
      float wxRadius = mix(wxWidths.x, wxWidths.y, pow(wxWidthSeed, 2.1));
      float wxAA = max(abs(dot(wxDx, wxPerpendicular)) + abs(dot(wxDy, wxPerpendicular)), 0.0001);
      float wxEndAA = max(abs(dot(wxDx, wxDirection)) + abs(dot(wxDy, wxDirection)), 0.0001);
      float wxEnd = 1.0 - smoothstep(wxLength - 0.035 - wxEndAA,
        wxLength + wxEndAA, abs(wxAlong));
      // Slight taper gives scratches fine tips, rather than rounded slot ends.
      wxRadius *= mix(1.0, 0.16, smoothstep(wxLength * 0.62, wxLength, abs(wxAlong)));
      float wxCore = wxHairlineCoverage(wxAcross, wxRadius, wxAA);
      float wxLip = max(wxHairlineCoverage(wxAcross, wxRadius * 2.1, wxAA) - wxCore, 0.0);
      float wxCluster = smoothstep(0.20, 0.85, wxDose) * smoothstep(0.25, 0.78, wxPatch);
      float wxFineEnd = 1.0 - smoothstep(wxLength * mix(0.18, 0.42, wxSeed),
        wxLength * mix(0.47, 0.87, wxSeed2) + wxEndAA, abs(wxAlong + (wxSeed3 - 0.5) * 0.24));
      float wxFine = max(wxHairlineCoverage(wxAcross + mix(0.025, 0.092, wxSeed)
        + wxAlong * (wxLengthSeed - 0.5) * 0.31, wxRadius * mix(0.30, 0.68, wxSeed3), wxAA),
        wxHairlineCoverage(wxAcross - mix(0.040, 0.135, wxSeed2)
        + wxAlong * (wxWidthSeed - 0.5) * 0.28, wxRadius * mix(0.22, 0.57, wxSeed), wxAA));
      float wxFineExtra = max(wxHairlineCoverage(wxAcross + mix(0.095, 0.175, wxWidthSeed)
        - wxAlong * (wxSeed - 0.5) * 0.36, wxRadius * 0.34, wxAA),
        wxHairlineCoverage(wxAcross - mix(0.110, 0.195, wxLengthSeed)
        - wxAlong * (wxSeed2 - 0.5) * 0.43, wxRadius * 0.30, wxAA))
        * smoothstep(0.50, 0.94, wxDose) * step(0.36, wxSeed3);
      wxFine = max(wxFine, wxFineExtra) * wxFineEnd * wxCluster;
      float wxPresent = step(wxAcceptSeed + 0.001, wxDensity)
        * mix(0.28, 1.0, pow(wxHash(vec3(wxNeighbour, 61.97)), 0.72));
      wxResult = max(wxResult, vec3(max(wxCore * wxEnd, wxFine),
        wxLip * wxEnd, wxFine) * wxPresent);
    }
  }
  return wxResult;
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
  uDust, uWear, uContact, uHeuristic);

// The same geometric edge field is reused for pooling and the existing
// shape-only wear overlay; the causal weatherSignals output is never altered.
vec3 wxQ = abs(wxLocal) / max(uHalf, vec3(0.00001));
vec3 wxEdgeAxes = smoothstep(vec3(0.76), vec3(0.99), wxQ);
float wxEdge = max(max(min(wxEdgeAxes.x, wxEdgeAxes.y),
  min(wxEdgeAxes.y, wxEdgeAxes.z)), min(wxEdgeAxes.z, wxEdgeAxes.x));
float wxHandle = wKindMask(uKind, 2.0);
float wxBody = wKindMask(uKind, 0.0);
float wxBaseMode = wKindMask(uContact, 2.0);
// Base contact is now the case's own underside and lower perimeter.
// weatherSignals supplies the localized contact footprint.
float wxDragged = wxBody * wxBaseMode;
float wxHardware = clamp(uHardware, 0.0, 1.0);
float wxPlastic = clamp(uPlastic, 0.0, 1.0);
float wxChippable = (1.0 - wxHandle) * (1.0 - wxDragged) * (1.0 - wxHardware);

float wxClump = wxFilteredNoise(wxP * 7.3);
float wxChipFineNoise = wxFilteredNoise(wxP * 91.0);
float wxChipNoise = 0.76 * wxFilteredNoise(wxP * 25.0)
  + 0.24 * wxChipFineNoise;
float wxGrains = wxSurfacePowder(wxP, wxN);

// A continuous thin film leaves the coat readable. Geometry supplies the large
// accumulation pattern; restrained fine variation and isolated grains supply
// texture without painting unrelated cloudy patches across the surface.
// Coverage stays bounded by ws.x even at the maximum dust setting.
float wxDustMask = clamp(ws.x * (0.39 + 0.10 * wxChipNoise
  + 0.17 * wxGrains), 0.0, 1.0);
vec3 wxDustColor = mix(wxPowderColor * (0.98 + 0.03 * wxChipFineNoise),
  wxPowderGrainColor, wxGrains * 0.48);
float wxRepeatedContact = ws.z * clamp(uWear, 0.0, 1.0);
vec4 wxRunoff = vec4(0.0);
float wxSedimentThreads = 0.5;
float wxSedimentFibres = 0.5;
// Source weather is sampled before transport, on the real lid above this face.
// A uniform branch skips both extra samples in every default/dry render.
if (uRunoff > 0.0 && uDust > 0.0) {
  // Rim receivers can extend beyond the lid's flat top. Keep their upstream
  // sample on that real top surface, before its 0.055-radius bevel begins.
  vec3 wxSourceP = vec3(clamp(wxP.x, -1.265, 1.265), 0.97,
    wxP.z < 0.0 ? -0.58 : 0.58);
  vec3 wxSourceN = vec3(0.0, 1.0, 0.0);
  vec4 wxSourceWeather = weatherSignals(wxSourceP, wxSourceN,
    vec3(0.0, 0.87, 0.0), vec3(1.32, 0.10, 0.72), 1.0,
    uDust, uWear, uContact, uHeuristic);
  vec4 wxSourceEnvironment = envSignals(wxSourceP, wxSourceN, 1.0,
    1.0, 0.7, 0.9, wxSourceWeather.w);
  wxRunoff = wxRunoffSignals(wxP, wxN, uKind, uRunoff,
    1.0, 0.7, 0.9, ws.w,
    vec2(wxSourceWeather.x, wxSourceEnvironment.z));
  // Many horizontal changes but slowly varying vertical coordinates make
  // parallel fibres inside each bulk run, not another imposed drip path.
  // This is a uniform branch, so derivative filtering remains well-defined.
  wxSedimentThreads = wxFilteredNoise(wxP * vec3(52.0, 3.4, 9.0)
    + vec3(8.3, 2.7, 6.1));
  wxSedimentFibres = wxFilteredNoise(wxP * vec3(176.0, 13.0, 11.0)
    + vec3(2.1, 9.4, 3.7));
}
// Blue diagnostics report actual removed dust, including prior contact cleaning.
// Transport never erases the underlying coat, wear relief or existing rust.
float wxDustBeforeWash = wxDustMask;
float wxWashMask = wxDustBeforeWash * wxRunoff.y;
wxDustMask = max(wxDustBeforeWash - wxWashMask, 0.0);
float wxSedimentGrain = clamp(0.40 * wxChipFineNoise + 0.35 * wxSedimentFibres
  + 0.25 * wxGrains, 0.0, 1.0);
float wxSedimentBody = clamp(wxRunoff.z / max(wxRunoff.w, 0.00001), 0.0, 1.0);
float wxSedimentFeather = smoothstep(0.015, 0.30, wxSedimentBody);
float wxSedimentStrands = smoothstep(0.18, 0.80,
  0.60 * wxSedimentThreads + 0.40 * wxSedimentFibres);
// The thin outer film breaks into porous fibres and isolated surviving grains.
// Every detail only removes density inside the transported source footprint.
float wxSedimentPores = max(0.60 * wxSedimentFibres + 0.40 * wxChipFineNoise,
  wxGrains * 0.88);
float wxSedimentPoreAA = max(fwidth(wxSedimentPores) * 0.7, 0.025);
float wxSedimentPoreThreshold = mix(0.62, 0.19, wxSedimentFeather);
float wxSedimentPorosity = smoothstep(wxSedimentPoreThreshold - wxSedimentPoreAA,
  wxSedimentPoreThreshold + 0.07 + wxSedimentPoreAA, wxSedimentPores);
float wxSedimentDensity = (0.54 + 0.46 * wxSedimentStrands) * wxSedimentPorosity;
float wxSedimentMask = wxRunoff.z * (1.0 - 0.97 * wxRepeatedContact) * wxSedimentDensity;
// Simplified thin-stain visual response: optical hiding is distinct from the
// relative deposited amount used for transport, height and establishment.
float wxSedimentOpacity = 1.0 - exp(-4.0 * wxSedimentMask);
float wxSedimentConcentration = smoothstep(0.15, 0.82,
  (0.28 + 0.72 * wxSedimentStrands) * wxSedimentFeather);
vec3 wxSedimentColor = mix(wxSedimentLightColor, wxSedimentDarkColor, wxSedimentConcentration);
float wxSedimentHeight = wxSedimentMask * (0.000045 + 0.00016 * wxSedimentGrain);
float wxMineralCoverage = clamp(wxDustMask
  + wxSedimentMask * (1.0 - wxDustMask), 0.0, 1.0);
float wxOpticalMineralCoverage = clamp(wxDustMask
  + wxSedimentOpacity * (1.0 - wxDustMask), 0.0, 1.0);

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

// Fine cuts spread over the three adjacent faces, with every stroke accepted
// from the same corner-centred contact field. Plastic keeps its hairlines;
// painted corner impacts combine fine cuts and sparse, broken paint chips.
float wxCornerMode = wKindMask(uContact, 1.0);
vec3 wxContactMarks = vec3(0.0);
if ((wxPlastic > 0.5 || wxCornerMode > 0.5) && wxHardware < 0.5 && uWear > 0.0) {
  vec3 wxProjection = pow(abs(wxN), vec3(6.0));
  wxProjection /= max(wxProjection.x + wxProjection.y + wxProjection.z, 0.0001);
  wxContactMarks = wxContactScratches(wxP, wxN, wxP.zy + vec2(5.73, 1.91),
      vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0)) * wxProjection.x
    + wxContactScratches(wxP, wxN, wxP.xz + vec2(2.37, 8.61),
      vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0)) * wxProjection.y
    + wxContactScratches(wxP, wxN, wxP.xy + vec2(9.17, 3.29),
      vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0)) * wxProjection.z;
}
wxContactMarks *= ws.y * (1.0 - wxHardware);
float wxPlasticGroove = wxContactMarks.x;
float wxPlasticLip = wxContactMarks.y;
float wxPlasticScuff = wxContactMarks.z;
float wxPaintCuts = (1.0 - wxPlastic) * wxCornerMode;
wxScratchCore = max(wxScratchCore, wxContactMarks.x * wxPaintCuts * 0.72);
wxScratchRim = max(wxScratchRim, wxContactMarks.y * wxPaintCuts * 0.46);
float wxPlasticWhitening = clamp(wxPlasticGroove * 0.42 + wxPlasticLip * 0.88
  + wxPlasticScuff * 0.22, 0.0, 1.0);

// Two offset thresholds leave a visible neutral primer rim around the deeper
// substrate. Wear intensity opens more islands; edges bias their density.
// A rust layer includes its damaged-coat footprint, so it can be added on its
// own. Its damage does not generate the separate scratch layer or clean dust.
float wxCorrosionSite = (wxBody + wKindMask(uKind, 1.0))
  * smoothstep(0.78, 1.12, wxP.x) * smoothstep(0.26, 0.6, wxP.z)
  * (1.0 - smoothstep(0.45, 1.05, abs(wxP.y - 0.35)));
float wxRustContact = uRust * wxCorrosionSite * (0.78 + 0.22 * wxEdge)
  * (1.0 - wxPlastic) * (1.0 - wxHardware);
// Unequal impact patches interrupt the taper on each face. Separate sparse
// paint loss from the continuous contact field; do not fill it like a stain.
float wxImpactPatch = smoothstep(0.24, 0.74,
  wxFilteredNoise(wxP * vec3(14.0, 9.0, 17.0) + vec3(7.1, 2.8, 11.6)));
float wxWearDamage = ws.y * wxChippable * mix(0.22, 1.0, wxImpactPatch);
float wxDamage = max(wxWearDamage, wxRustContact);
float wxChipStrength = wxDamage * (0.48 + 0.52 * wxEdge);
float wxChipThreshold = mix(0.78, 0.29, wxChipStrength);
float wxChipAA = max(fwidth(wxChipNoise) * 0.7, 0.018);
float wxChipUnder = wxDamage
  * smoothstep(wxChipThreshold - 0.085 - wxChipAA,
    wxChipThreshold - 0.085 + wxChipAA, wxChipNoise);
float wxChipCore = wxDamage
  * smoothstep(wxChipThreshold + 0.05 - wxChipAA,
    wxChipThreshold + 0.05 + wxChipAA, wxChipNoise);
float wxExposed = clamp(wxChipCore + wxScratchCore * (1.0 - wxChipCore), 0.0, 1.0);
// Each independently enabled layer carries a fixed, illustrative exposure
// history. Adding moss never silently turns on rust or changes a water mark.
vec4 wxEnvironment = envSignals(wxP, wxN, uKind, 1.0, 1.0, 0.08, ws.w);
vec4 wxRustEnvironment = envSignals(wxP, wxN, uKind, 0.9, 0.9, 0.35, ws.w);
float wxExposedIron = wxExposed * (1.0 - wxPlastic) * (1.0 - wxHardware);
float wxRustGrain = clamp(0.38 * wxChipNoise + 0.42 * wxChipFineNoise
  + 0.20 * wxGrains, 0.0, 1.0);
float wxRustMask = uRust * wxRustCoverage(wxExposedIron, wxRustEnvironment.z, wxRustGrain);
vec3 wxRustColor = mix(wxRustDarkColor, wxRustLightColor,
  clamp(0.16 + 0.72 * wxRustGrain, 0.0, 1.0));
// Replace the oxidized fraction inside the exposed-metal contribution. Mixing
// rust over the already blended coat would apply exposure twice at chip edges.
vec3 wxSubstrateColor = mix(wxMetalColor, wxRustColor,
  wxRustMask / max(wxExposedIron, 0.00001));

// Paint has a fine satin finish; exposed primer, steel and oxide have distinct
// responses. Plastic incisions are smoother than their stressed raised edges.
// One final roughness value also drives moss establishment.
float wxSubstrateRoughness = 0.43 + 0.075 * wxChipFineNoise;
wxSubstrateRoughness = mix(wxSubstrateRoughness, 0.25, wxRub * 0.8);
wxSubstrateRoughness = mix(wxSubstrateRoughness, 0.78, wxChipUnder * (1.0 - wxChipCore));
wxSubstrateRoughness = mix(wxSubstrateRoughness, 0.36, wxExposed);
float wxPlasticRoughness = 0.58 + 0.065 * wxChipFineNoise;
wxPlasticRoughness = mix(wxPlasticRoughness, 0.34, wxPlasticGroove * 0.65);
wxPlasticRoughness = mix(wxPlasticRoughness, 0.74,
  clamp(wxPlasticLip + wxPlasticScuff * 0.35, 0.0, 1.0));
wxSubstrateRoughness = mix(wxSubstrateRoughness, wxPlasticRoughness, wxPlastic);
wxSubstrateRoughness = mix(wxSubstrateRoughness, 0.32, wxHardware);
wxSubstrateRoughness = mix(wxSubstrateRoughness, 0.90 + 0.07 * wxRustGrain, wxRustMask);
float wxMossEstablishment = clamp(0.22 + 0.38 * wxSubstrateRoughness
  + 0.46 * wxMineralCoverage, 0.0, 1.0);
float wxMossDetail = clamp(0.42 * wxChipFineNoise + 0.32 * wxChipNoise
  + 0.46 * wxGrains, 0.0, 1.0);
float wxMossPattern = 0.5;
// The condition is uniform across the draw: derivative filtering remains valid
// while the dry/default view skips this extra colony-noise octave entirely.
if (uMoss > 0.0) {
  // Small colonies and existing chip-scale noise break up the broad clumps.
  // Reusing the finer octave makes ragged edges without another noise sample.
  wxMossPattern = 0.16 * wxClump + 0.28 * wxChipNoise
    + 0.14 * wxChipFineNoise
    + 0.42 * wxFilteredNoise(wxP * 18.9 + vec3(4.7, 2.3, 8.1));
}
float wxMossAA = max(fwidth(wxMossPattern) * 0.8, 0.022);
float wxMossMask = uMoss * wxMossCoverage(wxEnvironment.y, wxEnvironment.z,
  wxMossEstablishment, wxRepeatedContact, wxMossPattern, wxMossDetail, wxMossAA);
vec3 wxMossColor = mix(wxMossDarkColor, wxMossTipColor,
  clamp(0.10 + 0.82 * wxMossDetail, 0.0, 1.0)
    * smoothstep(0.03, 0.68, wxMossMask));

vec3 wxCoat = clamp(uCoatColor * (0.982 + 0.036 * wxClump), 0.0, 1.0);
vec3 wxAged = wxCoat;
// The paint/primer/metal stack is exclusive to painted steel. Plastic scratches
// have pale stressed edges and a shallow incision in the same coloured polymer.
if (wxPlastic < 0.5) {
  float wxCoatLuma = dot(wxCoat, vec3(0.2126, 0.7152, 0.0722));
  vec3 wxRubbedCoat = clamp(mix(wxCoat, vec3(wxCoatLuma), 0.24) + vec3(0.019), 0.0, 1.0);
  wxAged = mix(wxCoat, wxRubbedCoat, clamp(wxRub + wxDragScuff, 0.0, 1.0));
  wxAged = mix(wxAged, wxRubbedCoat + vec3(0.012), wxRubLines);
  wxAged = mix(wxAged, wxPrimerColor, wxChipUnder);
  wxAged = mix(wxAged, wxSubstrateColor, wxChipCore);
  wxAged = mix(wxAged, wxPrimerColor, wxScratchRim * 0.72);
  wxAged = mix(wxAged, wxSubstrateColor, wxScratchCore);
} else {
  vec3 wxStressedPlastic = mix(wxCoat, vec3(0.62, 0.66, 0.68), 0.76);
  wxAged = mix(wxCoat, wxStressedPlastic, wxPlasticWhitening);
}
// Real metal hardware remains independent of the painted/plastic case option.
wxAged = mix(wxAged, wxHardwareColor * (0.97 + 0.06 * wxClump), wxHardware);
// Rust belongs to exposed iron, beneath the independently deposited powder.
wxAged = mix(wxAged, wxDustColor, wxDustMask);
wxAged = mix(wxAged, wxSedimentColor, wxSedimentOpacity);
// Established colonies grow over retained residue, on either paint or plastic.
// Layer order: substrate/rust, retained powder, transported residue, then moss.
wxAged = mix(wxAged, wxMossColor, wxMossMask);
// A present water film changes optical response, never the authored history.
float wxWetMask = currentWetness(wxN, uWet, ws.w);
wxAged *= mix(1.0, 0.74, wxWetMask * (1.0 - wxHardware));
diffuseColor.rgb = wxAged;

float wxHeight = wxDustMask * (0.0008 + 0.00085 * wxGrains)
  - wxChipUnder * 0.00035 - wxChipCore * 0.0008
  - wxScratchCore * 0.0011 + wxRubLines * 0.00012;
// Plastic uses only fine incisions and lifted lips: no broad paint-chip crater.
// Their depth stays shallow; dust, steel and hardware retain their own relief.
float wxPlasticHeight = wxDustMask * (0.0008 + 0.00085 * wxGrains)
  - wxPlasticGroove * 0.00032 + wxPlasticLip * 0.00015
  - wxPlasticScuff * 0.00008;
wxHeight = mix(wxHeight, wxPlasticHeight, wxPlastic * (1.0 - wxHardware));
wxHeight += wxRustMask * (0.00032 + 0.00078 * wxRustGrain) * (1.0 - wxDustMask);
// A dried film has fine surface relief, not the raised edge of a rope or bead.
wxHeight += wxSedimentHeight;
wxHeight = mix(wxHeight, 0.0014 + 0.0028 * wxMossDetail, wxMossMask);

// Grayscale masks describe the effects actually used by this surface shader.
// Dust is retained powder after washing; steel wear combines rub/chips/scuffs,
// while plastic wear uses only its fine incisions and raised edges;
// wet is the present water film; runoff includes both removed and deposited dust.
// Contact diagnostics may still show where contact COULD occur, independently
// of wear amount; the grayscale wear mask is zero when no wear is applied.
float wxWearChipThreshold = mix(0.78, 0.29, wxWearDamage * (0.48 + 0.52 * wxEdge));
float wxWearChip = wxWearDamage * smoothstep(
  wxWearChipThreshold - 0.085 - wxChipAA,
  wxWearChipThreshold - 0.085 + wxChipAA, wxChipNoise);
float wxWearMask = clamp(max(max(wxRub, wxWearChip),
  max(max(wxScratchCore, wxScratchRim), wxDragScuff)), 0.0, 1.0);
wxWearMask = mix(wxWearMask, max(max(wxPlasticGroove, wxPlasticLip),
  wxPlasticScuff), wxPlastic * (1.0 - wxHardware));
float wxEffectMask = 0.0;
if (uLayer > 0.5 && uLayer < 1.5) wxEffectMask = wxDustMask;
if (uLayer > 1.5 && uLayer < 2.5) wxEffectMask = wxWearMask;
if (uLayer > 2.5 && uLayer < 3.5) wxEffectMask = wxWetMask;
if (uLayer > 3.5 && uLayer < 4.5) wxEffectMask = wxRustMask;
if (uLayer > 4.5 && uLayer < 5.5) wxEffectMask = wxMossMask;
if (uLayer > 5.5 && uLayer < 6.5) wxEffectMask = max(wxWashMask, wxSedimentMask);

float wxRunoffMask = max(wxWashMask, wxSedimentMask);
float wxAllMask = max(max(wxDustMask, wxWearMask),
  max(max(wxRustMask, wxMossMask), max(wxRunoffMask, wxWetMask)));
if (uLayer > 6.5) wxEffectMask = wxAllMask;

// Display-space legend colours, written after tone mapping below. The combined
// view averages overlapping contributions; inspecting one layer isolates it
// without changing the effects applied to the object.
vec3 wxDustID = vec3(0.901961, 0.741176, 0.411765);
vec3 wxWearID = vec3(0.403922, 0.862745, 0.898039);
vec3 wxWetID = vec3(0.443137, 0.600000, 0.933333);
vec3 wxRustID = vec3(0.941176, 0.517647, 0.388235);
vec3 wxMossID = vec3(0.568627, 0.788235, 0.419608);
vec3 wxRunoffID = vec3(0.705882, 0.603922, 0.937255);
float wxLayerSum = wxDustMask + wxWearMask + wxWetMask + wxRustMask + wxMossMask + wxRunoffMask;
vec3 wxLayerColor = (wxDustID * wxDustMask + wxWearID * wxWearMask
  + wxWetID * wxWetMask + wxRustID * wxRustMask + wxMossID * wxMossMask + wxRunoffID * wxRunoffMask)
  / max(wxLayerSum, 0.00001);
if (uLayer > 0.5 && uLayer < 1.5) wxLayerColor = wxDustID;
if (uLayer > 1.5 && uLayer < 2.5) wxLayerColor = wxWearID;
if (uLayer > 2.5 && uLayer < 3.5) wxLayerColor = wxWetID;
if (uLayer > 3.5 && uLayer < 4.5) wxLayerColor = wxRustID;
if (uLayer > 4.5 && uLayer < 5.5) wxLayerColor = wxMossID;
if (uLayer > 5.5 && uLayer < 6.5) wxLayerColor = wxRunoffID;

// Preserve the existing diagnostic overlay colours, values and lighting split.
vec3 causeColor = vec3(0.012, 0.016, 0.017);
float causeStrength = 0.0;
if (uLayer > 0.5 && uLayer < 1.5) {
  causeStrength = ws.x * (1.0 - wxRunoff.y);
  causeStrength += wxSedimentMask * (1.0 - causeStrength);
  causeColor = mix(causeColor, vec3(0.64, 0.45, 0.19), causeStrength);
}
if (uLayer > 1.5 && uLayer < 2.5) {
  causeStrength = uHeuristic > 0.5 ? wxEdge : ws.z;
  causeColor = mix(causeColor, vec3(0.29, 0.66, 0.56), causeStrength);
}
if (uLayer > 2.5 && uLayer < 3.5) {
  causeStrength = wxWetMask;
  causeColor = mix(causeColor, vec3(0.16, 0.43, 0.67), causeStrength);
}
if (uLayer > 3.5 && uLayer < 4.5) {
  causeStrength = wxRustMask;
  causeColor = mix(causeColor, vec3(0.74, 0.31, 0.09), causeStrength);
}
if (uLayer > 4.5 && uLayer < 5.5) {
  causeStrength = wxMossMask;
  causeColor = mix(causeColor, vec3(0.26, 0.61, 0.19), causeStrength);
}
if (uLayer > 5.5 && uLayer < 6.5) {
  causeStrength = max(wxWashMask, wxSedimentMask);
  causeColor = mix(causeColor, vec3(0.16, 0.48, 0.72), wxWashMask);
  causeColor = mix(causeColor, vec3(0.63, 0.43, 0.21), wxSedimentMask);
}
if (uLayer > 0.5) diffuseColor.rgb = causeColor * 0.48;
`;

/**
 * Creates a surface material for an axis-aligned Weathering Lab case part.
 * Shared uniforms use Three.js's { value } shape and retain their references.
 * uCoatColor is a linear THREE.Color; omitted values default to #3b4d5b.
 * The caller owns the material, renderer updates and eventual disposal.
 */
export function createWeatherMaterial({ center, half, kind, hardware = false, uniforms = {} }) {
  const material = new THREE.MeshStandardMaterial({
    color: '#3b4d5b',
    metalness: hardware ? 0.85 : 0,
    roughness: hardware ? 0.32 : 0.53,
    envMapIntensity: hardware ? 0.65 : 0.55,
  });
  const coatUniform = uniforms.uCoatColor?.isColor
    ? { value: uniforms.uCoatColor }
    : uniforms.uCoatColor ?? { value: new THREE.Color('#3b4d5b') };
  const shaderUniforms = {
    uDust: { value: 0 },
    uWear: { value: 0 },
    uContact: { value: 0 },
    uHeuristic: { value: 0 },
    uLayer: { value: 0 },
    uMaskView: { value: 0 },
    uPlastic: { value: 0 },
    uWet: { value: 0 },
    uRust: { value: 0 },
    uMoss: { value: 0 },
    uRunoff: { value: 0 },
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
uniform float uKind, uHardware, uDust, uWear, uContact, uHeuristic, uLayer, uMaskView, uPlastic;
uniform float uWet, uRust, uMoss, uRunoff;
${WEATHER_GLSL}
${ENVIRONMENT_GLSL}
${RUNOFF_GLSL}
${SURFACE_HELPERS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${SURFACE_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = wxSubstrateRoughness;
roughnessFactor = mix(roughnessFactor, 0.97 + 0.03 * wxGrains, wxDustMask);
roughnessFactor = mix(roughnessFactor, 0.96 + 0.035 * wxSedimentGrain, wxSedimentOpacity);
roughnessFactor = mix(roughnessFactor, 0.93 + 0.065 * wxMossDetail, wxMossMask);
roughnessFactor = mix(roughnessFactor, 0.18, wxWetMask * 0.82);
if (uLayer > 0.5) roughnessFactor = 1.0;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(max(wxExposed - wxRustMask, 0.0) * 0.86 * (1.0 - wxPlastic), 0.85, wxHardware)
  * (1.0 - wxDustMask) * (1.0 - wxSedimentOpacity) * (1.0 - wxMossMask);
if (uLayer > 0.5) metalnessFactor = 0.0;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// r160 defines normal and vViewPosition before this chunk. Standard/physical
// materials already enable derivatives on WebGL 1; WebGL 2 has them natively.
if (uLayer < 0.5) {
  vec3 wxBumpedNormal = wxPerturbNormal(-vViewPosition, normal, wxHeight);
  // Moss and transported residue may occupy otherwise untouched surfaces.
  normal = normalize(mix(normal, wxBumpedNormal,
    clamp(max(max(ws.x, max(ws.y, wxRustMask)), max(wxMossMask, wxSedimentMask)), 0.0, 1.0)));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uLayer > 0.5) totalEmissiveRadiance = causeColor * 0.66;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// High roughness only broadens a highlight. Suppress both the direct-light
// and environment specular lobes where opaque powder covers the substrate.
// Bare paint/metal and the diagnostic overlays retain their original response.
if (uLayer < 0.5) {
  float wxPowderSpecular = mix(1.0, mix(0.06, 0.7, wxWetMask), smoothstep(0.08, 0.90, wxOpticalMineralCoverage));
  reflectedLight.directSpecular *= wxPowderSpecular;
  reflectedLight.indirectSpecular *= wxPowderSpecular;
  float wxMossSpecular = mix(1.0, mix(0.03, 0.5, wxWetMask), smoothstep(0.0, 0.85, wxMossMask));
  reflectedLight.directSpecular *= wxMossSpecular;
  reflectedLight.indirectSpecular *= wxMossSpecular;
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
// Override the final output after lighting, tone mapping and colour conversion.
// A 0.5 effect is rendered as display gray 0.5, irrespective of the light rig.
if (uMaskView > 0.1 && uLayer > 0.5) {
  gl_FragColor = vec4(vec3(clamp(wxEffectMask, 0.0, 1.0)), 1.0);
  if (uMaskView > 1.5) gl_FragColor.rgb = mix(vec3(0.025), wxLayerColor,
    sqrt(clamp(wxEffectMask, 0.0, 1.0)));
}`);
  };

  material.customProgramCacheKey = () => 'weathering-surface-v17-present-water';
  return material;
}
