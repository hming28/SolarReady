"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { 
  Sun, 
  Compass, 
  Maximize2, 
  Eye, 
  Clock, 
  Layers, 
  RotateCcw,
  Sparkles,
  Zap,
  Home,
  CheckCircle2,
  Play,
  Pause,
  FastForward,
  Camera,
  AlertTriangle,
  Info,
} from "lucide-react";
import { RoofGeometry, LayoutResponse } from "@/lib/types";

interface Roof3DViewerProps {
  geometry: RoofGeometry;
  layout: LayoutResponse;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  onSwitchTo2D?: () => void;
}

// ---------------------------------------------------------------------------
// Scene Style Presets (house render, ground, sky and roof tints)
// Design intent: the PV modules are near-black blue, so everything around the
// roof stays mid-tone and quiet and the array is the one dark, focal object.
// ---------------------------------------------------------------------------
type ScenePresetKey = "warm" | "modern" | "engineering";

interface ScenePreset {
  label: string;
  defaultRoof: "charcoal" | "terracotta";
  background: number; // sky / horizon haze (fog uses the same colour)
  fogDensity: number;
  exposure: number;
  hemiSky: number;
  hemiGround: number;
  lawn: number;
  pad: number | null; // paved yard slab around the house (null = none)
  grid: boolean;
  lowerWall: number;
  upperWall: number;
  band: number;
  plinth: number;
  gable: number;
  porchRoof: number;
  pillar: number;
  windowFrame: number;
  driveBase: string;
  driveJoint: string;
  roofTints: { charcoal: number; terracotta: number };
  trim: number; // fascia, gutters, sills, lintels, quoins, fence caps
  door: number; // entrance door and window shutters
  carColor: number | null; // parked car (null = no car)
  props: boolean; // trees, bushes, pots, flower boxes, boundary wall
  leaf: number;
  leafAlt: number;
  flower: number;
}

const SCENE_PRESETS: Record<ScenePresetKey, ScenePreset> = {
  // Cream render, terracotta tile, sand pavers, olive garden: classic Malaysian terrace
  warm: {
    label: "Warm",
    defaultRoof: "terracotta",
    background: 0xdde5ec,
    fogDensity: 0.011,
    exposure: 0.9,
    hemiSky: 0xf1f6ff,
    hemiGround: 0xb8ad9a,
    lawn: 0x7f9467,
    pad: 0xcfc5b3,
    grid: false,
    lowerWall: 0xf0e6d4,
    upperWall: 0xf6eee0,
    band: 0x7b5e49,
    plinth: 0x9c8e7d,
    gable: 0xf6eee0,
    porchRoof: 0x4a3a31,
    pillar: 0x5b4a40,
    windowFrame: 0x2a2622,
    driveBase: "#b3a794",
    driveJoint: "#8f8472",
    roofTints: { charcoal: 0x5a6372, terracotta: 0xc0613a },
    trim: 0xfaf6ee,
    door: 0x7a4a2e,
    carColor: 0x5b9a98,
    props: true,
    leaf: 0x5f8f4e,
    leafAlt: 0x86b05c,
    flower: 0xf27d9b,
  },
  // Cool white render, charcoal trim, slate tile, concrete pavers, sage garden
  modern: {
    label: "Modern",
    defaultRoof: "charcoal",
    background: 0xe4e8ed,
    fogDensity: 0.011,
    exposure: 0.9,
    hemiSky: 0xf3f7ff,
    hemiGround: 0xaeb4bc,
    lawn: 0x8e9c82,
    pad: 0xc7ccd2,
    grid: false,
    lowerWall: 0xf3f4f5,
    upperWall: 0xe6e9ec,
    band: 0x2d3641,
    plinth: 0x59636f,
    gable: 0xe6e9ec,
    porchRoof: 0x1f2630,
    pillar: 0x2d3641,
    windowFrame: 0x111827,
    driveBase: "#aab0b8",
    driveJoint: "#848b95",
    roofTints: { charcoal: 0x6b7686, terracotta: 0xb5583a },
    trim: 0x39424e,
    door: 0xb98355,
    carColor: 0xe9edf1,
    props: true,
    leaf: 0x4f8a5b,
    leafAlt: 0x7cb58a,
    flower: 0xf4c542,
  },
  // Neutral grey clay model on a dark studio floor (for installers / site review)
  engineering: {
    label: "Engineering",
    defaultRoof: "charcoal",
    background: 0x0a0f1d,
    fogDensity: 0.010,
    exposure: 1.0,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x1e293b,
    lawn: 0x0f172a,
    pad: null,
    grid: true,
    lowerWall: 0xd3d8de,
    upperWall: 0xc6ccd3,
    band: 0x8f99a5,
    plinth: 0x6f7a87,
    gable: 0xc6ccd3,
    porchRoof: 0x7b8591,
    pillar: 0x6f7a87,
    windowFrame: 0x334155,
    driveBase: "#3a4656",
    driveJoint: "#222c3a",
    roofTints: { charcoal: 0x8b95a5, terracotta: 0xa8603f },
    trim: 0xaab3bd,
    door: 0x6f7a87,
    carColor: null,
    props: false,
    leaf: 0x6f7a87,
    leafAlt: 0x8b95a5,
    flower: 0xaab3bd,
  },
};

// ---------------------------------------------------------------------------
// Procedural Canvas Texture Generators (High-Resolution, Zero Network Load)
// ---------------------------------------------------------------------------

/** Monocrystalline Silicon Solar Cell Wafer Texture with Silver Busbars */
function createPVCellTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  // Dark obsidian/navy monocrystalline base
  ctx.fillStyle = "#050c16";
  ctx.fillRect(0, 0, 512, 1024);

  const cols = 6;
  const rows = 10;
  const pad = 4;
  const cellW = (512 - (cols + 1) * pad) / cols;
  const cellH = (1024 - (rows + 1) * pad) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cellW + pad);
      const y = pad + r * (cellH + pad);

      // Deep blue/black silicon wafer gradient
      const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      grad.addColorStop(0, "#14325c");
      grad.addColorStop(0.5, "#0c2142");
      grad.addColorStop(1, "#08172e");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cellW, cellH);

      // Monocrystalline chamfered / beveled cell corners
      ctx.fillStyle = "#050c16";
      const cut = 5;
      // top-left
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cut, y); ctx.lineTo(x, y + cut); ctx.fill();
      // top-right
      ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW - cut, y); ctx.lineTo(x + cellW, y + cut); ctx.fill();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + cut, y + cellH); ctx.lineTo(x, y + cellH - cut); ctx.fill();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(x + cellW, y + cellH); ctx.lineTo(x + cellW - cut, y + cellH); ctx.lineTo(x + cellW, y - cut); ctx.fill();

      // Silver Busbar Lines (3 main vertical conductors per cell)
      ctx.strokeStyle = "rgba(203, 213, 225, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + cellW * 0.25, y); ctx.lineTo(x + cellW * 0.25, y + cellH);
      ctx.moveTo(x + cellW * 0.50, y); ctx.lineTo(x + cellW * 0.50, y + cellH);
      ctx.moveTo(x + cellW * 0.75, y); ctx.lineTo(x + cellW * 0.75, y + cellH);
      ctx.stroke();

      // Fine Grid Fingers (Horizontal conductive grid)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let f = 1; f < 8; f++) {
        const fy = y + (cellH / 8) * f;
        ctx.moveTo(x, fy); ctx.lineTo(x + cellW, fy);
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Interlocking Malaysian Concrete Roof Tile Texture */
function createRoofTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Neutral light base: the material colour tints it (terracotta / slate)
  ctx.fillStyle = "#e4e6ea";
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const rowH = 512 / rows;
  for (let i = 0; i < rows; i++) {
    const y = i * rowH;
    // Overlapping tile cast shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, y, 512, 4);
    // Sunlit top edge highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, y + 4, 512, 2);

    // Staggered vertical tile grooves
    ctx.strokeStyle = "rgba(15, 23, 42, 0.25)";
    ctx.lineWidth = 2;
    const offset = (i % 2) * 16;
    for (let x = offset; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Modern Driveway Interlocking Paver Texture */
function createDrivewayTexture(base: string, joint: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = joint;
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 16) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    const offset = (Math.floor(y / 16) % 2) * 16;
    for (let x = offset; x < 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

// ---------------------------------------------------------------------------
// Stylised "game-art" house kit: bevelled volumes, window / door assemblies,
// car porch, boundary wall and soft low-poly planting. Everything is procedural
// and metric (1 unit = 1 m). Decorative props never cast shadows onto the roof,
// so they cannot be mistaken for real shading on the PV array.
// ---------------------------------------------------------------------------

/** Deterministic PRNG so the scenery looks identical on every rebuild. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bevelled box: the soft edge catches light and gives the toy / game-asset look. */
function rbox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  radius = 0.04,
  cast = true
): THREE.Mesh {
  const r = Math.min(radius, w * 0.49, h * 0.49, d * 0.49);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Light neutral plaster: soft mottling + damp / grime gradient at the foot of the wall. */
function createWallTexture(grime: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 256);
  const rand = mulberry32(11);
  for (let i = 0; i < 240; i++) {
    const x = rand() * 128;
    const y = rand() * 256;
    const r = 8 + rand() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.02 + rand() * 0.035;
    g.addColorStop(0, `rgba(95,80,65,${a})`);
    g.addColorStop(1, "rgba(95,80,65,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // canvas bottom = UV v 0 = foot of the wall
  const foot = ctx.createLinearGradient(0, 256, 0, 256 * 0.72);
  foot.addColorStop(0, `rgba(75,62,50,${grime})`);
  foot.addColorStop(1, "rgba(75,62,50,0)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, 256 * 0.72, 128, 256 * 0.28);
  const eave = ctx.createLinearGradient(0, 0, 0, 36);
  eave.addColorStop(0, "rgba(60,50,45,0.10)");
  eave.addColorStop(1, "rgba(60,50,45,0)");
  ctx.fillStyle = eave;
  ctx.fillRect(0, 0, 128, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Painted sky-blue glass with two soft diagonal highlights (reads as glass without an env map). */
function createGlassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#c4e8f7");
  g.addColorStop(1, "#4f9fc4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath();
  ctx.moveTo(76, 0);
  ctx.lineTo(118, 0);
  ctx.lineTo(40, 256);
  ctx.lineTo(0, 256);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(52, 0);
  ctx.lineTo(0, 150);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft round contact shadow used under props that do not cast real shadows. */
function createBlobTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(20,25,20,0.42)");
  g.addColorStop(0.6, "rgba(20,25,20,0.18)");
  g.addColorStop(1, "rgba(20,25,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface WindowMats {
  frame: THREE.Material;
  glass: THREE.Material;
  trim: THREE.Material;
  shutter: THREE.Material;
  planter: THREE.Material;
  leaf: THREE.Material;
  flower: THREE.Material;
}

/** Sliding window with sill, lintel, optional shutters and a flower box. Faces +Z, origin on the wall face. */
function createWindowAssembly(
  w: number,
  h: number,
  m: WindowMats,
  flowers: boolean,
  shutters: boolean
): THREE.Group {
  const g = new THREE.Group();
  const frame = rbox(w, h, 0.16, m.frame, 0.03);
  frame.position.z = 0.04;
  g.add(frame);

  const paneW = w * 0.44 - 0.02;
  const paneH = h * 0.84;
  [-1, 1].forEach((s) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, 0.03), m.glass);
    pane.position.set(s * w * 0.225, 0, 0.125);
    g.add(pane);
  });
  const mullion = rbox(0.05, paneH + 0.04, 0.05, m.frame, 0.015, false);
  mullion.position.set(0, 0, 0.14);
  g.add(mullion);

  const sill = rbox(w + 0.3, 0.07, 0.3, m.trim, 0.02);
  sill.position.set(0, -h / 2 - 0.035, 0.15);
  g.add(sill);
  const lintel = rbox(w + 0.2, 0.1, 0.22, m.trim, 0.025);
  lintel.position.set(0, h / 2 + 0.05, 0.11);
  g.add(lintel);

  if (shutters) {
    [-1, 1].forEach((s) => {
      const sh = rbox(w * 0.2, h, 0.05, m.shutter, 0.015);
      sh.position.set(s * (w / 2 + w * 0.1 + 0.04), 0, 0.06);
      g.add(sh);
    });
  }

  if (flowers) {
    const box = rbox(w * 0.92, 0.2, 0.26, m.planter, 0.03, false);
    box.position.set(0, -h / 2 - 0.22, 0.3);
    g.add(box);
    const n = Math.max(4, Math.round(w / 0.4));
    for (let i = 0; i < n; i++) {
      const x = -w * 0.42 + (i / (n - 1)) * w * 0.84;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), m.leaf);
      blob.position.set(x, -h / 2 - 0.1, 0.3);
      g.add(blob);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), m.flower);
      bloom.position.set(x + 0.03, -h / 2 + 0.02, 0.36);
      g.add(bloom);
    }
  }
  return g;
}

/** Soft low-poly shrub. */
function createBush(rand: () => number, leaf: THREE.Material, leafAlt: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const r = 0.32 + rand() * 0.18;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), i % 2 ? leafAlt : leaf);
    b.position.set((i - 1) * 0.38, r * 0.8, (rand() - 0.5) * 0.2);
    b.scale.y = 0.85;
    g.add(b);
  }
  return g;
}

/** Terracotta pot with a flowering shrub. */
function createPlanterPot(
  pot: THREE.Material,
  leaf: THREE.Material,
  leafAlt: THREE.Material,
  flower: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.42, 12), pot);
  body.position.y = 0.21;
  g.add(body);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 12), pot);
  rim.position.y = 0.44;
  g.add(rim);
  [
    [0, 0.72, 0, 0.3, leaf],
    [0.17, 0.62, 0.08, 0.2, leafAlt],
    [-0.16, 0.64, -0.06, 0.21, leafAlt],
  ].forEach((spec) => {
    const [x, y, z, r, mat] = spec as [number, number, number, number, THREE.Material];
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    b.position.set(x, y, z);
    g.add(b);
  });
  [
    [0.1, 0.98, 0.12],
    [-0.14, 0.9, 0.1],
    [0.22, 0.8, -0.1],
    [-0.04, 1.02, -0.08],
  ].forEach(([x, y, z]) => {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), flower);
    bloom.position.set(x, y, z);
    g.add(bloom);
  });
  return g;
}

/** Round-crown shade tree (frangipani / rain-tree feel), flat-shaded low poly. */
function createRoundTree(trunk: THREE.Material, leaf: THREE.Material, leafAlt: THREE.Material): THREE.Group {
  const t = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 8), trunk);
  stem.position.y = 1.1;
  t.add(stem);
  const blobs: [number, number, number, number, THREE.Material][] = [
    [0, 2.9, 0, 1.25, leaf],
    [0.8, 2.5, 0.3, 0.85, leafAlt],
    [-0.75, 2.55, -0.2, 0.9, leaf],
    [0.1, 3.55, 0.1, 0.8, leafAlt],
  ];
  blobs.forEach(([x, y, z, r, mat]) => {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    b.position.set(x, y, z);
    b.scale.y = 0.88;
    t.add(b);
  });
  return t;
}

/** Leaning coconut-style palm with drooping fronds: the quickest "this is Malaysia" cue. */
function createPalm(trunk: THREE.Material, leaf: THREE.Material, leafAlt: THREE.Material): THREE.Group {
  const p = new THREE.Group();
  const lean = 0.1;
  const segLen = 0.75;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 - i * 0.006, 0.125 - i * 0.006, segLen, 8),
      trunk
    );
    const d = (i + 0.5) * segLen;
    seg.position.set(Math.sin(lean) * d, Math.cos(lean) * d, 0);
    seg.rotation.z = -lean;
    p.add(seg);
  }
  const crown = new THREE.Group();
  crown.position.set(Math.sin(lean) * segs * segLen, Math.cos(lean) * segs * segLen, 0);
  p.add(crown);
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / fronds) * Math.PI * 2 + 0.3;
    const geo = new THREE.ConeGeometry(0.22, 1.9, 4);
    geo.translate(0, 0.95, 0);
    const frond = new THREE.Mesh(geo, i % 2 ? leaf : leafAlt);
    frond.rotation.z = -(i % 2 ? 1.0 : 1.35);
    frond.scale.set(0.25, 1, 1);
    pivot.add(frond);
    crown.add(pivot);
  }
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5b6b2f, roughness: 0.8 });
  [
    [0.12, -0.1, 0.08],
    [-0.1, -0.12, 0.1],
    [0.02, -0.1, -0.13],
  ].forEach(([x, y, z]) => {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), nutMat);
    nut.position.set(x, y, z);
    crown.add(nut);
  });
  return p;
}

/** Stylised hatchback parked nose-out (+Z). */
function createCar(color: number): THREE.Group {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x27415a, roughness: 0.12, metalness: 0.2 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d9, roughness: 0.4, metalness: 0.5 });

  const body = rbox(1.8, 0.55, 4.4, bodyMat, 0.18);
  body.position.set(0, 0.58, 0);
  car.add(body);
  const cabin = rbox(1.5, 0.55, 2.3, bodyMat, 0.2);
  cabin.position.set(0, 1.12, -0.25);
  car.add(cabin);
  const win = rbox(1.54, 0.34, 2.0, glassMat, 0.12, false);
  win.position.set(0, 1.15, -0.25);
  car.add(win);

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.28, 12);
  hubGeo.rotateZ(Math.PI / 2);
  [
    [-0.9, 1.35],
    [0.9, 1.35],
    [-0.9, -1.35],
    [0.9, -1.35],
  ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(x, 0.34, z);
    wheel.castShadow = true;
    car.add(wheel);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(x, 0.34, z);
    car.add(hub);
  });

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xffe9a8, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xc23b3b, emissive: 0xff4d4d, emissiveIntensity: 0.5 });
  [-0.62, 0.62].forEach((x) => {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), headMat);
    head.position.set(x, 0.66, 2.21);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), tailMat);
    tail.position.set(x, 0.66, -2.21);
    car.add(tail);
  });
  return car;
}

interface HouseParams {
  footprintW: number;
  footprintD: number;
  eaveHeight: number;
  groundFloorH: number;
  preset: ScenePreset;
}

/**
 * Builds the whole house body, entrance, car porch and front yard.
 * Layout (front = +Z): car porch on the +X side, entrance door on the -X side.
 */
function buildHouse(scene: THREE.Scene, p: HouseParams): void {
  const { footprintW: W, footprintD: D, eaveHeight, groundFloorH, preset } = p;
  const rand = mulberry32(20261022);
  const wallW = W * 0.96;
  const wallD = D * 0.96;
  const frontZ = wallD / 2;
  const house = new THREE.Group();
  scene.add(house);

  // ---- materials -----------------------------------------------------------
  const lowerWallMat = new THREE.MeshStandardMaterial({
    color: preset.lowerWall,
    map: createWallTexture(0.3),
    roughness: 0.88,
    metalness: 0,
  });
  const upperWallMat = new THREE.MeshStandardMaterial({
    color: preset.upperWall,
    map: createWallTexture(0.08),
    roughness: 0.85,
    metalness: 0,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: preset.trim, roughness: 0.6 });
  const bandMat = new THREE.MeshStandardMaterial({ color: preset.band, roughness: 0.6 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: preset.plinth, roughness: 0.9 });
  const frameMat = new THREE.MeshStandardMaterial({ color: preset.windowFrame, roughness: 0.5, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({
    map: createGlassTexture(),
    roughness: 0.15,
    metalness: 0,
    emissive: 0x2b6f93,
    emissiveIntensity: 0.12,
  });
  const doorMat = new THREE.MeshStandardMaterial({ color: preset.door, roughness: 0.55 });
  const slabMat = new THREE.MeshStandardMaterial({ color: preset.porchRoof, roughness: 0.6, metalness: 0.05 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: preset.pillar, roughness: 0.6, metalness: 0.1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: preset.leaf, roughness: 1, flatShading: true });
  const leafAltMat = new THREE.MeshStandardMaterial({ color: preset.leafAlt, roughness: 1, flatShading: true });
  const flowerMat = new THREE.MeshStandardMaterial({ color: preset.flower, roughness: 0.7 });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb8683f, roughness: 0.85 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.95 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: preset.upperWall, roughness: 0.9 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a84a, roughness: 0.3, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.0 });

  // ---- main volumes --------------------------------------------------------
  const lowerWall = rbox(wallW, groundFloorH, wallD, lowerWallMat, 0.1);
  lowerWall.position.set(0, groundFloorH / 2, 0);
  house.add(lowerWall);

  const upperH = eaveHeight - groundFloorH;
  const upperWall = rbox(wallW, upperH, wallD, upperWallMat, 0.1);
  upperWall.position.set(0, groundFloorH + upperH / 2, 0);
  house.add(upperWall);

  const band = rbox(wallW + 0.18, 0.16, wallD + 0.18, bandMat, 0.04);
  band.position.set(0, groundFloorH, 0);
  house.add(band);

  const plinth = rbox(wallW + 0.3, 0.35, wallD + 0.3, plinthMat, 0.05);
  plinth.position.set(0, 0.175, 0);
  house.add(plinth);

  // corner quoins
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const q = rbox(0.24, eaveHeight - 0.35, 0.24, trimMat, 0.05);
      q.position.set((sx * wallW) / 2, 0.35 + (eaveHeight - 0.35) / 2, (sz * wallD) / 2);
      house.add(q);
    })
  );

  // ---- front layout --------------------------------------------------------
  const carportW = W * 0.5;
  const cx = wallW / 2 - carportW / 2 - W * 0.01; // car porch centre (right side)
  const leftW = wallW - carportW;
  const doorX = -wallW / 2 + leftW / 2; // entrance centre (left side)
  const porchD = 4.8;
  const yardDepth = Math.min(Math.max(D * 0.32, 5.5), 8.0);

  // ---- windows -------------------------------------------------------------
  const wm: WindowMats = {
    frame: frameMat,
    glass: glassMat,
    trim: trimMat,
    shutter: doorMat,
    planter: potMat,
    leaf: leafMat,
    flower: flowerMat,
  };
  const winW = Math.min(W * 0.3, 2.2);
  const winH = 1.3;
  const winY = groundFloorH + 1.3;
  [-0.2, 0.2].forEach((fx) => {
    const front = createWindowAssembly(winW, winH, wm, preset.props, preset.props);
    front.position.set(W * fx, winY, frontZ);
    house.add(front);
    const back = createWindowAssembly(winW, winH, wm, false, false);
    back.rotation.y = Math.PI;
    back.position.set(W * fx, winY, -frontZ);
    house.add(back);
  });

  // ---- entrance: door, steps, wall lamp ------------------------------------
  const doorBaseY = 0.35;
  const doorFrame = rbox(1.2, 2.3, 0.16, trimMat, 0.04);
  doorFrame.position.set(doorX, doorBaseY + 1.15, frontZ + 0.04);
  house.add(doorFrame);
  const doorLeaf = rbox(0.98, 2.15, 0.08, doorMat, 0.03);
  doorLeaf.position.set(doorX, doorBaseY + 1.08, frontZ + 0.1);
  house.add(doorLeaf);
  [-0.26, 0.26].forEach((dx) => {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.02), glassMat);
    slit.position.set(doorX + dx, doorBaseY + 1.35, frontZ + 0.15);
    house.add(slit);
  });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), goldMat);
  handle.position.set(doorX + 0.36, doorBaseY + 1.05, frontZ + 0.17);
  house.add(handle);

  const stepLow = rbox(1.9, 0.15, 1.0, plinthMat, 0.04);
  stepLow.position.set(doorX, 0.125, frontZ + 0.15 + 0.5);
  house.add(stepLow);
  const stepHigh = rbox(1.7, 0.15, 0.55, plinthMat, 0.04);
  stepHigh.position.set(doorX, 0.275, frontZ + 0.15 + 0.275);
  house.add(stepHigh);

  const lampPlate = rbox(0.12, 0.28, 0.06, frameMat, 0.02, false);
  lampPlate.position.set(doorX + 0.85, doorBaseY + 1.9, frontZ + 0.03);
  house.add(lampPlate);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), lampMat);
  lamp.position.set(doorX + 0.85, doorBaseY + 1.9, frontZ + 0.12);
  house.add(lamp);

  // ---- car porch -----------------------------------------------------------
  const slab = rbox(carportW + 0.3, 0.2, porchD, slabMat, 0.05);
  slab.position.set(cx, 2.85, frontZ + porchD / 2);
  house.add(slab);
  [-1, 1].forEach((s) => {
    const col = rbox(0.22, 2.7, 0.22, pillarMat, 0.05);
    col.position.set(cx + (s * carportW) / 2, 0.05 + 1.35, frontZ + porchD - 0.2);
    house.add(col);
  });

  // ---- driveway ------------------------------------------------------------
  const driveMat = new THREE.MeshStandardMaterial({
    map: createDrivewayTexture(preset.driveBase, preset.driveJoint),
    roughness: 0.85,
  });
  const drive = new THREE.Mesh(new THREE.BoxGeometry(carportW + 0.5, 0.08, yardDepth), driveMat);
  drive.position.set(cx, 0.04, frontZ + yardDepth / 2);
  drive.receiveShadow = true;
  house.add(drive);

  // ---- paved yard slab -----------------------------------------------------
  const fz = frontZ + yardDepth + 0.1; // boundary wall line
  if (preset.pad !== null) {
    const z0 = -wallD / 2 - 1.2;
    const z1 = fz + 0.35;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(W * 1.7, 0.05, z1 - z0),
      new THREE.MeshStandardMaterial({ color: preset.pad, roughness: 0.92 })
    );
    pad.position.set(0, 0.025, (z0 + z1) / 2);
    pad.receiveShadow = true;
    house.add(pad);
  }

  // ---- car + soft planting + boundary wall (decor only) --------------------
  if (preset.carColor !== null) {
    const car = createCar(preset.carColor);
    car.position.set(cx, 0.08, frontZ + porchD / 2 + 0.1);
    house.add(car);
  }

  if (preset.props) {
    const blobTex = createBlobTexture();
    const addBlob = (x: number, z: number, radius: number) => {
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(x, 0.065, z);
      house.add(blob);
    };

    // stepping-stone path from the door to the street
    const pathColor = new THREE.Color(preset.pad ?? 0xcccccc).offsetHSL(0, 0, 0.05);
    const pathLen = fz - (frontZ + 1.15);
    if (pathLen > 0.5) {
      const path = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.07, pathLen),
        new THREE.MeshStandardMaterial({ color: pathColor, roughness: 0.9 })
      );
      path.position.set(doorX, 0.035, frontZ + 1.15 + pathLen / 2);
      path.receiveShadow = true;
      house.add(path);
    }

    // potted plants flanking the door
    [-1, 1].forEach((s) => {
      const pot = createPlanterPot(potMat, leafMat, leafAltMat, flowerMat);
      pot.position.set(doorX + s * 1.2, 0.05, frontZ + 0.5);
      house.add(pot);
      addBlob(doorX + s * 1.2, frontZ + 0.5, 0.45);
    });

    // boundary wall with a car gate and a pedestrian gate
    const hw = W * 0.85;
    const carGap: [number, number] = [cx - (carportW + 0.5) / 2, cx + (carportW + 0.5) / 2];
    const doorGap: [number, number] = [doorX - 0.7, doorX + 0.7];
    const gaps = [carGap, doorGap].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    gaps.forEach((gp) => {
      const last = merged[merged.length - 1];
      if (last && gp[0] - last[1] < 0.3) last[1] = Math.max(last[1], gp[1]);
      else merged.push([gp[0], gp[1]]);
    });
    const postXs: number[] = [-hw];
    const spans: [number, number][] = [];
    let cursor = -hw;
    merged.forEach(([a, b]) => {
      if (a - cursor > 0.3) spans.push([cursor, a]);
      postXs.push(a, b);
      cursor = b;
    });
    if (hw - cursor > 0.3) spans.push([cursor, hw]);
    postXs.push(hw);

    spans.forEach(([a, b]) => {
      const wall = rbox(b - a, 0.8, 0.22, fenceMat, 0.04);
      wall.position.set((a + b) / 2, 0.45, fz);
      wall.castShadow = false;
      house.add(wall);
      const cap = rbox(b - a + 0.04, 0.08, 0.3, trimMat, 0.025, false);
      cap.position.set((a + b) / 2, 0.88, fz);
      house.add(cap);

      const n = Math.floor((b - a) / 1.1);
      for (let k = 0; k < n; k++) {
        const bush = createBush(rand, leafMat, leafAltMat);
        const bx = a + ((k + 0.5) * (b - a)) / n;
        const s = 0.8 + rand() * 0.4;
        bush.scale.setScalar(s);
        bush.position.set(bx, 0.05, fz - 0.6);
        house.add(bush);
        addBlob(bx, fz - 0.6, 0.7 * s);
      }
    });
    postXs.forEach((x) => {
      const post = rbox(0.34, 1.15, 0.34, fenceMat, 0.04, false);
      post.position.set(x, 0.62, fz);
      house.add(post);
      const postCap = rbox(0.44, 0.1, 0.44, trimMat, 0.03, false);
      postCap.position.set(x, 1.24, fz);
      house.add(postCap);
    });

    // one palm and one shade tree in the front corners
    const palm = createPalm(trunkMat, leafMat, leafAltMat);
    palm.position.set(-W * 0.78, 0.05, frontZ + yardDepth * 0.45);
    house.add(palm);
    addBlob(-W * 0.78 + 0.3, frontZ + yardDepth * 0.45, 1.5);

    const tree = createRoundTree(trunkMat, leafMat, leafAltMat);
    tree.position.set(W * 0.78, 0.05, frontZ + yardDepth * 0.35);
    tree.scale.setScalar(0.95);
    house.add(tree);
    addBlob(W * 0.78, frontZ + yardDepth * 0.35, 1.9);
  }
}

export default function Roof3DViewer({
  geometry,
  layout,
  imageUrl,
  imageWidth,
  imageHeight,
  onSwitchTo2D,
}: Roof3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  // Keeps the user's camera when the scene is rebuilt (style / roof tile switch)
  const savedViewRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const [webglError, setWebglError] = useState<string | null>(null);
  // Time of day: 8.0 (8am) to 18.0 (6pm), default 11.5 (11:30am)
  const [timeOfDay, setTimeOfDay] = useState<number>(11.5);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [scenePreset, setScenePreset] = useState<ScenePresetKey>("warm");
  const [activeRoofStyle, setActiveRoofStyle] = useState<"aerial" | "charcoal" | "terracotta">(
    imageUrl ? "aerial" : "terracotta"
  );
  const [ridgeOrientationOverride, setRidgeOrientationOverride] = useState<"auto" | "ew" | "ns">("auto");

  // Default to aerial photograph whenever imageUrl is present
  useEffect(() => {
    if (imageUrl) {
      setActiveRoofStyle("aerial");
    }
  }, [imageUrl]);
  const preset = SCENE_PRESETS[scenePreset];
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);

  // Real-Time Solar Generation Physics Engine for Peninsular Malaysia (~3.18°N)
  const calculateSolarGeneration = (hour: number, capacityKWp: number) => {
    if (hour < 8.0 || hour > 18.0 || capacityKWp <= 0) {
      return { instantKW: 0, cumulativeKWh: 0, savingsRM: 0, currentIrradiance: 0 };
    }
    const progress = (hour - 8.0) / 10.0;
    const irradianceFactor = Math.pow(Math.sin(progress * Math.PI), 1.25);
    const peakIrradianceW = 980.0;
    const currentIrradiance = Math.round(peakIrradianceW * irradianceFactor);
    const performanceRatio = 0.82;
    const instantKW = (capacityKWp * (currentIrradiance / 1000.0)) * performanceRatio;

    let cumulativeKWh = 0;
    const steps = Math.floor((hour - 8.0) / 0.1);
    for (let i = 0; i <= steps; i++) {
      const h = 8.0 + i * 0.1;
      const p = (h - 8.0) / 10.0;
      const irr = peakIrradianceW * Math.pow(Math.sin(p * Math.PI), 1.25);
      const kw = (capacityKWp * (irr / 1000.0)) * performanceRatio;
      cumulativeKWh += kw * 0.1;
    }
    const savingsRM = cumulativeKWh * 0.4443;

    return {
      instantKW: Math.max(0, instantKW),
      cumulativeKWh: Math.max(0, cumulativeKWh),
      savingsRM: Math.max(0, savingsRM),
      currentIrradiance,
    };
  };

  const genMetrics = calculateSolarGeneration(timeOfDay, layout.capacity_kwp || 0);

  // Playback timer for 1-day animation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeOfDay((prev) => {
        const next = prev + 0.04 * playSpeed;
        if (next >= 18.0) {
          return 8.0;
        }
        return next;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  // Calculate sun position based on tropical Malaysia (~3.18°N) with True North compensation
  const updateSunPosition = (hour: number) => {
    if (!sunLightRef.current) return;
    const progress = (hour - 8) / 10.0; // 0.0 to 1.0
    const baseSolarAzimuthDeg = 90.0 + progress * 180.0; // 90° (E) -> 180° (S) -> 270° (W)
    
    // Compensate for satellite image leveling rotation:
    // True Solar Azimuth = (Base Solar Azimuth - canvas_rotation_deg) mod 360
    const canvasRot = geometry.canvas_rotation_deg || 0.0;
    const effectiveSolarAzimuthDeg = (baseSolarAzimuthDeg - canvasRot + 360.0) % 360.0;
    
    // Equatorial solar elevation: peaks at ~84° near noon
    const elevationRad = Math.sin(progress * Math.PI) * (84.0 * Math.PI / 180.0);
    const azimuthRad = (effectiveSolarAzimuthDeg * Math.PI) / 180.0;

    const distance = 50.0;
    const x = distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
    const y = Math.max(distance * Math.sin(elevationRad), 6.0);
    const z = distance * Math.cos(elevationRad) * Math.cos(azimuthRad);

    sunLightRef.current.position.set(x, y, z);
    sunLightRef.current.intensity = Math.max(1.2, Math.sin(progress * Math.PI) * 3.0);
  };

  useEffect(() => {
    updateSunPosition(timeOfDay);
  }, [timeOfDay]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 1.2;
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(preset.background);
    scene.fog = new THREE.FogExp2(preset.background, preset.fogDensity);

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 300);
    cameraRef.current = camera;
    camera.position.set(18, 19, 23);

    // 3. Renderer setup with resilient GPU fallback
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e1) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        });
      } catch (e2: any) {
        console.warn("WebGL initialization failed:", e2);
        setWebglError(e2?.message || "Failed to initialize WebGL graphics context");
        return;
      }
    }

    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = preset.exposure;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Keep above ground level
    controls.minDistance = 6;
    controls.maxDistance = 80;
    controls.target.set(0, 4.2, 0);
    if (savedViewRef.current) {
      camera.position.copy(savedViewRef.current.pos);
      controls.target.copy(savedViewRef.current.target);
    }

    // 5. Lighting
    // Ambient / Hemisphere light (tropical clear sky + ground warm bounce)
    const hemiLight = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, 1.05);
    scene.add(hemiLight);

    // Directional Sunlight with High-Definition Soft Shadows
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.8);
    sunLightRef.current = sunLight;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 90;
    const shadowSize = 18;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    sunLight.shadow.bias = -0.00005;
    sunLight.shadow.normalBias = 0.05; // Crucial: eliminates shadow acne & twinkling on sloping roofs
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLight.target.position.set(0, 4.2, 0);
    updateSunPosition(timeOfDay);

    // 6. Ground & Landscaping Architecture
    // Lush Malaysian Garden Turf
    const lawnGeo = new THREE.PlaneGeometry(300, 300);
    const lawnMat = new THREE.MeshStandardMaterial({
      color: preset.lawn,
      roughness: 0.85,
      metalness: 0.05,
    });
    const lawn = new THREE.Mesh(lawnGeo, lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.01;
    lawn.receiveShadow = true;
    scene.add(lawn);

    // Subtle Ground Grid
    if (preset.grid) {
      const grid = new THREE.GridHelper(60, 60, 0x0284c7, 0x1e293b);
      grid.position.y = 0.01;
      scene.add(grid);
    }

    // 7. Reconstruct 3D House Body & Roof (Strictly Synchronized with Backend Metric Packing Space)
    const rawPolys = geometry.roof_polygons_px || [];
    const allPtsFlat = rawPolys.flatMap((poly) => poly);
    const mPerPx =
      layout.scale_m_per_px ||
      geometry.scale?.metres_per_pixel ||
      (function () {
        if (allPtsFlat.length > 0) {
          const xs = allPtsFlat.map((p) => p[0]);
          const ys = allPtsFlat.map((p) => p[1]);
          const bboxSpan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 120.0);
          return Number((14.0 / bboxSpan).toFixed(4));
        }
        return 0.08;
      })();

    // Calculate center of roof in meters
    const allPtsM: [number, number][] = [];
    rawPolys.forEach((poly) => {
      poly.forEach((pt) => {
        allPtsM.push([pt[0] * mPerPx, pt[1] * mPerPx]);
      });
    });
    // Include obstacles in building boundary estimation
    (geometry.obstacles || []).forEach((obs) => {
      obs.polygon_px?.forEach((pt) => {
        allPtsM.push([pt[0] * mPerPx, pt[1] * mPerPx]);
      });
    });
    // Include reference scale line points if present
    (geometry.scale?.reference_px || []).forEach((pt) => {
      allPtsM.push([pt[0] * mPerPx, pt[1] * mPerPx]);
    });

    if (allPtsM.length >= 3) {
      const xs = allPtsM.map((p) => p[0]);
      const zs = allPtsM.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const centerX = (minX + maxX) / 2.0;
      const centerZ = (minZ + maxZ) / 2.0;

      // Realistic Malaysian residential terrace / linked house proportions
      // Typical minimum building lot envelope: width >= 7.5m (24ft lot), depth >= 11.0m (36ft)
      const footprintW = Math.max(maxX - minX, 7.5);
      const footprintD = Math.max(maxZ - minZ, 11.0);

      // Source image extent in meters for top-down aerial UV projection
      const imgWPx = imageWidth || (geometry.scale?.reference_m ? 870 : 800);
      const imgHPx = imageHeight || (geometry.scale?.reference_m ? 930 : 800);
      const imgWM = imgWPx * mPerPx;
      const imgHM = imgHPx * mPerPx;

      // Heights in meters for typical Malaysian 2-storey terrace house (e.g. Elmina West)
      const eaveHeight = 5.8;
      const groundFloorH = 3.0;
      const tiltDeg = geometry.tilt_deg !== undefined && geometry.tilt_deg !== null ? geometry.tilt_deg : 15.0;
      const tiltRad = (tiltDeg * Math.PI) / 180.0;

      // ---------------------------------------------------------
      // A. House body, entrance, car porch and front yard (stylised kit)
      // ---------------------------------------------------------
      buildHouse(scene, { footprintW, footprintD, eaveHeight, groundFloorH, preset });

      // ---------------------------------------------------------
      // C. Roof Materials & Textures (Aerial Photo or Procedural Architectural Tiles)
      // ---------------------------------------------------------
      let aerialTexture: THREE.Texture | null = null;
      if (imageUrl) {
        aerialTexture = new THREE.TextureLoader().load(
          imageUrl,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
            tex.needsUpdate = true;
            if (activeRoofStyle === "aerial" && roofMat) {
              roofMat.map = tex;
              roofMat.needsUpdate = true;
            }
          },
          undefined,
          (err) => {
            console.warn("Failed to load aerial roof texture:", err);
          }
        );
        aerialTexture.colorSpace = THREE.SRGBColorSpace;
        aerialTexture.wrapS = THREE.ClampToEdgeWrapping;
        aerialTexture.wrapT = THREE.ClampToEdgeWrapping;
      }

      const tileTexture = createRoofTileTexture();
      tileTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const roofMat = activeRoofStyle === "aerial" && aerialTexture
        ? new THREE.MeshStandardMaterial({
            map: aerialTexture,
            roughness: 0.72,
            metalness: 0.05,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshStandardMaterial({
            color: activeRoofStyle === "charcoal" ? preset.roofTints.charcoal : preset.roofTints.terracotta,
            map: tileTexture,
            roughness: 0.62,
            metalness: 0.12,
            side: THREE.DoubleSide,
          });

      // Eaves gutters / fascia in the preset trim colour
      const gutterMat = new THREE.MeshStandardMaterial({ color: preset.trim, metalness: 0.1, roughness: 0.5 });

      // UV mapping helper function: maps 3D roof scene coordinates (x, z) to texture UVs
      const computeUV = (x: number, z: number): [number, number] => {
        if (activeRoofStyle === "aerial") {
          // World coordinate in meters relative to top-left of image
          const vx = x + centerX;
          const vz = z + centerZ;
          const u = Math.max(0.0, Math.min(1.0, vx / imgWM));
          const v = Math.max(0.0, Math.min(1.0, 1.0 - (vz / imgHM)));
          return [u, v];
        } else {
          // Repeating tile pattern UVs
          return [(x + 50) / 3.2, (z + 50) / 3.2];
        }
      };

      // Distinct Multi-Color Palette Synchronized with Step 2 Editor
      const FACET_PALETTE_HEX = [
        0x0284c7, // Plane 1: Blue
        0x9333ea, // Plane 2: Purple
        0x059669, // Plane 3: Emerald
        0xd97706, // Plane 4: Amber
        0xdb2777, // Plane 5: Pink
        0x16a34a, // Plane 6: Green
        0x4f46e5, // Plane 7: Indigo
      ];

      // Detect roof orientation:
      // Priority 1: User manual toggle override if set
      let isRidgeAlongZ = false;
      if (ridgeOrientationOverride === "ns") {
        isRidgeAlongZ = true;
      } else if (ridgeOrientationOverride === "ew") {
        isRidgeAlongZ = false;
      } else {
        // Priority 2: Check backend layout facet slopes and geometry faces metrics
        const allSlopeDirs = [
          ...(layout.facet_layouts || []).map((f) => f.slope_direction),
          ...(geometry.faces_metrics || []).map((f) => f.slope_direction),
        ]
          .filter(Boolean)
          .map((d) => String(d).toLowerCase());

        const hasEW = allSlopeDirs.some((d) => d.includes("east") || d.includes("west"));
        const hasNS = allSlopeDirs.some((d) => d.includes("north") || d.includes("south"));

        if (hasEW && !hasNS) {
          isRidgeAlongZ = true; // Slopes to East and West -> Ridge is North-South (along Z)
        } else if (hasNS && !hasEW) {
          isRidgeAlongZ = false; // Slopes to North and South -> Ridge is East-West (along X)
        } else {
          // Standard residential terrace / linked house default:
          // Front of the house (+Z) faces street/car porch, rear faces back lane (-Z).
          // Ridge runs East-West (along X) parallel to the street!
          isRidgeAlongZ = false;
        }
      }

      // ---------------------------------------------------------
      // True Proportional Ridge Position & Asymmetrical Slopes:
      // Real roofs are rarely in the exact dead center (50/50).
      // We detect the true boundary between the slopes from the polygons,
      // and adapt the ridge position, slopes, gable walls, and panels proportionally.
      // ---------------------------------------------------------
      const polyBounds = rawPolys.map((poly) => {
        const pxs = poly.map((pt) => pt[0] * mPerPx);
        const pzs = poly.map((pt) => pt[1] * mPerPx);
        return {
          minX: Math.min(...pxs),
          maxX: Math.max(...pxs),
          minZ: Math.min(...pzs),
          maxZ: Math.max(...pzs),
          cenX: pxs.reduce((a, b) => a + b, 0) / (pxs.length || 1),
          cenZ: pzs.reduce((a, b) => a + b, 0) / (pzs.length || 1),
        };
      });

      let trueRidgeZ = centerZ;
      let trueRidgeX = centerX;

      if (isRidgeAlongZ) {
        // Ridge along Z: find dividing line along X between Left and Right slopes
        if (polyBounds.length >= 2) {
          const sortedByX = [...polyBounds].sort((a, b) => a.cenX - b.cenX);
          const gap = sortedByX[sortedByX.length - 1].cenX - sortedByX[0].cenX;
          if (gap > footprintW * 0.25) {
            let bestGapIdx = 1;
            let maxGap = -Infinity;
            for (let i = 1; i < sortedByX.length; i++) {
              const g = sortedByX[i].cenX - sortedByX[i - 1].cenX;
              if (g > maxGap) {
                maxGap = g;
                bestGapIdx = i;
              }
            }
            const leftXs = sortedByX.slice(0, bestGapIdx).map((p) => p.maxX);
            const rightXs = sortedByX.slice(bestGapIdx).map((p) => p.minX);
            const maxLeftX = Math.max(...leftXs);
            const minRightX = Math.min(...rightXs);
            trueRidgeX = (maxLeftX + minRightX) / 2.0;
          }
        }
        const minAllowedX = minX + footprintW * 0.2;
        const maxAllowedX = minX + footprintW * 0.8;
        trueRidgeX = Math.max(minAllowedX, Math.min(trueRidgeX, maxAllowedX));
      } else {
        // Ridge along X: find dividing line along Z between Rear (-Z) and Front (+Z) slopes
        if (polyBounds.length >= 2) {
          const sortedByZ = [...polyBounds].sort((a, b) => a.cenZ - b.cenZ);
          const gap = sortedByZ[sortedByZ.length - 1].cenZ - sortedByZ[0].cenZ;
          if (gap > footprintD * 0.25) {
            let bestGapIdx = 1;
            let maxGap = -Infinity;
            for (let i = 1; i < sortedByZ.length; i++) {
              const g = sortedByZ[i].cenZ - sortedByZ[i - 1].cenZ;
              if (g > maxGap) {
                maxGap = g;
                bestGapIdx = i;
              }
            }
            const rearZs = sortedByZ.slice(0, bestGapIdx).map((p) => p.maxZ);
            const frontZs = sortedByZ.slice(bestGapIdx).map((p) => p.minZ);
            const maxRearZ = Math.max(...rearZs);
            const minFrontZ = Math.min(...frontZs);
            trueRidgeZ = (maxRearZ + minFrontZ) / 2.0;
          }
        }
        const minAllowedZ = minZ + footprintD * 0.2;
        const maxAllowedZ = minZ + footprintD * 0.8;
        trueRidgeZ = Math.max(minAllowedZ, Math.min(trueRidgeZ, maxAllowedZ));
      }

      const ridgeSceneX = trueRidgeX - centerX;
      const ridgeSceneZ = trueRidgeZ - centerZ;

      // Proportional slope spans
      const rearSpan = Math.max(0.5, ridgeSceneZ - (-footprintD / 2.0));
      const frontSpan = Math.max(0.5, footprintD / 2.0 - ridgeSceneZ);
      const leftSpan = Math.max(0.5, ridgeSceneX - (-footprintW / 2.0));
      const rightSpan = Math.max(0.5, footprintW / 2.0 - ridgeSceneX);

      const dominantSpan = isRidgeAlongZ
        ? Math.max(leftSpan, rightSpan)
        : Math.max(frontSpan, rearSpan);

      const ridgeHeight = eaveHeight + dominantSpan * Math.tan(tiltRad);

      // Independent pitch for each slope ensuring both eaves land EXACTLY at eaveHeight = 5.8m
      const frontTiltRad = Math.atan((ridgeHeight - eaveHeight) / frontSpan);
      const rearTiltRad = Math.atan((ridgeHeight - eaveHeight) / rearSpan);
      const leftTiltRad = Math.atan((ridgeHeight - eaveHeight) / leftSpan);
      const rightTiltRad = Math.atan((ridgeHeight - eaveHeight) / rightSpan);

      const overEave = 0.22;   // Overhang extending over gutters
      const overGable = 0.18;  // Overhang extending past gable walls

      // Attic Ceiling Slab at eaveHeight - completely encloses interior of the house
      const slabMat = new THREE.MeshStandardMaterial({ color: preset.porchRoof, roughness: 0.6, metalness: 0.05 });
      const ceilingSlab = rbox(footprintW, 0.12, footprintD, slabMat, 0.02);
      ceilingSlab.position.set(0, eaveHeight - 0.06, 0);
      scene.add(ceilingSlab);

      // Rain Gutters adapted to roof orientation
      if (isRidgeAlongZ) {
        const gutterLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, footprintD * 1.02), gutterMat);
        gutterLeft.position.set(-footprintW * 0.51, eaveHeight, 0);
        scene.add(gutterLeft);
        const gutterRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, footprintD * 1.02), gutterMat);
        gutterRight.position.set(footprintW * 0.51, eaveHeight, 0);
        scene.add(gutterRight);
      } else {
        const gutterFront = new THREE.Mesh(new THREE.BoxGeometry(footprintW * 1.02, 0.14, 0.14), gutterMat);
        gutterFront.position.set(0, eaveHeight, footprintD * 0.51);
        scene.add(gutterFront);
        const gutterBack = new THREE.Mesh(new THREE.BoxGeometry(footprintW * 1.02, 0.14, 0.14), gutterMat);
        gutterBack.position.set(0, eaveHeight, -footprintD * 0.51);
        scene.add(gutterBack);
      }

      // ---------------------------------------------------------
      // B. Watertight Structural Base Roof (Solid Envelope)
      // True proportional asymmetrical gable slopes
      // ---------------------------------------------------------
      if (tiltDeg > 1.0) {
        const baseRoofGeom = new THREE.BufferGeometry();
        const basePositions: number[] = [];
        const baseNormals: number[] = [];
        const baseUvs: number[] = [];

        if (!isRidgeAlongZ) {
          // Ridge runs along X at Z = ridgeSceneZ, Y = ridgeHeight
          // Slopes fall to Front (+Z) and Rear (-Z)
          const x0 = -footprintW / 2 - overGable;
          const x1 = footprintW / 2 + overGable;
          const zFront = footprintD / 2 + overEave;
          const zRear = -footprintD / 2 - overEave;
          const yEaveFront = eaveHeight - overEave * Math.tan(frontTiltRad);
          const yEaveRear = eaveHeight - overEave * Math.tan(rearTiltRad);

          const fn = new THREE.Vector3(0, Math.cos(frontTiltRad), Math.sin(frontTiltRad)).normalize();
          const rn = new THREE.Vector3(0, Math.cos(rearTiltRad), -Math.sin(rearTiltRad)).normalize();

          // Front Slope (from Z = ridgeSceneZ down to zFront)
          const pF0 = [x0, ridgeHeight, ridgeSceneZ];
          const pF1 = [x1, ridgeHeight, ridgeSceneZ];
          const pF2 = [x1, yEaveFront, zFront];
          const pF3 = [x0, yEaveFront, zFront];

          [pF0, pF3, pF1, pF1, pF3, pF2].forEach((p) => {
            basePositions.push(p[0], p[1], p[2]);
            baseNormals.push(fn.x, fn.y, fn.z);
            const [u, v] = computeUV(p[0], p[2]);
            baseUvs.push(u, v);
          });

          // Rear Slope (from Z = ridgeSceneZ down to zRear)
          const pR0 = [x0, ridgeHeight, ridgeSceneZ];
          const pR1 = [x1, ridgeHeight, ridgeSceneZ];
          const pR2 = [x1, yEaveRear, zRear];
          const pR3 = [x0, yEaveRear, zRear];

          [pR0, pR1, pR3, pR1, pR2, pR3].forEach((p) => {
            basePositions.push(p[0], p[1], p[2]);
            baseNormals.push(rn.x, rn.y, rn.z);
            const [u, v] = computeUV(p[0], p[2]);
            baseUvs.push(u, v);
          });
        } else {
          // Ridge runs along Z at X = ridgeSceneX, Y = ridgeHeight
          // Slopes fall to Left (-X) and Right (+X)
          const z0 = -footprintD / 2 - overGable;
          const z1 = footprintD / 2 + overGable;
          const xRight = footprintW / 2 + overEave;
          const xLeft = -footprintW / 2 - overEave;
          const yEaveRight = eaveHeight - overEave * Math.tan(rightTiltRad);
          const yEaveLeft = eaveHeight - overEave * Math.tan(leftTiltRad);

          const ln = new THREE.Vector3(-Math.sin(leftTiltRad), Math.cos(leftTiltRad), 0).normalize();
          const rn = new THREE.Vector3(Math.sin(rightTiltRad), Math.cos(rightTiltRad), 0).normalize();

          // Left Slope (from X = ridgeSceneX down to xLeft)
          const pL0 = [ridgeSceneX, ridgeHeight, z0];
          const pL1 = [ridgeSceneX, ridgeHeight, z1];
          const pL2 = [xLeft, yEaveLeft, z1];
          const pL3 = [xLeft, yEaveLeft, z0];

          [pL0, pL2, pL1, pL0, pL3, pL2].forEach((p) => {
            basePositions.push(p[0], p[1], p[2]);
            baseNormals.push(ln.x, ln.y, ln.z);
            const [u, v] = computeUV(p[0], p[2]);
            baseUvs.push(u, v);
          });

          // Right Slope (from X = ridgeSceneX down to xRight)
          const pR0 = [ridgeSceneX, ridgeHeight, z0];
          const pR1 = [ridgeSceneX, ridgeHeight, z1];
          const pR2 = [xRight, yEaveRight, z1];
          const pR3 = [xRight, yEaveRight, z0];

          [pR0, pR1, pR2, pR0, pR2, pR3].forEach((p) => {
            basePositions.push(p[0], p[1], p[2]);
            baseNormals.push(rn.x, rn.y, rn.z);
            const [u, v] = computeUV(p[0], p[2]);
            baseUvs.push(u, v);
          });
        }

        baseRoofGeom.setAttribute("position", new THREE.Float32BufferAttribute(basePositions, 3));
        baseRoofGeom.setAttribute("normal", new THREE.Float32BufferAttribute(baseNormals, 3));
        baseRoofGeom.setAttribute("uv", new THREE.Float32BufferAttribute(baseUvs, 2));

        const baseRoofMesh = new THREE.Mesh(baseRoofGeom, roofMat);
        baseRoofMesh.castShadow = true;
        baseRoofMesh.receiveShadow = true;
        scene.add(baseRoofMesh);
      } else {
        // Flat Roof: clean parapet horizontal slab
        const flatRoof = rbox(footprintW + 0.2, 0.16, footprintD + 0.2, roofMat, 0.04);
        flatRoof.position.set(0, eaveHeight + 0.08, 0);
        flatRoof.receiveShadow = true;
        scene.add(flatRoof);
      }

      // Helper function to split a polygon across a straight cut line (Sutherland-Hodgman style)
      const splitPolyByCoord = (
        poly: number[][],
        coordIdx: 0 | 1,
        splitVal: number
      ): [number[][], number[][]] => {
        const polyNeg: number[][] = [];
        const polyPos: number[][] = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const cur = poly[i];
          const next = poly[(i + 1) % n];
          const curVal = cur[coordIdx];
          const nextVal = next[coordIdx];

          if (curVal <= splitVal) polyNeg.push(cur);
          if (curVal >= splitVal) polyPos.push(cur);

          if ((curVal < splitVal && nextVal > splitVal) || (curVal > splitVal && nextVal < splitVal)) {
            const t = (splitVal - curVal) / (nextVal - curVal);
            const interPt = [
              cur[0] + t * (next[0] - cur[0]),
              cur[1] + t * (next[1] - cur[1]),
            ];
            polyNeg.push(interPt);
            polyPos.push(interPt);
          }
        }
        return [polyNeg, polyPos];
      };

      const splitValPx = isRidgeAlongZ ? trueRidgeX / mPerPx : trueRidgeZ / mPerPx;
      const coordIdx = isRidgeAlongZ ? 0 : 1;

      // Ensure any polygon spanning across the true ridge line is split into individual planar slope facets
      const effectivePolys: number[][][] = [];
      rawPolys.forEach((polyPx) => {
        if (polyPx.length < 3) return;
        const vals = polyPx.map((pt) => pt[coordIdx]);
        const minVal = Math.min(...vals);
        const maxVal = Math.max(...vals);

        // If this polygon spans across the true ridge line
        if (minVal < splitValPx - 10 && maxVal > splitValPx + 10) {
          const [neg, pos] = splitPolyByCoord(polyPx, coordIdx, splitValPx);
          if (neg.length >= 3) effectivePolys.push(neg);
          if (pos.length >= 3) effectivePolys.push(pos);
        } else {
          effectivePolys.push(polyPx);
        }
      });

      // ---------------------------------------------------------
      // C. Active Facet Overlays & Colored Boundary Wireframes
      // Highlight Plane 1 (Blue), Plane 2 (Purple), etc. matching Step 2 Canvas Editor
      // ---------------------------------------------------------
      effectivePolys.forEach((polyPx, polyIdx) => {
        if (polyPx.length < 3) return;

        const pts3D = polyPx.map((pt) => {
          const xm = pt[0] * mPerPx - centerX;
          const zm = pt[1] * mPerPx - centerZ;

          let ym = eaveHeight;
          if (isRidgeAlongZ) {
            const isWest = xm < ridgeSceneX;
            const span = isWest ? leftSpan : rightSpan;
            const distFromRidge = Math.abs(xm - ridgeSceneX);
            const planeY = ridgeHeight - (distFromRidge / span) * (ridgeHeight - eaveHeight);
            ym = Math.max(eaveHeight, Math.min(planeY, ridgeHeight));
          } else {
            const isRear = zm < ridgeSceneZ;
            const span = isRear ? rearSpan : frontSpan;
            const distFromRidge = Math.abs(zm - ridgeSceneZ);
            const planeY = ridgeHeight - (distFromRidge / span) * (ridgeHeight - eaveHeight);
            ym = Math.max(eaveHeight, Math.min(planeY, ridgeHeight));
          }
          return new THREE.Vector3(xm, ym, zm);
        });

        const facetColorHex = FACET_PALETTE_HEX[polyIdx % FACET_PALETTE_HEX.length];

        // 1. Facet Colored Boundary Wireframe (elevated +0.015m above tiles)
        const linePts: THREE.Vector3[] = [];
        for (let i = 0; i < pts3D.length; i++) {
          const pA = pts3D[i].clone();
          const pB = pts3D[(i + 1) % pts3D.length].clone();
          pA.y += 0.015;
          pB.y += 0.015;
          linePts.push(pA, pB);
        }
        const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
        const lineMat = new THREE.LineBasicMaterial({
          color: facetColorHex,
          linewidth: 3,
          transparent: true,
          opacity: 0.95,
        });
        const borderLines = new THREE.LineSegments(lineGeom, lineMat);
        scene.add(borderLines);

        // 2. Translucent Solar Zone Tint Overlay (elevated +0.006m, zero z-fighting)
        const shape2D = polyPx.map((p) => new THREE.Vector2(p[0] * mPerPx, p[1] * mPerPx));
        const triangles = THREE.ShapeUtils.triangulateShape(shape2D, []);
        const facetGeom = new THREE.BufferGeometry();
        const positions: number[] = [];

        triangles.forEach((face) => {
          const v0 = pts3D[face[0]];
          const v1 = pts3D[face[1]];
          const v2 = pts3D[face[2]];
          const ax = v1.x - v0.x;
          const az = v1.z - v0.z;
          const bx = v2.x - v0.x;
          const bz = v2.z - v0.z;
          const ny = az * bx - ax * bz;
          const tri = ny < 0 ? [face[0], face[2], face[1]] : [face[0], face[1], face[2]];

          tri.forEach((vertIdx) => {
            const v = pts3D[vertIdx];
            positions.push(v.x, v.y + 0.006, v.z);
          });
        });

        facetGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        facetGeom.computeVertexNormals();

        const facetOverlayMat = new THREE.MeshBasicMaterial({
          color: facetColorHex,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const facetMesh = new THREE.Mesh(facetGeom, facetOverlayMat);
        scene.add(facetMesh);
      });

      // Triangular Gable End Walls & Ridge Cap (Only rendered when pitch > 1° to properly support 0° Flat Roofs)
      if (tiltDeg > 1.0) {
        const gableMat = new THREE.MeshStandardMaterial({
          color: preset.gable,
          roughness: 0.75,
          metalness: 0.08,
          side: THREE.DoubleSide,
        });

        // Ridge cap + barge boards: the finishing details that make the roof read as "built"
        const capMat = new THREE.MeshStandardMaterial({
          color: roofMat.color.clone().multiplyScalar(0.82),
          roughness: 0.6,
        });
        const bargeMat = new THREE.MeshStandardMaterial({ color: preset.trim, roughness: 0.55 });
        const addBarge = (
          parent: THREE.Object3D,
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          z: number
        ) => {
          const len = Math.hypot(x2 - x1, y2 - y1);
          const board = rbox(len + 0.08, 0.16, 0.1, bargeMat, 0.02);
          board.position.set((x1 + x2) / 2, (y1 + y2) / 2 + 0.03, z);
          board.rotation.z = Math.atan2(y2 - y1, x2 - x1);
          parent.add(board);
        };
        if (isRidgeAlongZ) {
          const cap = rbox(0.3, 0.17, footprintD + overGable * 2, capMat, 0.06);
          cap.position.set(ridgeSceneX, ridgeHeight + 0.02, 0);
          scene.add(cap);
          [-footprintD * 0.485, footprintD * 0.485].forEach((gz) => {
            addBarge(scene, -footprintW * 0.48, eaveHeight, ridgeSceneX, ridgeHeight, gz);
            addBarge(scene, ridgeSceneX, ridgeHeight, footprintW * 0.48, eaveHeight, gz);
          });
        } else {
          const cap = rbox(footprintW + overGable * 2, 0.17, 0.3, capMat, 0.06);
          cap.position.set(0, ridgeHeight + 0.02, ridgeSceneZ);
          scene.add(cap);
          [-footprintW * 0.485, footprintW * 0.485].forEach((gx) => {
            const bg = new THREE.Group();
            bg.rotation.y = Math.PI / 2;
            bg.position.x = gx;
            addBarge(bg, -footprintD * 0.48, eaveHeight, ridgeSceneZ, ridgeHeight, 0);
            addBarge(bg, ridgeSceneZ, ridgeHeight, footprintD * 0.48, eaveHeight, 0);
            scene.add(bg);
          });
        }

        if (isRidgeAlongZ) {
          [-footprintD * 0.478, footprintD * 0.478].forEach((gz) => {
            const gableShape = new THREE.Shape();
            gableShape.moveTo(-footprintW * 0.48, eaveHeight);
            gableShape.lineTo(ridgeSceneX, ridgeHeight);
            gableShape.lineTo(footprintW * 0.48, eaveHeight);
            gableShape.closePath();

            const gableGeo = new THREE.ShapeGeometry(gableShape);
            const gableMesh = new THREE.Mesh(gableGeo, gableMat);
            gableMesh.position.z = gz;
            gableMesh.castShadow = true;
            gableMesh.receiveShadow = true;
            scene.add(gableMesh);
          });
        } else {
          [-footprintW * 0.478, footprintW * 0.478].forEach((gx) => {
            const gableShape = new THREE.Shape();
            gableShape.moveTo(-footprintD * 0.48, eaveHeight);
            gableShape.lineTo(ridgeSceneZ, ridgeHeight);
            gableShape.lineTo(footprintD * 0.48, eaveHeight);
            gableShape.closePath();

            const gableGeo = new THREE.ShapeGeometry(gableShape);
            const gableMesh = new THREE.Mesh(gableGeo, gableMat);
            gableMesh.rotation.y = Math.PI / 2;
            gableMesh.position.x = gx;
            gableMesh.castShadow = true;
            gableMesh.receiveShadow = true;
            scene.add(gableMesh);
          });
        }
      }

      // ---------------------------------------------------------
      // D. Realistic 3D Solar Panels with True Coplanar Alignment
      // ---------------------------------------------------------
      const panels = layout.panels || [];
      const pvCellTexture = createPVCellTexture();
      pvCellTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      
      const pvFrameMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Polished silver anodized aluminum frame
        metalness: 0.95,
        roughness: 0.22,
      });

      const pvGlassMat = new THREE.MeshPhysicalMaterial({
        map: pvCellTexture,
        roughness: 0.12,
        metalness: 0.85,
        reflectivity: 0.98,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      });

      const railMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.92,
        roughness: 0.35,
      });

      panels.forEach((p) => {
        const wm = p.w_m;
        const lm = p.h_m;
        const thickness = 0.04;

        // Exact panel center in 3D scene coordinates (synchronized metric space)
        const pCenterX = (p.x_m - centerX) + (wm / 2.0);
        const pCenterZ = (p.y_m - centerZ) + (lm / 2.0);

        let distFromRidge = 0;
        let expectedNormal: THREE.Vector3;
        let surfaceY = eaveHeight;

        if (isRidgeAlongZ) {
          const isWest = pCenterX < ridgeSceneX;
          const span = isWest ? leftSpan : rightSpan;
          const tilt = isWest ? leftTiltRad : rightTiltRad;
          const slopeDirX = isWest ? -1 : 1;
          distFromRidge = Math.abs(pCenterX - ridgeSceneX);
          expectedNormal = new THREE.Vector3(slopeDirX * Math.sin(tilt), Math.cos(tilt), 0).normalize();
          const planeY = ridgeHeight - (distFromRidge / span) * (ridgeHeight - eaveHeight);
          surfaceY = Math.max(eaveHeight, Math.min(planeY, ridgeHeight));
        } else {
          const isRear = pCenterZ < ridgeSceneZ;
          const span = isRear ? rearSpan : frontSpan;
          const tilt = isRear ? rearTiltRad : frontTiltRad;
          const slopeDirZ = isRear ? -1 : 1;
          distFromRidge = Math.abs(pCenterZ - ridgeSceneZ);
          expectedNormal = new THREE.Vector3(0, Math.cos(tilt), slopeDirZ * Math.sin(tilt)).normalize();
          const planeY = ridgeHeight - (distFromRidge / span) * (ridgeHeight - eaveHeight);
          surfaceY = Math.max(eaveHeight, Math.min(planeY, ridgeHeight));
        }

        const panelGroup = new THREE.Group();
        // Position panel cleanly above roof surface (+0.09m realistic mounting rail standoff)
        panelGroup.position.set(pCenterX, surfaceY + 0.09, pCenterZ);

        // Align panel normal vector to point flush with roof surface into the sky
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), expectedNormal);
        panelGroup.quaternion.copy(alignQuat);

        // Apply panel plane rotation (if layout packed with orientation angle)
        if (p.rotation_deg && Math.abs(p.rotation_deg) > 1.0) {
          panelGroup.rotateOnWorldAxis(expectedNormal, THREE.MathUtils.degToRad(-p.rotation_deg));
        }

        // Aluminum Outer Metallic Frame
        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(wm, thickness, lm), pvFrameMat);
        frameMesh.castShadow = true;
        panelGroup.add(frameMesh);

        // Anti-Reflective Monocrystalline Glass Wafer Surface
        const cellMesh = new THREE.Mesh(new THREE.BoxGeometry(wm * 0.965, 0.005, lm * 0.965), pvGlassMat);
        cellMesh.position.y = thickness / 2.0 + 0.003;
        cellMesh.castShadow = true;
        panelGroup.add(cellMesh);

        // Continuous Solar Mounting Rails (Underneath panels, 4.5cm above roof)
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(wm * 1.06, 0.03, 0.04), railMat);
        rail1.position.set(0, -0.03, -lm * 0.28);
        panelGroup.add(rail1);

        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(wm * 1.06, 0.03, 0.04), railMat);
        rail2.position.set(0, -0.03, lm * 0.28);
        panelGroup.add(rail2);

        // Metallic Standoff Feet (exactly touch roof surface at Y = -0.09)
        const standoffGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.09, 6);
        const standoffMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
        [[-wm * 0.4, -lm * 0.28], [wm * 0.4, -lm * 0.28], [-wm * 0.4, lm * 0.28], [wm * 0.4, lm * 0.28]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(standoffGeo, standoffMat);
          leg.position.set(lx, -0.045, lz);
          panelGroup.add(leg);
        });

        scene.add(panelGroup);
      });
    }

    // 8. Animation Render Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Responsive Window Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      savedViewRef.current = { pos: camera.position.clone(), target: controls.target.clone() };
      // Free GPU memory held by this scene before the next rebuild
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : mesh.material
          ? [mesh.material]
          : [];
        mats.forEach((m) => {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        });
      });
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      if (controls) {
        controls.dispose();
      }
    };
  }, [geometry, layout, activeRoofStyle, scenePreset, ridgeOrientationOverride, imageUrl, imageWidth, imageHeight]);

  // Camera Preset Views
  const setCameraView = (view: "top" | "iso" | "front" | "reset") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === "top") {
      camera.position.set(0, 32, 0.1);
      controls.target.set(0, 6, 0);
    } else if (view === "front") {
      camera.position.set(0, 8, 25);
      controls.target.set(0, 4.5, 0);
    } else if (view === "iso") {
      camera.position.set(19, 17, 21);
      controls.target.set(0, 4.5, 0);
    } else {
      camera.position.set(18, 19, 23);
      controls.target.set(0, 4.2, 0);
    }
    controls.update();
  };

  const handleExportSnapshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const dataUrl = renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `SolarReady-3D-Twin-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  const formatHour = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h > 12 ? h - 12 : h;
    const displayM = m < 10 ? `0${m}` : `${m}`;
    return `${displayH}:${displayM} ${period}`;
  };

  if (webglError) {
    return (
      <div className="relative w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4 select-none">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-base font-bold text-white tracking-tight">
            Hardware Acceleration Required for 3D View
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your browser could not initialize a 3D WebGL context ({webglError}). This typically occurs when graphics hardware acceleration is disabled in your browser settings.
          </p>
        </div>

        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-left text-xs text-slate-300 space-y-2 max-w-md w-full shadow-2xl">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5">
            <Info className="w-4 h-4" /> How to enable 3D in 10 seconds:
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] pl-1">
            <li>Open your browser settings: <code className="text-amber-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono">chrome://settings/system</code></li>
            <li>Toggle ON <strong>&quot;Use graphics acceleration when available&quot;</strong></li>
            <li>Click <strong>Relaunch</strong> to restart the browser</li>
          </ol>
        </div>

        {onSwitchTo2D && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onSwitchTo2D}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Eye className="w-4 h-4" />
              <span>Switch to 2D Realistic / CAD Mode</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {scenePreset !== "engineering" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 58%, rgba(30,24,20,0.22) 100%)",
          }}
        />
      )}

      {/* Top-Right HUD: Camera Presets & Aesthetics Customizer */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl" role="toolbar" aria-label="3D Camera Controls">
          <button
            type="button"
            onClick={() => setCameraView("top")}
            aria-label="Bird's eye top-down camera view"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Bird's Eye Top-Down"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => setCameraView("iso")}
            aria-label="Isometric 45 degree perspective camera view"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Isometric Perspective"
          >
            45° Iso
          </button>
          <button
            type="button"
            onClick={() => setCameraView("front")}
            aria-label="Front street elevation camera view"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Front Elevation"
          >
            Street
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            aria-pressed={autoRotate}
            aria-label="Toggle 360 degree turntable auto-rotation"
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              autoRotate ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="Toggle 360° Auto-Turntable"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setCameraView("reset")}
            aria-label="Reset 3D camera to default position"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Camera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleExportSnapshot}
            aria-label="Capture high-resolution 3D screenshot"
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-800/60 transition-colors cursor-pointer"
            title="Export 3D Render Snapshot (.png)"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scene Style Presets */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-500 font-semibold mr-1">Scene:</span>
          {(Object.keys(SCENE_PRESETS) as ScenePresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setScenePreset(key);
                if (!imageUrl) {
                  setActiveRoofStyle(SCENE_PRESETS[key].defaultRoof);
                }
              }}
              aria-pressed={scenePreset === key}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                scenePreset === key ? "bg-slate-700 text-white" : "hover:text-slate-200"
              }`}
            >
              {SCENE_PRESETS[key].label}
            </button>
          ))}
        </div>

        {/* Roof Material / Aerial Texture Toggle */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-500 font-semibold mr-1">Roof:</span>
          {imageUrl && (
            <button
              type="button"
              onClick={() => setActiveRoofStyle("aerial")}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                activeRoofStyle === "aerial" ? "bg-cyan-600 text-white shadow-sm" : "hover:text-slate-200"
              }`}
            >
              📷 Aerial Photo
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveRoofStyle("terracotta")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              activeRoofStyle === "terracotta" ? "bg-amber-800 text-amber-200" : "hover:text-slate-200"
            }`}
          >
            🧱 Terracotta
          </button>
          <button
            type="button"
            onClick={() => setActiveRoofStyle("charcoal")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              activeRoofStyle === "charcoal" ? "bg-slate-700 text-white" : "hover:text-slate-200"
            }`}
          >
            ⬛ Slate Grey
          </button>
        </div>

        {/* Roof Ridge Orientation Control */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-500 font-semibold mr-1">Ridge:</span>
          <button
            type="button"
            onClick={() => setRidgeOrientationOverride("ew")}
            title="Ridge runs Left-to-Right (East-West), slopes to Front & Rear"
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              ridgeOrientationOverride === "ew" || ridgeOrientationOverride === "auto"
                ? "bg-sky-600 text-white"
                : "hover:text-slate-200"
            }`}
          >
            ↔️ E-W (Horizontal)
          </button>
          <button
            type="button"
            onClick={() => setRidgeOrientationOverride("ns")}
            title="Ridge runs Front-to-Back (North-South), slopes to Left & Right"
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              ridgeOrientationOverride === "ns"
                ? "bg-sky-600 text-white"
                : "hover:text-slate-200"
            }`}
          >
            ↕️ N-S (Vertical)
          </button>
        </div>

        {/* True North & Solar Alignment Badge */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-300">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-slate-400">North:</span>
          <span className="font-mono text-cyan-300 font-bold">
            {geometry.canvas_rotation_deg ? `${geometry.canvas_rotation_deg > 0 ? `+${geometry.canvas_rotation_deg}°` : `${geometry.canvas_rotation_deg}°`}` : "0° (True North)"}
          </span>
        </div>
      </div>

      {/* Bottom Floating Bar: Malaysian Sun Path, 1-Day Playback & Dynamic Generation Simulator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-2xl bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col gap-2.5">
        {/* Real-time Solar Generation Dashboard Strip */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-center">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              Instant Power
            </span>
            <span className="font-mono text-sm font-extrabold text-amber-400">
              {genMetrics.instantKW.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">kW</span>
            </span>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <Sun className="w-3 h-3 text-emerald-400" />
              Day Energy Yield
            </span>
            <span className="font-mono text-sm font-extrabold text-emerald-400">
              {genMetrics.cumulativeKWh.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">kWh</span>
            </span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 font-semibold" title="Estimated single-day savings. Full 365-day annual savings (~RM 2,800/yr) detailed in Step 4 Report">
              Today's Savings (今日预估)
            </span>
            <span className="font-mono text-sm font-extrabold text-cyan-400">
              RM {genMetrics.savingsRM.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ day</span>
            </span>
          </div>
        </div>

        {/* Playback Controls & Sun Timeline Slider */}
        <div className="flex items-center gap-2.5">
          {/* Play / Pause 1-Day Simulation Button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0 ${
              isPlaying
                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-300"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title={isPlaying ? "Pause Sun Simulation" : "Play 1-Day Solar Simulation"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            <span className="text-[11px] font-bold">{isPlaying ? "Pause" : "Play 1-Day"}</span>
          </button>

          {/* Speed Toggle (1x / 2x / 4x) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] shrink-0">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaySpeed(spd)}
                className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                  playSpeed === spd
                    ? "bg-slate-800 text-amber-400 border border-amber-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Sun Time Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">8 AM</span>
            <input
              type="range"
              min="8.0"
              max="18.0"
              step="0.1"
              value={timeOfDay}
              onChange={(e) => {
                setTimeOfDay(parseFloat(e.target.value));
                if (isPlaying) setIsPlaying(false);
              }}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">6 PM</span>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-1.5 text-white font-mono font-bold bg-slate-950 px-2 py-1 rounded-md border border-slate-800 text-xs shrink-0">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatHour(timeOfDay)}</span>
          </div>
        </div>

        {/* Bottom Status Info Strip */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span>
              Installed: <strong className="text-white font-mono">{layout.panel_count} modules</strong> ({layout.capacity_kwp} kWp)
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-amber-400/90 font-mono">
              Solar Irradiance: {genMetrics.currentIrradiance} W/m²
            </span>
          </div>
          <span className="text-slate-500 italic hidden sm:inline">
            Left Click: Orbit 360° | Right Click: Pan | Scroll: Zoom
          </span>
        </div>
      </div>
    </div>
  );
}
