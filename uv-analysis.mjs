// Browser-local UV measurements. Coverage uses texel centres, not summed UV area.
const SAMPLE_SIZE = 512;
const MAX_TRIANGLES = 60000;
const UV_EPSILON = 1e-7;
const MAX_GAP_EDGES = 1800;

class UnionFind {
  constructor(size) {
    this.parent = Int32Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }
  find(index) {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[index] !== index) {
      const next = this.parent[index];
      this.parent[index] = root;
      index = next;
    }
    return root;
  }
  join(a, b) {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return;
    if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a]++;
  }
}

function triangleMeasures(positions, uvs, face) {
  const p = face * 9, t = face * 6;
  const ax = positions[p + 3] - positions[p];
  const ay = positions[p + 4] - positions[p + 1];
  const az = positions[p + 5] - positions[p + 2];
  const bx = positions[p + 6] - positions[p];
  const by = positions[p + 7] - positions[p + 1];
  const bz = positions[p + 8] - positions[p + 2];
  const a2 = ax * ax + ay * ay + az * az;
  const b2 = bx * bx + by * by + bz * bz;
  const dot = ax * bx + ay * by + az * bz;
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  const du1 = uvs[t + 2] - uvs[t], dv1 = uvs[t + 3] - uvs[t + 1];
  const du2 = uvs[t + 4] - uvs[t], dv2 = uvs[t + 5] - uvs[t + 1];
  const uvDet = Math.abs(du1 * dv2 - du2 * dv1);
  const uvScale = Math.max(du1 * du1 + dv1 * dv1, du2 * du2 + dv2 * dv2);
  const degenerate3D = !Number.isFinite(cross) || cross <= Math.max(a2, b2) * 1e-12 || cross === 0;
  const degenerateUV = !Number.isFinite(uvDet) || uvDet <= uvScale * 1e-12 || uvDet === 0;
  if (degenerate3D || degenerateUV) return { degenerate3D, degenerateUV };

  // A local orthonormal 3D basis removes orientation and scale from stretch.
  const length = Math.sqrt(a2), along = dot / length, across = cross / length;
  let j00 = du1 / length, j10 = dv1 / length;
  let j01 = (du2 - du1 * along / length) / across;
  let j11 = (dv2 - dv1 * along / length) / across;
  const scale = Math.max(Math.abs(j00), Math.abs(j01), Math.abs(j10), Math.abs(j11));
  j00 /= scale; j01 /= scale; j10 /= scale; j11 /= scale;
  const trace = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11;
  const determinant = Math.abs(j00 * j11 - j01 * j10);
  const largest = (trace + Math.sqrt(Math.max(0, trace * trace - 4 * determinant * determinant))) / 2;
  const stretch = Math.max(1, Math.min(1e6, largest / determinant));
  return { degenerate3D: false, degenerateUV: false, uvArea: uvDet / 2, worldArea: cross / 2, stretch };
}

function sameUVEdge(a, b) {
  return Math.abs(a.u0 - b.u0) <= UV_EPSILON && Math.abs(a.v0 - b.v0) <= UV_EPSILON &&
    Math.abs(a.u1 - b.u1) <= UV_EPSILON && Math.abs(a.v1 - b.v1) <= UV_EPSILON;
}

// Canonically evaluate shared edges from their lower endpoint. A half-open
// [left, right) span and [bottom, top) edge avoid counting shared diagonals twice.
function rasterTriangle(uvs, face, differences) {
  const t = face * 6, size = SAMPLE_SIZE, stride = size + 1;
  const vertices = [[uvs[t], uvs[t + 1]], [uvs[t + 2], uvs[t + 3]], [uvs[t + 4], uvs[t + 5]]];
  const minV = Math.min(vertices[0][1], vertices[1][1], vertices[2][1]);
  const maxV = Math.max(vertices[0][1], vertices[1][1], vertices[2][1]);
  const first = Math.max(0, Math.ceil(minV * size - 0.5));
  const end = Math.min(size, Math.ceil(maxV * size - 0.5));
  if (first >= end) return;
  const edges = [];
  for (let i = 0; i < 3; i++) {
    let a = vertices[i], b = vertices[(i + 1) % 3];
    if (a[1] === b[1]) continue;
    if (a[1] > b[1]) [a, b] = [b, a];
    edges.push([a[0], a[1], b[1], (b[0] - a[0]) / (b[1] - a[1])]);
  }
  for (let row = first; row < end; row++) {
    const y = (row + 0.5) / size;
    let left = Infinity, right = -Infinity;
    for (let e = 0; e < edges.length; e++) {
      const edge = edges[e];
      if (y < edge[1] || y >= edge[2]) continue;
      const x = edge[0] + (y - edge[1]) * edge[3];
      left = Math.min(left, x); right = Math.max(right, x);
    }
    const from = Math.max(0, Math.ceil(left * size - 0.5));
    const to = Math.min(size, Math.ceil(right * size - 0.5));
    if (from < to) {
      const offset = row * stride;
      differences[offset + from]++;
      differences[offset + to]--;
    }
  }
}

function pointSegmentDistance2(p, a, b) {
  const x = b[0] - a[0], y = b[1] - a[1];
  const length2 = x * x + y * y;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / length2)) : 0;
  const dx = p[0] - a[0] - t * x, dy = p[1] - a[1] - t * y;
  return dx * dx + dy * dy;
}

function segmentDistance2(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abc = cross(a, b, c), abd = cross(a, b, d), cda = cross(c, d, a), cdb = cross(c, d, b);
  if (((abc < 0 && abd > 0) || (abc > 0 && abd < 0)) &&
      ((cda < 0 && cdb > 0) || (cda > 0 && cdb < 0))) return 0;
  return Math.min(pointSegmentDistance2(a, c, d), pointSegmentDistance2(b, c, d),
    pointSegmentDistance2(c, a, b), pointSegmentDistance2(d, a, b));
}

function boundaryGaps(islands, overlap) {
  let edgeGapUV = Infinity;
  const edges = [];
  for (const island of islands) {
    const b = island.bounds;
    edgeGapUV = Math.min(edgeGapUV, b.minU, b.minV, 1 - b.maxU, 1 - b.maxV);
    for (const boundary of island.boundary) edges.push({ id: island.id, a: boundary[0], b: boundary[1] });
  }
  edgeGapUV = Number.isFinite(edgeGapUV) ? Math.max(0, edgeGapUV) : null;
  if (overlap > 0) return { minGapUV: null, edgeGapUV, gapStatus: 'overlap' };
  if (islands.length < 2) return { minGapUV: null, edgeGapUV, gapStatus: 'single-island' };
  if (edges.length > MAX_GAP_EDGES) return { minGapUV: null, edgeGapUV, gapStatus: 'edge-limit' };
  let minimum = Infinity;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      if (a.id === b.id) continue;
      minimum = Math.min(minimum, segmentDistance2(a.a, a.b, b.a, b.b));
      if (minimum === 0) return { minGapUV: 0, edgeGapUV, gapStatus: 'boundary-distance' };
    }
  }
  return { minGapUV: Number.isFinite(minimum) ? Math.sqrt(minimum) : null, edgeGapUV, gapStatus: 'boundary-distance' };
}

/** Analyze UV channel 0. materialId -1 deliberately treats all materials as one atlas.
 * occupancy / overlap are fractions of the 0–1 tile sampled at 512² texel centres.
 * uvArea is the sum of face areas, while occupancy is their sampled union.
 * density uses model units (no assumed centimetres); stretch is σmax / σmin,
 * aggregated as a 3D-area-weighted geometric mean and capped at 1,000,000.
 */
export function analyzeUV(model, { materialId = -1, resolution = 128 } = {}) {
  const { positions, uvs, vertexIds, uvValid, materialIds } = model;
  const count = positions.length / 9;
  if (!Number.isInteger(count) || uvs.length !== count * 6 || vertexIds.length !== count * 3 ||
      uvValid.length !== count || materialIds.length !== count) throw new Error('모델의 삼각형 데이터 길이가 맞지 않습니다.');
  if (count > MAX_TRIANGLES) throw new Error('한 번에 삼각형 60,000개까지 분석할 수 있습니다. 모델을 나누거나 폴리곤 수를 줄여 주세요.');
  if (!Number.isFinite(resolution) || resolution <= 0) throw new Error('텍스처 해상도는 양수여야 합니다.');
  const warnings = [...(model.warnings || [])];
  const sets = new UnionFind(count), faceIsland = new Int32Array(count).fill(-1);
  const valid = new Uint8Array(count), measures = new Array(count), geometryEdges = new Map();
  const differences = new Int32Array(SAMPLE_SIZE * (SAMPLE_SIZE + 1));
  const stats = { triangles: 0, missingUV: 0, degenerateUV: 0, degenerate3D: 0, outsideTriangles: 0,
    occupancy: 0, overlap: 0, uvArea: 0, worldArea: 0, density: 0, sampleSize: SAMPLE_SIZE, resolution };

  for (let face = 0; face < count; face++) {
    if (materialId !== -1 && materialIds[face] !== materialId) continue;
    stats.triangles++;
    const t = face * 6;
    let finiteUV = !!uvValid[face], outside = false;
    for (let k = 0; k < 6; k++) {
      const coordinate = uvs[t + k];
      finiteUV = finiteUV && Number.isFinite(coordinate);
      outside = outside || coordinate < 0 || coordinate > 1;
    }
    const measurement = triangleMeasures(positions, uvs, face);
    if (measurement.degenerate3D) stats.degenerate3D++;
    if (!finiteUV) { stats.missingUV++; continue; }
    if (outside) stats.outsideTriangles++;
    if (measurement.degenerateUV) stats.degenerateUV++;
    if (measurement.degenerate3D || measurement.degenerateUV) continue;
    valid[face] = 1;
    measures[face] = measurement;
    stats.uvArea += measurement.uvArea;
    stats.worldArea += measurement.worldArea;
    rasterTriangle(uvs, face, differences);
    for (let corner = 0; corner < 3; corner++) {
      let a = corner, b = (corner + 1) % 3;
      let idA = vertexIds[face * 3 + a], idB = vertexIds[face * 3 + b];
      if (idA > idB) { [idA, idB] = [idB, idA]; [a, b] = [b, a]; }
      const edge = { face, u0: uvs[t + a * 2], v0: uvs[t + a * 2 + 1],
        u1: uvs[t + b * 2], v1: uvs[t + b * 2 + 1], shared: false };
      const key = `${idA}:${idB}`;
      const group = geometryEdges.get(key);
      if (group) group.push(edge); else geometryEdges.set(key, [edge]);
    }
  }

  let comparisons = 0, truncatedConnectivity = false, nonManifold = false;
  for (const group of geometryEdges.values()) {
    if (group.length > 2) nonManifold = true;
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      for (let j = 0; j < i; j++) {
        if (++comparisons > 3000000) { truncatedConnectivity = true; break; }
        const b = group[j];
        if (sameUVEdge(a, b)) {
          sets.join(a.face, b.face);
          a.shared = b.shared = true;
        }
      }
      if (truncatedConnectivity) break;
    }
    if (truncatedConnectivity) break;
  }
  if (nonManifold) warnings.push('3개 이상의 면이 공유하는 에지가 있습니다. 비매니폴드 형상이나 중복 면인지 확인해 주세요.');
  if (truncatedConnectivity) warnings.push('한 에지에 지나치게 많은 면이 연결되어 아일랜드 연결 검사를 제한했습니다. 아일랜드 수와 경계는 불완전할 수 있습니다.');

  const islands = [], roots = new Map();
  for (let face = 0; face < count; face++) {
    if (!valid[face]) continue;
    const root = sets.find(face);
    let island = roots.get(root);
    if (!island) {
      island = { id: islands.length, faces: [], uvArea: 0, worldArea: 0, densityRatio: 0, stretch: 1,
        bounds: { minU: Infinity, minV: Infinity, maxU: -Infinity, maxV: -Infinity }, boundary: [], _stretchSum: 0 };
      roots.set(root, island); islands.push(island);
    }
    faceIsland[face] = island.id;
    island.faces.push(face);
    const m = measures[face];
    island.uvArea += m.uvArea; island.worldArea += m.worldArea;
    island._stretchSum += Math.log(m.stretch) * m.worldArea;
    for (let corner = 0; corner < 3; corner++) {
      const u = uvs[face * 6 + corner * 2], v = uvs[face * 6 + corner * 2 + 1];
      island.bounds.minU = Math.min(island.bounds.minU, u); island.bounds.maxU = Math.max(island.bounds.maxU, u);
      island.bounds.minV = Math.min(island.bounds.minV, v); island.bounds.maxV = Math.max(island.bounds.maxV, v);
    }
  }
  for (const group of geometryEdges.values()) for (const edge of group) {
    if (!edge.shared) islands[faceIsland[edge.face]].boundary.push([[edge.u0, edge.v0], [edge.u1, edge.v1]]);
  }
  stats.density = stats.worldArea ? resolution * Math.sqrt(stats.uvArea / stats.worldArea) : 0;
  for (const island of islands) {
    const density = resolution * Math.sqrt(island.uvArea / island.worldArea);
    island.densityRatio = stats.density ? density / stats.density : 0;
    island.stretch = Math.exp(island._stretchSum / island.worldArea);
    delete island._stretchSum;
  }

  let occupied = 0, overlapping = 0;
  for (let row = 0; row < SAMPLE_SIZE; row++) {
    let coverage = 0;
    for (let column = 0; column < SAMPLE_SIZE; column++) {
      coverage += differences[row * (SAMPLE_SIZE + 1) + column];
      if (coverage > 0) occupied++;
      if (coverage > 1) overlapping++;
    }
  }
  stats.occupancy = occupied / (SAMPLE_SIZE * SAMPLE_SIZE);
  stats.overlap = overlapping / (SAMPLE_SIZE * SAMPLE_SIZE);
  Object.assign(stats, boundaryGaps(islands, stats.overlap));
  if (materialId === -1 && new Set(materialIds).size > 1) warnings.push('여러 머티리얼을 하나의 UV 타일로 함께 검사 중입니다. 서로 다른 텍스처를 쓰는 경우 머티리얼별로 확인해 주세요.');
  return { islands, faceIsland, stats, warnings };
}
