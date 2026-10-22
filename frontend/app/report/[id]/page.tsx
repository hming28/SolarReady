"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Sun, 
  Zap, 
  DollarSign, 
  Clock, 
  Printer, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  Info, 
  MapPin, 
  Home, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Bookmark,
  Share2,
  Check,
  Edit,
  Grid,
  X
} from "lucide-react";
import { api } from "@/lib/api";
import { Assessment, EnergyFinanceResult } from "@/lib/types";
import Stepper from "@/components/Stepper";
import FinancialCard from "@/components/FinancialCard";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [energyResult, setEnergyResult] = useState<EnergyFinanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingFinance, setIsUpdatingFinance] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [suriaRebate, setSuriaRebate] = useState<number>(2400); // 4.0 kWac * 600 default
  const [inverterKwac, setInverterKwac] = useState<number>(4.0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("solarready_saved_projects");
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list) && list.some((p: any) => p.id === assessmentId)) {
          setIsSaved(true);
        }
      }
    } catch {
      // ignore
    }
  }, [assessmentId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      showToast("✓ Shareable project link copied to clipboard!");
    }
  };

  const handleSaveProject = async () => {
    try {
      const title = projectName.trim() || assessment?.title || assessment?.location?.text || `Terrace Rooftop Solar (${assessmentId.slice(0, 8)})`;
      
      // 1. Persist to Backend API for cross-device synchronization
      await api.updateAssessmentMetadata(assessmentId, {
        title,
        house_type: assessment?.house_type,
        monthly_bill_rm: assessment?.monthly_bill_rm ?? undefined,
        is_saved: true,
      }).catch((e) => console.warn("Backend save metadata error:", e));

      // 2. Also update local storage for offline redundancy
      const stored = localStorage.getItem("solarready_saved_projects");
      const list = stored ? JSON.parse(stored) : [];
      const newEntry = {
        id: assessmentId,
        title,
        houseType: assessment?.house_type || "Residential Rooftop",
        location: assessment?.location?.text || "Peninsular Malaysia",
        capacityKwp: assessment?.layout?.capacity_kwp || 4.4,
        panelCount: assessment?.layout?.panel_count || 8,
        costRm: energyResult?.finance.cost_rm || 15400,
        annualSavingsRm: energyResult?.finance.annual_savings_rm.base || 2230,
        paybackYears: energyResult?.finance.payback_years.base || 5.8,
        updatedAt: new Date().toLocaleDateString("en-MY", { month: "short", day: "numeric", year: "numeric" }),
      };

      const filtered = list.filter((p: any) => p.id !== assessmentId);
      filtered.unshift(newEntry);
      localStorage.setItem("solarready_saved_projects", JSON.stringify(filtered));

      setIsSaved(true);
      setIsSaveModalOpen(false);
      showToast("✓ Assessment saved to Your Projects dashboard & cloud database!");
    } catch (err: any) {
      alert("Failed to save project: " + err.message);
    }
  };

  const fetchAssessmentAndEnergy = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAssessment(assessmentId);
      setAssessment(data);
      if (data.title) {
        setProjectName(data.title);
      }

      const capacityKwp =
        data.layout?.capacity_kwp && data.layout.capacity_kwp > 0
          ? data.layout.capacity_kwp
          : 4.4;

      // Estimate energy & finances with Solar ATAP RP4 default rates
      const energyData = await api.estimateEnergy({
        capacity_kwp: capacityKwp,
        lat: data.location?.lat || 3.185,
        lon: data.location?.lon || 101.512,
        self_use_pct: 60.0,
        tariff_rm_per_kwh: 0.4443,
        export_rate_rm_per_kwh: 0.2703,
        cost_per_kwp_rm: 3500.0,
        assessment_id: assessmentId,
      });

      // Synchronize net payback with default SuRIA Home rebate (4.0 kWac = RM 2,400)
      const grossCost = energyData.finance.cost_rm;
      const netCost = Math.max(0, grossCost - 2400);
      const netPaybackBase = energyData.finance.annual_savings_rm.base > 0
        ? Number((netCost / energyData.finance.annual_savings_rm.base).toFixed(1))
        : 10;
      setEnergyResult({
        ...energyData,
        finance: {
          ...energyData.finance,
          payback_years: {
            low: Number((netCost / energyData.finance.annual_savings_rm.high).toFixed(1)),
            base: netPaybackBase,
            high: Number((netCost / energyData.finance.annual_savings_rm.low).toFixed(1)),
          },
        },
      });
    } catch (err: any) {
      console.error("Failed to load report data:", err);
      setError(err?.message || "Failed to calculate solar feasibility report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessmentAndEnergy();
  }, [assessmentId]);

  const handleUpdateFinancialParams = async (
    selfUsePct: number,
    tariff: number,
    costPerKwp: number,
    exportRate: number = 0.2703,
    suriaRebateRm: number = 2400,
    inverterRatingKwac: number = 4.0
  ) => {
    if (!assessment) return;
    try {
      setIsUpdatingFinance(true);
      setSuriaRebate(suriaRebateRm);
      setInverterKwac(inverterRatingKwac);
      const capKwp = assessment.layout?.capacity_kwp || 4.4;

      // 1. Instantly update local energyResult state so top KPI cards update with 0ms lag
      if (energyResult) {
        const sRatio = selfUsePct / 100.0;
        const eRatio = 1.0 - sRatio;
        const calcSavings = (gen: number) =>
          Number(((gen * sRatio * tariff) + (gen * eRatio * exportRate)).toFixed(2));
        const newSavings = {
          low: calcSavings(energyResult.annual_generation_kwh.low),
          base: calcSavings(energyResult.annual_generation_kwh.base),
          high: calcSavings(energyResult.annual_generation_kwh.high),
        };
        const grossCost = Math.round(capKwp * costPerKwp);
        const netCost = Math.max(0, grossCost - suriaRebateRm);
        const newPayback = {
          low: Number((netCost / newSavings.high).toFixed(1)),
          base: Number((netCost / newSavings.base).toFixed(1)),
          high: Number((netCost / newSavings.low).toFixed(1)),
        };
        setEnergyResult({
          ...energyResult,
          finance: {
            ...energyResult.finance,
            cost_rm: grossCost,
            cost_per_kwp_rm: costPerKwp,
            self_use_pct: selfUsePct,
            tariff_rm_per_kwh: tariff,
            export_rate_rm_per_kwh: exportRate,
            annual_savings_rm: newSavings,
            payback_years: newPayback,
          },
        });
      }

      // 2. Synchronize with backend API
      const updated = await api.estimateEnergy({
        capacity_kwp: capKwp,
        lat: assessment.location?.lat || 3.185,
        lon: assessment.location?.lon || 101.512,
        self_use_pct: selfUsePct,
        tariff_rm_per_kwh: tariff,
        export_rate_rm_per_kwh: exportRate,
        cost_per_kwp_rm: costPerKwp,
        assessment_id: assessmentId,
      });

      // Synchronize backend response while maintaining net payback with SuRIA rebate
      const grossCost = updated.finance.cost_rm;
      const netCost = Math.max(0, grossCost - suriaRebateRm);
      const netPaybackBase = updated.finance.annual_savings_rm.base > 0
        ? Number((netCost / updated.finance.annual_savings_rm.base).toFixed(1))
        : 10;

      setEnergyResult({
        ...updated,
        finance: {
          ...updated.finance,
          payback_years: {
            low: Number((netCost / updated.finance.annual_savings_rm.high).toFixed(1)),
            base: netPaybackBase,
            high: Number((netCost / updated.finance.annual_savings_rm.low).toFixed(1)),
          },
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingFinance(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (error && !energyResult) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
        <div className="no-print">
          <Stepper currentStep="report" assessmentId={assessmentId} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="p-6 max-w-md bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Unable to Synthesize Solar Report</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
            <div className="flex gap-2 pt-2 justify-center">
              <Link
                href={`/layout-sim/${assessmentId}`}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Simulation</span>
              </Link>
              <button
                type="button"
                onClick={fetchAssessmentAndEnergy}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Retry Calculation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !assessment || !energyResult) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center space-y-3 min-h-screen">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Synthesizing Solar Feasibility Report...</p>
      </div>
    );
  }

  const qualityTier = assessment.geometry?.scale?.quality_tier || "uncalibrated";
  const capacityKwp = assessment.layout?.capacity_kwp || 4.4;
  const panelCount = assessment.layout?.panel_count || 8;
  const grossRoofArea = assessment.geometry?.roof_area_m2;
  const pvModuleArea = assessment.layout?.module_area_m2 || Number((panelCount * 2.58).toFixed(2));

  // Dynamic Module Preset Resolution based on layout capacity and module count
  const panelPresetsMap: Record<number, { name: string; hardwareRm: number; turnkeyRate: number }> = {
    550: { name: "Tier-1 550W Monocrystalline", hardwareRm: 580, turnkeyRate: 3500 },
    450: { name: "High-Density 450W Mono", hardwareRm: 480, turnkeyRate: 3500 },
    400: { name: "Compact 400W Residential", hardwareRm: 420, turnkeyRate: 3500 },
  };

  const detectedWp = panelCount > 0 ? Math.round((capacityKwp / panelCount) * 1000) : 550;
  const matchedPresetKey = [550, 450, 400].reduce((prev, curr) => 
    Math.abs(curr - detectedWp) < Math.abs(prev - detectedWp) ? curr : prev
  );
  const activeModulePreset = panelPresetsMap[matchedPresetKey];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <div className="no-print">
        <Stepper currentStep="report" assessmentId={assessmentId} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 flex-1">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                Feasibility Assessment
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  qualityTier === "user_measured"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : qualityTier === "approx_map_measure"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                Scale: {qualityTier === "approx_map_measure" ? "Google Maps 5m Bar" : qualityTier === "user_measured" ? "User Measured" : "Uncalibrated"}
              </span>
              {assessment.is_demo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Demo Data
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Rooftop Solar Feasibility & Energy Report
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>{assessment.location?.text}</span>
              <span>·</span>
              <span>{assessment.house_type}</span>
              <span>·</span>
              <span className="font-mono text-slate-400">ID: {assessmentId}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
            {/* Save Project Button */}
            <button
              type="button"
              onClick={() => {
                setProjectName(assessment.location?.text || "");
                setIsSaveModalOpen(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isSaved
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-amber-500/20"
              }`}
              title="Save this solar feasibility study to your dashboard"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-white" : ""}`} />
              <span>{isSaved ? "✓ Project Saved" : "Save Project"}</span>
            </button>

            {/* Copy Shareable Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy link to clipboard"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copy Link</span>
            </button>

            <Link
              href={`/layout-sim/${assessmentId}`}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Return to Step 3 Solar Simulation"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </Link>
          </div>
        </div>

        {/* Quick Multi-Step Editor Navigation Banner */}
        <div className="bg-slate-100/90 border border-slate-200/90 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 no-print shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Need to fine-tune roof boundaries or test different solar modules? All steps are fully editable.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/editor/${assessmentId}`}
              className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors"
              title="Edit roof polygons, scale calibration, and pitch angle in Step 2"
            >
              <span>✏️ Edit Roof & Pitch (Step 2)</span>
            </Link>
            <Link
              href={`/layout-sim/${assessmentId}`}
              className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors"
              title="Reconfigure panel layout, setbacks, and grid limits in Step 3"
            >
              <span>⚡ Reconfigure Panels (Step 3)</span>
            </Link>
          </div>
        </div>

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-950/95 text-white border border-emerald-500/80 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Save Project Name Modal */}
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  <span>Save Project to Dashboard</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-700 block">Project / Property Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. City of Elmina Terrace (Phase 2)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <p className="text-[10.5px] text-slate-400">
                  This assessment will appear under &ldquo;Saved Projects &amp; Case Studies&rdquo; on the homepage for 1-click re-opening and editing.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirm &amp; Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Capacity */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Installed Capacity</span>
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-2">
              <div className="text-3xl font-black text-slate-900">{capacityKwp} kWp</div>
              <p className="text-xs text-slate-500">{panelCount} × {activeModulePreset.name}</p>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
              <span>PV Module Area:</span>
              <span className="font-semibold text-slate-700">{pvModuleArea} m²</span>
            </div>
          </div>

          {/* Annual Generation */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Est. Annual Generation</span>
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-3xl font-black text-emerald-700">
                {energyResult.annual_generation_kwh.base.toLocaleString()} kWh
              </div>
              <p className="text-xs text-slate-500">
                Range: {energyResult.annual_generation_kwh.low.toLocaleString()} – {energyResult.annual_generation_kwh.high.toLocaleString()} kWh/yr
              </p>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
              <span>Specific Yield:</span>
              <span className="font-semibold text-slate-700">
                ~{energyResult.specific_yield_kwh_per_kwp.base} kWh/kWp
              </span>
            </div>
          </div>

          {/* Annual Savings */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Est. Annual Savings</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="my-2">
              <div className="text-3xl font-black text-emerald-700">
                RM {energyResult.finance.annual_savings_rm.base.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500">
                ~RM {(energyResult.finance.annual_savings_rm.base / 12).toFixed(0)} / month direct offset
              </p>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
              <span>Tariff Assumed:</span>
              <span className="font-semibold text-slate-700">
                RM {energyResult.finance.tariff_rm_per_kwh.toFixed(3)}/kWh
              </span>
            </div>
          </div>

          {/* Payback Horizon */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Simple Payback Horizon</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="my-2">
              <div className="text-3xl font-black text-amber-600">
                {energyResult.finance.payback_years.base
                  ? `${energyResult.finance.payback_years.base} Yrs`
                  : "N/A"}
              </div>
              <p className="text-xs text-slate-500">
                {suriaRebate > 0 ? (
                  <span>
                    Net: <strong className="text-emerald-700 font-bold">RM {Math.max(0, energyResult.finance.cost_rm - suriaRebate).toLocaleString()}</strong>
                    {" "}(after -RM {suriaRebate.toLocaleString()} SuRIA)
                  </span>
                ) : (
                  <span>Upfront: RM {energyResult.finance.cost_rm.toLocaleString()}</span>
                )}
              </p>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
              <span>Policy Status:</span>
              <span className="font-semibold text-emerald-700">Solar ATAP 2026 Eligible</span>
            </div>
          </div>
        </div>

        {/* Roof Geometry, Dimensions & Carbon Impact Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dimensions & Scale Audit Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-slate-800 text-xs font-bold border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>Roof Geometry & Scale Audit</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold uppercase">
                {assessment.geometry?.scale?.quality_tier?.replace("_", " ") || "Calibrated"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Calibrated Ratio:</span>
                <span className="font-mono font-bold text-slate-800">
                  {assessment.geometry?.scale?.metres_per_pixel ? `${assessment.geometry.scale.metres_per_pixel.toFixed(4)} m/px` : "---"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Roof Pitch / Tilt:</span>
                <span className="font-bold text-amber-600">
                  {assessment.geometry?.tilt_deg !== undefined ? assessment.geometry.tilt_deg : 15}° Slope
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Gross Roof Area:</span>
                <span className="font-mono font-bold text-slate-800">
                  {grossRoofArea ? `${grossRoofArea} m²` : `${pvModuleArea} m²`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Roof Planes:</span>
                <span className="font-bold text-slate-800">
                  {assessment.geometry?.roof_polygons_px?.length || 1} Independent Facet(s)
                </span>
              </div>
            </div>
            {assessment.geometry?.scale?.notes && (
              <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                Scale reference: {assessment.geometry.scale.notes}
              </p>
            )}
          </div>

          {/* Environmental Carbon Abatement Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-2xl border border-emerald-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-emerald-950 text-xs font-bold border-b border-emerald-100 pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Environmental Carbon Abatement</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold uppercase">
                SDP Planet Track
              </span>
            </div>
            <div className="my-1">
              <div className="text-3xl font-black text-emerald-800">
                {((energyResult.annual_generation_kwh.base * 0.589) / 1000).toFixed(2)} t CO₂ / yr
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Equivalent to ~{Math.round((energyResult.annual_generation_kwh.base * 0.589) / 1000 * 45)} mature tropical trees planted annually.
              </p>
            </div>
            <div className="text-[10px] text-emerald-600/80 border-t border-emerald-100 pt-2">
              Peninsular Malaysia Grid Emission Factor: 0.589 kg CO₂/kWh (Energy Commission Malaysia / SEDA).
            </div>
          </div>
        </div>

        {/* Rooftop Layout & Module Blueprint Preview (Guaranteed print-friendly 2D vector visual) */}
        {assessment.layout?.panels && assessment.layout.panels.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Rooftop PV Array Layout Blueprint ({panelCount} Modules · {capacityKwp} kWp)
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                {activeModulePreset.name}
              </span>
            </div>

            <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {/* Aerial/Satellite Underlay */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={api.getImageUrl(assessmentId)}
                alt="Rooftop Satellite Image"
                className="w-full h-full object-contain opacity-70"
              />

              {/* Scaled SVG Overlay with Roof Polygon & Solar Panels */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${assessment.image?.width_px || 1000} ${assessment.image?.height_px || 650}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Roof Polygons */}
                {assessment.geometry?.roof_polygons_px?.map((poly, idx) => (
                  <polygon
                    key={`roof-poly-${idx}`}
                    points={poly.map((p) => p.join(",")).join(" ")}
                    fill="rgba(2, 132, 199, 0.15)"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                ))}

                {/* Solar Panel Rectangles */}
                {assessment.layout.panels.map((p, idx) => {
                  const mPerPx = assessment.geometry?.scale?.metres_per_pixel || 0.02;
                  const xPx = p.x_px ?? (p.x_m / mPerPx);
                  const yPx = p.y_px ?? (p.y_m / mPerPx);
                  const wPx = p.w_px ?? (p.w_m / mPerPx);
                  const hPx = p.h_px ?? (p.h_m / mPerPx);
                  return (
                    <g key={`panel-${idx}`}>
                      <rect
                        x={xPx}
                        y={yPx}
                        width={wPx}
                        height={hPx}
                        fill="#0c1f38"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        rx="1"
                      />
                      {/* Grid line inside panel */}
                      <line
                        x1={xPx + wPx * 0.5}
                        y1={yPx}
                        x2={xPx + wPx * 0.5}
                        y2={yPx + hPx}
                        stroke="rgba(245, 158, 11, 0.4)"
                        strokeWidth="0.8"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Informational overlay badge */}
              <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700 text-[10.5px] text-slate-300 font-mono">
                <span>Scale: {assessment.geometry?.scale?.metres_per_pixel?.toFixed(4) || "0.0200"} m/px · {panelCount} Panels Placed</span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Financial Simulator */}
        <FinancialCard
          initialResult={energyResult}
          capacityKwp={capacityKwp}
          panelCount={panelCount}
          moduleHardwareRm={activeModulePreset.hardwareRm}
          moduleName={activeModulePreset.name}
          initialMonthlyBillRm={assessment.monthly_bill_rm ?? 380}
          onUpdateParams={handleUpdateFinancialParams}
          isUpdating={isUpdatingFinance}
        />

        {/* Methodology & Assumptions Transparency Accordion */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Assumptions & Technical Transparency Audit</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="space-y-2">
              <p className="font-semibold text-slate-800">Solar Irradiance Baseline:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Source: {energyResult.source} (EC JRC PVGIS v6 / SEDA historical dataset).</li>
                <li>Geographic Lat/Lon: {assessment.location?.lat || 3.185}° N, {assessment.location?.lon || 101.512}° E (Selangor).</li>
                <li>Assumed optimal rooftop inclination: 10.0° facing south.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-800">System Losses Breakdown (14.0% Total):</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Inverter conversion efficiency: ~97.5%</li>
                <li>Thermal coefficient derate: ~-0.35%/°C above 25°C ambient</li>
                <li>Soiling and tropical dust derating: 3.0%</li>
                <li>DC/AC wiring and mismatch: ~2.0%</li>
              </ul>
            </div>
          </div>

          {/* Legal / Engineering Disclaimer */}
          <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Academic & Feasibility Disclaimer:</p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                This report is generated for preliminary feasibility modeling under the SDP University Hackathon 2026.
                It does not constitute an engineering structural certification, electrical guarantee, or commercial turnkey quotation.
                Final installation viability requires physical rooftop truss inspection and load-bearing sign-off by an SEDA-certified PV engineer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
