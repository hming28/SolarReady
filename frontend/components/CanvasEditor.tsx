"use client";

import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group, Text } from "react-konva";
import useImage from "@/lib/useImage";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Undo, 
  Redo, 
  Trash2, 
  Sparkles,
  Scissors,
  Wand2,
  Zap,
  MousePointer,
  ShieldAlert,
  ChevronDown,
  Ruler,
  Crop,
  Check,
  X,
  RotateCw,
  Compass,
  Grid,
} from "lucide-react";
import { RoofGeometry, Obstacle } from "@/lib/types";

export type EditorTool = "select" | "sam2" | "knife" | "ruler" | "crop" | "rotate";

interface CanvasEditorProps {
  imageUrl: string;
  geometry: RoofGeometry;
  onChange: (newGeometry: RoofGeometry) => void;
  onOpenScaleModal: (p1: [number, number], p2: [number, number], distPx: number) => void;
  onGeminiDetect?: () => Promise<void>;
  isGeminiLoading?: boolean;
  onSam2Click?: (x: number, y: number) => Promise<void>;
  isSam2Loading?: boolean;
  onCutLine?: (p1: [number, number], p2: [number, number]) => Promise<void>;
  isCutting?: boolean;
  onCropImage?: (box: [number, number, number, number]) => Promise<void>;
  isCropping?: boolean;
  onRotateImage?: (angleDeg: number) => Promise<void>;
  isRotating?: boolean;
}

export default function CanvasEditor({
  imageUrl,
  geometry,
  onChange,
  onOpenScaleModal,
  onGeminiDetect,
  isGeminiLoading = false,
  onSam2Click,
  isSam2Loading = false,
  onCutLine,
  isCutting = false,
  onCropImage,
  isCropping = false,
  onRotateImage,
  isRotating = false,
}: CanvasEditorProps) {
  const [image, imageStatus] = useImage(imageUrl, "anonymous");
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 1000, height: 650 });

  // Canvas Viewport transform
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  // Tool state: "select" (natural pan & vertex drag), "sam2" (smart trace), "knife" (slice)
  const [activeTool, setActiveTool] = useState<EditorTool>("select");

  // User custom Cut Line state
  const [knifeStart, setKnifeStart] = useState<[number, number] | null>(null);
  const [knifePointer, setKnifePointer] = useState<[number, number] | null>(null);

  // User custom Scale Ruler state
  const [rulerStart, setRulerStart] = useState<[number, number] | null>(null);
  const [rulerPointer, setRulerPointer] = useState<[number, number] | null>(null);

  // User Crop Bounding Box state
  const [cropStart, setCropStart] = useState<[number, number] | null>(null);
  const [cropPointer, setCropPointer] = useState<[number, number] | null>(null);
  const [pendingCropBox, setPendingCropBox] = useState<[number, number, number, number] | null>(null);

  // User Rotate / Level State
  const [rotateAngle, setRotateAngle] = useState<number>(0);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);

  // Satellite view clarity & high-pass contrast filter
  const [crispFilter, setCrispFilter] = useState(true);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<RoofGeometry[]>([geometry]);
  const [historyStep, setHistoryStep] = useState(0);

  // Dynamic responsive canvas sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setStageDimensions({ width: w, height: h });
        }
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    const ro = new ResizeObserver(updateDimensions);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      ro.disconnect();
    };
  }, []);

  const pushHistory = (newGeom: RoofGeometry) => {
    const nextHistory = history.slice(0, historyStep + 1);
    nextHistory.push(newGeom);
    if (nextHistory.length > 25) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryStep(nextHistory.length - 1);
    onChange(newGeom);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      onChange(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      onChange(history[nextStep]);
    }
  };

  // Auto-fit image on initial load or container resize
  useEffect(() => {
    if (image && stageDimensions.width > 0 && stageDimensions.height > 0) {
      const stageW = stageDimensions.width;
      const stageH = stageDimensions.height;

      const scaleX = (stageW * 0.92) / image.width;
      const scaleY = (stageH * 0.92) / image.height;
      const initialScale = Math.min(scaleX, scaleY, 1.2);

      const posX = (stageW - image.width * initialScale) / 2;
      const posY = (stageH - image.height * initialScale) / 2;

      setStageScale(initialScale);
      setStagePosition({ x: posX, y: posY });
    }
  }, [image, stageDimensions.width, stageDimensions.height]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.12;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(newScale, 5.0));

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const handleZoom = (direction: "in" | "out" | "reset") => {
    if (direction === "reset") {
      if (image && stageDimensions.width > 0) {
        const scaleX = (stageDimensions.width * 0.92) / image.width;
        const scaleY = (stageDimensions.height * 0.92) / image.height;
        const s = Math.min(scaleX, scaleY, 1.2);
        setStageScale(s);
        setStagePosition({
          x: (stageDimensions.width - image.width * s) / 2,
          y: (stageDimensions.height - image.height * s) / 2,
        });
      }
      return;
    }

    const factor = direction === "in" ? 1.2 : 0.8;
    setStageScale((prev) => Math.max(0.2, Math.min(prev * factor, 5.0)));
  };

  // Stage pointer click
  const handleStageClick = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const imageCoords: [number, number] = [
      Math.round((pointer.x - stagePosition.x) / stageScale),
      Math.round((pointer.y - stagePosition.y) / stageScale),
    ];

    // Prevent clicking outside image boundary
    if (
      image &&
      (imageCoords[0] < 0 ||
        imageCoords[0] > image.width ||
        imageCoords[1] < 0 ||
        imageCoords[1] > image.height)
    ) {
      return;
    }

    if (activeTool === "sam2") {
      if (onSam2Click) {
        onSam2Click(imageCoords[0], imageCoords[1]);
      }
      return;
    }

    if (activeTool === "knife") {
      if (!knifeStart) {
        setKnifeStart(imageCoords);
        setKnifePointer(imageCoords);
      } else {
        if (onCutLine) {
          onCutLine(knifeStart, imageCoords);
        }
        setKnifeStart(null);
        setKnifePointer(null);
      }
      return;
    }

    if (activeTool === "ruler") {
      if (!rulerStart) {
        setRulerStart(imageCoords);
        setRulerPointer(imageCoords);
      } else {
        const distPx = Math.hypot(imageCoords[0] - rulerStart[0], imageCoords[1] - rulerStart[1]);
        if (distPx > 2) {
          onOpenScaleModal(rulerStart, imageCoords, distPx);
        }
        setRulerStart(null);
        setRulerPointer(null);
        setActiveTool("select");
      }
      return;
    }

    if (activeTool === "crop") {
      if (!cropStart) {
        setCropStart(imageCoords);
        setCropPointer(imageCoords);
        setPendingCropBox(null);
      } else {
        const x1 = Math.min(cropStart[0], imageCoords[0]);
        const x2 = Math.max(cropStart[0], imageCoords[0]);
        const y1 = Math.min(cropStart[1], imageCoords[1]);
        const y2 = Math.max(cropStart[1], imageCoords[1]);
        if (x2 - x1 >= 30 && y2 - y1 >= 30) {
          setPendingCropBox([x1, y1, x2, y2]);
        }
        setCropStart(null);
        setCropPointer(null);
      }
      return;
    }
  };

  const handleStageMouseDown = (e: any) => {
    if (activeTool !== "crop") return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const imageCoords: [number, number] = [
      Math.round((pointer.x - stagePosition.x) / stageScale),
      Math.round((pointer.y - stagePosition.y) / stageScale),
    ];
    setCropStart(imageCoords);
    setCropPointer(imageCoords);
    setPendingCropBox(null);
  };

  const handleStageMouseUp = () => {
    if (activeTool !== "crop") return;
    if (cropStart && cropPointer) {
      const x1 = Math.min(cropStart[0], cropPointer[0]);
      const x2 = Math.max(cropStart[0], cropPointer[0]);
      const y1 = Math.min(cropStart[1], cropPointer[1]);
      const y2 = Math.max(cropStart[1], cropPointer[1]);
      if (x2 - x1 >= 30 && y2 - y1 >= 30) {
        setPendingCropBox([x1, y1, x2, y2]);
      }
      setCropStart(null);
      setCropPointer(null);
    }
  };

  const handleStageMouseMove = (e: any) => {
    const isTracingKnife = activeTool === "knife" && knifeStart;
    const isTracingRuler = activeTool === "ruler" && rulerStart;
    const isTracingCrop = activeTool === "crop" && cropStart;
    if (!isTracingKnife && !isTracingRuler && !isTracingCrop) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const imageCoords: [number, number] = [
      Math.round((pointer.x - stagePosition.x) / stageScale),
      Math.round((pointer.y - stagePosition.y) / stageScale),
    ];
    if (isTracingKnife) {
      setKnifePointer(imageCoords);
    } else if (isTracingRuler) {
      setRulerPointer(imageCoords);
    } else if (isTracingCrop) {
      setCropPointer(imageCoords);
    }
  };

  // Vertex Dragging
  const handleVertexDragMove = (
    polyIdx: number,
    ptIdx: number,
    e: any
  ) => {
    const newX = Math.round(e.target.x());
    const newY = Math.round(e.target.y());

    const updated = geometry.roof_polygons_px.map((poly, pIdx) => {
      if (pIdx !== polyIdx) return poly;
      return poly.map((pt, i) => (i === ptIdx ? ([newX, newY] as [number, number]) : pt));
    });
    onChange({ ...geometry, roof_polygons_px: updated });
  };

  const handleVertexDragEnd = () => {
    pushHistory(geometry);
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all roof polygons?")) {
      pushHistory({
        ...geometry,
        roof_polygons_px: [],
        obstacles: [],
      });
      setKnifeStart(null);
      setKnifePointer(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 select-none">
      {/* Top Streamlined Canvas Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-white">
        {/* Core Tool Modes & AI Actions */}
        <div className="flex items-center gap-2">
          {/* 1. AI Auto-Detect (Primary 1-Click Action) */}
          {onGeminiDetect && (
            <button
              type="button"
              onClick={onGeminiDetect}
              disabled={isGeminiLoading}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              title="Run AI Vision to auto-detect 3D roof topology, ridges & watertight facets"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeminiLoading ? "animate-spin" : ""}`} />
              <span>{isGeminiLoading ? "Analyzing Roof..." : "AI Auto-Detect"}</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-800" />

          {/* Tool mode selector */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80" role="toolbar" aria-label="Drawing and editing tools">
            <button
              type="button"
              onClick={() => {
                setActiveTool("select");
                setKnifeStart(null);
                setKnifePointer(null);
                setRulerStart(null);
                setRulerPointer(null);
              }}
              aria-pressed={activeTool === "select"}
              aria-label="Select and pan mode"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "select"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
              title="Select & Pan Mode: Drag canvas to navigate or drag white vertex handles to fine-tune shape"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select & Pan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("sam2");
                setKnifeStart(null);
                setKnifePointer(null);
                setRulerStart(null);
                setRulerPointer(null);
              }}
              aria-pressed={activeTool === "sam2"}
              aria-label="Meta SAM 2 smart segmentation tool"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "sam2"
                  ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/50"
                  : "text-purple-300 hover:text-white hover:bg-purple-950/60"
              }`}
              title="Meta SAM 2 Smart Click: Click any roof pitch to trace its exact facet boundary"
            >
              <Wand2 className={`w-3.5 h-3.5 stroke-[2.2] ${isSam2Loading ? "animate-spin" : ""}`} />
              <span>{isSam2Loading ? "SAM 2..." : "SAM 2 Click"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("knife");
                setKnifeStart(null);
                setKnifePointer(null);
                setRulerStart(null);
                setRulerPointer(null);
              }}
              aria-pressed={activeTool === "knife"}
              aria-label="Draw cut line to split roof facets"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "knife"
                  ? "bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/50"
                  : "text-amber-300 hover:text-white hover:bg-amber-950/60"
              }`}
              title="Draw Cut Line: Click two points across a roof ridge to split a polygon into 2 separate slope facets"
            >
              <Scissors className={`w-3.5 h-3.5 stroke-[2.2] ${isCutting ? "animate-spin" : ""}`} />
              <span>{isCutting ? "Cutting..." : "Draw Cut Line"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("ruler");
                setKnifeStart(null);
                setKnifePointer(null);
                setRulerStart(null);
                setRulerPointer(null);
              }}
              aria-pressed={activeTool === "ruler"}
              aria-label="Scale calibration ruler tool"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "ruler"
                  ? "bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-400/50"
                  : "text-cyan-300 hover:text-white hover:bg-cyan-950/60"
              }`}
              title="Scale Calibration Ruler: Click two points across a known distance (e.g. Google Maps 5m scale bar) to calibrate real-world dimensions"
            >
              <Ruler className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Ruler Tool</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("crop");
                setKnifeStart(null);
                setKnifePointer(null);
                setRulerStart(null);
                setRulerPointer(null);
                setPendingCropBox(null);
              }}
              aria-pressed={activeTool === "crop"}
              aria-label="Crop to single target house"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "crop"
                  ? "bg-sky-600 text-white shadow-sm ring-2 ring-sky-400/50"
                  : "text-sky-300 hover:text-white hover:bg-sky-950/60"
              }`}
              title="Crop to Single House: Drag a rectangle around the target house to isolate it for AI, keeping your calibrated scale intact"
            >
              <Crop className={`w-3.5 h-3.5 stroke-[2.2] ${isCropping ? "animate-spin" : ""}`} />
              <span>{isCropping ? "Cropping..." : "Crop Tool"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTool === "rotate") {
                  setActiveTool("select");
                  setRotateAngle(0);
                } else {
                  setActiveTool("rotate");
                  setKnifeStart(null);
                  setKnifePointer(null);
                  setRulerStart(null);
                  setRulerPointer(null);
                  setPendingCropBox(null);
                }
              }}
              aria-pressed={activeTool === "rotate"}
              aria-label="Rotate and level satellite image"
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "rotate"
                  ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50"
                  : "text-indigo-300 hover:text-white hover:bg-indigo-950/60"
              }`}
              title="Straighten / Rotate: Level slanted satellite rooftops horizontally for clean, aligned solar layout (e.g. ±28°)"
            >
              <RotateCw className={`w-3.5 h-3.5 stroke-[2.2] ${isRotating ? "animate-spin" : ""}`} />
              <span>{isRotating ? "Rotating..." : "Rotate / Level"}</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Quick HD Sharpen Toggle */}
          <button
            type="button"
            onClick={() => setCrispFilter(!crispFilter)}
            aria-pressed={crispFilter}
            aria-label="Toggle high-pass contrast and tile ridge sharpening"
            className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all text-xs cursor-pointer ${
              crispFilter
                ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs"
                : "bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white hover:bg-slate-700/60"
            }`}
            title="Toggle High-Pass Contrast & Ridge Tile Sharpening"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{crispFilter ? "HD Sharpen: ON" : "HD Sharpen"}</span>
          </button>
        </div>

        {/* View & History controls */}
        <div className="flex items-center gap-1" role="toolbar" aria-label="Canvas view and history controls">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStep <= 0}
            title="Undo"
            aria-label="Undo canvas action"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            title="Redo"
            aria-label="Redo canvas action"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => handleZoom("in")}
            title="Zoom In"
            aria-label="Zoom in canvas"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            title="Zoom Out"
            aria-label="Zoom out canvas"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("reset")}
            title="Fit to Screen"
            aria-label="Fit image to screen"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={handleClearAll}
            title="Clear All Shapes"
            aria-label="Clear all roof polygons"
            className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-bar: In-progress tool guidance */}
      <div className="bg-slate-950/80 px-4 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          {activeTool === "select" && (
            <span className="text-slate-300">
              Drag canvas to navigate • Drag white vertex handles to fine-tune slope boundaries • Mouse wheel to zoom
            </span>
          )}
          {activeTool === "sam2" && (
            <span className="text-purple-300 font-bold flex items-center gap-1.5 animate-pulse">
              <Wand2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Meta SAM 2 Smart Click: Click anywhere on a roof pitch to auto-trace its exact boundary!</span>
            </span>
          )}
          {activeTool === "knife" && (
            <span className="text-amber-400 font-bold flex items-center gap-1.5 animate-pulse">
              <Scissors className="w-3.5 h-3.5" />
              <span>
                {knifeStart
                  ? "Point 1 set. Now click across the opposite roof edge to slice the ridge into 2 slope facets."
                  : "Draw Cut Line: Click the first point along the roof ridge line to slice."}
              </span>
            </span>
          )}
        </div>

        {activeTool === "knife" && knifeStart ? (
          <div className="flex items-center gap-2">
            <span className="text-amber-300 text-[10px]">Cutting in progress...</span>
            <button
              type="button"
              onClick={() => {
                setKnifeStart(null);
                setKnifePointer(null);
              }}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px]"
            >
              Cancel Line
            </button>
          </div>
        ) : (
          image && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-900 text-slate-400 border-slate-800"
                title="Current working rooftop image resolution"
              >
                {image.width} × {image.height} px
              </span>
            </div>
          )
        )}
      </div>

      {/* Main Canvas Stage */}
      <div 
        ref={containerRef} 
        className={`flex-1 relative overflow-hidden bg-slate-950 transition-[filter] duration-300 ${
          activeTool === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
        }`}
        style={{
          filter: crispFilter ? "contrast(1.28) brightness(1.04) saturate(1.12)" : "none",
        }}
      >
        {imageStatus === "loading" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs text-white space-y-2 pointer-events-none">
            <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-300 font-medium">Loading Rooftop Aerial Image...</span>
          </div>
        )}

        {imageStatus === "failed" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base">卫星屋顶图像丢失</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                服务器重启后上传的图像已从存储中清除。<br />
                请重新上传您的屋顶卫星图像以继续编辑。
              </p>
              <p className="text-[10px] text-slate-600 font-mono break-all">{imageUrl}</p>
            </div>
            <a
              href="/"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg"
            >
              <span>↩ 重新上传图像（返回首页）</span>
            </a>
          </div>
        )}

        {/* Floating Crop Confirmation Modal / Badge */}
        {pendingCropBox && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-sky-500/80 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-4 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="text-xs">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Crop className="w-3.5 h-3.5 text-sky-400" />
                <span>Crop to Target House</span>
              </p>
              <p className="text-[10px] text-slate-300">
                {Math.round(pendingCropBox[2] - pendingCropBox[0])} × {Math.round(pendingCropBox[3] - pendingCropBox[1])} px
                {geometry.scale?.metres_per_pixel ? ` • Scale (${geometry.scale.metres_per_pixel.toFixed(4)} m/px) preserved` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  if (onCropImage && pendingCropBox) {
                    await onCropImage(pendingCropBox);
                    setPendingCropBox(null);
                    setActiveTool("select");
                  }
                }}
                disabled={isCropping}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isCropping ? "Cropping..." : "Confirm Crop"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCropBox(null);
                  setCropStart(null);
                  setCropPointer(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer"
                title="Cancel Crop"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Straighten / Rotate Rooftop Control Panel */}
        {activeTool === "rotate" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-indigo-500/80 rounded-2xl p-3 shadow-2xl flex flex-col md:flex-row items-center gap-3 backdrop-blur-md animate-in fade-in zoom-in-95 max-w-[95vw]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <RotateCw className={`w-4 h-4 ${isRotating ? "animate-spin" : ""}`} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Level Rooftop</span>
                  {geometry.canvas_rotation_deg ? (
                    <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
                      Offset: {geometry.canvas_rotation_deg > 0 ? `+${geometry.canvas_rotation_deg}°` : `${geometry.canvas_rotation_deg}°`}
                    </span>
                  ) : null}
                </div>
                <div className="text-[10px] text-slate-400">
                  Align roof eaves/ridge parallel to grid
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden md:block" />

            {/* Quick 90-degree and Fine-Tune Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRotateAngle((prev) => Math.max(-180, Math.min(180, Number((prev - 90).toFixed(1)))))}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                title="Rotate 90° Counter-Clockwise"
              >
                -90°
              </button>
              <button
                type="button"
                onClick={() => setRotateAngle((prev) => Math.max(-180, Math.min(180, Number((prev - 1).toFixed(1)))))}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                title="Fine-tune -1°"
              >
                -1°
              </button>

              {/* Direct Angle Input */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 mx-1">
                <input
                  type="number"
                  step="0.5"
                  min="-180"
                  max="180"
                  value={rotateAngle}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setRotateAngle(isNaN(val) ? 0 : Math.max(-180, Math.min(180, val)));
                  }}
                  className="w-12 bg-transparent text-right font-mono text-xs font-bold text-indigo-300 focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-400">°</span>
              </div>

              <button
                type="button"
                onClick={() => setRotateAngle((prev) => Math.max(-180, Math.min(180, Number((prev + 1).toFixed(1)))))}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                title="Fine-tune +1°"
              >
                +1°
              </button>
              <button
                type="button"
                onClick={() => setRotateAngle((prev) => Math.max(-180, Math.min(180, Number((prev + 90).toFixed(1)))))}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                title="Rotate 90° Clockwise"
              >
                +90°
              </button>
            </div>

            {/* Angle Slider */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-mono text-slate-500">-180°</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.5"
                value={rotateAngle}
                onChange={(e) => setRotateAngle(parseFloat(e.target.value))}
                className="w-28 sm:w-36 accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-slate-500">+180°</span>
            </div>

            {/* Grid Toggle Button */}
            <button
              type="button"
              onClick={() => setShowGridLines(!showGridLines)}
              className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                showGridLines
                  ? "bg-indigo-950/80 text-indigo-300 border-indigo-700"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
              title="Toggle Alignment Guidelines Grid"
            >
              <Grid className="w-3 h-3" />
              <span>Grid</span>
            </button>

            <div className="h-6 w-px bg-slate-800 hidden md:block" />

            {/* Actions: Confirm, Reset, Cancel */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  if (onRotateImage && rotateAngle !== 0) {
                    await onRotateImage(rotateAngle);
                    setRotateAngle(0);
                    setActiveTool("select");
                  }
                }}
                disabled={isRotating || rotateAngle === 0}
                className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isRotating ? "Applying..." : "Apply Leveling"}</span>
              </button>

              <button
                type="button"
                onClick={() => setRotateAngle(0)}
                disabled={rotateAngle === 0}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer disabled:opacity-40"
                title="Reset to 0°"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() => {
                  setRotateAngle(0);
                  setActiveTool("select");
                }}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer"
                title="Exit Rotate Mode"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <Stage
          ref={stageRef}
          width={stageDimensions.width}
          height={stageDimensions.height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePosition.x}
          y={stagePosition.y}
          draggable={activeTool === "select" || activeTool === "rotate"}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onMouseDown={handleStageMouseDown}
          onMouseUp={handleStageMouseUp}
          onMouseMove={handleStageMouseMove}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePosition({ x: e.target.x(), y: e.target.y() });
            }
          }}
          className="w-full h-full"
        >
          <Layer>
            {(() => {
              const imgW = image?.width || stageDimensions.width;
              const imgH = image?.height || stageDimensions.height;
              const isRotateMode = activeTool === "rotate";
              const currentPreviewAngle = isRotateMode ? rotateAngle : 0;

              return (
                <>
                  {/* Rotating Rooftop Geometry Canvas Group */}
                  <Group
                    x={imgW / 2}
                    y={imgH / 2}
                    offsetX={imgW / 2}
                    offsetY={imgH / 2}
                    rotation={currentPreviewAngle}
                  >
                    {/* 1. Rooftop Aerial Image */}
                    {image && <KonvaImage image={image} />}

                    {/* 2. Confirmed Roof Facet Polygons */}
                    {geometry.roof_polygons_px.map((poly, polyIdx) => {
                      const flatPoints = poly.flatMap((pt) => pt);
                      const palette = [
                        { fill: "rgba(14, 165, 233, 0.25)", stroke: "#0284c7" },
                        { fill: "rgba(168, 85, 247, 0.25)", stroke: "#9333ea" },
                        { fill: "rgba(16, 185, 129, 0.25)", stroke: "#059669" },
                        { fill: "rgba(245, 158, 11, 0.25)", stroke: "#d97706" },
                        { fill: "rgba(236, 72, 153, 0.25)", stroke: "#db2777" },
                        { fill: "rgba(34, 197, 94, 0.25)", stroke: "#16a34a" },
                        { fill: "rgba(99, 102, 241, 0.25)", stroke: "#4f46e5" },
                      ];
                      const color = palette[polyIdx % palette.length];

                      return (
                        <Group key={`roof-poly-${polyIdx}`}>
                          {/* Filled Area */}
                          <Line
                            points={flatPoints}
                            closed
                            fill={color.fill}
                            stroke={color.stroke}
                            strokeWidth={2.5 / stageScale}
                          />

                          {/* Draggable Vertices in Select Mode */}
                          {activeTool === "select" &&
                            poly.map((pt, ptIdx) => (
                              <Circle
                                key={`vertex-roof-${polyIdx}-${ptIdx}`}
                                x={pt[0]}
                                y={pt[1]}
                                radius={5.5 / stageScale}
                                fill="#ffffff"
                                stroke={color.stroke}
                                strokeWidth={2 / stageScale}
                                draggable
                                onDragStart={(e) => {
                                  e.cancelBubble = true;
                                }}
                                onDragMove={(e) => {
                                  e.cancelBubble = true;
                                  handleVertexDragMove(polyIdx, ptIdx, e);
                                }}
                                onDragEnd={(e) => {
                                  e.cancelBubble = true;
                                  handleVertexDragEnd();
                                }}
                              />
                            ))}
                        </Group>
                      );
                    })}

                    {/* 3. Obstacle Polygons if any exist */}
                    {geometry.obstacles?.map((obs, obsIdx) => {
                      const flatPoints = obs.polygon_px.flatMap((pt) => pt);
                      return (
                        <Group key={`obs-${obs.id || obsIdx}`}>
                          <Line
                            points={flatPoints}
                            closed
                            fill="rgba(244, 63, 94, 0.35)"
                            stroke="#f43f5e"
                            strokeWidth={2 / stageScale}
                            dash={[4 / stageScale, 4 / stageScale]}
                          />
                        </Group>
                      );
                    })}

                    {/* 6. Saved Calibrated Reference Line */}
                    {geometry.scale?.reference_px && geometry.scale.reference_px.length === 2 && (
                      <Group>
                        <Line
                          points={[
                            geometry.scale.reference_px[0][0],
                            geometry.scale.reference_px[0][1],
                            geometry.scale.reference_px[1][0],
                            geometry.scale.reference_px[1][1],
                          ]}
                          stroke="#06b6d4"
                          strokeWidth={2 / stageScale}
                          dash={[4 / stageScale, 2 / stageScale]}
                        />
                        <Circle
                          x={geometry.scale.reference_px[0][0]}
                          y={geometry.scale.reference_px[0][1]}
                          radius={4 / stageScale}
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth={1.5 / stageScale}
                        />
                        <Circle
                          x={geometry.scale.reference_px[1][0]}
                          y={geometry.scale.reference_px[1][1]}
                          radius={4 / stageScale}
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth={1.5 / stageScale}
                        />
                        {geometry.scale.reference_m && (
                          <Text
                            x={
                              (geometry.scale.reference_px[0][0] + geometry.scale.reference_px[1][0]) / 2 +
                              8 / stageScale
                            }
                            y={
                              (geometry.scale.reference_px[0][1] + geometry.scale.reference_px[1][1]) / 2 -
                              12 / stageScale
                            }
                            text={`Ref: ${geometry.scale.reference_m}m (${geometry.scale.metres_per_pixel?.toFixed(4)} m/px)`}
                            fontSize={11 / stageScale}
                            fontFamily="sans-serif"
                            fontStyle="bold"
                            fill="#38bdf8"
                          />
                        )}
                      </Group>
                    )}

                    {/* 4. Active Knife Cut Line in progress */}
                    {knifeStart && knifePointer && (
                      <Group>
                        <Line
                          points={[knifeStart[0], knifeStart[1], knifePointer[0], knifePointer[1]]}
                          stroke="#f59e0b"
                          strokeWidth={2.5 / stageScale}
                          dash={[6 / stageScale, 3 / stageScale]}
                        />
                        <Circle
                          x={knifeStart[0]}
                          y={knifeStart[1]}
                          radius={5 / stageScale}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={1.5 / stageScale}
                        />
                        <Circle
                          x={knifePointer[0]}
                          y={knifePointer[1]}
                          radius={5 / stageScale}
                          fill="#ffffff"
                          stroke="#f59e0b"
                          strokeWidth={2 / stageScale}
                        />
                      </Group>
                    )}

                    {/* 5. Active Ruler Line in progress */}
                    {rulerStart && rulerPointer && (
                      <Group>
                        <Line
                          points={[rulerStart[0], rulerStart[1], rulerPointer[0], rulerPointer[1]]}
                          stroke="#06b6d4"
                          strokeWidth={2.5 / stageScale}
                          dash={[5 / stageScale, 3 / stageScale]}
                        />
                        <Circle
                          x={rulerStart[0]}
                          y={rulerStart[1]}
                          radius={5 / stageScale}
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth={1.5 / stageScale}
                        />
                        <Circle
                          x={rulerPointer[0]}
                          y={rulerPointer[1]}
                          radius={5 / stageScale}
                          fill="#ffffff"
                          stroke="#06b6d4"
                          strokeWidth={2 / stageScale}
                        />
                        <Text
                          x={(rulerStart[0] + rulerPointer[0]) / 2 + 10 / stageScale}
                          y={(rulerStart[1] + rulerPointer[1]) / 2 - 14 / stageScale}
                          text={`${Math.hypot(rulerPointer[0] - rulerStart[0], rulerPointer[1] - rulerStart[1]).toFixed(1)} px`}
                          fontSize={12 / stageScale}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill="#22d3ee"
                        />
                      </Group>
                    )}
                  </Group>

                  {/* Alignment Guidelines in Rotate Mode */}
                  {isRotateMode && showGridLines && (
                    <Group listening={false}>
                      {/* Center Horizontal & Vertical Axis */}
                      <Line
                        points={[-imgW * 2, imgH / 2, imgW * 3, imgH / 2]}
                        stroke="rgba(129, 140, 248, 0.85)"
                        strokeWidth={2 / stageScale}
                        dash={[10 / stageScale, 5 / stageScale]}
                      />
                      <Line
                        points={[imgW / 2, -imgH * 2, imgW / 2, imgH * 3]}
                        stroke="rgba(129, 140, 248, 0.85)"
                        strokeWidth={2 / stageScale}
                        dash={[10 / stageScale, 5 / stageScale]}
                      />
                      {/* Fine Horizontal Reference Lines */}
                      {Array.from({ length: 60 }).map((_, i) => {
                        const offset = (i - 30) * 40;
                        if (offset === 0) return null;
                        const y = imgH / 2 + offset;
                        return (
                          <Line
                            key={`h-grid-${i}`}
                            points={[-imgW * 2, y, imgW * 3, y]}
                            stroke="rgba(148, 163, 184, 0.22)"
                            strokeWidth={1 / stageScale}
                            dash={[5 / stageScale, 5 / stageScale]}
                          />
                        );
                      })}
                      {/* Fine Vertical Reference Lines */}
                      {Array.from({ length: 60 }).map((_, i) => {
                        const offset = (i - 30) * 40;
                        if (offset === 0) return null;
                        const x = imgW / 2 + offset;
                        return (
                          <Line
                            key={`v-grid-${i}`}
                            points={[x, -imgH * 2, x, imgH * 3]}
                            stroke="rgba(148, 163, 184, 0.22)"
                            strokeWidth={1 / stageScale}
                            dash={[5 / stageScale, 5 / stageScale]}
                          />
                        );
                      })}
                    </Group>
                  )}
                </>
              );
            })()}

            {/* 7. Active Crop Selection Box */}
            {cropStart && cropPointer && (() => {
              const x = Math.min(cropStart[0], cropPointer[0]);
              const y = Math.min(cropStart[1], cropPointer[1]);
              const w = Math.abs(cropPointer[0] - cropStart[0]);
              const h = Math.abs(cropPointer[1] - cropStart[1]);
              return (
                <Group>
                  <Line
                    points={[x, y, x + w, y, x + w, y + h, x, y + h, x, y]}
                    stroke="#38bdf8"
                    strokeWidth={2.5 / stageScale}
                    dash={[6 / stageScale, 4 / stageScale]}
                    closed
                    fill="rgba(56, 189, 248, 0.2)"
                  />
                  <Text
                    x={x + 8 / stageScale}
                    y={y + 8 / stageScale}
                    text={`Crop Area: ${Math.round(w)} × ${Math.round(h)} px`}
                    fontSize={11 / stageScale}
                    fontFamily="sans-serif"
                    fontStyle="bold"
                    fill="#38bdf8"
                  />
                </Group>
              );
            })()}

            {/* 8. Pending Crop Box Confirm Preview */}
            {pendingCropBox && (() => {
              const x = pendingCropBox[0];
              const y = pendingCropBox[1];
              const w = pendingCropBox[2] - pendingCropBox[0];
              const h = pendingCropBox[3] - pendingCropBox[1];
              return (
                <Group>
                  <Line
                    points={[x, y, x + w, y, x + w, y + h, x, y + h, x, y]}
                    stroke="#38bdf8"
                    strokeWidth={3 / stageScale}
                    closed
                    fill="rgba(56, 189, 248, 0.25)"
                  />
                </Group>
              );
            })()}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
