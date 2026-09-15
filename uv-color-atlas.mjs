// Discrete UV colour atlas: actual-resolution texel centres, no antialiasing.
// Call buildAtlasData in a disposable worker and transfer rgba.buffer to the UI.
const MAX_RESOLUTION = 4096;
const MAX_TRIANGLES = 60000;
const MAX_SCAN_ROWS = 8000000;
const BACKGROUND = '#24282c';
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function hash(value) {
  value = Math.imul((value >>> 0) ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Stable across resolution and padding changes; seed changes only the palette. */
export function getIslandColor(id, seed = 123) {
  const hue = ((id * 137.50776405 + hash(seed) / 4294967296 * 360) % 360) / 360;
  const saturation = .48 + hash(id ^ seed) / 4294967296 * .16;
  const lightness = .60 + hash(id + seed + 17) / 4294967296 * .12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = n => {
    const k = (n + hue * 12) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [channel(0), channel(8), channel(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function packedColor(css) {
  const rgb = Number.parseInt(css.slice(1), 16), r = rgb >>> 16, g = (rgb >>> 8) & 255, b = rgb & 255;
  return (LITTLE_ENDIAN ? r | (g << 8) | (b << 16) | (255 << 24) : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

function clippedArea(vertices) {
  let polygon = vertices;
  for (const [axis, boundary, direction] of [[0, 0, 1], [0, 1, -1], [1, 0, 1], [1, 1, -1]]) {
    if (!polygon.length) return 0;
    const clipped = [];
    let a = polygon[polygon.length - 1], insideA = (a[axis] - boundary) * direction >= 0;
    for (const b of polygon) {
      const insideB = (b[axis] - boundary) * direction >= 0;
      if (insideA !== insideB) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
        p[axis] = boundary;
        clipped.push(p);
      }
      if (insideB) clipped.push(b);
      a = b; insideA = insideB;
    }
    polygon = clipped;
  }
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    twiceArea += a[0] * b[1] - a[1] * b[0];
  }
  return Math.abs(twiceArea) / 2;
}

function findFree(next, index) {
  let root = index;
  while (next[root] !== root) root = next[root];
  while (next[index] !== index) {
    const old = next[index]; next[index] = root; index = old;
  }
  return root;
}

function rasterEdges(vertices, size) {
  const edges = [];
  for (let i = 0; i < 3; i++) {
    let a = vertices[i], b = vertices[(i + 1) % 3];
    if (a[1] === b[1]) continue;
    if (a[1] > b[1]) [a, b] = [b, a];
    edges.push([a[0] * size, a[1] * size, b[1] * size, (b[0] - a[0]) / (b[1] - a[1])]);
  }
  return edges;
}

function rasterSpan(edges, row, size) {
  // Pixel coordinates keep centre-aligned shared edges exact (also for odd N).
  const y = row + .5;
  let left = Infinity, right = -Infinity;
  for (const edge of edges) {
    if (y < edge[1] || y >= edge[2]) continue;
    const x = edge[0] + (y - edge[1]) * edge[3];
    left = Math.min(left, x); right = Math.max(right, x);
  }
  return [Math.max(0, Math.ceil(left - .5)), Math.min(size, Math.ceil(right - .5))];
}

// Exact nearest-original-texel Euclidean dilation in O(N²), reusing the raster
// scratch buffer. Ties choose the topmost, then leftmost original source texel.
// Newly padded texels never become sources and never overwrite original colour.
function dilate(owners, scratch, size, radius, counts) {
  for (let row = 0; row < size; row++) {
    const offset = row * size;
    let left = -1;
    for (let x = 0; x < size; x++) {
      if (owners[offset + x]) left = x;
      scratch[offset + x] = left < 0 ? -1 : offset + left;
    }
    let right = -1;
    for (let x = size - 1; x >= 0; x--) {
      if (owners[offset + x]) right = x;
      const old = scratch[offset + x];
      if (right >= 0 && (old < 0 || right - x < x - (old - offset))) scratch[offset + x] = offset + right;
    }
  }
  const rows = new Int32Array(size), limits = new Float64Array(size + 1), costs = new Int32Array(size);
  let padded = 0;
  // Lower envelope of parabolas f(y) + (targetY-y)², one per source row.
  for (let x = 0; x < size; x++) {
    let last = -1;
    for (let row = 0; row < size; row++) {
      const source = scratch[row * size + x];
      if (source < 0) continue;
      const dx = source % size - x;
      if (Math.abs(dx) > radius) continue;
      costs[row] = dx * dx;
      let crossing = -Infinity;
      while (last >= 0) {
        const previous = rows[last];
        crossing = ((costs[row] + row * row) - (costs[previous] + previous * previous)) / (2 * (row - previous));
        if (crossing > limits[last]) break;
        last--;
      }
      rows[++last] = row; limits[last] = last === 0 ? -Infinity : crossing;
      limits[last + 1] = Infinity;
    }
    if (last < 0) continue;
    let current = 0;
    for (let row = 0; row < size; row++) {
      if (owners[row * size + x]) continue;
      while (current < last && limits[current + 1] < row) current++;
      const sourceRow = rows[current], dy = row - sourceRow;
      if (costs[sourceRow] + dy * dy > radius * radius) continue;
      const owner = owners[scratch[sourceRow * size + x]];
      owners[row * size + x] = owner;
      counts[owner - 1]++; padded++;
    }
  }
  return padded;
}

/**
 * Returns {width,height,rgba,palette,islandStats,stats,coverage}. rgba is opaque
 * RGBA8, row 0 at the top of the image (UV v=1), ready for ImageData/CanvasTexture.
 * Overlap: the first source triangle wins; shared edges are half-open [left,right)
 * and [bottom,top), matching analyzeUV's texel-centre rule. No UV wrapping.
 * islandStats.texels counts original exclusively assigned texels, never padding.
 * expectedTexels sums triangle area clipped to the 0–1 tile × resolution². It is
 * a geometric budget, NOT a union: overlapping triangles can double-count it.
 * zeroTexelIslands may be subpixel, clipped, or hidden by earlier overlap; it is
 * not by itself proof of undersized UVs. Palette reseeding never changes coverage.
 */
export function buildAtlasData(model, analysis, { resolution = 64, seed = 123, padding = 0 } = {}) {
  if (!Number.isInteger(resolution) || resolution < 1 || resolution > MAX_RESOLUTION) throw new Error('색상 아틀라스 해상도는 1–4,096 사이의 정수여야 합니다.');
  if (!Number.isInteger(padding) || padding < 0 || padding > 8) throw new Error('패딩은 0–8픽셀 사이의 정수여야 합니다.');
  if (!Number.isFinite(seed)) throw new Error('색상 시드는 유한한 숫자여야 합니다.');
  seed >>>= 0;
  const count = model?.uvValid?.length, uvs = model?.uvs, faceIsland = analysis?.faceIsland, islands = analysis?.islands;
  if (!Number.isInteger(count) || count > MAX_TRIANGLES || !uvs || uvs.length !== count * 6 ||
      !faceIsland || faceIsland.length !== count || !Array.isArray(islands)) throw new Error('색상 아틀라스의 모델·아일랜드 데이터가 맞지 않습니다. 삼각형 60,000개까지 지원합니다.');
  const palette = [], islandById = new Map();
  for (const island of islands) {
    if (!Number.isInteger(island.id) || island.id < 0 || island.id >= MAX_TRIANGLES || islandById.has(island.id)) throw new Error('아일랜드 번호가 잘못되었거나 중복되었습니다.');
    islandById.set(island.id, island);
    palette[island.id] = getIslandColor(island.id, seed);
  }
  const texels = new Uint32Array(palette.length), paddingTexels = new Uint32Array(palette.length);
  const expected = new Float64Array(palette.length), faces = [];
  const size = resolution, total = size * size, stride = size + 1;
  for (let face = 0; face < count; face++) {
    const id = faceIsland[face];
    if (!model.uvValid[face] || id === -1) continue;
    if (!islandById.has(id)) throw new Error('삼각형이 가리키는 아일랜드를 찾을 수 없습니다.');
    const t = face * 6, v = [[uvs[t], uvs[t + 1]], [uvs[t + 2], uvs[t + 3]], [uvs[t + 4], uvs[t + 5]]];
    if (!v.every(p => p.every(Number.isFinite))) continue;
    const area = clippedArea(v);
    if (!(area > 0)) continue;
    expected[id] += area * total;
    faces.push(face);
  }
  // The final RGBA buffer temporarily stores island IDs + 1. No extra owner map.
  const rgba = new Uint8ClampedArray(total * 4), owners = new Uint32Array(rgba.buffer);
  const next = faces.length ? new Int32Array(size * stride) : null;
  if (next) for (let i = 0; i < next.length; i++) next[i] = i;
  let covered = 0, scanRows = 0;
  for (const face of faces) {
    if (covered === total) break;
    const t = face * 6, id = faceIsland[face];
    const v = [[uvs[t], uvs[t + 1]], [uvs[t + 2], uvs[t + 3]], [uvs[t + 4], uvs[t + 5]]];
    const first = Math.max(0, Math.ceil(Math.min(v[0][1], v[1][1], v[2][1]) * size - .5));
    const end = Math.min(size, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1]) * size - .5));
    const edges = rasterEdges(v, size);
    for (let row = first; row < end; row++) {
      if (++scanRows > MAX_SCAN_ROWS) throw new Error('색상 아틀라스의 계산량 한도에 도달했습니다. 더 낮은 해상도를 선택하거나 모델을 나눠 주세요.');
      const imageRow = size - 1 - row, base = imageRow * stride;
      if (findFree(next, base) === base + size) continue;
      const [from, to] = rasterSpan(edges, row, size);
      if (from >= to) continue;
      let slot = findFree(next, base + from);
      while (slot < base + to) {
        owners[imageRow * size + slot - base] = id + 1;
        texels[id]++; covered++;
        const following = findFree(next, slot + 1);
        next[slot] = following; slot = following;
      }
    }
  }
  const padded = padding && covered && covered < total ? dilate(owners, next, size, padding, paddingTexels) : 0;
  const packedPalette = palette.map(packedColor), neutral = packedColor(BACKGROUND);
  for (let i = 0; i < total; i++) owners[i] = owners[i] ? packedPalette[owners[i] - 1] : neutral;
  const islandStats = islands.map(({ id }) => ({ id, texels: texels[id], expectedTexels: expected[id], paddedTexels: paddingTexels[id] }));
  return {
    width: size, height: size, rgba, palette, islandStats, coverage: covered / total,
    stats: { resolution: size, seed, padding, coveredTexels: covered, paddedTexels: padded,
      emptyTexels: total - covered, backgroundTexels: total - covered - padded,
      zeroTexelIslands: islandStats.filter(s => s.texels === 0).length,
      inTileZeroTexelIslands: islandStats.filter(s => s.texels === 0 && s.expectedTexels > 0).length,
      scanRows, scanRowLimit: MAX_SCAN_ROWS, background: BACKGROUND, overlapRule: 'first-triangle-wins' }
  };
}

/**
 * Pick the colour owner of the clicked texel, including nearest-source padding.
 * Linear-filter mode still picks the centre texel, not a blended colour's owner.
 * UV 0/1 edges select the first/last texel; outside the tile returns -1.
 * No full atlas/owner map is allocated: at most 2*padding+1 spans per face.
 */
export function pickAtlasIsland(model, analysis, { u, v, resolution = 64, padding = 0 } = {}) {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) return -1;
  if (!Number.isInteger(resolution) || resolution < 1 || resolution > MAX_RESOLUTION) throw new Error('색상 아틀라스 해상도는 1–4,096 사이의 정수여야 합니다.');
  if (!Number.isInteger(padding) || padding < 0 || padding > 8) throw new Error('패딩은 0–8픽셀 사이의 정수여야 합니다.');
  const count = model?.uvValid?.length, uvs = model?.uvs, faceIsland = analysis?.faceIsland;
  if (!Number.isInteger(count) || count > MAX_TRIANGLES || !uvs || uvs.length !== count * 6 ||
      !faceIsland || faceIsland.length !== count || !Array.isArray(analysis?.islands)) throw new Error('색상 아틀라스의 모델·아일랜드 데이터가 맞지 않습니다.');
  const islandIds = new Set(analysis.islands.map(island => island.id));
  const size = resolution, x = Math.min(size - 1, Math.floor(u * size));
  const imageRow = Math.min(size - 1, Math.floor((1 - v) * size)), uvRow = size - 1 - imageRow;
  let bestDistance = padding * padding + 1, bestPixel = Infinity, bestIsland = -1;
  for (let face = 0; face < count; face++) {
    const id = faceIsland[face];
    if (!model.uvValid[face] || id === -1) continue;
    if (!islandIds.has(id)) throw new Error('삼각형이 가리키는 아일랜드를 찾을 수 없습니다.');
    const t = face * 6, vertices = [[uvs[t], uvs[t + 1]], [uvs[t + 2], uvs[t + 3]], [uvs[t + 4], uvs[t + 5]]];
    if (!vertices.every(p => p.every(Number.isFinite))) continue;
    const first = Math.max(0, uvRow - padding, Math.ceil(Math.min(vertices[0][1], vertices[1][1], vertices[2][1]) * size - .5));
    const end = Math.min(size, uvRow + padding + 1, Math.ceil(Math.max(vertices[0][1], vertices[1][1], vertices[2][1]) * size - .5));
    if (first >= end) continue;
    const left = Math.max(0, Math.ceil(Math.min(vertices[0][0], vertices[1][0], vertices[2][0]) * size - .5));
    const right = Math.min(size, Math.ceil(Math.max(vertices[0][0], vertices[1][0], vertices[2][0]) * size - .5));
    if (left > x + padding || right <= x - padding || !(clippedArea(vertices) > 0)) continue;
    const edges = rasterEdges(vertices, size);
    for (let row = first; row < end; row++) {
      const dy = size - 1 - row - imageRow;
      if (dy * dy > bestDistance) continue;
      const [from, to] = rasterSpan(edges, row, size);
      if (from >= to) continue;
      const sourceX = Math.max(from, Math.min(to - 1, x));
      const distance = (sourceX - x) ** 2 + dy * dy;
      const pixel = (size - 1 - row) * size + sourceX;
      if (distance > padding * padding || distance > bestDistance || (distance === bestDistance && pixel >= bestPixel)) continue;
      bestDistance = distance; bestPixel = pixel; bestIsland = id;
      // First source face owns an originally covered texel, before any padding.
      if (distance === 0) return id;
    }
  }
  return bestIsland;
}

/** Synchronous convenience wrapper. Production large-atlas work belongs in a worker. */
export function createIslandAtlas(model, analysis, options) {
  const data = buildAtlasData(model, analysis, options);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(data.width, data.height) :
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) throw new Error('이 환경에는 Canvas가 없습니다. buildAtlasData를 사용해 주세요.');
  canvas.width = data.width; canvas.height = data.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('색상 아틀라스 Canvas를 만들지 못했습니다.');
  const image = context.createImageData(data.width, data.height);
  image.data.set(data.rgba); context.putImageData(image, 0, 0);
  const { rgba, ...summary } = data;
  return { canvas, ...summary };
}
