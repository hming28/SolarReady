"use client";

import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Rect, Group, Text } from "react-konva";
import useImage from "@/lib/useImage";
import { ZoomIn, ZoomOut, Maximize2, ShieldAlert } from "lucide-react";
import { RoofGeometry, LayoutResponse, PanelPlacement } from "@/lib/types";

interface PanelOverlayProps {
  imageUrl: string;
  geometry: RoofGeometry;
  layout: LayoutResponse;
  viewMode: "realistic" | "blueprint";
}

export default function PanelOverlay({
  imageUrl,
  geometry,
  layout,
  viewMode,
}: PanelOverlayProps) {
  const [image, imageStatus] = useImage(imageUrl, "anonymous");
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 1000, height: 650 });

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

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

  // Auto-fit to viewport
  useEffect(() => {
    if (image && stageDimensions.width > 0 && stageDimensions.height > 0) {
      const stageW = stageDimensions.width;
      const stageH = stageDimensions.height;

      const scaleX = (stageW * 0.9) / image.width;
      const scaleY = (stageH * 0.9) / image.height;
      const initScale = Math.min(scaleX, scaleY, 1.2);

      setScale(initScale);
      setPosition({
        x: (stageW - image.width * initScale) / 2,
        y: (stageH - image.height * initScale) / 2,
      });
    }
  }, [image, stageDimensions]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.12;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.2, Math.min(newScale, 5.0));

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleZoom = (dir: "in" | "out" | "reset") => {
    if (dir === "reset") {
      if (image && stageDimensions.width > 0 && stageDimensions.height > 0) {
        const scaleX = (stageDimensions.width * 0.9) / image.width;
        const scaleY = (stageDimensions.height * 0.9) / image.height;
        const initScale = Math.min(scaleX, scaleY, 1.2);
        setScale(initScale);
        setPosition({
          x: (stageDimensions.width - image.width * initScale) / 2,
          y: (stageDimensions.height - image.height * initScale) / 2,
        });
      }
      return;
    }
    const factor = dir === "in" ? 1.2 : 0.8;
    setScale((prev) => Math.max(0.2, Math.min(prev * factor, 5.0)));
  };

  const mPerPx = geometry.scale?.metres_per_pixel || 0.02;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden">
      {imageStatus === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs text-white space-y-2 pointer-events-none">
          <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-300 font-medium">Loading Solar Layout Preview...</span>
        </div>
      )}

      {imageStatus === "failed" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 text-center space-y-4 pointer-events-auto">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-base">屋顶图像不可用</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              服务器重启后上传的图像已从存储中清除。<br />
              请重新上传您的屋顶卫星图像以继续。
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg"
          >
            ↩ 重新上传图像（返回首页）
          </a>
        </div>
      )}

      {/* Zoom Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg" role="toolbar" aria-label="Zoom controls">
        <button
          type="button"
          onClick={() => handleZoom("in")}
          aria-label="Zoom in"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("out")}
          aria-label="Zoom out"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("reset")}
          aria-label="Reset zoom and center view"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <Stage
          ref={stageRef}
          width={stageDimensions.width}
          height={stageDimensions.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable
          onWheel={handleWheel}
          className="w-full h-full"
        >
          <Layer>
            {/* View Mode 1: Realistic Image Background */}
            {viewMode === "realistic" ? (
              image && <KonvaImage image={image} />
            ) : (
              /* View Mode 2: Blueprint CAD Background */
              image && (
                <Rect
                  x={0}
                  y={0}
                  width={image.width}
                  height={image.height}
                  fill="#0B192C"
                  stroke="#1E3E62"
                  strokeWidth={2}
                />
              )
            )}

            {/* Roof Perimeter Facets (Multi-Color Palette Synchronized with Step 2) */}
            {geometry.roof_polygons_px.map((poly, idx) => {
              const facetColors = [
                { fill: "rgba(14, 165, 233, 0.20)", stroke: "#0284c7" },
                { fill: "rgba(168, 85, 247, 0.20)", stroke: "#9333ea" },
                { fill: "rgba(16, 185, 129, 0.20)", stroke: "#059669" },
                { fill: "rgba(245, 158, 11, 0.20)", stroke: "#d97706" },
                { fill: "rgba(236, 72, 153, 0.20)", stroke: "#db2777" },
                { fill: "rgba(34, 197, 94, 0.20)", stroke: "#16a34a" },
                { fill: "rgba(99, 102, 241, 0.20)", stroke: "#4f46e5" },
              ];
              const color = facetColors[idx % facetColors.length];
              return (
                <Line
                  key={`roof-line-${idx}`}
                  points={poly.flatMap((pt) => pt)}
                  closed
                  stroke={color.stroke}
                  strokeWidth={(viewMode === "blueprint" ? 2.5 : 2) / scale}
                  dash={viewMode === "blueprint" ? [8 / scale, 4 / scale] : undefined}
                  fill={viewMode === "blueprint" ? color.fill.replace("0.20", "0.08") : color.fill}
                />
              );
            })}

            {/* Obstacles */}
            {geometry.obstacles.map((obs, idx) => {
              const bufferPx = (obs.buffer_m || 0.3) / mPerPx;
              return (
                <Group key={`obs-poly-${idx}`}>
                  {/* Clearance Buffer */}
                  <Line
                    points={obs.polygon_px.flatMap((pt) => pt)}
                    closed
                    stroke="rgba(244, 63, 94, 0.4)"
                    strokeWidth={(bufferPx * 2) / scale}
                    lineJoin="round"
                  />
                  {/* Obstacle Box */}
                  <Line
                    points={obs.polygon_px.flatMap((pt) => pt)}
                    closed
                    fill={viewMode === "blueprint" ? "rgba(244, 63, 94, 0.3)" : "rgba(244, 63, 94, 0.5)"}
                    stroke="#e11d48"
                    strokeWidth={2 / scale}
                  />
                </Group>
              );
            })}

            {/* Solar Panels Grid */}
            {layout.panels.map((p) => {
              const xPx = p.x_px ?? p.x_m / mPerPx;
              const yPx = p.y_px ?? p.y_m / mPerPx;
              const wPx = p.w_px ?? p.w_m / mPerPx;
              const hPx = p.h_px ?? p.h_m / mPerPx;
              const rot = p.rotation_deg || 0;

              return (
                <Group
                  key={`panel-${p.index}`}
                  x={xPx + wPx / 2}
                  y={yPx + hPx / 2}
                  rotation={rot}
                  offset={{ x: wPx / 2, y: hPx / 2 }}
                >
                  {/* PV Module Body (Monocrystalline Dark Blue/Navy Silicon) */}
                  <Rect
                    width={wPx}
                    height={hPx}
                    fill={viewMode === "blueprint" ? "#1E3E62" : "#0d1b2a"}
                    stroke={viewMode === "blueprint" ? "#00ADB5" : "#e2e8f0"}
                    strokeWidth={(viewMode === "blueprint" ? 1.5 : 1.2) / scale}
                    cornerRadius={1 / scale}
                    shadowColor="#000000"
                    shadowBlur={viewMode === "realistic" ? 6 / scale : 0}
                    shadowOffsetX={viewMode === "realistic" ? 2 / scale : 0}
                    shadowOffsetY={viewMode === "realistic" ? 3 / scale : 0}
                    shadowOpacity={viewMode === "realistic" ? 0.6 : 0}
                  />

                  {/* Inner Antireflective Wafer Border */}
                  {viewMode === "realistic" && (
                    <Rect
                      x={1.5 / scale}
                      y={1.5 / scale}
                      width={Math.max(wPx - 3 / scale, 1)}
                      height={Math.max(hPx - 3 / scale, 1)}
                      fill="#1b2a47"
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth={0.8 / scale}
                    />
                  )}

                  {/* Photovoltaic Cell Busbars / Grid lines */}
                  <Line
                    points={[wPx / 2, 0, wPx / 2, hPx]}
                    stroke={viewMode === "blueprint" ? "rgba(0, 173, 181, 0.4)" : "rgba(200, 220, 255, 0.4)"}
                    strokeWidth={0.9 / scale}
                  />
                  <Line
                    points={[0, hPx * 0.25, wPx, hPx * 0.25]}
                    stroke={viewMode === "blueprint" ? "rgba(0, 173, 181, 0.3)" : "rgba(200, 220, 255, 0.3)"}
                    strokeWidth={0.7 / scale}
                  />
                  <Line
                    points={[0, hPx * 0.5, wPx, hPx * 0.5]}
                    stroke={viewMode === "blueprint" ? "rgba(0, 173, 181, 0.35)" : "rgba(200, 220, 255, 0.35)"}
                    strokeWidth={0.8 / scale}
                  />
                  <Line
                    points={[0, hPx * 0.75, wPx, hPx * 0.75]}
                    stroke={viewMode === "blueprint" ? "rgba(0, 173, 181, 0.3)" : "rgba(200, 220, 255, 0.3)"}
                    strokeWidth={0.7 / scale}
                  />

                  {/* Solar Glass Specular Reflection Highlight */}
                  {viewMode === "realistic" && (
                    <Line
                      points={[2 / scale, hPx * 0.4, wPx * 0.5, 2 / scale]}
                      stroke="rgba(255, 255, 255, 0.18)"
                      strokeWidth={1.2 / scale}
                    />
                  )}

                  {/* Panel Number Badge */}
                  {wPx * scale > 16 && (
                    <Text
                      text={`#${p.index}`}
                      fontSize={Math.max(8 / scale, 8)}
                      fontStyle="bold"
                      fill={viewMode === "blueprint" ? "#38BDF8" : "#ffffff"}
                      x={3 / scale}
                      y={3 / scale}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
