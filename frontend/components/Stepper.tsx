"use client";

import Link from "next/link";
import { Check, UploadCloud, Edit3, Ruler, Grid, BarChart3, ArrowLeft, ArrowRight } from "lucide-react";

export type StepKey = "upload" | "editor" | "calibration" | "layout" | "report";

interface StepperProps {
  currentStep: StepKey;
  assessmentId?: string;
}

export default function Stepper({ currentStep, assessmentId }: StepperProps) {
  const steps = [
    { key: "upload", label: "Upload & Info", icon: UploadCloud, path: "/" },
    { key: "editor", label: "Roof & Facets", icon: Edit3, path: assessmentId ? `/editor/${assessmentId}` : "/editor" },
    { key: "layout", label: "Panel Packing", icon: Grid, path: assessmentId ? `/layout-sim/${assessmentId}` : "/layout-sim" },
    { key: "report", label: "Feasibility & ROI", icon: BarChart3, path: assessmentId ? `/report/${assessmentId}` : "/report" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  // Determine back navigation link and label
  let backHref = "/";
  let backLabel = "Back to Upload";
  if (currentStep === "editor") {
    backHref = "/";
    backLabel = "Back to Upload";
  } else if (currentStep === "layout") {
    backHref = assessmentId ? `/editor/${assessmentId}` : "/editor";
    backLabel = "Back to Roof Editor";
  } else if (currentStep === "report") {
    backHref = assessmentId ? `/layout-sim/${assessmentId}` : "/layout-sim";
    backLabel = "Back to Solar Simulation";
  }

  // Determine forward/next navigation link and label for quick header jumping
  let nextHref: string | null = null;
  let nextLabel = "";
  if (assessmentId) {
    if (currentStep === "editor") {
      nextHref = `/layout-sim/${assessmentId}`;
      nextLabel = "Next: Panel Packing";
    } else if (currentStep === "layout") {
      nextHref = `/report/${assessmentId}`;
      nextLabel = "Next: ROI Report";
    }
  }

  return (
    <div className="w-full bg-white border-b border-slate-200/80 shadow-xs py-1.5 sm:py-2 px-3 sm:px-6 shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
        {/* Back Button (shown on Steps 2, 3, 4) */}
        {currentStep !== "upload" ? (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs transition-colors shrink-0"
            title={backLabel}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">Back</span>
          </Link>
        ) : (
          <div className="w-16 hidden sm:block" />
        )}

        {/* Stepper Pipeline */}
        <div className="flex-1 flex items-center justify-between max-w-3xl">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            // When an assessment exists, all other valid steps are directly clickable to view/jump freely
            const isAvailable = Boolean(assessmentId) || isCompleted;
            const isClickable = !isCurrent && isAvailable;
            const Icon = step.icon;

            const content = (
              <div className={`flex items-center gap-1.5 sm:gap-2 ${isClickable ? "group cursor-pointer" : ""}`}>
                <div
                  className={`w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                    isCompleted
                      ? "bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700"
                      : isCurrent
                      ? "bg-amber-500 text-slate-950 ring-2 ring-amber-200 shadow-xs"
                      : isClickable
                      ? "bg-slate-100 text-slate-700 border border-slate-300 group-hover:bg-amber-50 group-hover:border-amber-400 group-hover:text-amber-700 shadow-2xs"
                      : "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed"
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-[2.5]" /> : <Icon className="w-3 h-3" />}
                </div>
                <div className="hidden md:block text-left">
                  <p
                    className={`text-xs font-semibold leading-tight transition-colors ${
                      isCurrent
                        ? "text-slate-950 font-bold"
                        : isCompleted
                        ? "text-emerald-700 group-hover:underline"
                        : isClickable
                        ? "text-slate-700 group-hover:text-amber-700 group-hover:underline"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-[10px] leading-tight transition-colors ${
                      isClickable ? "text-slate-400 group-hover:text-amber-600" : "text-slate-400"
                    }`}
                  >
                    Step 0{idx + 1}
                  </p>
                </div>
              </div>
            );

            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                {isClickable ? (
                  <Link
                    href={step.path}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                    title={`Jump to Step 0${idx + 1}: ${step.label}`}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}

                {idx < steps.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-3 hidden sm:block">
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors ${
                        idx < currentIndex
                          ? "bg-emerald-500"
                          : assessmentId
                          ? "bg-slate-300"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Next Button or Balance Placeholder */}
        {nextHref ? (
          <Link
            href={nextHref}
            className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
            title={nextLabel}
          >
            <span className="hidden sm:inline">{nextLabel}</span>
            <span className="sm:hidden">Next</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <div className="w-20 hidden sm:block" />
        )}
      </div>
    </div>
  );
}
