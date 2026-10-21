"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  Ruler, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  Trash2, 
  Layers, 
  Compass, 
  Sliders, 
  Zap 
} from "lucide-react";
import { api } from "@/lib/api";
import { Assessment, RoofGeometry, ScaleCalibration, ScaleTier, RoofAnalysisResponse } from "@/lib/types";
import Stepper from "@/components/Stepper";
import ScaleModal from "@/components/ScaleModal";

// Dynamically import CanvasEditor without SSR for Konva compatibility
const CanvasEditor = dynamic(() => import("@/components/CanvasEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
      <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium">Initializing Interactive Canvas...</p>
    </div>
  ),
});

const DEFAULT_GEOMETRY: RoofGeometry = {
  roof_polygons_px: [],
  obstacles: [],
  scale: {
    method: "none",
    quality_tier: "uncalibrated",
  },
};

const FACET_PALETTE_HEX = [
  "#0284c7", // Sky/Blue (Plane 1)
  "#9333ea", // Purple (Plane 2)
  "#059669", // Emerald (Plane 3)
  "#d97706", // Amber (Plane 4)
  "#db2777", // Rose/Pink (Plane 5)
  "#16a34a", // Green (Plane 6)
  "#4f46e5", // Indigo (Plane 7)
];

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [geometry, setGeometry] = useState<RoofGeometry>(DEFAULT_GEOMETRY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Roof Pitch / Tilt Angle State (Default 15° standard Malaysian pitch)
  const [tiltDeg, setTiltDeg] = useState<number>(15.0);
  const [geminiPitchInsight, setGeminiPitchInsight] = useState<{
    material?: string;
    pitch?: number;
    confidenceRange?: [number, number];
    reasoning?: string;
  } | null>(null);
  const [roofAnalysis, setRoofAnalysis] = useState<RoofAnalysisResponse | null>(null);

  // Scale Calibration Modal
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [calibPoints, setCalibPoints] = useState<[[number, number], [number, number]] | null>(null);
  const [calibPixelDist, setCalibPixelDist] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    api.getAssessment(assessmentId)
      .then((data) => {
        if (!isMounted) return;
        setAssessment(data);
        if (data.geometry) {
          const geom = { ...data.geometry };
          // Preserve genuine backend scale; if missing, maintain honest uncalibrated state
          if (!geom.scale) {
            geom.scale = {
              method: "none",
              quality_tier: "uncalibrated",
            };
          }
          setGeometry(geom);
          if (geom.tilt_deg) {
            setTiltDeg(geom.tilt_deg);
          }
          if (
            geom.estimated_pitch_deg ||
            geom.pitch_reasoning ||
            geom.roof_material
          ) {
            setGeminiPitchInsight({
              material: geom.roof_material || undefined,
              pitch: geom.estimated_pitch_deg ?? geom.tilt_deg ?? undefined,
              confidenceRange: (geom.pitch_confidence_range as [number, number]) || undefined,
              reasoning: geom.pitch_reasoning || undefined,
            });
          }
        } else {
          setGeometry(DEFAULT_GEOMETRY);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load assessment:", err);
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [assessmentId]);

  // Real-time roof dimension & plane orientation analysis
  useEffect(() => {
    if (geometry.roof_polygons_px && geometry.roof_polygons_px.length > 0) {
      api.analyzeRoof(
        geometry.roof_polygons_px,
        geometry.scale?.metres_per_pixel,
        tiltDeg,
        geometry.canvas_rotation_deg || 0
      )
        .then((res) => setRoofAnalysis(res))
        .catch((err) => console.warn("Roof analysis error:", err));
    } else {
      setRoofAnalysis(null);
    }
  }, [geometry.roof_polygons_px, geometry.scale?.metres_per_pixel, tiltDeg, geometry.canvas_rotation_deg]);

  const handleOpenScaleModal = (p1: [number, number], p2: [number, number], distPx: number) => {
    setCalibPoints([p1, p2]);
    setCalibPixelDist(distPx);
    setIsScaleModalOpen(true);
  };

  const handleSaveScale = (newScale: ScaleCalibration) => {
    const updatedScale: ScaleCalibration = {
      ...newScale,
      reference_px: calibPoints || geometry.scale?.reference_px,
    };
    const updatedGeometry = {
      ...geometry,
      scale: updatedScale,
    };
    setGeometry(updatedGeometry);
  };

  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiProgress, setGeminiProgress] = useState(0);
  const [geminiStatusText, setGeminiStatusText] = useState("");

  const handleGeminiDetect = async () => {
    try {
      setIsGeminiLoading(true);
      setGeminiProgress(15);
      setGeminiStatusText("Connecting to Vision AI API...");

      const timer1 = setTimeout(() => {
        setGeminiProgress(45);
        setGeminiStatusText("Segmenting roof planes & ridge boundaries...");
      }, 1500);

      const timer2 = setTimeout(() => {
        setGeminiProgress(75);
        setGeminiStatusText("Estimating roof pitch angle & material profile...");
      }, 3000);

      const res = await api.geminiDetect(assessmentId);
      clearTimeout(timer1);
      clearTimeout(timer2);

      setGeminiProgress(100);
      setGeminiStatusText("Roof facets & pitch angle detected!");

      if (res && (res.estimated_pitch_deg || res.pitch_reasoning || res.roof_material)) {
        if (res.estimated_pitch_deg !== undefined && res.estimated_pitch_deg !== null) {
          setTiltDeg(res.estimated_pitch_deg);
        }
        setGeminiPitchInsight({
          material: res.roof_material,
          pitch: res.estimated_pitch_deg,
          confidenceRange: res.pitch_confidence_range,
          reasoning: res.pitch_reasoning,
        });
      }

      if (res && res.polygons_px && res.polygons_px.length > 0) {
        setGeometry((prev) => ({
          ...prev,
          roof_polygons_px: res.polygons_px,
          tilt_deg: res.estimated_pitch_deg ?? prev.tilt_deg,
        }));
      } else {
        alert("Vision AI could not detect distinct facets. You can use SAM 2 Smart Click or Draw Cut Line to define facets.");
      }
      setTimeout(() => {
        setIsGeminiLoading(false);
      }, 1000);
    } catch (err: any) {
      const msg = err.message || "Failed to analyze rooftop.";
      const displayMsg = msg.toLowerCase().includes("gemini")
        ? msg
        : `Vision AI detection failed: ${msg}`;
      alert(displayMsg);
      setIsGeminiLoading(false);
    }
  };

  const [isSam2Loading, setIsSam2Loading] = useState(false);

  const handleSam2Click = async (x: number, y: number) => {
    try {
      setIsSam2Loading(true);
      const res = await api.sam2PointSegment(assessmentId, x, y, "hiera_b_plus", 2.5);
      if (res && res.polygon_px && res.polygon_px.length >= 3) {
        setGeometry((prev) => ({
          ...prev,
          roof_polygons_px: [...prev.roof_polygons_px, res.polygon_px],
        }));
      }
    } catch (err: any) {
      alert(`Meta SAM 2 point segmentation: ${err.message}`);
    } finally {
      setIsSam2Loading(false);
    }
  };

  const [isCutting, setIsCutting] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [imageVersion, setImageVersion] = useState(Date.now());
  const [cropToast, setCropToast] = useState<string | null>(null);
  const [rotateToast, setRotateToast] = useState<string | null>(null);

  const handleRotateImage = async (angleDeg: number) => {
    try {
      setIsRotating(true);
      const updated = await api.rotateImage(assessmentId, angleDeg);
      setAssessment(updated);
      if (updated.geometry) {
        setGeometry(updated.geometry);
      }
      setImageVersion(Date.now());
      const totalRot = updated.geometry?.canvas_rotation_deg || 0;
      setRotateToast(
        `✓ Rooftop leveled! Image rotated ${angleDeg > 0 ? `+${angleDeg}°` : `${angleDeg}°`} (${totalRot}° from True North). Solar azimuth compensated.`
      );
      setTimeout(() => setRotateToast(null), 5000);
    } catch (err: any) {
      alert(`Rotation failed: ${err.message || err}`);
    } finally {
      setIsRotating(false);
    }
  };

  const handleCropImage = async (box: [number, number, number, number]) => {
    try {
      setIsCropping(true);
      const updated = await api.cropImage(assessmentId, box);
      setAssessment(updated);
      if (updated.geometry) {
        setGeometry(updated.geometry);
      }
      setImageVersion(Date.now());
      const mPerPx = updated.geometry?.scale?.metres_per_pixel;
      setCropToast(
        `✓ Cropped to target house! ${
          mPerPx ? `Scale (${mPerPx.toFixed(4)} m/px) preserved.` : ""
        } Ready for AI Auto-Detection.`
      );
      setTimeout(() => setCropToast(null), 5000);
    } catch (err: any) {
      alert(`Crop failed: ${err.message || err}`);
    } finally {
      setIsCropping(false);
    }
  };

  const handleCutLine = async (p1: [number, number], p2: [number, number]) => {
    if (geometry.roof_polygons_px.length === 0) {
      alert("Please outline or auto-detect a roof polygon first before cutting.");
      return;
    }
    try {
      setIsCutting(true);
      const res = await api.cutRoofWithLine(geometry.roof_polygons_px, [p1, p2]);
      if (res && res.split_occurred && res.roof_polygons_px && res.roof_polygons_px.length > 0) {
        setGeometry((prev) => ({
          ...prev,
          roof_polygons_px: res.roof_polygons_px,
        }));
      } else {
        alert(
          res?.message ||
            "Cut line did not intersect any roof polygon. Draw across the boundary of the roof polygon to split it."
        );
      }
    } catch (err: any) {
      alert(`Cut line failed: ${err.message}`);
    } finally {
      setIsCutting(false);
    }
  };

  const handleProceedToPacking = async () => {
    if (geometry.roof_polygons_px.length === 0) {
      await handleGeminiDetect();
      return;
    }
    try {
      setSaving(true);
      const updatedGeometry: RoofGeometry = {
        ...geometry,
        tilt_deg: tiltDeg,
        faces_metrics: roofAnalysis?.faces,
        roof_area_m2: roofAnalysis?.total_true_area_m2 || roofAnalysis?.total_planar_area_m2 || geometry.roof_area_m2,
        estimated_pitch_deg: geminiPitchInsight?.pitch,
        roof_material: geminiPitchInsight?.material,
        pitch_confidence_range: geminiPitchInsight?.confidenceRange,
        pitch_reasoning: geminiPitchInsight?.reasoning,
      };
      await api.updateGeometry(assessmentId, updatedGeometry);
      router.push(`/layout-sim/${assessmentId}`);
    } catch (err: any) {
      alert(`Error saving geometry: ${err.message}`);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading rooftop assessment session...</p>
      </div>
    );
  }

  const imageUrl = `${api.getImageUrl(assessmentId)}?v=${imageVersion}`;
  const isCalibrated =
    geometry.scale &&
    geometry.scale.metres_per_pixel &&
    geometry.scale.quality_tier !== "uncalibrated";

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-900">
      <Stepper currentStep="editor" assessmentId={assessmentId} />

      {cropToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/95 text-emerald-200 border border-emerald-700/80 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{cropToast}</span>
        </div>
      )}

      {rotateToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/95 text-indigo-200 border border-indigo-700/80 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{rotateToast}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 pb-16 lg:pb-0">
        {/* Left / Center: Interactive Canvas Editor (Responsive mobile height) */}
        <div className="w-full h-[50vh] min-h-[320px] max-h-[480px] lg:h-full lg:max-h-none lg:flex-1 min-w-0 flex flex-col overflow-hidden relative border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0">
          <CanvasEditor
            imageUrl={imageUrl}
            geometry={geometry}
            onChange={setGeometry}
            onOpenScaleModal={handleOpenScaleModal}
            onGeminiDetect={handleGeminiDetect}
            isGeminiLoading={isGeminiLoading}
            onSam2Click={handleSam2Click}
            isSam2Loading={isSam2Loading}
            onCutLine={handleCutLine}
            isCutting={isCutting}
            onCropImage={handleCropImage}
            isCropping={isCropping}
            onRotateImage={handleRotateImage}
            isRotating={isRotating}
          />
        </div>

        {/* Right: Inspection, Calibration & Roof Facet Sidebar */}
        <div className="w-full lg:w-[380px] lg:shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col lg:h-full min-h-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 custom-scrollbar">
            {/* Session Info */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/60 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Assessment ID:</span>
                <span className="font-mono text-white text-[11px]">{assessmentId}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Location:</span>
                <span className="text-white font-semibold truncate max-w-[150px]">
                  {assessment?.location?.text || "Selangor"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Typology:</span>
                <span className="text-amber-400 font-semibold">{assessment?.house_type}</span>
              </div>
              {geometry.canvas_rotation_deg ? (
                <div className="flex items-center justify-between text-slate-400">
                  <span>True North Offset:</span>
                  <span className="text-indigo-400 font-semibold font-mono">
                    {geometry.canvas_rotation_deg > 0 ? `+${geometry.canvas_rotation_deg}°` : `${geometry.canvas_rotation_deg}°`}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Scale Calibration Card */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Ruler className="w-4 h-4 text-cyan-400" />
                  <span>Scale Calibration</span>
                </div>
                {/* Quality Tier Badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    geometry.scale.quality_tier === "user_measured"
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : geometry.scale.quality_tier === "approx_map_measure"
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-rose-950 text-rose-400 border-rose-800"
                  }`}
                >
                  {geometry.scale.quality_tier === "user_measured"
                    ? "User Measured"
                    : geometry.scale.quality_tier === "approx_map_measure"
                    ? "Approx Estimate"
                    : "Uncalibrated"}
                </span>
              </div>

              {isCalibrated ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Ratio:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {geometry.scale.metres_per_pixel?.toFixed(4)} m/px
                    </span>
                  </div>
                  {geometry.scale.reference_m && (
                    <div className="flex justify-between text-slate-300">
                      <span>Reference Length:</span>
                      <span className="font-bold text-white">{geometry.scale.reference_m} m</span>
                    </div>
                  )}
                  {geometry.scale.notes && (
                    <p className="text-[10px] text-slate-400 italic">{geometry.scale.notes}</p>
                  )}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCalibPixelDist(
                          geometry.scale.reference_m && geometry.scale.metres_per_pixel
                            ? geometry.scale.reference_m / geometry.scale.metres_per_pixel
                            : 50.0
                        );
                        setIsScaleModalOpen(true);
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
                    >
                      Edit Scale
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeometry((prev) => ({
                          ...prev,
                          scale: {
                            method: "none",
                            quality_tier: "uncalibrated",
                          },
                        }));
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium"
                    >
                      Clear Calibration
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-[11px] text-rose-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <span>Scale Uncalibrated</span>
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      Select the <strong className="text-cyan-300">Ruler Tool</strong> on the canvas toolbar to measure the Google Maps 5m scale bar or a known reference edge.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCalibPixelDist(50.0);
                        setIsScaleModalOpen(true);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                      title="Manually enter known distance in meters"
                    >
                      <Ruler className="w-3 h-3" />
                      <span>Custom Scale</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeometry((prev) => ({
                          ...prev,
                          scale: {
                            method: "known_line",
                            metres_per_pixel: 0.0694,
                            reference_m: 5.0,
                            quality_tier: "approx_map_measure",
                            notes: "Quick scale preset (~0.0694 m/px)",
                          },
                        }));
                      }}
                      className="py-1.5 px-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Apply 0.0694 m/px scale preset"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Quick ~0.0694m/px</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Roof Pitch & Angle Selector Card */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Roof Pitch / Angle</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {geminiPitchInsight?.pitch && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AI {geminiPitchInsight.pitch}°
                    </span>
                  )}
                  <span className="font-mono text-amber-300 text-xs font-bold">{tiltDeg}° Tilt</span>
                </div>
              </div>

              {/* AI Detected Pitch Notification Banner with 1-Click Apply */}
              {geminiPitchInsight?.pitch ? (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AI Estimated Pitch: {geminiPitchInsight.pitch}°</span>
                    </span>
                    {tiltDeg === geminiPitchInsight.pitch ? (
                      <span className="text-[9px] bg-emerald-900 text-emerald-200 border border-emerald-700 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        ✓ Applied
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTiltDeg(geminiPitchInsight.pitch!)}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Apply AI Angle</span>
                      </button>
                    )}
                  </div>
                  {geminiPitchInsight.confidenceRange && (
                    <div className="text-[10px] text-slate-300 flex justify-between">
                      <span>Confidence Range:</span>
                      <span className="font-mono text-emerald-300">
                        {geminiPitchInsight.confidenceRange[0]}°–{geminiPitchInsight.confidenceRange[1]}°
                      </span>
                    </div>
                  )}
                  {geminiPitchInsight.material && (
                    <div className="text-[10px] text-slate-300 flex justify-between">
                      <span>Roof Material:</span>
                      <span className="text-white font-medium capitalize">{geminiPitchInsight.material}</span>
                    </div>
                  )}
                  {geminiPitchInsight.reasoning && (
                    <p className="text-[10px] text-slate-400 leading-relaxed italic border-t border-emerald-900/40 pt-1">
                      &ldquo;{geminiPitchInsight.reasoning}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="font-medium">AI Pitch Estimation:</span>
                  <button
                    type="button"
                    onClick={handleGeminiDetect}
                    disabled={isGeminiLoading}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-md border border-amber-500/30 transition-all disabled:opacity-50 text-[11px]"
                    title="Run AI Vision to estimate roof pitch angle from shadow and architectural features"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeminiLoading ? "animate-spin" : ""}`} />
                    <span>{isGeminiLoading ? "Estimating..." : "Estimate with AI"}</span>
                  </button>
                </div>
              )}

              {/* Dynamic angle button list */}
              {(() => {
                const standardAngles = [0, 10, 15, 20, 25];
                if (geminiPitchInsight?.pitch && !standardAngles.includes(geminiPitchInsight.pitch)) {
                  standardAngles.push(geminiPitchInsight.pitch);
                  standardAngles.sort((a, b) => a - b);
                }
                return (
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {standardAngles.map((angle) => {
                      const isAiMatch = geminiPitchInsight?.pitch === angle;
                      return (
                        <button
                          key={`tilt-${angle}`}
                          type="button"
                          onClick={() => setTiltDeg(angle)}
                          className={`py-1.5 px-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                            tiltDeg === angle
                              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-xs"
                              : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          {angle === 0 ? "0°" : `${angle}°`}
                          {isAiMatch && (
                            <span className="block text-[8px] font-mono font-bold text-emerald-400">
                              AI
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Slope Area Factor:</span>
                <span className="font-mono text-white font-semibold">
                  ×{(1 / Math.max(Math.cos((tiltDeg * Math.PI) / 180), 0.1)).toFixed(3)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Malaysian pitched roofs typically slope at 15°–25° for monsoonal storm runoff. True area increases by 1/cos(θ).
              </p>
            </div>

            {/* Roof Surfaces & Dimensions Inspector */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Roof Facets & Dimensions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-[11px]">{geometry.roof_polygons_px.length} faces</span>
                  {geometry.roof_polygons_px.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGeometry((prev) => ({ ...prev, roof_polygons_px: [] }))}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-normal transition-colors cursor-pointer"
                      title="Clear all faces to start fresh"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* AI Vision Topology Auto-Detector Card */}
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-emerald-200">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AI Auto-Detect:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isGeminiLoading
                        ? "Analyzing 3D roof topology..."
                        : "AI auto-finds roof edges, ridges & slope facets"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeminiDetect}
                    disabled={isGeminiLoading}
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 shadow-xs cursor-pointer"
                    title="Run AI Vision to auto-detect roof type and watertight slope facets"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeminiLoading ? "animate-spin" : ""}`} />
                    <span>{isGeminiLoading ? "Analyzing..." : "AI Auto-Detect"}</span>
                  </button>
                </div>

                {/* Live Loading Progress Bar & Status */}
                {isGeminiLoading && (
                  <div className="space-y-1.5 bg-slate-950/90 p-2 rounded-lg border border-emerald-700/80 animate-pulse">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-spin" />
                        <span>AI Segmenting Rooftop...</span>
                      </span>
                      <span className="font-mono text-white font-extrabold">{geminiProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${geminiProgress}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-300 italic truncate" title={geminiStatusText}>
                      {geminiStatusText}
                    </p>
                  </div>
                )}
              </div>

              {geometry.roof_polygons_px.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No roof polygons detected yet. Click &ldquo;AI Auto-Detect&rdquo; above to auto-detect roof slopes.
                </p>
              ) : (
                <div className="space-y-2">
                  {geometry.roof_polygons_px.map((poly, idx) => {
                    const metric = roofAnalysis?.faces?.find((f) => f.index === idx + 1);
                    const facetColor = FACET_PALETTE_HEX[idx % FACET_PALETTE_HEX.length];
                    return (
                      <div
                        key={`face-${idx}`}
                        className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-xs text-slate-300 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white/30"
                              style={{ backgroundColor: facetColor }}
                              title={`Plane ${idx + 1} Color Code`}
                            />
                            <span className="font-bold text-white">Plane {idx + 1}</span>
                            {metric?.slope_direction && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-semibold flex items-center gap-1">
                                <Compass className="w-3 h-3" />
                                {metric.slope_direction}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = geometry.roof_polygons_px.filter((_, i) => i !== idx);
                                setGeometry({ ...geometry, roof_polygons_px: updated });
                              }}
                              className="text-slate-400 hover:text-rose-400 p-1"
                              title="Delete Face"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isCalibrated && metric?.length_m && metric?.width_m ? (
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2 rounded border border-slate-800">
                            <div>
                              <span className="text-slate-500 block">Length × Width:</span>
                              <span className="font-mono font-bold text-white">
                                {metric.length_m}m × {metric.width_m}m
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Perimeter:</span>
                              <span className="font-mono text-slate-300">
                                {metric.perimeter_m}m
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Planar Area:</span>
                              <span className="font-mono text-cyan-300 font-bold">
                                {metric.planar_area_m2} m²
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">True Slope Area:</span>
                              <span className="font-mono text-amber-300 font-bold">
                                {metric.true_area_m2} m²
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">
                            Points: {poly.length} vertices (Calibrate scale to show metric size)
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Total Metrics Summary */}
                  {roofAnalysis && isCalibrated && roofAnalysis.total_true_area_m2 && (
                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 flex items-center justify-between text-xs">
                      <span className="text-amber-200 font-semibold">Total True Surface Area:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {roofAnalysis.total_true_area_m2.toFixed(1)} m²
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>


          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60 shrink-0"
                title="Return to Step 1 Upload"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>

              <button
                type="button"
                onClick={handleProceedToPacking}
                disabled={saving}
                className={`flex-1 py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                  geometry.roof_polygons_px.length > 0
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 cursor-pointer ring-2 ring-amber-400/60"
                    : "bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 cursor-pointer"
                }`}
                title="Proceed to Step 3 to view simulated solar panels installed on your roof"
              >
                {saving ? (
                  <span>Saving Roof Geometry...</span>
                ) : geometry.roof_polygons_px.length > 0 ? (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Simulate Solar Panels on Roof</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-Detect Roof & Simulate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Only Sticky Floating Action Bar (375px phone support) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-2xl">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>{geometry.roof_polygons_px.length} Facets</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                isCalibrated
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                  : "bg-rose-950 text-rose-400 border-rose-800"
              }`}
            >
              {isCalibrated ? "Calibrated" : "Uncalibrated"}
            </span>
          </span>
          <span className="text-[10px] text-slate-400">Step 2: Roof Editor</span>
        </div>

        <button
          type="button"
          onClick={handleProceedToPacking}
          disabled={saving}
          className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all ${
            geometry.roof_polygons_px.length > 0
              ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 cursor-pointer"
              : "bg-slate-800 text-amber-400 border border-amber-500/40 cursor-pointer"
          }`}
          title="Proceed to Step 3 to view simulated solar panels installed on your roof"
        >
          {saving ? (
            <span>Saving...</span>
          ) : (
            <>
              <span>Simulate Panels</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Scale Calibration Modal */}
      <ScaleModal
        isOpen={isScaleModalOpen}
        onClose={() => setIsScaleModalOpen(false)}
        pixelDistance={calibPixelDist}
        initialScale={geometry.scale}
        onSaveScale={handleSaveScale}
      />
    </div>
  );
}
