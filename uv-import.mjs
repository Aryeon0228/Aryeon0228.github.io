import { Matrix3, ShapeUtils, Vector2, Vector3 } from './vendor/three/build/three.module.js';
import { FBXLoader } from './vendor/three/examples/jsm/loaders/FBXLoader.js?v=d42d659f639a';

// Local inspection only. No materials, textures, or companion files are fetched.
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TRIANGLES = 60000;
const MAX_FACE_CORNERS = 4096;
const MAX_SOURCE_VERTICES = 1000000;
const FLOAT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const INTEGER = /^[+-]?\d+$/;
const float = value => typeof value === 'string' && FLOAT.test(value) ? Number(value) : NaN;
const finite32 = value => Number.isFinite(value) && Number.isFinite(Math.fround(value));
const validVector = (value, size) => value && value.length >= size && value.slice(0, size).every(finite32);

function collector(name) {
  const positions = [], uvs = [], normals = [], vertexIds = [], uvValid = [], materialIds = [];
  const materialNames = [], materials = new Map(), warnings = new Set();
  let missingUV = 0, invalidFaces = 0;
  const material = (key, label = key) => {
    if (!materials.has(key)) {
      materials.set(key, materialNames.length);
      materialNames.push(label || '기본 재질');
    }
    return materials.get(key);
  };
  return {
    warnings,
    material,
    get triangleCount() { return uvValid.length; },
    invalidFace() { invalidFaces++; },
    add(points, texcoords, ids, faceNormals, materialId) {
      if (uvValid.length >= MAX_TRIANGLES) throw new Error('삼각형 60,000개 이하의 모델을 사용해 주세요.');
      if (!points.every(p => validVector(p, 3))) { invalidFaces++; return; }
      const hasUV = texcoords.every(uv => validVector(uv, 2));
      // Missing coordinates use inert storage, never a valid UV at the origin.
      uvValid.push(hasUV ? 1 : 0);
      if (!hasUV) missingUV++;
      const a = new Vector3().fromArray(points[0]);
      const ab = new Vector3().fromArray(points[1]).sub(a);
      const ac = new Vector3().fromArray(points[2]).sub(a);
      const flat = ab.cross(ac).normalize();
      if (!flat.lengthSq()) flat.set(0, 1, 0);
      for (let i = 0; i < 3; i++) {
        positions.push(...points[i]);
        uvs.push(...(hasUV ? texcoords[i] : [0, 0]));
        vertexIds.push(ids[i]);
        const n = validVector(faceNormals[i], 3) ? new Vector3().fromArray(faceNormals[i]).normalize() : flat;
        normals.push(...(n.lengthSq() ? n.toArray() : flat.toArray()));
      }
      materialIds.push(materialId);
    },
    finish() {
      if (!uvValid.length) throw new Error('검사할 삼각형이 없습니다. 폴리곤 메시가 포함된 OBJ 또는 FBX를 사용해 주세요.');
      if (missingUV) warnings.add(`UV가 없거나 잘못된 삼각형 ${missingUV.toLocaleString('en-US')}개는 UV 계산에서 제외합니다.`);
      if (invalidFaces) warnings.add(`좌표나 정점 참조가 잘못되었거나 분할할 수 없는 면 ${invalidFaces.toLocaleString('en-US')}개를 건너뛰었습니다.`);
      return {
        name, positions: new Float32Array(positions), uvs: new Float32Array(uvs),
        normals: new Float32Array(normals), vertexIds: new Uint32Array(vertexIds),
        uvValid: new Uint8Array(uvValid), materialIds: new Uint32Array(materialIds),
        materialNames, warnings: [...warnings]
      };
    }
  };
}

function objIndex(token, length) {
  if (!token || !INTEGER.test(token)) return -1;
  const value = Number(token);
  if (!Number.isSafeInteger(value) || value === 0) return -1;
  const index = value < 0 ? length + value : value - 1;
  return index >= 0 && index < length ? index : -1;
}

// Project onto the dominant Newell-normal plane; earcut handles concave n-gons.
// Original corners remain intact, including the v/vt/vn identity at each seam.
function triangulateOBJ(corners, vertices) {
  if (corners.length === 3) return [[0, 1, 2]];
  const normal = [0, 0, 0];
  for (let i = 0; i < corners.length; i++) {
    const a = vertices[corners[i].v], b = vertices[corners[(i + 1) % corners.length].v];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
    normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
    normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const drop = Math.abs(normal[0]) > Math.abs(normal[1]) ? 0 : 1;
  const axis = Math.abs(normal[drop]) > Math.abs(normal[2]) ? drop : 2;
  if (!normal[axis]) return [];
  const dims = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
  const projected = corners.map(c => new Vector2(vertices[c.v][dims[0]], vertices[c.v][dims[1]]));
  // Earcut can omit redundant collinear corners; preserve the winding of the source.
  const triangles = ShapeUtils.triangulateShape(projected, []);
  const sign = Math.sign(ShapeUtils.area(projected));
  for (const tri of triangles) {
    const [a, b, c] = tri.map(i => projected[i]);
    if (Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) !== sign) {
      [tri[1], tri[2]] = [tri[2], tri[1]];
    }
  }
  return triangles;
}

function parseOBJ(text, name) {
  const out = collector(name), vertices = [], texcoords = [], normals = [];
  // OBJ v indices are global; object instances get distinct topology IDs. A g,
  // usemtl, s, or vn change alone does not split the geometric mesh.
  let objectIds = new Map(), nextVertexId = 0, materialId = out.material('');
  let nonPolygon = false;
  const lines = text.replace(/^\uFEFF/, '').replace(/\\\r?\n/g, ' ').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.split('#', 1)[0].trim();
    if (!line) continue;
    const match = /^(\S+)(?:\s+(.*))?$/.exec(line);
    const [, type, rest = ''] = match;
    if (type === 'o') { objectIds = new Map(); continue; }
    if (type === 'usemtl') { materialId = out.material(rest); continue; }
    if (type === 'mtllib') {
      out.warnings.add('OBJ 재질 이름만 읽습니다. MTL·텍스처 파일은 불러오지 않습니다.');
      continue;
    }
    if (!['v', 'vt', 'vn', 'f'].includes(type)) {
      if (['l', 'p', 'curv', 'curv2', 'surf'].includes(type)) nonPolygon = true;
      continue;
    }
    const fields = rest.trim().split(/\s+/);
    if (type === 'v' || type === 'vt' || type === 'vn') {
      const target = type === 'v' ? vertices : type === 'vt' ? texcoords : normals;
      if (target.length >= MAX_SOURCE_VERTICES) throw new Error('원본 정점 또는 UV 수가 너무 많습니다. 1,000,000개 이하로 줄여 주세요.');
      const values = fields.map(float);
      if (type === 'vt') {
        // Wavefront allows a single texture coordinate; the second defaults to 0.
        target.push([values[0], fields.length === 1 ? 0 : values[1]]);
      } else {
        let xyz = values.slice(0, 3);
        if (type === 'v' && fields.length === 4) xyz = xyz.map(v => v / values[3]);
        target.push(validVector(xyz, 3) ? xyz : null);
      }
      continue;
    }
    if (fields.length > MAX_FACE_CORNERS) throw new Error('한 면의 꼭짓점은 4,096개 이하여야 합니다. 내보내기 전에 삼각형으로 분할해 주세요.');
    const corners = fields.map(field => {
      const [v, vt, vn] = field.split('/');
      return { v: objIndex(v, vertices.length), vt: objIndex(vt, texcoords.length), vn: objIndex(vn, normals.length) };
    });
    // A closing duplicate corner is common; remove only an identical corner.
    const first = corners[0], last = corners[corners.length - 1];
    if (corners.length > 3 && first.v === last.v && first.vt === last.vt && first.vn === last.vn) corners.pop();
    if (corners.length < 3 || corners.some(c => c.v < 0 || !vertices[c.v])) { out.invalidFace(); continue; }
    const triangles = triangulateOBJ(corners, vertices);
    if (!triangles.length) { out.invalidFace(); continue; }
    for (const tri of triangles) {
      const face = tri.map(i => corners[i]);
      const ids = face.map(c => {
        if (!objectIds.has(c.v)) objectIds.set(c.v, nextVertexId++);
        return objectIds.get(c.v);
      });
      out.add(face.map(c => vertices[c.v]), face.map(c => texcoords[c.vt]), ids,
        face.map(c => normals[c.vn]), materialId);
    }
  }
  if (nonPolygon) out.warnings.add('선·점·곡선·NURBS 표면은 제외하고 폴리곤 메시만 검사합니다.');
  return out.finish();
}

function disposeFBX(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!mat) continue;
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const value of [...textures, ...materials, ...geometries]) value.dispose();
}

function parseFBX(buffer, name) {
  const loader = new FBXLoader();
  loader.uvLabSkipTextures = true;
  loader.uvLabMaxTriangles = MAX_TRIANGLES;
  loader.uvLabMaxFaceVertices = MAX_FACE_CORNERS;
  loader.uvLabMaxArrayBytes = 80 * 1024 * 1024;
  let scene;
  const out = collector(name);
  let nextVertexId = 0;
  const p = new Vector3(), n = new Vector3(), normalMatrix = new Matrix3();
  try {
    scene = loader.parse(buffer, '');
    scene.updateMatrixWorld(true);
    out.warnings.add('FBX의 첫 번째 UV 세트와 정적 메시를 검사합니다. 재질·텍스처의 UV 변환 및 애니메이션은 적용하지 않습니다.');
    if (scene.animations?.length) out.warnings.add('FBX 애니메이션은 재생하지 않고 파일의 기본 자세를 검사합니다.');
    scene.traverse(object => {
      if (!object.isMesh) {
        if (object.isLine || object.isPoints) out.warnings.add('FBX 선·점·곡선은 제외하고 폴리곤 메시만 검사합니다.');
        return;
      }
      if (object.isSkinnedMesh) out.warnings.add('스킨 메시에는 뼈 변형을 적용하지 않습니다. 원본 바인드/기본 형상의 정적 검사이며 현재 애니메이션 자세와 다를 수 있습니다.');
      if (object.geometry.morphAttributes.position?.length) out.warnings.add('모프 변형은 적용하지 않고 기본 형상을 검사합니다.');
      const geo = object.geometry, pos = geo.getAttribute('position'), uv = geo.getAttribute('uv');
      const originalIds = geo.getAttribute('uvLabVertexId'), normal = geo.getAttribute('normal');
      if (!pos) return;
      if (!originalIds || originalIds.count !== pos.count) throw new Error('FBX 원본 정점 연결 정보를 읽지 못했습니다. OBJ로 다시 내보내 주세요.');
      const count = geo.index ? geo.index.count : pos.count;
      if (count % 3) throw new Error('FBX 삼각형 데이터가 완전하지 않습니다.');
      if (out.triangleCount + count / 3 > MAX_TRIANGLES) throw new Error('삼각형 60,000개 이하의 모델을 사용해 주세요.');
      normalMatrix.getNormalMatrix(object.matrixWorld);
      // Baking a reflected transform removes Three's per-object front-face flip.
      const mirrored = (object.matrixWorld.determinant() < 0) !== !!geo.userData.uvLabGeometricMirrored;
      const cornerOrder = mirrored ? [0, 2, 1] : [0, 1, 2];
      const ids = new Map();
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materialMap = objectMaterials.map(mat => out.material(mat?.uuid || 'default', mat?.name || '기본 재질'));
      let groupIndex = 0;
      for (let offset = 0; offset < count; offset += 3) {
        while (groupIndex < geo.groups.length && offset >= geo.groups[groupIndex].start + geo.groups[groupIndex].count) groupIndex++;
        const group = geo.groups[groupIndex];
        const materialIndex = group && offset >= group.start ? group.materialIndex : 0;
        const materialId = materialMap[materialIndex] ?? out.material('default', '기본 재질');
        const points = [], texcoords = [], faceNormals = [], vertexIds = [];
        for (let corner = 0; corner < 3; corner++) {
          const sourceCorner = offset + cornerOrder[corner];
          const index = geo.index ? geo.index.getX(sourceCorner) : sourceCorner;
          p.fromBufferAttribute(pos, index).applyMatrix4(object.matrixWorld);
          points.push(p.toArray());
          texcoords.push(uv && index < uv.count ? [uv.getX(index), uv.getY(index)] : null);
          if (normal && index < normal.count) {
            n.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
            faceNormals.push(n.toArray());
          } else faceNormals.push(null);
          const originalId = originalIds.getX(index);
          if (!ids.has(originalId)) ids.set(originalId, nextVertexId++);
          vertexIds.push(ids.get(originalId));
        }
        out.add(points, texcoords, vertexIds, faceNormals, materialId);
      }
    });
    return out.finish();
  } finally {
    if (scene) disposeFBX(scene);
  }
}

/**
 * Read a browser File/Blob with a .name; all data remains local. Positions and
 * optional source normals are baked to world space; UVs are unwrapped raw data
 * (no wrapping/clamping). vertexIds encode topology, never a position weld.
 * uvValid=0 excludes missing/broken UVs; storage zeros must not be counted as UVs.
 * OBJ supports polygon faces, independent/negative v/vt/vn indices and concave
 * n-gons. FBX uses the bundled r160 loader (ASCII 7.x / binary 6.4+), UV set 0,
 * static undeformed control points. Absolute physical units are not inferred.
 */
export async function importUVFile(file) {
  if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') throw new Error('OBJ 또는 FBX 파일을 선택해 주세요.');
  const extension = file.name.toLowerCase().split('.').pop();
  if (!['obj', 'fbx'].includes(extension)) throw new Error('OBJ와 FBX 파일을 지원합니다.');
  if (file.size > MAX_FILE_BYTES) throw new Error('20 MiB 이하의 파일을 사용해 주세요.');
  const buffer = await file.arrayBuffer();
  if (!buffer.byteLength) throw new Error('파일이 비어 있습니다.');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('20 MiB 이하의 파일을 사용해 주세요.');
  try {
    return extension === 'obj' ? parseOBJ(new TextDecoder().decode(buffer), file.name) : parseFBX(buffer, file.name);
  } catch (error) {
    if (error instanceof Error && /[가-힣]/.test(error.message)) throw error;
    throw new Error(`${extension.toUpperCase()} 파일을 읽지 못했습니다. 폴리곤 메시와 UV를 포함해 다시 내보내 주세요. (${error instanceof Error ? error.message : '잘못된 파일'})`);
  }
}
