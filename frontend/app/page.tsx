"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  UploadCloud, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  FileCheck,
  Bookmark,
  Trash2,
  Edit,
  Zap,
  Layers,
  Compass,
  Home,
  Receipt
} from "lucide-react";
import { api } from "@/lib/api";
import Stepper from "@/components/Stepper";

interface SavedProject {
  id: string;
  title: string;
  houseType: string;
  location: string;
  capacityKwp: number;
  panelCount: number;
  costRm: number;
  annualSavingsRm: number;
  paybackYears: number;
  updatedAt: string;
  isBenchmark?: boolean;
}

const DEFAULT_BENCHMARKS: SavedProject[] = [
  {
    id: "demo-elmina-terrace-01",
    title: "City of Elmina Terrace Demo",
    houseType: "2-Storey Link (22' x 75')",
    location: "Elmina West, Selangor",
    capacityKwp: 4.4,
    panelCount: 8,
    costRm: 15400,
    annualSavingsRm: 2840,
    paybackYears: 5.4,
    updatedAt: "Verified Benchmark",
    isBenchmark: true,
  },
  {
    id: "sample_setia_indah",
    title: "Setia Indah 2-Storey Terrace",
    houseType: "2-Storey Linked Terrace",
    location: "Setia Indah, Setia Alam, Selangor",
    capacityKwp: 5.5,
    panelCount: 10,
    costRm: 19250,
    annualSavingsRm: 2854.28,
    paybackYears: 6.7,
    updatedAt: "Saved Assessment",
    isBenchmark: false,
  },
];

export default function UploadPage() {
  const router = useRouter();

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("Peninsular Malaysia");
  const [houseType, setHouseType] = useState("Residential Rooftop");
  const [monthlyBillRm, setMonthlyBillRm] = useState<number | null>(380);
  const [consent, setConsent] = useState(true);

  // Status states
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Saved Projects state
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(DEFAULT_BENCHMARKS);

  useEffect(() => {
    let isMounted = true;
    const loadProjects = async () => {
      try {
        // 1. Fetch from backend
        const backendSummaries = await api.listAssessments().catch(() => []);
        const backendList: SavedProject[] = backendSummaries.map((s) => ({
          id: s.id,
          title: s.title,
          houseType: s.house_type,
          location: s.location,
          capacityKwp: s.capacity_kwp,
          panelCount: s.panel_count,
          costRm: s.cost_rm,
          annualSavingsRm: s.annual_savings_rm,
          paybackYears: s.payback_years,
          updatedAt: s.updated_at,
          isBenchmark: s.is_demo,
        }));

        // 2. Fetch from localStorage (for migration/backup)
        let localList: SavedProject[] = [];
        try {
          const stored = localStorage.getItem("solarready_saved_projects");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              localList = parsed.map((p: any) => ({ ...p, isBenchmark: false }));
            }
          }
        } catch {}

        // Combine unique by id: backend projects take precedence
        const idSet = new Set<string>();
        const merged: SavedProject[] = [];
        for (const p of [...backendList, ...localList]) {
          if (!idSet.has(p.id)) {
            idSet.add(p.id);
            merged.push(p);
          }
        }

        // Add benchmark if not present
        for (const b of DEFAULT_BENCHMARKS) {
          if (!idSet.has(b.id)) {
            idSet.add(b.id);
            merged.push(b);
          }
        }

        if (isMounted) {
          setSavedProjects(merged);
        }
      } catch (err) {
        console.error("Failed to load assessments:", err);
      }
    };
    loadProjects();
    return () => { isMounted = false; };
  }, []);

  const handleDeleteSavedProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteAssessment(projectId).catch(() => {});
      const stored = localStorage.getItem("solarready_saved_projects");
      if (stored) {
        const list = JSON.parse(stored);
        const updated = list.filter((p: any) => p.id !== projectId);
        localStorage.setItem("solarready_saved_projects", JSON.stringify(updated));
      }
      setSavedProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!["image/jpeg", "image/png"].includes(selected.type)) {
        setErrorMessage("Unsupported format. Please upload a JPG or PNG image.");
        return;
      }
      if (selected.size > 15 * 1024 * 1024) {
        setErrorMessage("File exceeds 15 MB limit. Please select a smaller image.");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleStartAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a rooftop image to continue.");
      return;
    }
    if (!consent) {
      setErrorMessage("Please accept the privacy consent statement to proceed.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      // 1. Create assessment
      const assessment = await api.createAssessment({
        location: { text: locationText, lat: 3.185, lon: 101.512 },
        house_type: houseType,
        monthly_bill_rm: monthlyBillRm ?? undefined,
        consent: { image_use: true, timestamp: new Date().toISOString() },
        is_demo: false,
      });

      // 2. Upload image
      await api.uploadImage(assessment.id, file);

      // 3. Navigate to editor
      router.push(`/editor/${assessment.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload image. Please try again.");
      setIsUploading(false);
    }
  };

  const handleLoadDemo = () => {
    router.push("/editor/demo-elmina-terrace-01");
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
      <Stepper currentStep="upload" />

      {/* Hero Header - Ultra-compact single-screen layout */}
      <div className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/60 py-1.5 sm:py-2 px-4 text-center shrink-0">
        <div className="max-w-2xl mx-auto space-y-0.5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Verifiable Rooftop Solar Feasibility Pipeline</span>
          </div>
          <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Assess Your Rooftop Solar Potential in Minutes
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-600 max-w-lg mx-auto leading-snug">
            Grounded geometric panel packing with verifiable scale calibration and Malaysian TNB tariff modeling.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-5xl mx-auto px-4 py-2 sm:py-3 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-start">
          {/* Card A: Upload Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900">Upload Rooftop Image</h2>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Provide an aerial or satellite photo of your house roof</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                Step 1 of 4
              </span>
            </div>

            {errorMessage && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium text-[11px]">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleStartAssessment} className="space-y-2">
              {/* Dropzone */}
              <div>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-2.5 sm:p-3 text-center transition-colors bg-slate-50/50 hover:bg-amber-50/20 group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {previewUrl ? (
                    <div className="space-y-1.5">
                      <div className="relative mx-auto w-full h-24 sm:h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{file?.name} ({(file!.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 py-1">
                      <div className="w-8 h-8 mx-auto rounded-full bg-amber-100/70 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        Drag & drop roof image here, or <span className="text-amber-600 underline">browse</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Supports orthogonal drone photos or Google Maps satellite screenshots
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Monthly Electricity Bill Intake */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-amber-500" />
                    <span>Average Monthly Electricity Bill (Optional)</span>
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <span>RM</span>
                    <input
                      type="number"
                      min="50"
                      max="3000"
                      value={monthlyBillRm || ""}
                      onChange={(e) => setMonthlyBillRm(e.target.value ? Number(e.target.value) : null)}
                      placeholder="380"
                      className="w-12 bg-transparent text-right font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Presets:</span>
                  {[180, 280, 380, 550, 850].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMonthlyBillRm(amt)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        monthlyBillRm === amt
                          ? "bg-amber-500 text-slate-950 shadow-2xs font-extrabold"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      RM {amt}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Pre-fills your baseline consumption so Step 4 instantly calculates your before vs after electric bills.
                </p>
              </div>

              {/* Privacy Consent */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-[10.5px] text-slate-600 font-medium leading-tight">
                    I consent to processing this rooftop image for solar feasibility simulation. All GPS EXIF metadata
                    will be removed automatically before processing.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing & Sanitizing Image...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Roof Editor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card B: Quick Demo & Guidelines (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            {/* Quick Demo Card */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-3 sm:p-3.5 text-slate-950 shadow-md shadow-amber-500/15 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 text-[9px] font-black uppercase tracking-wider">
                  Verified Demo
                </span>
                <span className="text-[10px] font-semibold text-amber-950/80">Sime Darby Property</span>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-950 leading-tight">
                  City of Elmina Terrace Demo
                </h3>
                <p className="text-[10.5px] text-slate-900/90 mt-0.5 leading-snug">
                  Pre-configured with ground-truth measured scale (11.50m roof pitch) & clear obstacles.
                </p>
              </div>
              <div className="bg-white/30 backdrop-blur-xs rounded-xl p-1.5 sm:p-2 text-[10.5px] space-y-0.5 font-medium border border-white/40">
                <div className="flex justify-between">
                  <span className="text-slate-800">Typology:</span>
                  <span className="font-bold">2-Storey Link (22&apos; x 75&apos;)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-800">Calibration:</span>
                  <span className="font-bold text-emerald-900">User Measured (0.02 m/px)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-800">Gross Roof Area:</span>
                  <span className="font-bold">~77.0 m²</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="w-full py-1.5 sm:py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <span>Load Elmina Benchmark Demo</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

            {/* Photo Guidelines Card */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Image Capture Guidelines</span>
              </div>
              <ul className="text-[10.5px] text-slate-600 space-y-0.5 leading-tight">
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><strong>Top-Down View:</strong> Vertical orthogonal angles minimize distortion.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><strong>Clear Perimeter:</strong> Ensure full roof boundaries and ridgelines are visible.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><strong>Watertight Roof Facets:</strong> Multimodal AI automatically segments all slope orientations.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Saved Assessments & Verified Case Studies Gallery (Solves empty space & adds project management) */}
      <div className="max-w-5xl mx-auto px-4 py-3 w-full space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Saved Assessments &amp; Benchmark Projects ({savedProjects.length})
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            1-Click Re-open &amp; Bi-directional Editing (Steps 1–4)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {savedProjects.map((proj) => (
            <div
              key={proj.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-amber-400/80 transition-all flex flex-col justify-between space-y-2.5 group"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      proj.isBenchmark
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {proj.isBenchmark ? "Benchmark" : "Saved Project"}
                  </span>
                  {!proj.isBenchmark && proj.id !== "sample_setia_indah" && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedProject(proj.id, e)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                      title="Remove from saved projects"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                  {proj.title}
                </h3>
                <p className="text-[10.5px] text-slate-500 flex items-center gap-1.5">
                  <span>{proj.houseType}</span>
                  <span>·</span>
                  <span>{proj.location}</span>
                </p>
              </div>

              {/* Key Specs Pills */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center text-slate-700">
                <div>
                  <span className="block text-[9px] text-slate-400 font-medium">Capacity</span>
                  <span className="font-mono font-bold text-[11px] text-emerald-700">{proj.capacityKwp} kWp</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400 font-medium">Est. Cost</span>
                  <span className="font-mono font-bold text-[11px] text-slate-800">~RM {(proj.costRm / 1000).toFixed(1)}k</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-400 font-medium">Annual Savings</span>
                  <span className="font-mono font-bold text-[11px] text-amber-700">RM {proj.annualSavingsRm.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <Link
                  href={`/report/${proj.id}`}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold text-center transition-colors flex items-center justify-center gap-1"
                >
                  <span>View Report</span>
                  <ArrowRight className="w-3 h-3 text-amber-400" />
                </Link>
                <Link
                  href={`/editor/${proj.id}`}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                  title="Edit roof polygons, scale, and panels"
                >
                  <Edit className="w-3 h-3 text-slate-500" />
                  <span>Edit</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW: 3-Pillar Technology & Transparency Architecture Strip */}
      <div className="max-w-5xl mx-auto px-4 pb-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Compass className="w-4 h-4 text-cyan-600" />
              <span>Verifiable Scale Anchoring</span>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-relaxed">
              Every roof is calibrated against the Google Maps 5m scale bar or user roof pitch. Prevents arbitrary zooming errors.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Multimodal AI Vision Topology</span>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-relaxed">
              Automated roof facet segmentation, obstacle boundary avoidance, and 15° pitch slope detection for tropical monsoon storm runoff.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Malaysian SEDA &amp; TNB Modeling</span>
            </div>
            <p className="text-[10.5px] text-slate-600 leading-relaxed">
              Calculates Solar ATAP 5kWac (1-Phase) and 15kWac (3-Phase) caps, Peninsular Malaysia PVGIS v6 irradiance, and tiered TNB domestic savings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
