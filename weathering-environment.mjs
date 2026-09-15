/**
 * Shared moisture conditions for the axis-aligned Weathering Lab case.
 * Educational relative fields, not measured RH, elapsed days or a fluid solver.
 * Wetness describes repeated water/moisture exposure: a small ambient supply
 * can reach sheltered surfaces, while rain from above is attenuated by shielding.
 * Shelter/retention never create water. Material eligibility belongs elsewhere.
 * References: CCI "Caring for metal objects" and "Caring for outdoor objects".
 */

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

// Integral of wetness starting dry, divided by equilibrium wetness * duration.
// The short series avoids cancellation near zero and matches the GLSL branch.
function integralFraction(x) {
  return x < 0.05
    ? x * (0.5 - x / 6 + x * x / 24 - x * x * x / 120)
    : 1 - (1 - Math.exp(-x)) / x;
}

/**
 * `weather.shelter` comes from sampleWeather; GLSL receives weatherSignals.w.
 * World normal uses +Y up; rain arrives vertically from above.
 * point/part are reserved for later canonical runoff; this stage uses normal
 * and the supplied position-dependent shelter, without a blanket edge rule.
 *
 * Returns values in [0,1]: arrival, wetPersistence (equilibrium wet fraction),
 * wetDose (bounded integrated wetness over a virtual exposure), and retention.
 * Wet persistence describes the condition, not the final instant in history.
 * Each evaluation describes a new history, rather than advancing a live clock.
 */
export function sampleEnvironment(point, normal, part = {}, state = {}, weather = {}) {
  const waterInput = clamp(finite(state.wetness, 0));
  const exposure = clamp(finite(state.exposure, 0));
  const drying = clamp(finite(state.drying, 0.5));
  const shelter = clamp(finite(weather.shelter, 0));
  let n = [0, 1, 0].map((fallback, i) => finite(normal?.[i], fallback));
  const normalLength = Math.hypot(...n);
  n = normalLength > 0.000001 ? n.map(value => value / normalLength) : [0, 1, 0];

  const up = Math.max(n[1], 0);
  // Broad upward surfaces and protected locations retain supplied moisture.
  // These illustrative coefficients are not material-specific measurements.
  const retention = clamp(0.58 * up + 0.22 * shelter);
  const arrival = waterInput * (0.08 + 0.92 * up * (1 - 0.82 * shelter));
  const dryingRate = (0.22 + 1.4 * drying)
    * (1 - 0.55 * retention) * (1 - 0.35 * shelter);

  // dW/dt = A*(1-W) - D*W, with W(0)=0. D stays strictly positive.
  const rate = arrival + dryingRate;
  const wetPersistence = arrival / rate;
  const duration = 4 * exposure;
  const integratedWetness = wetPersistence * duration * integralFraction(rate * duration);
  const wetDose = clamp(1 - Math.exp(-integratedWetness));
  return { arrival, wetPersistence, wetDose, retention };
}

/**
 * Mirror of sampleEnvironment. Supply finite UI inputs and world-space normals.
 * Returns vec4(arrival, wetPersistence, wetDose, retention), all in [0,1].
 * No rust/moss mask here: consumers must apply their own material/growth gates.
 */
export const ENVIRONMENT_GLSL = /* glsl */ `
float envIntegralFraction(float envX) {
  return envX < 0.05
    ? envX * (0.5 - envX / 6.0 + envX * envX / 24.0
      - envX * envX * envX / 120.0)
    : 1.0 - (1.0 - exp(-envX)) / envX;
}

vec4 envSignals(
  vec3 p, vec3 n, float kind,
  float wetness, float exposure, float drying, float shelter
) {
  float envWaterInput = clamp(wetness, 0.0, 1.0);
  float envExposure = clamp(exposure, 0.0, 1.0);
  float envDrying = clamp(drying, 0.0, 1.0);
  float envShelter = clamp(shelter, 0.0, 1.0);
  float envNormalLength = length(n);
  vec3 envN = envNormalLength > 0.000001 ? n / envNormalLength : vec3(0.0, 1.0, 0.0);
  float envUp = max(envN.y, 0.0);
  float envRetention = clamp(0.58 * envUp + 0.22 * envShelter, 0.0, 1.0);
  float envArrival = envWaterInput
    * (0.08 + 0.92 * envUp * (1.0 - 0.82 * envShelter));
  float envDryingRate = (0.22 + 1.4 * envDrying)
    * (1.0 - 0.55 * envRetention) * (1.0 - 0.35 * envShelter);
  float envRate = envArrival + envDryingRate;
  float envWetPersistence = envArrival / envRate;
  float envDuration = 4.0 * envExposure;
  float envIntegratedWetness = envWetPersistence * envDuration
    * envIntegralFraction(envRate * envDuration);
  float envWetDose = clamp(1.0 - exp(-envIntegratedWetness), 0.0, 1.0);
  return vec4(envArrival, envWetPersistence, envWetDose, envRetention);
}
`;
