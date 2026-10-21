"use client";

import { useEffect, useState } from "react";
import { 
  Sliders, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  HelpCircle, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  ArrowRight
} from "lucide-react";
import { api } from "@/lib/api";
import { 
  LcoeCalculationRequest, 
  LcoeResult, 
  TownshipComparisonScenario, 
  StructureTypeInfo 
} from "@/lib/types";

export default function EconomicsPage() {
  // Slider states
  const [moduleFobUsd, setModuleFobUsd] = useState(0.116); // $0.116/W OPIS benchmark
  const [wacc, setWacc] = useState(0.08); // 8% cost of capital
  const [wheelingCharge, setWheelingCharge] = useState(9.0); // 9 sen grid wheeling fee
  const [offtakerTariff, setOfftakerTariff] = useState(36.0); // 36 sen C&I energy ceiling
  const [selectedStructure, setSelectedStructure] = useState("solar_ready_greenfield");
  const [cacCost, setCacCost] = useState(0.0); // 0 for greenfield, 600 for retail

  // API Data
  const [lcoeResult, setLcoeResult] = useState<LcoeResult | null>(null);
  const [scenarios, setScenarios] = useState<Record<string, TownshipComparisonScenario> | null>(null);
  const [structureTypes, setStructureTypes] = useState<StructureTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch baseline scenarios
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getTownshipScenarios(8.8),
      api.getStructureTypes(),
      api.computeLcoe({
        module_fob_usd_per_w: moduleFobUsd,
        wacc: wacc,
        wheeling_charge_sen: wheelingCharge,
        offtaker_tariff_sen: offtakerTariff,
        structure_type: selectedStructure,
        cac_rm_per_kwp: cacCost,
      }),
    ])
      .then(([scenData, structData, lcoeData]) => {
        if (!isMounted) return;
        setScenarios(scenData);
        setStructureTypes(structData);
        setLcoeResult(lcoeData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Recalculate on slider adjustments
  const recompute = async (
    newFob: number,
    newWacc: number,
    newWheel: number,
    newOfftaker: number,
    newStruct: string,
    newCac: number
  ) => {
    try {
      const updated = await api.computeLcoe({
        module_fob_usd_per_w: newFob,
        wacc: newWacc,
        wheeling_charge_sen: newWheel,
        offtaker_tariff_sen: newOfftaker,
        structure_type: newStruct,
        cac_rm_per_kwp: newCac,
      });
      setLcoeResult(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStructureChange = (structId: string) => {
    setSelectedStructure(structId);
    // Auto-adjust CAC: Greenfield has 0 CAC (packaged in S&P); Retrofit has ~600 RM/kWp CAC
    const defaultCac = structId === "solar_ready_greenfield" ? 0.0 : 600.0;
    setCacCost(defaultCac);
    recompute(moduleFobUsd, wacc, wheelingCharge, offtakerTariff, structId, defaultCac);
  };

  if (loading || !lcoeResult || !scenarios) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center text-slate-800 space-y-3">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading Economic & LCOE Model...</p>
      </div>
    );
  }

  const green = scenarios.greenfield_solar_ready;
  const brown = scenarios.brownfield_retrofit;

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Hero Header */}
      <div className="max-w-6xl mx-auto w-full space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300 text-amber-800 text-xs font-bold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>The First-Principles &ldquo;Idiot Index&rdquo; Model</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
          Factory-Fit Solar-Ready Townships vs. Conventional Retrofits
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
          PV modules cost only <strong className="text-slate-900">~RM 0.50/W ($0.116/W)</strong>, yet residential installations cost <strong className="text-slate-900">RM 3.50–4.00/W</strong> — a 7x to 8x markup.
          Sime Darby Property vertically integrates homebuilding, mounting standardization, and sales contracts to compress BOS and CAC down to the physical limit.
        </p>
      </div>

      {/* Head-to-Head Comparison Cards */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Greenfield Solar-Ready (Winner) */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-7 shadow-sm relative overflow-hidden space-y-5">
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm">
            SDP Unfair Advantage
          </div>

          <div>
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Upcoming Phases (New Launches)</div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">SDP Solar-Ready Factory-Fit</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Standardized roof trusses with pre-embedded mounting rails and pre-cast electrical conduits. Solar lease option bundled directly into the Sales & Purchase Agreement (SPA).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-200 text-xs">
            <div>
              <span className="text-slate-600 text-[11px] font-medium">Turnkey Capex:</span>
              <div className="text-xl font-black text-emerald-800">RM {green.capex_rm_per_kwp.toLocaleString()} / kWp</div>
              <span className="text-[10px] text-emerald-700 font-bold">35% Cost Compression</span>
            </div>
            <div>
              <span className="text-slate-600 text-[11px] font-medium">Delivered LCOE:</span>
              <div className="text-xl font-black text-emerald-700">{green.delivered_lcoe_sen} sen / kWh</div>
              <span className="text-[10px] text-slate-500">Incl. 9 sen wheeling fee</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Mounting Structure Cost:</span>
              <span className="font-bold text-emerald-700">RM {green.structure_cost_rm_per_kwp}/kWp (Pre-cast rails)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Customer Acquisition Cost (CAC):</span>
              <span className="font-bold text-emerald-700">RM 0 (Bundled in SPA Contract)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Viable Homeowner Roof Rent:</span>
              <span className="font-extrabold text-amber-700">~RM {green.homeowner_monthly_rent_rm.toFixed(0)} / month</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">Township Scope 2 Abatement:</span>
              <span className="font-bold text-slate-900">{green.scope2_abatement_tonnes_per_home_yr} tonnes CO₂/home/yr</span>
            </div>
          </div>
        </div>

        {/* Brownfield Retrofit (Status Quo) */}
        <div className="bg-white border-2 border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Existing Built Phases</div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Conventional Brownfield Retrofit</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Retrofitting existing occupied homes. Heavy customer acquisition friction (door-to-door sales), high-friction tile hook brackets, and individual tenant negotiations.
          </p>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-600 text-[11px] font-medium">Turnkey Capex:</span>
              <div className="text-xl font-black text-slate-800">RM {brown.capex_rm_per_kwp.toLocaleString()} / kWp</div>
              <span className="text-[10px] text-slate-500 font-semibold">Full retail markup</span>
            </div>
            <div>
              <span className="text-slate-600 text-[11px] font-medium">Delivered LCOE:</span>
              <div className="text-xl font-black text-amber-700">{brown.delivered_lcoe_sen} sen / kWh</div>
              <span className="text-[10px] text-slate-500">Incl. 9 sen wheeling fee</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Mounting Structure Cost:</span>
              <span className="font-bold text-slate-800">RM {brown.structure_cost_rm_per_kwp}/kWp (Tile brackets)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Customer Acquisition Cost (CAC):</span>
              <span className="font-bold text-rose-600">~RM {brown.cac_rm_per_home.toLocaleString()} / home</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Viable Homeowner Roof Rent:</span>
              <span className="font-bold text-slate-700">~RM {brown.homeowner_monthly_rent_rm.toFixed(0)} / month (Thin margin)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">Commercial Feasibility:</span>
              <span className="font-bold text-amber-700">Limited (High CAC risk)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Interactive Sensitivity Sandbox */}
      <div className="max-w-6xl mx-auto w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-600" />
              <span>Sensitivity & Economics Simulation Engine</span>
            </h3>
            <p className="text-xs text-slate-500">
              Adjust variables in real-time to test the physical and financial limits of solar feasibility in Malaysia.
            </p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Real-Time Reactive
          </span>
        </div>

        {/* 4 Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Slider 1: Module FOB */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">TOPCon Module FOB</span>
              <span className="font-mono font-bold text-amber-700">
                ${moduleFobUsd.toFixed(3)}/W
              </span>
            </div>
            <input
              type="range"
              min="0.08"
              max="0.20"
              step="0.005"
              value={moduleFobUsd}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setModuleFobUsd(val);
                recompute(val, wacc, wheelingCharge, offtakerTariff, selectedStructure, cacCost);
              }}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              ≈ RM {(moduleFobUsd * 4.3).toFixed(2)}/W (OPIS benchmark).
            </p>
          </div>

          {/* Slider 2: WACC */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Cost of Capital (WACC)</span>
              <span className="font-mono font-bold text-blue-700">
                {(wacc * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.12"
              step="0.005"
              value={wacc}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setWacc(val);
                recompute(moduleFobUsd, val, wheelingCharge, offtakerTariff, selectedStructure, cacCost);
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              25-year capital recovery factor (CRF). Commercial borrowing benchmark.
            </p>
          </div>

          {/* Slider 3: Grid Wheeling Charge */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">TPA Wheeling Charge</span>
              <span className="font-mono font-bold text-rose-700">
                {wheelingCharge.toFixed(1)} sen/kWh
              </span>
            </div>
            <input
              type="range"
              min="4.0"
              max="15.0"
              step="0.5"
              value={wheelingCharge}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setWheelingCharge(val);
                recompute(moduleFobUsd, wacc, val, offtakerTariff, selectedStructure, cacCost);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              CREAM / TPA network charge paid to TNB grid for transmission.
            </p>
          </div>

          {/* Slider 4: Off-taker Value Ceiling */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Off-taker PPA Ceiling</span>
              <span className="font-mono font-bold text-emerald-700">
                {offtakerTariff.toFixed(1)} sen/kWh
              </span>
            </div>
            <input
              type="range"
              min="28.0"
              max="45.0"
              step="0.5"
              value={offtakerTariff}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOfftakerTariff(val);
                recompute(moduleFobUsd, wacc, wheelingCharge, val, selectedStructure, cacCost);
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              Commercial C&I tariff energy portion (excluding capacity charges).
            </p>
          </div>
        </div>

        {/* Structure Type Selector Pills */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Roof Structure Classification (The 4x Cost Differentiator):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {structureTypes.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStructureChange(st.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedStructure === st.id
                    ? "border-amber-500 bg-amber-50/80 text-slate-900 ring-2 ring-amber-500/20 shadow-xs"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="font-bold text-xs text-slate-900 truncate">{st.name}</div>
                <div className="text-[11px] font-mono text-amber-700 font-bold mt-1">
                  Structure: RM {st.structure_cost_rm_per_kwp}/kWp
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{st.typical_for}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Result Waterfall & Key Indicators */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered LCOE</span>
            <div className={`text-3xl font-black mt-1 ${lcoeResult.viable_lease ? "text-emerald-400" : "text-rose-400"}`}>
              {lcoeResult.delivered_lcoe_sen} <span className="text-sm font-semibold">sen/kWh</span>
            </div>
            <span className="text-[11px] text-slate-300">
              Gen: {lcoeResult.generation_lcoe_sen} + Grid: {lcoeResult.wheeling_charge_sen}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margin vs Off-taker</span>
            <div className={`text-2xl font-black mt-1 ${lcoeResult.margin_sen_per_kwh > 0 ? "text-amber-400" : "text-rose-400"}`}>
              {lcoeResult.margin_sen_per_kwh > 0 ? `+${lcoeResult.margin_sen_per_kwh}` : lcoeResult.margin_sen_per_kwh} sen
            </div>
            <span className="text-[10px] text-slate-300">
              {lcoeResult.viable_lease ? "Economically Viable" : "Unviable (No Lease Value)"}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Viable Homeowner Rent</span>
            <div className="text-2xl font-black text-white mt-1">
              RM {lcoeResult.typical_homeowner_monthly_rent_rm.toFixed(0)} <span className="text-xs font-normal text-slate-400">/ mo</span>
            </div>
            <span className="text-[10px] text-slate-300">
              RM {lcoeResult.max_viable_annual_rent_per_kwp_rm.toFixed(0)}/kWp/year
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">The Cost Compression Index</span>
            <div className="text-2xl font-black text-cyan-400 mt-1">
              {lcoeResult.capex_breakdown.idiot_index}x
            </div>
            <span className="text-[10px] text-slate-300">
              Total Capex (RM {lcoeResult.capex_breakdown.total_capex_rm_per_kwp}) / Raw Module (RM {lcoeResult.capex_breakdown.module_rm_per_kwp})
            </span>
          </div>
        </div>

        {/* Physics Note Callout */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1">
          <p className="font-bold text-amber-900">
            Physics Fact: Why We Do Not Optimize Tilt or Orientation in Malaysia
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900/90">
            Empirical studies from Terengganu (7.8 kWp testbed) and Kuala Lumpur prove that optimal tilt and azimuth only improve annual yield by ~4.8% near the equator (3.18° N), where global horizontal irradiance exceeds 4.0 kWh/kWp/day year-round. However, mounting structure cost varies by over 400% (RM 95 vs. RM 850/kWp). In accordance with first-principles engineering, we focus 100% of our algorithmic effort on structural cost reduction and developer vertical integration.
          </p>
        </div>
      </div>
    </div>
  );
}
