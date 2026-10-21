"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Full-screen CAD / 3D studio workspaces must never have an outer footer causing page scrollbars
  if (pathname?.startsWith("/editor") || pathname?.startsWith("/layout-sim")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200/80 bg-white py-2 text-center text-[11px] text-slate-500 shrink-0">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
        <span className="font-semibold text-slate-600">
          SolarReady Malaysia · Built for SDP University Hackathon 2026 (Planet Track)
        </span>
        <span className="text-slate-400 text-[10px]">
          Preliminary feasibility model · PVGIS v6 / SEDA benchmarks · No Google Solar API
        </span>
      </div>
    </footer>
  );
}
