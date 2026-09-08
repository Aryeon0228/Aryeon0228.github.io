export function candleLux(count, distance) { return count / (distance * distance); }
export function stopDifference(a, b) { return Math.log2(b / a); }
export function fitExposure(lux) { return Math.log2(100000 / lux); }
export function linearDisplay(lux, reflectance, stops) {
  const x = lux / 100000 * (reflectance / .18) * (.18 / .82) * 2 ** stops;
  return x / (1 + x);
}
export function srgb(x) { return x <= .0031308 ? 12.92*x : 1.055 * x ** (1/2.4) - .055; }
