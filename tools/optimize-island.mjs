// Converts the Sketchfab "Viking Island - Minecraft" export (CC-BY-4.0,
// cubical.xyz) into small, browser-friendly GLB files.
//
// Usage: node tools/optimize-island.mjs <path-to-extracted-scene.gltf> <out-dir>
//
// Steps
//  1. Bake: every triangle gets one flat colour = average of the atlas texels
//     under its UVs (alpha-weighted) x its vertex colour. The texture itself is
//     not shipped, so the output contains no texture artwork.
//  2. Merge all ~4,000 meshes into a 4x4 grid of chunks (frustum-cullable).
//  3. Weld identical vertices, then simplify per chunk with meshoptimizer,
//     locking chunk borders so neighbouring chunks never crack.
//  4. Quantize + meshopt-compress (EXT_meshopt_compression).
// Two levels of detail are written: island-low.glb (fast first paint) and
// island-high.glb (loaded progressively).

import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { PNG } from 'pngjs';

const [, , srcPath, outDir = 'public/models'] = process.argv;
if (!srcPath) {
  console.error('Usage: node tools/optimize-island.mjs <scene.gltf> [out-dir]');
  process.exit(1);
}

const GRID = 4;
const LODS = [
  // error is relative to the model's extent (~577 blocks): 1e-4 ≈ 0.06 block.
  { name: 'island-high.glb', error: 0.0004 },
  // Low LOD: topology-ignoring "sloppy" simplification to a fixed budget,
  // used for first paint and on low-power devices.
  { name: 'island-low.glb', sloppyTriangles: 220000, single: true },
];

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// ---- 1. Load source and atlas ----
const io = new NodeIO().registerExtensions([KHRMaterialsSpecular]);
const src = await io.read(srcPath);
const material = src.getRoot().listMaterials()[0];
const texture = material.getBaseColorTexture();
const png = PNG.sync.read(Buffer.from(texture.getImage()));
const W = png.width;
const H = png.height;
log(`source read; atlas ${W}x${H}`);

// Summed-area tables (alpha-premultiplied linear RGB, alpha, plain RGB, count)
// so each triangle's average colour is O(1).
const S = (W + 1) * (H + 1);
const sat = { r: new Float64Array(S), g: new Float64Array(S), b: new Float64Array(S), a: new Float64Array(S), pr: new Float64Array(S), pg: new Float64Array(S), pb: new Float64Array(S) };
const toLinear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const LUT = Float64Array.from({ length: 256 }, (_, i) => toLinear(i));
const toSrgb = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
const PALETTE = (linear) => {
  const level = Math.round(Math.min(1, Math.max(0, toSrgb(linear))) * 31) / 31;
  return Math.round(toLinear(level * 255) * 255);
};
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const p = (y * W + x) * 4;
    const a = png.data[p + 3] / 255;
    const r = LUT[png.data[p]];
    const g = LUT[png.data[p + 1]];
    const b = LUT[png.data[p + 2]];
    const i = (y + 1) * (W + 1) + (x + 1);
    const up = i - (W + 1);
    for (const [k, v] of [['r', r * a], ['g', g * a], ['b', b * a], ['a', a], ['pr', r], ['pg', g], ['pb', b]]) {
      const t = sat[k];
      t[i] = v + t[i - 1] + t[up] - t[up - 1];
    }
  }
}
const rect = (t, x0, y0, x1, y1) => t[y1 * (W + 1) + x1] - t[y0 * (W + 1) + x1] - t[y1 * (W + 1) + x0] + t[y0 * (W + 1) + x0];

function texelAverage(u0, v0, u1, v1, out) {
  let x0 = Math.floor(Math.min(u0, u1) * W + 0.02);
  let x1 = Math.ceil(Math.max(u0, u1) * W - 0.02);
  let y0 = Math.floor(Math.min(v0, v1) * H + 0.02);
  let y1 = Math.ceil(Math.max(v0, v1) * H - 0.02);
  x0 = Math.min(Math.max(x0, 0), W - 1);
  y0 = Math.min(Math.max(y0, 0), H - 1);
  x1 = Math.min(Math.max(x1, x0 + 1), W);
  y1 = Math.min(Math.max(y1, y0 + 1), H);
  const area = (x1 - x0) * (y1 - y0);
  const alpha = rect(sat.a, x0, y0, x1, y1);
  if (alpha > 1e-6) {
    out[0] = rect(sat.r, x0, y0, x1, y1) / alpha;
    out[1] = rect(sat.g, x0, y0, x1, y1) / alpha;
    out[2] = rect(sat.b, x0, y0, x1, y1) / alpha;
  } else {
    out[0] = rect(sat.pr, x0, y0, x1, y1) / area;
    out[1] = rect(sat.pg, x0, y0, x1, y1) / area;
    out[2] = rect(sat.pb, x0, y0, x1, y1) / area;
  }
  return alpha / area; // coverage 0..1
}

// ---- 2. Bake every triangle into flat-coloured world-space triangles ----
const meshNodes = src.getRoot().listNodes().filter((n) => n.getMesh());
let triTotal = 0;
for (const node of meshNodes) {
  for (const prim of node.getMesh().listPrimitives()) {
    const idx = prim.getIndices();
    triTotal += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
  }
}
log(`${meshNodes.length} mesh nodes, ${triTotal} triangles`);

const triPos = new Float32Array(triTotal * 9);
const triCol = new Uint8Array(triTotal * 3);
const toByte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
let t = 0;
let dropped = 0;
let water = 0;
const waterYs = [];
let bbMin = [Infinity, Infinity, Infinity];
let bbMax = [-Infinity, -Infinity, -Infinity];
const c = [0, 0, 0];
for (const node of meshNodes) {
  const m = node.getWorldMatrix();
  for (const prim of node.getMesh().listPrimitives()) {
    const P = prim.getAttribute('POSITION').getArray();
    const UV = prim.getAttribute('TEXCOORD_0').getArray();
    const colAcc = prim.getAttribute('COLOR_0');
    const C = colAcc ? colAcc.getArray() : null;
    const cSize = colAcc ? colAcc.getElementSize() : 0;
    const cNorm = colAcc && colAcc.getNormalized() ? (colAcc.getComponentType() === 5121 ? 255 : 65535) : 1;
    const idxAcc = prim.getIndices();
    const I = idxAcc ? idxAcc.getArray() : null;
    const n = I ? I.length : P.length / 3;
    for (let k = 0; k < n; k += 3) {
      const a = I ? I[k] : k;
      const b = I ? I[k + 1] : k + 1;
      const d = I ? I[k + 2] : k + 2;
      const cover = texelAverage(
        Math.min(UV[a * 2], UV[b * 2], UV[d * 2]), Math.min(UV[a * 2 + 1], UV[b * 2 + 1], UV[d * 2 + 1]),
        Math.max(UV[a * 2], UV[b * 2], UV[d * 2]), Math.max(UV[a * 2 + 1], UV[b * 2 + 1], UV[d * 2 + 1]), c);
      if (cover < 0.04) { dropped += 1; continue; } // fully transparent texels: invisible in the original
      let vr = 1, vg = 1, vb = 1;
      if (C) {
        vr = (C[a * cSize] + C[b * cSize] + C[d * cSize]) / 3 / cNorm;
        vg = (C[a * cSize + 1] + C[b * cSize + 1] + C[d * cSize + 1]) / 3 / cNorm;
        vb = (C[a * cSize + 2] + C[b * cSize + 2] + C[d * cSize + 2]) / 3 / cNorm;
      }
      // The export tints water blocks blue via vertex colour. Water and the
      // seabed are replaced by CurioTrail's own animated water, so drop them.
      const isWater = vr < 0.2 && vb > 0.8;
      if (isWater) {
        const y = (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3;
        waterYs.push(y);
        water += 1;
        continue;
      }
      // Snap to a 32-level-per-channel palette in sRGB space (perceptually
      // even), stored as linear bytes. Merges visually identical faces.
      triCol[t * 3] = PALETTE(c[0] * vr);
      triCol[t * 3 + 1] = PALETTE(c[1] * vg);
      triCol[t * 3 + 2] = PALETTE(c[2] * vb);
      for (let v = 0; v < 3; v += 1) {
        const vi = [a, b, d][v];
        const x = P[vi * 3], y = P[vi * 3 + 1], z = P[vi * 3 + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        // Snap to 1/64 block to remove float noise so welding works.
        const o = t * 9 + v * 3;
        triPos[o] = Math.round(wx * 64) / 64;
        triPos[o + 1] = Math.round(wy * 64) / 64;
        triPos[o + 2] = Math.round(wz * 64) / 64;
        for (let ax = 0; ax < 3; ax += 1) {
          bbMin[ax] = Math.min(bbMin[ax], triPos[o + ax]);
          bbMax[ax] = Math.max(bbMax[ax], triPos[o + ax]);
        }
      }
      t += 1;
    }
  }
}
// Sea level = most common water-surface height. Remove everything that sits
// fully below it (seabed and the slab's side walls); keep the shoreline.
const counts = new Map();
for (const y of waterYs) counts.set(Math.round(y), (counts.get(Math.round(y)) || 0) + 1);
const seaLevel = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
let kept = 0;
bbMin = [Infinity, Infinity, Infinity];
bbMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < t; i += 1) {
  const top = Math.max(triPos[i * 9 + 1], triPos[i * 9 + 4], triPos[i * 9 + 7]);
  if (top < seaLevel - 1.01) continue;
  if (kept !== i) {
    triPos.copyWithin(kept * 9, i * 9, i * 9 + 9);
    triCol.copyWithin(kept * 3, i * 3, i * 3 + 3);
  }
  for (let v = 0; v < 3; v += 1) for (let ax = 0; ax < 3; ax += 1) {
    bbMin[ax] = Math.min(bbMin[ax], triPos[kept * 9 + v * 3 + ax]);
    bbMax[ax] = Math.max(bbMax[ax], triPos[kept * 9 + v * 3 + ax]);
  }
  kept += 1;
}
const submerged = t - kept;
const triCount = kept;
log(`baked ${triCount} triangles (dropped ${dropped} transparent, ${water} water, ${submerged} submerged); sea level y=${seaLevel}; bbox ${bbMin} .. ${bbMax}`);

// ---- 3. Chunk, weld, simplify ----
const sizeX = (bbMax[0] - bbMin[0]) / GRID;
const sizeZ = (bbMax[2] - bbMin[2]) / GRID;
const chunkOf = new Uint8Array(triCount);
const chunkCounts = new Uint32Array(GRID * GRID);
for (let i = 0; i < triCount; i += 1) {
  const cx = (triPos[i * 9] + triPos[i * 9 + 3] + triPos[i * 9 + 6]) / 3;
  const cz = (triPos[i * 9 + 2] + triPos[i * 9 + 5] + triPos[i * 9 + 8]) / 3;
  const gx = Math.min(GRID - 1, Math.floor((cx - bbMin[0]) / sizeX));
  const gz = Math.min(GRID - 1, Math.floor((cz - bbMin[2]) / sizeZ));
  chunkOf[i] = gz * GRID + gx;
  chunkCounts[chunkOf[i]] += 1;
}

function weldChunk(ci) {
  const map = new Map();
  const pos = [];
  const col = [];
  const indices = new Uint32Array(chunkCounts[ci] * 3);
  let w = 0;
  for (let i = 0; i < triCount; i += 1) {
    if (chunkOf[i] !== ci) continue;
    const r = triCol[i * 3], g = triCol[i * 3 + 1], b = triCol[i * 3 + 2];
    for (let v = 0; v < 3; v += 1) {
      const o = i * 9 + v * 3;
      const key = `${triPos[o]},${triPos[o + 1]},${triPos[o + 2]},${r},${g},${b}`;
      let id = map.get(key);
      if (id === undefined) {
        id = pos.length / 3;
        map.set(key, id);
        pos.push(triPos[o], triPos[o + 1], triPos[o + 2]);
        col.push(r, g, b, 255);
      }
      indices[w++] = id;
    }
  }
  return { positions: new Float32Array(pos), colors: new Uint8Array(col), indices };
}

const welded = [];
for (let ci = 0; ci < GRID * GRID; ci += 1) {
  if (!chunkCounts[ci]) continue;
  welded.push({ ci, ...weldChunk(ci) });
}
log(`welded ${welded.length} chunks, ${welded.reduce((s, c) => s + c.positions.length / 3, 0)} vertices`);

function mergeChunks(list) {
  let vCount = 0;
  let iCount = 0;
  for (const c of list) { vCount += c.positions.length / 3; iCount += c.indices.length; }
  const positions = new Float32Array(vCount * 3);
  const colors = new Uint8Array(vCount * 4);
  const indices = new Uint32Array(iCount);
  let vo = 0;
  let io2 = 0;
  for (const c of list) {
    positions.set(c.positions, vo * 3);
    colors.set(c.colors, vo * 4);
    for (let i = 0; i < c.indices.length; i += 1) indices[io2++] = c.indices[i] + vo;
    vo += c.positions.length / 3;
  }
  return { positions, colors, indices };
}

// Centre the island on the origin with sea level at y = 0.
const offset = [-(bbMin[0] + bbMax[0]) / 2, -seaLevel, -(bbMin[2] + bbMax[2]) / 2];

mkdirSync(outDir, { recursive: true });
const report = [];
for (const lod of LODS) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mat = doc.createMaterial('island').setRoughnessFactor(1).setMetallicFactor(0);
  const scene = doc.createScene('island');
  let tris = 0;
  // The low LOD is one mesh: sloppy simplification can't lock chunk borders.
  const chunks = lod.single ? [{ ci: 'all', ...mergeChunks(welded) }] : welded;
  for (const chunk of chunks) {
    let simplified;
    if (lod.sloppyTriangles) {
      const share = chunk.indices.length / (triCount * 3);
      const target = Math.max(3, Math.floor(lod.sloppyTriangles * share) * 3);
      [simplified] = MeshoptSimplifier.simplifySloppy(chunk.indices, chunk.positions, 3, null, target, 1);
    } else {
      [simplified] = MeshoptSimplifier.simplify(chunk.indices, chunk.positions, 3, 0, lod.error, ['LockBorder']);
    }
    // Compact vertex buffer to used vertices only.
    const remap = new Int32Array(chunk.positions.length / 3).fill(-1);
    const pos = [];
    const col = [];
    const idx = new Uint32Array(simplified.length);
    for (let i = 0; i < simplified.length; i += 1) {
      const v = simplified[i];
      if (remap[v] < 0) {
        remap[v] = pos.length / 3;
        pos.push(chunk.positions[v * 3] + offset[0], chunk.positions[v * 3 + 1] + offset[1], chunk.positions[v * 3 + 2] + offset[2]);
        col.push(chunk.colors[v * 4], chunk.colors[v * 4 + 1], chunk.colors[v * 4 + 2], 255);
      }
      idx[i] = remap[v];
    }
    tris += idx.length / 3;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(col)).setNormalized(true).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
      .setMaterial(mat);
    const mesh = doc.createMesh(`chunk-${chunk.ci}`).addPrimitive(prim);
    scene.addChild(doc.createNode(`chunk-${chunk.ci}`).setMesh(mesh));
  }
  doc.getRoot().setDefaultScene(scene);
  doc.getRoot().getAsset().extras = {
    title: 'Viking Island - Minecraft (optimised for CurioTrail)',
    author: 'cubical.xyz (https://sketchfab.com/cubical)',
    source: 'https://sketchfab.com/3d-models/viking-island-minecraft-fd76e3824b7647d98be20d3e2160e018',
    license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
    modifications: 'Merged, baked to flat per-face colours (texture removed), simplified, quantized and meshopt-compressed.',
  };
  await doc.transform(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ quantizePosition: 14, quantizeColor: 8 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const outIo = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const out = join(outDir, lod.name);
  await outIo.write(out, doc);
  const bytes = statSync(out).size;
  report.push({ file: lod.name, triangles: tris, megabytes: +(bytes / 1048576).toFixed(2) });
  log(`wrote ${out}: ${tris} triangles, ${(bytes / 1048576).toFixed(2)} MB`);
}

const srcBin = join(dirname(resolve(srcPath)), 'scene.bin');
console.log(JSON.stringify({
  source: { triangles: triTotal, meshes: meshNodes.length, megabytes: +((statSync(srcBin).size + statSync(srcPath).size) / 1048576).toFixed(1) },
  dimensions: { x: bbMax[0] - bbMin[0], y: bbMax[1] - bbMin[1], z: bbMax[2] - bbMin[2] },
  seaLevel,
  removed: { transparent: dropped, water, submerged },
  output: report,
}, null, 2));
