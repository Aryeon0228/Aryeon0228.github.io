import {BoxGeometry, BufferGeometry, Float32BufferAttribute} from './vendor/three/build/three.module.js';

const SEGMENTS = 5;

/**
 * Axis-aligned rounded box, centred on the origin with the supplied half bounds.
 * Six planar faces, twelve quarter cylinders and eight spherical corner patches
 * share vertices and analytic normals. Broad planes retain exact axis normals;
 * averaging triangle normals would bend those planes and is intentionally avoided.
 * Current weathering materials use world-space coordinates, so no UVs are needed.
 */
export function createWeatheringBox(half, radius = .065) {
  if (half?.length !== 3 || !Array.from(half).every(v => Number.isFinite(v) && v > 0)) {
    throw new RangeError('Half bounds must contain three positive finite numbers.');
  }
  if (!Number.isFinite(radius) || radius < 0 || radius >= Math.min(...half)) {
    throw new RangeError('Radius must be non-negative and smaller than every half bound.');
  }
  if (radius === 0) {
    const box = new BoxGeometry(...Array.from(half, v => 2 * v));
    box.computeBoundingBox(); box.computeBoundingSphere();
    return box;
  }

  const inner = Array.from(half, v => v - radius);
  const positions = [], normals = [], indices = [], vertices = new Map();
  function vertex(position, normal) {
    // Weld the primitive seams at the same precision as BufferAttribute storage.
    const p = position.map(Math.fround), key = p.join(',');
    if (vertices.has(key)) return vertices.get(key);
    const index = positions.length / 3, length = Math.hypot(...normal);
    positions.push(...p);
    normals.push(...normal.map(v => Math.abs(v) < 1e-12 ? 0 : v / length));
    vertices.set(key, index);
    return index;
  }
  function triangle(a, b, c) {
    const u = [], v = [], n = [];
    for (let axis = 0; axis < 3; axis++) {
      u[axis] = positions[b * 3 + axis] - positions[a * 3 + axis];
      v[axis] = positions[c * 3 + axis] - positions[a * 3 + axis];
      n[axis] = normals[a * 3 + axis] + normals[b * 3 + axis] + normals[c * 3 + axis];
    }
    const outward = (u[1] * v[2] - u[2] * v[1]) * n[0]
      + (u[2] * v[0] - u[0] * v[2]) * n[1]
      + (u[0] * v[1] - u[1] * v[0]) * n[2];
    indices.push(a, outward > 0 ? b : c, outward > 0 ? c : b);
  }

  // Each broad plane has just two triangles and four identical axis normals.
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    for (const sign of [-1, 1]) {
      const normal = [0, 0, 0]; normal[axis] = sign;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => {
        const p = [0, 0, 0];
        p[axis] = sign * half[axis]; p[u] = su * inner[u]; p[v] = sv * inner[v];
        return vertex(p, normal);
      });
      triangle(corners[0], corners[1], corners[2]);
      triangle(corners[0], corners[2], corners[3]);
    }
  }

  // The edge normals are the radial directions from the inner cuboid.
  for (let along = 0; along < 3; along++) {
    const u = (along + 1) % 3, v = (along + 2) % 3;
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const strip = [];
      for (let step = 0; step <= SEGMENTS; step++) {
        const angle = step * Math.PI / (2 * SEGMENTS);
        const normal = [0, 0, 0];
        normal[u] = su * Math.cos(angle); normal[v] = sv * Math.sin(angle);
        for (const end of [-1, 1]) {
          const p = [0, 0, 0]; p[along] = end * inner[along];
          p[u] = su * inner[u] + radius * normal[u];
          p[v] = sv * inner[v] + radius * normal[v];
          strip.push(vertex(p, normal));
        }
      }
      for (let step = 0; step < SEGMENTS; step++) {
        const at = 2 * step;
        triangle(strip[at], strip[at + 1], strip[at + 2]);
        triangle(strip[at + 1], strip[at + 3], strip[at + 2]);
      }
    }
  }

  // Sine-weighted barycentric samples match the edge strips' 18-degree steps.
  // Plain normalized barycentric coordinates would leave mismatched boundaries.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const signs = [sx, sy, sz], patch = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      patch[i] = [];
      for (let j = 0; j <= SEGMENTS - i; j++) {
        const direction = [i, j, SEGMENTS - i - j].map(v => Math.sin(v * Math.PI / (2 * SEGMENTS)));
        const length = Math.hypot(...direction);
        const normal = direction.map((v, axis) => signs[axis] * v / length);
        const p = normal.map((v, axis) => signs[axis] * inner[axis] + radius * v);
        patch[i][j] = vertex(p, normal);
      }
    }
    for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < SEGMENTS - i; j++) {
      triangle(patch[i][j], patch[i + 1][j], patch[i][j + 1]);
      if (i + j < SEGMENTS - 1) triangle(patch[i + 1][j], patch[i + 1][j + 1], patch[i][j + 1]);
    }
  }

  const geometry = new BufferGeometry();
  geometry.type = 'WeatheringBoxGeometry';
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
