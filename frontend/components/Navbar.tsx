"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sun, CheckCircle2, AlertCircle, LayoutGrid, Sliders, Compass, Sparkles, ChevronDown, Menu, X } from "lucide-react";
import { api } from "@/lib/api";

export default function Navbar() {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.getHealth()
      .then(() => {
        if (isMounted) setBackendHealthy(true);
      })
      .catch(() => {
        if (isMounted) setBackendHealthy(false);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setToolsDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand: Always points to Step 1 Single Roof Assessment */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Sun className="w-6 h-6 text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">SolarReady</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                AI Solar
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Residential Rooftop Solar Feasibility</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
          {/* Main Primary Tool: Single Roof Assessment */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-50 text-amber-900 font-bold border border-amber-200/80 hover:bg-amber-100/80 transition-colors shadow-xs"
          >
            <Compass className="w-4 h-4 text-amber-600" />
            <span>Single Roof Assessment</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200/80 text-amber-900 rounded-full">
              Main
            </span>
          </Link>

          {/* Secondary / Advanced Tools Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setToolsDropdownOpen((prev) => !prev)}
              onBlur={() => setTimeout(() => setToolsDropdownOpen(false), 200)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer"
            >
              <span>Township & Macro Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {toolsDropdownOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Secondary B2B / Demo Tools
                </div>
                <Link
                  href="/planner"
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <LayoutGrid className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <span>Township Portfolio</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Demo</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Multi-unit estate aggregation</p>
                  </div>
                </Link>
                <Link
                  href="/economics"
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <Sliders className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <span>First-Principles Sandbox</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">LCOE</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Macro cost & tariff sensitivity</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Status Indicator & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-50/80">
            {backendHealthy === null ? (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                <span className="text-slate-500">Checking API...</span>
              </>
            ) : backendHealthy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 inline" /> Engine Online
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 inline" /> Engine Offline
                </span>
              </>
            )}
          </div>

          {/* Accessible Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Accessible Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150 shadow-xl"
        >
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Navigation Menu
          </div>
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 text-amber-900 font-bold border border-amber-200"
          >
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-amber-600" />
              <span className="text-sm">Single Roof Assessment</span>
            </div>
            <span className="text-xs bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded-full">Main</span>
          </Link>
          <Link
            href="/planner"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between p-3 rounded-xl text-slate-800 hover:bg-slate-50 border border-slate-200/70 font-semibold"
          >
            <div className="flex items-center gap-2.5">
              <LayoutGrid className="w-4 h-4 text-emerald-600" />
              <span className="text-sm">Township Portfolio</span>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">B2B Demo</span>
          </Link>
          <Link
            href="/economics"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between p-3 rounded-xl text-slate-800 hover:bg-slate-50 border border-slate-200/70 font-semibold"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span className="text-sm">Economics Sandbox</span>
            </div>
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">LCOE</span>
          </Link>
        </div>
      )}
    </header>
  );
}
