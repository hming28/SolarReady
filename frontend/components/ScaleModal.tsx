"use client";

import { useState, useEffect, useRef } from "react";
import { Ruler, ShieldCheck, AlertTriangle, Check, X, MapPin } from "lucide-react";
import { ScaleTier, ScaleCalibration } from "@/lib/types";

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixelDistance: number;
  initialScale?: ScaleCalibration;
  onSaveScale: (scale: ScaleCalibration) => void;
}

export default function ScaleModal({
  isOpen,
  onClose,
  pixelDistance,
  initialScale,
  onSaveScale,
}: ScaleModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [knownMeters, setKnownMeters] = useState<string>(
    initialScale?.reference_m ? initialScale.reference_m.toString() : "5.00"
  );
  const [qualityTier, setQualityTier] = useState<ScaleTier>(
    initialScale?.quality_tier || "approx_map_measure"
  );
  const [notes, setNotes] = useState<string>(
    initialScale?.notes || "Google Maps 5m satellite scale bar reference"
  );

  useEffect(() => {
    if (initialScale?.reference_m) {
      setKnownMeters(initialScale.reference_m.toString());
      setQualityTier(initialScale.quality_tier || "approx_map_measure");
      setNotes(initialScale.notes || "");
    } else {
      setKnownMeters("5.00");
      setQualityTier("approx_map_measure");
      setNotes("Google Maps 5m satellite scale bar reference");
    }
  }, [initialScale, isOpen]);

  // Focus trap / auto-focus and Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const metersNum = parseFloat(knownMeters);
  const calculatedMPerPx =
    pixelDistance > 0 && !isNaN(metersNum) && metersNum > 0
      ? metersNum / pixelDistance
      : null;

  const handleApply = () => {
    if (!calculatedMPerPx || metersNum <= 0) return;

    onSaveScale({
      method: "known_line",
      metres_per_pixel: parseFloat(calculatedMPerPx.toFixed(6)),
      reference_m: metersNum,
      quality_tier: qualityTier,
      notes: notes || undefined,
    });
    onClose();
  };

  const handlePreset = (meters: number, label: string) => {
    setKnownMeters(meters.toFixed(2));
    setNotes(label);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scale-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Ruler className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 id="scale-modal-title" className="font-bold text-sm tracking-tight">Scale Calibration</h3>
              <p className="text-[11px] text-slate-400">Ground truth length to pixel ratio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scale calibration modal"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Reference Stats */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drawn Line Length</p>
              <p className="text-sm font-extrabold text-slate-800">{pixelDistance.toFixed(1)} px</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calculated Scale</p>
              <p className="text-sm font-extrabold text-emerald-600">
                {calculatedMPerPx ? `${calculatedMPerPx.toFixed(4)} m/px` : "---"}
              </p>
            </div>
          </div>

          {/* Real world length input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Actual Ground Length (Meters)
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0.1"
                value={knownMeters}
                onChange={(e) => setKnownMeters(e.target.value)}
                placeholder="e.g. 5.00"
                className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">m</span>
            </div>
          </div>

          {/* Quick presets for Malaysian residential buildings and Google Maps */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Quick Scale Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handlePreset(5.00, "Google Maps 5m satellite scale bar reference");
                  setQualityTier("approx_map_measure");
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Maps 5m Bar</span>
              </button>
              <button
                type="button"
                onClick={() => handlePreset(6.70, "Standard 22ft terrace front width")}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                22ft Front (6.70m)
              </button>
              <button
                type="button"
                onClick={() => handlePreset(6.10, "Standard 20ft terrace front width")}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                20ft Front (6.10m)
              </button>
              <button
                type="button"
                onClick={() => handlePreset(11.50, "Elmina 2-storey roof pitch length")}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold border border-amber-200 transition-colors"
              >
                Elmina Pitch (11.50m)
              </button>
            </div>
          </div>

          {/* Quality Tier Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Measurement Source & Confidence</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQualityTier("user_measured")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  qualityTier === "user_measured"
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">User Measured</span>
                  {qualityTier === "user_measured" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Tape measured on-site or verified architectural drawings
                </p>
              </button>

              <button
                type="button"
                onClick={() => setQualityTier("approx_map_measure")}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  qualityTier === "approx_map_measure"
                    ? "border-amber-500 bg-amber-50/50 text-amber-950 ring-2 ring-amber-500/20"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">Map Approximate</span>
                  {qualityTier === "approx_map_measure" && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Measured via satellite ruler (labeled as approximate in report)
                </p>
              </button>
            </div>
          </div>

          {/* Perspective Distortion Notice */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-[11px] text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Honest Measurement Rule:</strong> If this photo is taken from a low angle, perspective distortion
              will introduce area errors. For official quoting, a physical site survey is required.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!calculatedMPerPx}
            className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-40"
          >
            Apply Calibration
          </button>
        </div>
      </div>
    </div>
  );
}
