// Orientation and texel-axis measurements are separate: a rotated island can
// still have perfectly perpendicular texel axes on the 3D surface.
const DEGREES = 180 / Math.PI;
const MAX_TRIANGLES = 60000;

/** Unsigned angle to the nearest U/V axis, in degrees [0, 45].
 * Degenerate/non-finite segments return NaN. This measures direction only,
 * not whether an edge lies on a pixel boundary at a particular resolution.
 */
export function boundaryDeviation(a, b) {
  const du = Math.abs(b[0] - a[0]), dv = Math.abs(b[1] - a[1]);
  if (!Number.isFinite(du) || !Number.isFinite(dv) || Math.max(du, dv) === 0) return NaN;
  return Math.atan2(Math.min(du, dv), Math.max(du, dv)) * DEGREES;
}

function faceMeasurement(model, face) {
  const { positions, uvs } = model, p = face * 9, t = face * 6;
  const ax = positions[p + 3] - positions[p];
  const ay = positions[p + 4] - positions[p + 1];
  const az = positions[p + 5] - positions[p + 2];
  const bx = positions[p + 6] - positions[p];
  const by = positions[p + 7] - positions[p + 1];
  const bz = positions[p + 8] - positions[p + 2];
  const du1 = uvs[t + 2] - uvs[t], dv1 = uvs[t + 3] - uvs[t + 1];
  const du2 = uvs[t + 4] - uvs[t], dv2 = uvs[t + 5] - uvs[t + 1];
  const determinant = du1 * dv2 - du2 * dv1;
  const uvScale = Math.max(du1 * du1 + dv1 * dv1, du2 * du2 + dv2 * dv2);
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  const worldScale = Math.max(ax * ax + ay * ay + az * az, bx * bx + by * by + bz * bz);
  if (!Number.isFinite(determinant) || !Number.isFinite(cross) ||
      Math.abs(determinant) <= uvScale * 1e-12 || cross <= worldScale * 1e-12 || cross === 0) return null;

  // dP/du = (e1 * dv2 - e2 * dv1) / determinant, and similarly dP/dv.
  // The common determinant cancels when both vectors are normalized; avoiding
  // the division also keeps tiny but valid UV triangles numerically stable.
  let ux = ax * dv2 - bx * dv1, uy = ay * dv2 - by * dv1, uz = az * dv2 - bz * dv1;
  let vx = bx * du1 - ax * du2, vy = by * du1 - ay * du2, vz = bz * du1 - az * du2;
  const uLength = Math.hypot(ux, uy, uz), vLength = Math.hypot(vx, vy, vz);
  if (!Number.isFinite(uLength) || !Number.isFinite(vLength) || uLength === 0 || vLength === 0) return null;
  ux /= uLength; uy /= uLength; uz /= uLength;
  vx /= vLength; vy /= vLength; vz /= vLength;
  const cosine = Math.min(1, Math.abs(ux * vx + uy * vy + uz * vz));
  return { shear: Math.asin(cosine) * DEGREES, area: cross / 2 };
}

function totals() {
  return { length: 0, alignedLength: 0, deviationSum: 0, area: 0, shearSum: 0, shearMax: 0 };
}

function publicMetrics(total) {
  return {
    alignedFraction: total.length ? total.alignedLength / total.length : null,
    axisDeviation: total.length ? total.deviationSum / total.length : null,
    shearMean: total.area ? total.shearSum / total.area : null,
    shearMax: total.area ? total.shearMax : null,
  };
}

/**
 * Use analyzeUV's selected islands and boundaries so internal triangulation
 * diagonals and excluded materials do not affect boundary alignment.
 *
 * alignedFraction and axisDeviation are weighted by UV boundary length.
 * shearMean is weighted by 3D face area; shearMax is the largest face value.
 * A shear of 0° means perpendicular pixel axes, not necessarily square pixels.
 * Rotating an anisotropic UV mapping can change shear because it changes the
 * physical directions of its U/V pixel axes. UV translation, uniform scale,
 * mirroring, and reversed triangle winding preserve shear.
 *
 * Invalid/excluded faces retain NaN. Metrics with no valid samples are null.
 */
export function analyzeGrid(model, analysis, { axisTolerance = 2 } = {}) {
  const count = model.positions.length / 9;
  if (!Number.isInteger(count) || model.uvs.length !== count * 6 ||
      model.uvValid.length !== count || analysis.faceIsland.length !== count) {
    throw new Error('격자 분석에 필요한 삼각형 데이터 길이가 맞지 않습니다.');
  }
  if (count > MAX_TRIANGLES) throw new Error('격자 분석은 한 번에 삼각형 60,000개까지 지원합니다.');
  if (!Number.isFinite(axisTolerance) || axisTolerance < 0 || axisTolerance > 45) {
    throw new Error('축 정렬 허용 각도는 0°에서 45° 사이여야 합니다.');
  }
  const faceShear = new Float32Array(count).fill(NaN), summary = totals();
  const records = analysis.islands.map(island => ({ id: island.id, totals: totals() }));
  const byId = new Map(records.map(record => [record.id, record]));

  for (const island of analysis.islands) {
    const total = byId.get(island.id).totals;
    for (const [a, b] of island.boundary) {
      const deviation = boundaryDeviation(a, b);
      if (!Number.isFinite(deviation)) continue;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      total.length += length;
      total.deviationSum += deviation * length;
      if (deviation <= axisTolerance) total.alignedLength += length;
    }
    summary.length += total.length;
    summary.alignedLength += total.alignedLength;
    summary.deviationSum += total.deviationSum;
  }

  for (let face = 0; face < count; face++) {
    if (!model.uvValid[face]) continue;
    const record = byId.get(analysis.faceIsland[face]);
    if (!record) continue;
    const measurement = faceMeasurement(model, face);
    if (!measurement) continue;
    const { shear, area } = measurement, total = record.totals;
    faceShear[face] = shear;
    total.area += area;
    total.shearSum += shear * area;
    total.shearMax = Math.max(total.shearMax, shear);
    summary.area += area;
    summary.shearSum += shear * area;
    summary.shearMax = Math.max(summary.shearMax, shear);
  }

  return {
    islands: records.map(record => ({ id: record.id, ...publicMetrics(record.totals) })),
    faceShear,
    summary: publicMetrics(summary),
  };
}
