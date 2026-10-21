"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
} from "lucide-react";
import { RoofGeometry, LayoutResponse } from "@/lib/types";

interface Roof3DViewerProps {
  geometry: RoofGeometry;
  layout: LayoutResponse;
  imageUrl?: string;
}

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
  ctx.fillStyle = "#07111e";
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
      grad.addColorStop(0, "#0c1f38");
      grad.addColorStop(0.5, "#081526");
      grad.addColorStop(1, "#050e1b");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cellW, cellH);

      // Monocrystalline chamfered / beveled cell corners
      ctx.fillStyle = "#07111e";
      const cut = 5;
      // top-left
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cut, y); ctx.lineTo(x, y + cut); ctx.fill();
      // top-right
      ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW - cut, y); ctx.lineTo(x + cellW, y + cut); ctx.fill();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + cut, y + cellH); ctx.lineTo(x, y + cellH - cut); ctx.fill();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(x + cellW, y + cellH); ctx.lineTo(x + cellW - cut, y + cellH); ctx.lineTo(x + cellW, y + cellH - cut); ctx.fill();

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

  // Base charcoal slate tile tone
  ctx.fillStyle = "#222c3d";
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const rowH = 512 / rows;
  for (let i = 0; i < rows; i++) {
    const y = i * rowH;
    // Overlapping tile cast shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, y, 512, 4);
    // Sunlit top edge highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, y + 4, 512, 2);

    // Staggered vertical tile grooves
    ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Modern Driveway Interlocking Paver Texture */
function createDrivewayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 16) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    const offset = (Math.floor(y / 16) % 2) * 16;
    for (let x = offset; x < 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

export default function Roof3DViewer({
  geometry,
  layout,
  imageUrl,
}: Roof3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Time of day: 8.0 (8am) to 18.0 (6pm), default 11.5 (11:30am)
  const [timeOfDay, setTimeOfDay] = useState<number>(11.5);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeRoofStyle, setActiveRoofStyle] = useState<"charcoal" | "terracotta">("charcoal");
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
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.010);

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 300);
    cameraRef.current = camera;
    camera.position.set(18, 19, 23);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
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

    // 5. Lighting
    // Ambient / Hemisphere light (tropical clear sky + ground warm bounce)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.05);
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
    const lawnGeo = new THREE.PlaneGeometry(80, 80);
    const lawnMat = new THREE.MeshStandardMaterial({
      color: 0x14532d, // Tropical lush emerald lawn
      roughness: 0.85,
      metalness: 0.05,
    });
    const lawn = new THREE.Mesh(lawnGeo, lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.01;
    lawn.receiveShadow = true;
    scene.add(lawn);

    // Subtle Ground Grid
    const grid = new THREE.GridHelper(60, 60, 0x0284c7, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

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

    if (allPtsM.length >= 3) {
      const xs = allPtsM.map((p) => p[0]);
      const zs = allPtsM.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const centerX = (minX + maxX) / 2.0;
      const centerZ = (minZ + maxZ) / 2.0;

      const footprintW = Math.max(maxX - minX, 6.0);
      const footprintD = Math.max(maxZ - minZ, 6.0);

      // Heights in meters for typical Malaysian 2-storey terrace house (e.g. Elmina West)
      const eaveHeight = 5.8;
      const groundFloorH = 3.0;
      const tiltDeg = geometry.tilt_deg || 15.0;
      const tiltRad = (tiltDeg * Math.PI) / 180.0;

      // ---------------------------------------------------------
      // A. Main House Facade (Contemporary Two-Tone Render)
      // ---------------------------------------------------------
      // Ground Floor Wall: Warm Off-White Stucco
      const lowerWallMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.8,
        metalness: 0.05,
      });
      const lowerWallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 0.96, groundFloorH, footprintD * 0.96),
        lowerWallMat
      );
      lowerWallMesh.position.set(0, groundFloorH / 2.0, 0);
      lowerWallMesh.castShadow = true;
      lowerWallMesh.receiveShadow = true;
      scene.add(lowerWallMesh);

      // Upper Floor Wall: Contemporary Slate-Trimmed Accent
      const upperWallMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.75,
        metalness: 0.08,
      });
      const upperWallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 0.96, eaveHeight - groundFloorH, footprintD * 0.96),
        upperWallMat
      );
      upperWallMesh.position.set(0, groundFloorH + (eaveHeight - groundFloorH) / 2.0, 0);
      upperWallMesh.castShadow = true;
      upperWallMesh.receiveShadow = true;
      scene.add(upperWallMesh);

      // Contemporary Charcoal Feature Accent Band
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const bandMesh = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 0.97, 0.15, footprintD * 0.97),
        bandMat
      );
      bandMesh.position.set(0, groundFloorH, 0);
      scene.add(bandMesh);

      // Foundation Concrete Plinth
      const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const plinthMesh = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 1.04, 0.35, footprintD * 1.04),
        plinthMat
      );
      plinthMesh.position.set(0, 0.175, 0);
      plinthMesh.receiveShadow = true;
      scene.add(plinthMesh);

      // ---------------------------------------------------------
      // B. Architectural Windows & Entrance Details
      // ---------------------------------------------------------
      const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
      const windowGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.9,
        transmission: 0.6,
        transparent: true,
        opacity: 0.85,
        reflectivity: 0.95,
      });

      // Front Ribbon Windows (Upper Floor Bedroom)
      const winW = footprintW * 0.32;
      const winH = 1.3;
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.1), windowFrameMat);
      winFrame.position.set(-footprintW * 0.2, groundFloorH + 1.2, footprintD * 0.485);
      scene.add(winFrame);

      const winGlass = new THREE.Mesh(new THREE.BoxGeometry(winW * 0.92, winH * 0.88, 0.05), windowGlassMat);
      winGlass.position.set(-footprintW * 0.2, groundFloorH + 1.2, footprintD * 0.49);
      scene.add(winGlass);

      // Upper Floor Twin Window
      const winFrame2 = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.1), windowFrameMat);
      winFrame2.position.set(footprintW * 0.2, groundFloorH + 1.2, footprintD * 0.485);
      scene.add(winFrame2);

      const winGlass2 = new THREE.Mesh(new THREE.BoxGeometry(winW * 0.92, winH * 0.88, 0.05), windowGlassMat);
      winGlass2.position.set(footprintW * 0.2, groundFloorH + 1.2, footprintD * 0.49);
      scene.add(winGlass2);

      // Front Car Porch Driveway (Interlocking Paver Court)
      const driveMat = new THREE.MeshStandardMaterial({
        map: createDrivewayTexture(),
        roughness: 0.8,
      });
      const driveMesh = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 0.9, 0.08, footprintD * 0.45),
        driveMat
      );
      driveMesh.position.set(0, 0.04, footprintD * 0.68);
      driveMesh.receiveShadow = true;
      scene.add(driveMesh);

      // Modern Entrance Porch Awning / Canopy
      const porchRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 });
      const porchCanopy = new THREE.Mesh(
        new THREE.BoxGeometry(footprintW * 0.55, 0.18, 2.6),
        porchRoofMat
      );
      porchCanopy.position.set(0, groundFloorH * 0.95, footprintD * 0.55);
      porchCanopy.castShadow = true;
      porchCanopy.receiveShadow = true;
      scene.add(porchCanopy);

      // Porch Slim Architectural Pillars
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const pillarGeo = new THREE.BoxGeometry(0.12, groundFloorH * 0.95, 0.12);
      const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
      pillarL.position.set(-footprintW * 0.24, groundFloorH * 0.475, footprintD * 0.66);
      pillarL.castShadow = true;
      scene.add(pillarL);

      const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
      pillarR.position.set(footprintW * 0.24, groundFloorH * 0.475, footprintD * 0.66);
      pillarR.castShadow = true;
      scene.add(pillarR);

      // ---------------------------------------------------------
      // C. Pitched Roof Facet Meshes with Interlocking Concrete Tiles
      // ---------------------------------------------------------
      const tileTexture = createRoofTileTexture();
      const roofMat = new THREE.MeshStandardMaterial({
        color: activeRoofStyle === "charcoal" ? 0x273244 : 0x8a3822,
        map: tileTexture,
        roughness: 0.62,
        metalness: 0.12,
        side: THREE.DoubleSide,
      });

      // Eaves Rain Gutters (Charcoal Zinc Profile)
      const gutterMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });

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

      // Detect roof orientation: whether ridge runs along X (sloping North/South) or along Z (sloping East/West)
      const facetCentroidsX = rawPolys.map((poly) =>
        poly.reduce((sum, pt) => sum + pt[0] * mPerPx, 0) / (poly.length || 1)
      );
      const facetCentroidsZ = rawPolys.map((poly) =>
        poly.reduce((sum, pt) => sum + pt[1] * mPerPx, 0) / (poly.length || 1)
      );

      const spanCentroidsX = rawPolys.length >= 2
        ? Math.max(...facetCentroidsX) - Math.min(...facetCentroidsX)
        : 0;
      const spanCentroidsZ = rawPolys.length >= 2
        ? Math.max(...facetCentroidsZ) - Math.min(...facetCentroidsZ)
        : 0;

      // When the facets are separated more along X than Z, the ridge runs along Z (North-South) and roof slopes East-West
      const isRidgeAlongZ = spanCentroidsX > spanCentroidsZ * 1.15;

      // Calculate realistic Gable Roof Ridge Height and True Ridge Position
      let trueRidgeZ = centerZ;
      let trueRidgeX = centerX;

      if (isRidgeAlongZ) {
        if (rawPolys.length >= 2) {
          let minCIdx = 0;
          let maxCIdx = 0;
          for (let i = 1; i < facetCentroidsX.length; i++) {
            if (facetCentroidsX[i] < facetCentroidsX[minCIdx]) minCIdx = i;
            if (facetCentroidsX[i] > facetCentroidsX[maxCIdx]) maxCIdx = i;
          }
          if (minCIdx !== maxCIdx) {
            const leftXs = rawPolys[minCIdx].map((pt) => pt[0] * mPerPx);
            const rightXs = rawPolys[maxCIdx].map((pt) => pt[0] * mPerPx);
            trueRidgeX = (Math.max(...leftXs) + Math.min(...rightXs)) / 2.0;
          }
        }
      } else {
        if (rawPolys.length >= 2) {
          let minCIdx = 0;
          let maxCIdx = 0;
          for (let i = 1; i < facetCentroidsZ.length; i++) {
            if (facetCentroidsZ[i] < facetCentroidsZ[minCIdx]) minCIdx = i;
            if (facetCentroidsZ[i] > facetCentroidsZ[maxCIdx]) maxCIdx = i;
          }
          if (minCIdx !== maxCIdx) {
            const rearZs = rawPolys[minCIdx].map((pt) => pt[1] * mPerPx);
            const frontZs = rawPolys[maxCIdx].map((pt) => pt[1] * mPerPx);
            trueRidgeZ = (Math.max(...rearZs) + Math.min(...frontZs)) / 2.0;
          }
        }
      }

      const ridgeSceneX = trueRidgeX - centerX;
      const ridgeSceneZ = trueRidgeZ - centerZ;

      const slopeDepth = Math.max(trueRidgeZ - minZ, maxZ - trueRidgeZ, footprintD / 2.0);
      const slopeWidth = Math.max(trueRidgeX - minX, maxX - trueRidgeX, footprintW / 2.0);
      const slopeSpan = isRidgeAlongZ ? slopeWidth : slopeDepth;
      const ridgeHeight = eaveHeight + slopeSpan * Math.tan(tiltRad);

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

      // Reconstruct each 3D Pitched Facet Mesh using True Mathematical Planar Slope
      const facetMeshes: THREE.Mesh[] = [];

      rawPolys.forEach((polyPx, polyIdx) => {
        if (polyPx.length < 3) return;

        let isNegativeSide = false;
        if (isRidgeAlongZ) {
          const facetCenterX =
            polyPx.reduce((sum, pt) => sum + (pt[0] * mPerPx - centerX), 0) / polyPx.length;
          isNegativeSide = facetCenterX < ridgeSceneX;
        } else {
          const facetCenterZ =
            polyPx.reduce((sum, pt) => sum + (pt[1] * mPerPx - centerZ), 0) / polyPx.length;
          isNegativeSide = facetCenterZ < ridgeSceneZ;
        }

        const pts3D = polyPx.map((pt) => {
          const xm = pt[0] * mPerPx - centerX;
          const zm = pt[1] * mPerPx - centerZ;

          let distFromRidge = 0;
          if (isRidgeAlongZ) {
            distFromRidge = isNegativeSide
              ? Math.max(0, ridgeSceneX - xm)
              : Math.max(0, xm - ridgeSceneX);
          } else {
            distFromRidge = isNegativeSide
              ? Math.max(0, ridgeSceneZ - zm)
              : Math.max(0, zm - ridgeSceneZ);
          }
          let ym = ridgeHeight - distFromRidge * Math.tan(tiltRad);
          ym = Math.max(eaveHeight, Math.min(ym, ridgeHeight));
          return new THREE.Vector3(xm, ym, zm);
        });

        // Triangulate 3D polygon
        const shape2D = polyPx.map((p) => new THREE.Vector2(p[0] * mPerPx, p[1] * mPerPx));
        const triangles = THREE.ShapeUtils.triangulateShape(shape2D, []);

        const geom = new THREE.BufferGeometry();
        const positions: number[] = [];
        const uvs: number[] = [];

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
            positions.push(v.x, v.y, v.z);
            uvs.push((v.x + 20) / 10.0, (v.z + 20) / 10.0);
          });
        });

        geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geom.computeVertexNormals();

        const facetMesh = new THREE.Mesh(geom, roofMat);
        facetMesh.castShadow = true;
        facetMesh.receiveShadow = true;
        scene.add(facetMesh);
        facetMeshes.push(facetMesh);

        // Distinct Facet Color Edge Wireframe (matches Step 2 Plane 1-4)
        const edges = new THREE.EdgesGeometry(geom, 12);
        const facetColorHex = FACET_PALETTE_HEX[polyIdx % FACET_PALETTE_HEX.length];
        const lineMat = new THREE.LineBasicMaterial({
          color: facetColorHex,
          linewidth: 2.5,
          transparent: true,
          opacity: 0.9,
        });
        const edgeLines = new THREE.LineSegments(edges, lineMat);
        scene.add(edgeLines);
      });

      // Triangular Gable End Walls
      const gableMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.75,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });

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

      // ---------------------------------------------------------
      // D. Realistic 3D Solar Panels with True Coplanar Alignment
      // ---------------------------------------------------------
      const panels = layout.panels || [];
      const pvCellTexture = createPVCellTexture();
      
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

        if (isRidgeAlongZ) {
          const isWest = pCenterX < ridgeSceneX;
          const slopeDirX = isWest ? -1 : 1;
          distFromRidge = Math.abs(pCenterX - ridgeSceneX);
          expectedNormal = new THREE.Vector3(slopeDirX * Math.sin(tiltRad), Math.cos(tiltRad), 0).normalize();
        } else {
          const isRear = pCenterZ < ridgeSceneZ;
          const slopeDirZ = isRear ? -1 : 1;
          distFromRidge = Math.abs(pCenterZ - ridgeSceneZ);
          expectedNormal = new THREE.Vector3(0, Math.cos(tiltRad), slopeDirZ * Math.sin(tiltRad)).normalize();
        }

        const planeY = ridgeHeight - distFromRidge * Math.tan(tiltRad);
        const surfaceY = Math.max(eaveHeight, Math.min(planeY, ridgeHeight));

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
      renderer.dispose();
      controls.dispose();
    };
  }, [geometry, layout, activeRoofStyle]);

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

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

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

        {/* Roof Material Tone Toggle */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-500 font-semibold mr-1">Roof Tile:</span>
          <button
            type="button"
            onClick={() => setActiveRoofStyle("charcoal")}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeRoofStyle === "charcoal" ? "bg-slate-700 text-white" : "hover:text-slate-200"
            }`}
          >
            Charcoal Slate
          </button>
          <button
            type="button"
            onClick={() => setActiveRoofStyle("terracotta")}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeRoofStyle === "terracotta" ? "bg-amber-800 text-amber-200" : "hover:text-slate-200"
            }`}
          >
            Terracotta
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
