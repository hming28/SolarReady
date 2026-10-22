"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  Grid, 
  ArrowRight, 
  ArrowLeft,
  Zap, 
  Layers, 
  ShieldCheck, 
  Sliders, 
  Eye, 
  Compass, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Wand2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { 
  Assessment, 
  RoofGeometry, 
  LayoutResponse, 
  PanelSpec, 
  LayoutParams,
  GeminiLayoutRecommendResponse,
  ArrayBlockRecommendation,
} from "@/lib/types";
import Stepper from "@/components/Stepper";

// Dynamically import PanelOverlay without SSR
const PanelOverlay = dynamic(() => import("@/components/PanelOverlay"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
      <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium">Generating Solar Array Projection...</p>
    </div>
  ),
});

// Dynamically import Roof3DViewer without SSR
const Roof3DViewer = dynamic(() => import("@/components/Roof3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
      <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium">Initializing 3D Rooftop Digital Twin...</p>
    </div>
  ),
});

const PANEL_PRESETS: (PanelSpec & { estHardwareRm: number; estTurnkeyRm: number })[] = [
  {
    name: "Tier-1 550W Monocrystalline",
    length_m: 2.278,
    width_m: 1.134,
    rated_power_wp: 550.0,
    min_gap_m: 0.02,
    estHardwareRm: 580,
    estTurnkeyRm: 1925,
  },
  {
    name: "High-Density 450W Mono",
    length_m: 1.903,
    width_m: 1.134,
    rated_power_wp: 450.0,
    min_gap_m: 0.02,
    estHardwareRm: 480,
    estTurnkeyRm: 1575,
  },
  {
    name: "Compact 400W Residential",
    length_m: 1.722,
    width_m: 1.134,
    rated_power_wp: 400.0,
    min_gap_m: 0.02,
    estHardwareRm: 420,
    estTurnkeyRm: 1400,
  },
];

type GridSupplyPhase = "single_phase_5kw" | "three_phase_15kw" | "max_roof";

const GRID_PHASE_CONFIGS: Record<
  GridSupplyPhase,
  {
    label: string;
    shortLabel: string;
    maxKwp: number | null;
    inverterLimit: string;
    desc: string;
    badgeStyle: string;
  }
> = {
  single_phase_5kw: {
    label: "1-Phase (5kWac Solar ATAP Cap)",
    shortLabel: "1-Phase (5kWac)",
    maxKwp: 5.5,
    inverterLimit: "5.0 kWac",
    desc: "Standard Malaysian terrace homes with single-phase TNB meter (capped at 5kWac inverter under Solar ATAP 2026, ~8–10 modules of 550W).",
    badgeStyle: "bg-emerald-950 text-emerald-400 border-emerald-800",
  },
  three_phase_15kw: {
    label: "3-Phase (15kWac Solar ATAP Limit)",
    shortLabel: "3-Phase (15kWac)",
    maxKwp: 16.5,
    inverterLimit: "15.0 kWac",
    desc: "Upgraded 3-phase residential supply under Solar ATAP 2026 (capped at 15kWac inverter, ~24–30 modules of 550W).",
    badgeStyle: "bg-sky-950 text-sky-400 border-sky-800",
  },
  max_roof: {
    label: "Max Physical Roof Capacity",
    shortLabel: "Unconstrained Roof",
    maxKwp: null,
    inverterLimit: "Custom / Commercial",
    desc: "Fills full physical roof space. Systems exceeding 15kWac require commercial ATAP or custom TNB engineering review.",
    badgeStyle: "bg-amber-950 text-amber-300 border-amber-800",
  },
};

export default function LayoutSimPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [layout, setLayout] = useState<LayoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  // Configuration Controls
  const [gridSupplyPhase, setGridSupplyPhase] = useState<GridSupplyPhase>("single_phase_5kw");
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [setbackM, setSetbackM] = useState(0.4);
  const [obstacleBufferM, setObstacleBufferM] = useState(0.3);
  const [orientation, setOrientation] = useState<"optimal" | "portrait" | "landscape">("optimal");
  const [viewMode, setViewMode] = useState<"realistic" | "blueprint" | "3d">("realistic");
  const [activeFacetIndices, setActiveFacetIndices] = useState<number[] | null>(null);
  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [showSedaDetails, setShowSedaDetails] = useState<boolean>(false);

  // Gemini AI Recommendation state & progress bar
  const [isGeminiRunning, setIsGeminiRunning] = useState(false);
  const [geminiProgress, setGeminiProgress] = useState(0);
  const [geminiStatusText, setGeminiStatusText] = useState("");
  const [geminiResult, setGeminiResult] = useState<GeminiLayoutRecommendResponse | null>(null);

  const handleGeminiOptimize = async () => {
    if (!assessment?.geometry) return;
    try {
      setIsGeminiRunning(true);
      setGeminiProgress(15);
      setGeminiStatusText("Connecting to Vision AI API...");

      const timer1 = setTimeout(() => {
        setGeminiProgress(45);
        setGeminiStatusText("Analyzing equatorial sun azimuth (Selangor ~3.18°N) & roof slope orientations...");
      }, 1200);

      const timer2 = setTimeout(() => {
        setGeminiProgress(75);
        setGeminiStatusText("Evaluating monsoonal rainwater drainage (0.35m setback) & wind uplift safety...");
      }, 3000);

      const rec = await api.geminiRecommendLayout(assessmentId);
      clearTimeout(timer1);
      clearTimeout(timer2);

      setGeminiProgress(90);
      setGeminiStatusText("Packing collision-free PV modules onto highest-yield facets...");

      // Apply recommended values
      setOrientation(rec.recommended_orientation);
      setSetbackM(rec.recommended_setback_m);
      setSelectedPresetIdx(rec.recommended_preset_index);
      setActiveFacetIndices(rec.recommended_active_facets);
      setGeminiResult(rec);

      // Re-run packing with recommended parameters AND AI symmetrical array blocks
      await runPacking(
        assessment.geometry,
        PANEL_PRESETS[rec.recommended_preset_index],
        rec.recommended_setback_m,
        obstacleBufferM,
        rec.recommended_orientation,
        rec.recommended_active_facets,
        rec.arrays
      );

      setGeminiProgress(100);
      setGeminiStatusText("AI Solar Array Optimization Complete!");
      setTimeout(() => {
        setIsGeminiRunning(false);
      }, 1000);
    } catch (err: any) {
      alert(`AI Layout Recommendation failed: ${err.message}`);
      setIsGeminiRunning(false);
    }
  };

  const runPacking = async (
    geom: RoofGeometry,
    preset: PanelSpec,
    pSetback: number,
    pObsBuf: number,
    pOrient: "optimal" | "portrait" | "landscape",
    pActiveFacets?: number[] | null,
    pArrays?: ArrayBlockRecommendation[] | null,
    pGridPhase?: GridSupplyPhase
  ) => {
    try {
      setCalculating(true);
      const activePhase = pGridPhase ?? gridSupplyPhase;
      const facetsToUse = pActiveFacets !== undefined ? pActiveFacets : activeFacetIndices;
      const maxKwp = GRID_PHASE_CONFIGS[activePhase].maxKwp ?? undefined;
      const res = await api.optimizeLayout({
        geometry: geom,
        panel_spec: preset,
        params: {
          setback_m: pSetback,
          obstacle_buffer_m: pObsBuf,
          orientation: pOrient,
          allow_estimated_scale: true,
          active_facet_indices: facetsToUse,
          arrays: pArrays,
          max_capacity_kwp: maxKwp,
        },
      });
      setLayout(res);
      // Automatically persist layout to backend so Step 4 Report reflects the latest simulated layout
      await api.updateLayout(assessmentId, res).catch((e) => console.warn("Layout auto-save error:", e));

      if (activeFacetIndices === null && res.facet_layouts && res.facet_layouts.length > 0) {
        setActiveFacetIndices(res.facet_layouts.map((f) => f.facet_index));
      }
    } catch (err: any) {
      console.error("Packing error:", err);
    } finally {
      setCalculating(false);
    }
  };

  const handleGridPhaseChange = (phaseKey: GridSupplyPhase) => {
    setGridSupplyPhase(phaseKey);
    if (!assessment?.geometry) return;
    runPacking(
      assessment.geometry,
      PANEL_PRESETS[selectedPresetIdx],
      setbackM,
      obstacleBufferM,
      orientation,
      activeFacetIndices,
      geminiResult?.arrays,
      phaseKey
    );
  };

  const handleAutoFixScale = async () => {
    if (!assessment?.geometry) return;
    try {
      setCalculating(true);
      const allPts = assessment.geometry.roof_polygons_px.flatMap((p) => p);
      let mPerPx = 0.017;
      if (allPts.length >= 3) {
        const xs = allPts.map((p) => p[0]);
        const ys = allPts.map((p) => p[1]);
        const spanPx = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 120);
        mPerPx = Number((14.0 / spanPx).toFixed(4));
      }
      const updatedGeometry: RoofGeometry = {
        ...assessment.geometry,
        scale: {
          method: "known_line",
          metres_per_pixel: mPerPx,
          reference_m: 14.0,
          quality_tier: "approx_map_measure",
          notes: "Auto-calibrated based on standard Malaysian residential frontage (~14m span)",
        },
      };
      await api.updateGeometry(assessmentId, updatedGeometry);
      setAssessment((prev) => (prev ? { ...prev, geometry: updatedGeometry } : null));
      await runPacking(
        updatedGeometry,
        PANEL_PRESETS[selectedPresetIdx],
        setbackM,
        obstacleBufferM,
        orientation,
        activeFacetIndices,
        geminiResult?.arrays
      );
    } catch (e: any) {
      alert(`Auto-fix scale failed: ${e.message}`);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    api.getAssessment(assessmentId)
      .then(async (data) => {
        if (!isMounted) return;
        setAssessment(data);
        if (data.layout && data.layout.panels && data.layout.panels.length > 0) {
          // Restore saved layout
          setLayout(data.layout);
          if (data.layout.params?.setback_m) setSetbackM(data.layout.params.setback_m);
          if (data.layout.params?.obstacle_buffer_m) setObstacleBufferM(data.layout.params.obstacle_buffer_m);
          if (data.layout.params?.orientation) setOrientation(data.layout.params.orientation);
          if (data.layout.params?.active_facet_indices) setActiveFacetIndices(data.layout.params.active_facet_indices);
          if (data.layout.params?.max_capacity_kwp) {
            if (data.layout.params.max_capacity_kwp <= 5.5) setGridSupplyPhase("single_phase_5kw");
            else if (data.layout.params.max_capacity_kwp <= 16.5) setGridSupplyPhase("three_phase_15kw");
            else setGridSupplyPhase("max_roof");
          } else {
            setGridSupplyPhase("max_roof");
          }
        } else if (data.geometry && data.geometry.roof_polygons_px?.length) {
          const defaultPhase = data.house_type?.toLowerCase().includes("terrace") ? "single_phase_5kw" : "max_roof";
          setGridSupplyPhase(defaultPhase);
          await runPacking(
            data.geometry,
            PANEL_PRESETS[selectedPresetIdx],
            setbackM,
            obstacleBufferM,
            orientation,
            null,
            null,
            defaultPhase
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [assessmentId]);

  const handleApplyParams = () => {
    if (!assessment?.geometry) return;
    runPacking(
      assessment.geometry,
      PANEL_PRESETS[selectedPresetIdx],
      setbackM,
      obstacleBufferM,
      orientation,
      activeFacetIndices,
      geminiResult?.arrays
    );
  };

  const handleToggleFacet = (facetIdx: number) => {
    if (!assessment?.geometry) return;
    const currentActive =
      activeFacetIndices !== null
        ? activeFacetIndices
        : (layout?.facet_layouts?.map((f) => f.facet_index) || [0]);

    let nextActive: number[];
    if (currentActive.includes(facetIdx)) {
      nextActive = currentActive.filter((i) => i !== facetIdx);
    } else {
      nextActive = [...currentActive, facetIdx];
    }
    setActiveFacetIndices(nextActive);
    runPacking(
      assessment.geometry,
      PANEL_PRESETS[selectedPresetIdx],
      setbackM,
      obstacleBufferM,
      orientation,
      nextActive
    );
  };

  const [savingLayout, setSavingLayout] = useState(false);

  const handleProceedToReport = async () => {
    try {
      setSavingLayout(true);
      if (layout) {
        await api.updateLayout(assessmentId, layout);
      }
      router.push(`/report/${assessmentId}`);
    } catch (err: any) {
      console.error("Failed to persist layout before report:", err);
      // Still navigate so user can see report
      router.push(`/report/${assessmentId}`);
    } finally {
      setSavingLayout(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading solar layout simulation...</p>
      </div>
    );
  }

  const imageUrl = api.getImageUrl(assessmentId);
  const isCalibrated = assessment?.geometry?.scale?.quality_tier !== "uncalibrated";

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-900">
      <Stepper currentStep="layout" assessmentId={assessmentId} />

      {/* Top Metrics Strip & Unified View Switcher */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-white shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400">Total Panels:</span>
            <span className="font-extrabold text-amber-400 text-sm">
              {layout?.panel_count || 0} modules
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-slate-400">Peak Capacity:</span>
            <span className="font-extrabold text-emerald-400 text-sm">
              {layout?.capacity_kwp ? `${layout.capacity_kwp} kWp` : "---"}
            </span>
          </div>

          {/* Dynamic Turnkey Cost */}
          {layout?.capacity_kwp && layout.capacity_kwp > 0 ? (
            (() => {
              const is3Phase = gridSupplyPhase === "three_phase_15kw";
              const baseCost = Math.round(layout.capacity_kwp * 3500);
              const threePhaseDelta = is3Phase && layout.capacity_kwp <= 6.0 ? 1200 : 0;
              const totalEstCost = baseCost + threePhaseDelta;
              return (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-950/80 border border-emerald-700/80 px-2.5 py-0.5 rounded-lg shadow-xs">
                  <span className="text-emerald-400 font-semibold text-[11px]">Est. Turnkey Cost:</span>
                  <span className="font-extrabold text-white text-xs font-mono">
                    ~RM {totalEstCost.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 hidden xl:inline">
                    {is3Phase && threePhaseDelta > 0 ? "(incl. 3-Phase Inverter & 4P BOS +RM1.2k)" : "(~RM 3,500/kWp)"}
                  </span>
                </div>
              );
            })()
          ) : null}

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-slate-400">PV Area / Usable:</span>
            <span className="font-semibold text-slate-200">
              {layout?.module_area_m2} m² / {layout?.usable_area_m2 || "---"} m²
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-slate-400">Roof Angle:</span>
            <span className="font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full text-[11px]">
              {assessment?.geometry?.tilt_deg || 15}° Pitch
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <span className="text-slate-400">Grid Status:</span>
            <span
              className={`font-semibold border px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 ${
                layout?.capacity_kwp && layout.capacity_kwp <= 5.0
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : layout?.capacity_kwp && layout.capacity_kwp <= 13.5
                  ? "bg-sky-950 text-sky-300 border-sky-800"
                  : "bg-amber-950 text-amber-300 border-amber-800"
              }`}
            >
              {layout?.capacity_kwp && layout.capacity_kwp <= 5.0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>1-Phase Compliant (≤ 4kWac)</span>
                </>
              ) : layout?.capacity_kwp && layout.capacity_kwp <= 13.5 ? (
                <>
                  <Zap className="w-3 h-3 text-sky-400" />
                  <span>3-Phase Required (≤ 12kWac)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  <span>Commercial Review ({layout?.capacity_kwp || 0} kWp &gt; 12kWac)</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Unified 3-Way View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700/80 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode("realistic")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === "realistic"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Satellite Aerial Photo View"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D Realistic</span>
            <span className="sm:hidden">2D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("blueprint")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === "blueprint"
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="CAD Blueprint Schematic View"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D Blueprint</span>
            <span className="sm:hidden">CAD</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
              viewMode === "3d"
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-sm"
                : "text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
            }`}
            title="3D Rooftop Digital Twin with Sun Path & Soft Shadows"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D Digital Twin</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left: Controls & Specification Inspector Sidebar */}
        <div className="w-full lg:w-80 xl:w-88 bg-slate-900 border-r border-slate-800 flex flex-col h-full min-h-0 shrink-0">
          {/* Scrollable Upper Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span>Layout Parameters</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
                100% Constrained
              </span>
            </div>

            {/* Scale Anomaly Warning Banner if roof area < 25m² and 0 panels */}
            {layout && layout.panel_count === 0 && (layout.roof_area_m2 ?? 0) < 25 && (
              <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-600/80 text-xs text-amber-200 space-y-2 animate-pulse shadow-md">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Roof Scale Anomaly Detected</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  The calibrated roof area is only <strong className="text-amber-400">{layout.roof_area_m2} m²</strong>. A single 550W panel (2.58 m²) plus boundary setbacks cannot fit.
                </p>
                <button
                  type="button"
                  onClick={handleAutoFixScale}
                  disabled={calculating}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{calculating ? "Recalculating..." : "Auto-Fix: Reset to Standard House Scale (~14m)"}</span>
                </button>
              </div>
            )}

            {/* AI Smart Layout Optimizer Card */}
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-800/80 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>AI Array Optimizer</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                  SEDA / TNB
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                AI evaluates equatorial sun angles (Selangor ~3.18°N) to auto-select optimal slope azimuths & setbacks.
              </p>

              {/* Live Loading Progress Bar & Status */}
              {isGeminiRunning && (
                <div className="space-y-1.5 bg-slate-950/90 p-2 rounded-lg border border-emerald-700/80 animate-pulse">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" />
                      <span>AI Analyzing...</span>
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

              <button
                type="button"
                onClick={handleGeminiOptimize}
                disabled={isGeminiRunning || calculating}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                title="Run AI Vision to calculate optimal array orientation and active facets"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeminiRunning ? "animate-spin" : ""}`} />
                <span>{isGeminiRunning ? "AI Optimizing Array..." : "AI Auto-Optimize Array"}</span>
              </button>
            </div>

            {/* AI Solar Engineering Recommendation Results Banner */}
            {geminiResult && (
              <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-800/80 text-xs space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>AI Array Plan</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Applied
                  </span>
                </div>

                {/* Symmetrical Array Quick Badges */}
                {geminiResult.arrays && geminiResult.arrays.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {geminiResult.arrays.map((arr, aIdx) => (
                      <span
                        key={`ai-arr-${aIdx}`}
                        className="font-mono text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 font-bold"
                      >
                        P{arr.facet_index + 1}: {arr.rows}×{arr.cols} {arr.orientation}
                      </span>
                    ))}
                  </div>
                )}

                {/* Collapsible Details Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAiDetails(!showAiDetails)}
                  className="w-full flex items-center justify-between pt-1.5 text-[10px] text-slate-400 hover:text-emerald-400 font-semibold border-t border-slate-800/80 cursor-pointer"
                >
                  <span>{showAiDetails ? "Hide AI Reasoning" : "View AI Reasoning & Azimuth"}</span>
                  {showAiDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAiDetails && (
                  <div className="space-y-1.5 pt-1 text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/60">
                    <p className="text-slate-300 italic">{geminiResult.summary_insights}</p>
                    {geminiResult.arrays?.map((arr, idx) => arr.reason && (
                      <div key={idx} className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                        <strong className="text-white">Plane {arr.facet_index + 1}:</strong> {arr.reason}
                      </div>
                    ))}
                    {geminiResult.azimuth_analysis && (
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        <strong className="text-emerald-300">Sun Azimuth:</strong> {geminiResult.azimuth_analysis}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TNB Grid Supply & SEDA Inverter Cap Selector */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>TNB Supply & SEDA Inverter Cap</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    GRID_PHASE_CONFIGS[gridSupplyPhase].badgeStyle
                  }`}
                >
                  {GRID_PHASE_CONFIGS[gridSupplyPhase].shortLabel}
                </span>
              </div>

              {/* 3-way toggle buttons */}
              <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                {(["single_phase_5kw", "three_phase_15kw", "max_roof"] as GridSupplyPhase[]).map((phaseKey) => {
                  const cfg = GRID_PHASE_CONFIGS[phaseKey];
                  const isSelected = gridSupplyPhase === phaseKey;
                  const costBadge = phaseKey === "single_phase_5kw" ? "~RM 15.4k–19k" : phaseKey === "three_phase_15kw" ? "~RM 46k–55k" : "Full Budget";
                  return (
                    <button
                      key={phaseKey}
                      type="button"
                      onClick={() => handleGridPhaseChange(phaseKey)}
                      aria-pressed={isSelected}
                      className={`p-2 rounded-lg text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 text-slate-950 font-extrabold shadow-sm ring-1 ring-amber-400"
                          : "bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60"
                      }`}
                    >
                      <span className="text-[11px] leading-tight font-bold">{cfg.shortLabel}</span>
                      <span className={`text-[9px] ${isSelected ? "text-slate-950 font-bold" : "text-amber-400 font-mono"}`}>
                        {costBadge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Informational description */}
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                {GRID_PHASE_CONFIGS[gridSupplyPhase].desc}
              </div>

              {/* Informative Note when roof physical size is the natural bottleneck */}
              {gridSupplyPhase !== "single_phase_5kw" && layout && layout.capacity_kwp <= 5.5 && (
                <div className="p-2 rounded-lg bg-slate-900/90 border border-sky-800/60 text-[11px] text-slate-300 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    <strong className="text-sky-300 font-semibold">Physical Roof Limit Reached:</strong> This roof surface is already fully utilized with {layout.panel_count} modules ({layout.capacity_kwp} kWp · ~RM {Math.round(layout.capacity_kwp * 3500).toLocaleString()}). 3-Phase quota unlocks up to 15 kWac (~30 modules), which takes effect if you select more roof facets or on larger properties.
                  </p>
                </div>
              )}

              {/* Advisory when full roof exceeds 15kWac */}
              {gridSupplyPhase === "max_roof" && layout && layout.capacity_kwp > 16.5 && (
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/80 text-[11px] text-amber-300 space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Exceeds Standard 15kWac Residential Cap</span>
                  </div>
                  <p className="text-slate-300 text-[10px] leading-relaxed">
                    At {layout.capacity_kwp} kWp ({layout.panel_count} modules), this exceeds Solar ATAP 2026 domestic limits (15 kWac). Requires commercial ATAP or custom TNB 3-phase substation engineering review.
                  </p>
                </div>
              )}
            </div>

            {/* Panel Preset Selection with AI Recommended Highlight */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-300">Module Specification</label>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI Recommended: 550W
                </span>
              </div>
              <select
                value={selectedPresetIdx}
                onChange={(e) => setSelectedPresetIdx(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
              >
                {PANEL_PRESETS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    {idx === 0 ? "[AI Recommended] " : ""}{p.name} ({p.rated_power_wp}W · ~RM {p.estHardwareRm}/panel)
                  </option>
                ))}
              </select>
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-[10px] text-slate-300 space-y-0.5">
                <div className="font-bold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Module Pricing & Turnkey EPCC Rate:</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Tier-1 Monocrystalline modules cost ~RM {PANEL_PRESETS[selectedPresetIdx].estHardwareRm} per panel (~RM {PANEL_PRESETS[selectedPresetIdx].estTurnkeyRm} all-in turnkey incl. inverter & mounting). Fully matches Malaysian SEDA market benchmarks (~RM 3,500/kWp).
                </p>
              </div>
            </div>

            {/* Roof Edge Setback Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Perimeter Setback</span>
                <span className="font-bold text-amber-400">{setbackM.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.2"
                step="0.05"
                value={setbackM}
                onChange={(e) => setSetbackM(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.20m (Tight)</span>
                <span>0.40m (MS IEC Standard)</span>
                <span>1.20m (Wide)</span>
              </div>
            </div>

            {/* Array Orientation Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Array Orientation</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                {(["optimal", "portrait", "landscape"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOrientation(mode)}
                    className={`py-1.5 rounded-lg capitalize transition-all ${
                      orientation === mode
                        ? "bg-amber-500 text-slate-950 shadow-sm font-extrabold"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Malaysian SEDA & TNB Engineering Guidelines Accordion */}
            <div className="rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSedaDetails(!showSedaDetails)}
                className="w-full p-2.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left cursor-pointer"
              >
                <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>SEDA & TNB Engineering Guidelines</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${GRID_PHASE_CONFIGS[gridSupplyPhase].badgeStyle}`}>
                    {GRID_PHASE_CONFIGS[gridSupplyPhase].inverterLimit}
                  </span>
                  {showSedaDetails ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </div>
              </button>

              {showSedaDetails && (
                <div className="p-3 pt-0 space-y-2 text-xs text-slate-300 border-t border-slate-800/80">
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Single-Phase vs Three-Phase Caps:</span>
                    </span>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      Standard Malaysian terrace homes connect via single-phase TNB meters (capped at 5 kWac inverter under Solar ATAP 2026). 
                      8–10× 550W modules (4.4–5.5 kWp DC) achieves an ideal 1.1× DC/AC ratio. Homes with 3-phase supply can expand up to 15 kWac under Solar ATAP 2026.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>Dual MPPT String Protection:</span>
                    </span>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      Standard residential inverters feature 2 MPPT trackers. Concentrating panels on 1–2 primary azimuth planes avoids multi-orientation string mismatch losses.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Multi-Facet Allocation Section */}
            {layout?.facet_layouts && layout.facet_layouts.length > 0 && (
              <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Slope Facet Allocation</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeFacetIndices?.length ?? layout.facet_layouts.length} / {layout.facet_layouts.length} Active
                  </span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pt-0.5 custom-scrollbar">
                  {layout.facet_layouts.map((fl) => {
                    const isChecked = activeFacetIndices === null ? true : activeFacetIndices.includes(fl.facet_index);
                    return (
                      <label
                        key={`facet-toggle-${fl.facet_index}`}
                        className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-slate-900 border-sky-800/80 text-white"
                            : "bg-slate-950/40 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFacet(fl.facet_index)}
                            className="rounded accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{
                              backgroundColor: ["#0284c7", "#9333ea", "#059669", "#d97706", "#db2777", "#16a34a", "#4f46e5"][fl.facet_index % 7]
                            }}
                          />
                          <span className="font-bold text-[11px]">Plane {fl.facet_index + 1}</span>
                          {fl.slope_direction && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold">
                              {fl.slope_direction}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-amber-400 text-[11px]">
                            {isChecked ? `${fl.panel_count} mods` : "0"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estimated Scale Fallback Notice */}
            {layout?.scale_fallback_applied && (
              <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-800/60 text-[10px] text-amber-300 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-slate-300 leading-tight">
                  Estimated scale applied (~0.08m/px). Panels simulated using standard satellite resolution.
                </p>
              </div>
            )}

            {/* Re-calculate Button */}
            <button
              type="button"
              onClick={handleApplyParams}
              disabled={calculating}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {calculating ? "Calculating Packing..." : "Re-calculate Array Layout"}
            </button>

            {/* Constraint Transparency Badge */}
            <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Deterministic Shapely Geometry (Zero Overlap)</span>
            </div>
          </div>

          {/* Sticky Bottom Action Bar: Always visible on screen, never hidden by scrolling! */}
          <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 shrink-0 space-y-1.5">
            {layout && layout.panel_count === 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-800/80 text-[10px] text-amber-300 leading-tight space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>0 Panels fit on roof surface.</span>
                  {(layout.roof_area_m2 ?? 0) < 25 && (
                    <button
                      type="button"
                      onClick={handleAutoFixScale}
                      disabled={calculating}
                      className="text-[9px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      {calculating ? "Fixing..." : "Auto-Fix Scale (~14m)"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Link
                href={`/editor/${assessmentId}`}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60 shrink-0"
                title="Return to Step 2 Roof Editor"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>

              <button
                type="button"
                onClick={handleProceedToReport}
                disabled={savingLayout || !layout}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingLayout ? (
                  <span>Saving Array Layout...</span>
                ) : (
                  <>
                    <span>View Solar Feasibility Report</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Center: Stage Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 bg-slate-950">
          {assessment?.geometry && layout ? (
            viewMode === "3d" ? (
              <Roof3DViewer
                geometry={assessment.geometry}
                layout={layout}
                imageUrl={imageUrl}
                onSwitchTo2D={() => setViewMode("realistic")}
              />
            ) : (
              <PanelOverlay
                imageUrl={imageUrl}
                geometry={assessment.geometry}
                layout={layout}
                viewMode={viewMode}
              />
            )
          ) : (
            <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <p className="text-xs text-slate-400">No roof geometry available. Please complete Step 2.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
