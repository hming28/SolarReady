"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  Sun, 
  TrendingUp, 
  Leaf, 
  ShieldAlert, 
  ArrowRight, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  Sliders,
  DollarSign,
  Layers
} from "lucide-react";
import { api } from "@/lib/api";
import { TownshipUnit } from "@/lib/types";

export default function PlannerPage() {
  const [portfolio, setPortfolio] = useState<TownshipUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [clusterFilter, setClusterFilter] = useState<"all" | "greenfield_launch" | "brownfield_retrofit">("all");
  const [sortBy, setSortBy] = useState<"lcoe" | "readiness" | "capacity">("lcoe");

  useEffect(() => {
    let isMounted = true;
    api.getPortfolio()
      .then((data) => {
        if (!isMounted) return;
        setPortfolio(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Filter by cluster
  const filteredPortfolio = portfolio.filter((unit) => {
    if (clusterFilter === "all") return true;
    return unit.cluster_type === clusterFilter;
  });

  // Sort logic: strictly prioritizing Delivered LCOE first (First-Principles)
  const sortedPortfolio = [...filteredPortfolio].sort((a, b) => {
    if (sortBy === "lcoe") {
      // Viable leases first, then lowest delivered LCOE
      if (a.viable_lease !== b.viable_lease) return a.viable_lease ? -1 : 1;
      return a.delivered_lcoe_sen - b.delivered_lcoe_sen;
    }
    if (sortBy === "readiness") {
      const order: Record<string, number> = {
        "Ready": 1,
        "Obstacle Clearance Needed": 2,
        "Complex Pitch / Non-Viable": 3,
      };
      const rankA = order[a.roof_ready_tier] || 99;
      const rankB = order[b.roof_ready_tier] || 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.delivered_lcoe_sen - b.delivered_lcoe_sen;
    }
    return b.potential_kwp - a.potential_kwp;
  });

  const totalKwp = sortedPortfolio.reduce((acc, curr) => acc + curr.potential_kwp, 0).toFixed(1);
  const viableUnits = sortedPortfolio.filter((u) => u.viable_lease).length;
  const avgLcoe = sortedPortfolio.length > 0
    ? (sortedPortfolio.reduce((acc, curr) => acc + curr.delivered_lcoe_sen, 0) / sortedPortfolio.length).toFixed(1)
    : "---";
  const totalRentRm = sortedPortfolio.reduce((acc, curr) => acc + (curr.viable_monthly_rent_rm * 12), 0).toLocaleString();

  return (
    <div className="flex-1 bg-slate-50 flex flex-col py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Demo Watermark Banner */}
      <div className="max-w-6xl mx-auto w-full">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              SDP Aggregator
            </span>
            <span className="text-xs font-bold">
              Township Solar-Ready Portfolio · Ranked by Delivered LCOE (First-Principles Model)
            </span>
          </div>
          <Link
            href="/economics"
            className="text-xs font-bold text-amber-950 underline hover:text-amber-800 flex items-center gap-1"
          >
            <span>Open Sensitivity Sandbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Sime Darby Property Township Solar Aggregator
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Screening residential rooftop assets for Community Renewable Energy (CREAM / TPA).
              Filtered by <strong>Delivered Cost of Electricity</strong> to eliminate loss-making roofs.
            </p>
          </div>

          {/* Cluster Filter Buttons */}
          <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1 shadow-xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setClusterFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clusterFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Assets ({portfolio.length})
            </button>
            <button
              type="button"
              onClick={() => setClusterFilter("greenfield_launch")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clusterFilter === "greenfield_launch"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Solar-Ready Greenfield (Phase 7)
            </button>
            <button
              type="button"
              onClick={() => setClusterFilter("brownfield_retrofit")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clusterFilter === "brownfield_retrofit"
                  ? "bg-amber-600 text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Brownfield Retrofits
            </button>
          </div>
        </div>

        {/* Aggregated KPI Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Viable Rooftops</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {viableUnits} / {sortedPortfolio.length} Units
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">
              {sortedPortfolio.length > 0 ? `${((viableUnits / sortedPortfolio.length) * 100).toFixed(0)}% Economically Viable` : "---"}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Aggregate Peak Capacity</span>
            <div className="text-2xl font-black text-amber-500 mt-1">{totalKwp} kWp</div>
            <span className="text-[10px] text-slate-400">Total cluster potential</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Avg. Delivered LCOE</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{avgLcoe} sen/kWh</div>
            <span className="text-[10px] text-slate-400">Incl. 9 sen wheeling charge</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Homeowner Rental Pool</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">RM {totalRentRm} / yr</div>
            <span className="text-[10px] text-slate-400">Community shared value</span>
          </div>
        </div>

        {/* Sorting Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Sorting Priority:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
            >
              <option value="lcoe">Lowest Delivered LCOE First (Economic Viability)</option>
              <option value="readiness">Structural Readiness Tier</option>
              <option value="capacity">Raw Capacity (kWp)</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-400">
            *Offtaker PPA ceiling benchmark: <strong>36.0 sen/kWh</strong>. Assets above 36 sen generate negative margin.
          </p>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Property / ID</th>
                  <th className="py-3 px-4">Cluster / Phase</th>
                  <th className="py-3 px-4">Roof Structure Tier</th>
                  <th className="py-3 px-4">Structure Cost</th>
                  <th className="py-3 px-4">Delivered LCOE</th>
                  <th className="py-3 px-4">Lease Status</th>
                  <th className="py-3 px-4">Homeowner Rent</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sortedPortfolio.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {unit.id}
                      <span className="block text-[10px] font-normal text-slate-400">{unit.address}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">{unit.township}</span>
                      <span className={`block text-[10px] font-bold ${
                        unit.cluster_type === "greenfield_launch" ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        {unit.cluster_type === "greenfield_launch" ? "Solar-Ready Launch" : "Existing Retrofit"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {unit.structure_type}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      RM {unit.structure_cost_rm_per_kwp}/kWp
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-sm font-black ${
                        unit.delivered_lcoe_sen <= 25.0
                          ? "text-emerald-600"
                          : unit.delivered_lcoe_sen <= 34.0
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}>
                        {unit.delivered_lcoe_sen} sen
                      </span>
                      <span className="block text-[10px] text-slate-400">/ kWh delivered</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {unit.viable_lease ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Viable Asset
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          Non-Viable (Loss)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {unit.viable_lease ? (
                        <div>
                          <span className="font-extrabold text-slate-900">
                            RM {unit.viable_monthly_rent_rm.toFixed(0)} / mo
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            (RM {(unit.viable_monthly_rent_rm * 12).toFixed(0)}/yr)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold">RM 0 (Unviable)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/report/demo-elmina-terrace-01`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors"
                      >
                        <span>Audit Roof</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
