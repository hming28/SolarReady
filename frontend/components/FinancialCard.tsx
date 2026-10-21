"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Leaf, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Receipt,
  Info,
  Gift,
  HelpCircle
} from "lucide-react";
import { EnergyFinanceResult } from "@/lib/types";

// Malaysian TNB Domestic Tiered Tariff Schedule (RP4 2025–2027 Baseline):
// 0 - 200 kWh: 21.80 sen/kWh
// 201 - 300 kWh: 33.40 sen/kWh
// 301 - 600 kWh: 51.60 sen/kWh
// 601 - 900 kWh: 54.60 sen/kWh
// > 900 kWh: 57.10 sen/kWh
function kwhToTnbBill(kwh: number): number {
  if (kwh <= 0) return 0;
  if (kwh <= 200) return kwh * 0.218;
  if (kwh <= 300) return 200 * 0.218 + (kwh - 200) * 0.334;
  if (kwh <= 600) return 200 * 0.218 + 100 * 0.334 + (kwh - 300) * 0.516;
  if (kwh <= 900) return 200 * 0.218 + 100 * 0.334 + 300 * 0.516 + (kwh - 600) * 0.546;
  return 200 * 0.218 + 100 * 0.334 + 300 * 0.516 + 300 * 0.546 + (kwh - 900) * 0.571;
}

function tnbBillToKwh(bill: number): number {
  if (bill <= 0) return 0;
  const b200 = 200 * 0.218; // 43.60
  const b300 = b200 + 100 * 0.334; // 77.00
  const b600 = b300 + 300 * 0.516; // 231.80
  const b900 = b600 + 300 * 0.546; // 395.60

  if (bill <= b200) return bill / 0.218;
  if (bill <= b300) return 200 + (bill - b200) / 0.334;
  if (bill <= b600) return 300 + (bill - b300) / 0.516;
  if (bill <= b900) return 600 + (bill - b600) / 0.546;
  return 900 + (bill - b900) / 0.571;
}

interface FinancialCardProps {
  initialResult: EnergyFinanceResult;
  capacityKwp: number;
  panelCount?: number;
  moduleHardwareRm?: number;
  moduleName?: string;
  initialMonthlyBillRm?: number;
  onUpdateParams: (
    selfUsePct: number,
    tariff: number,
    costPerKwp: number,
    exportRate?: number,
    suriaRebateRm?: number,
    inverterKwac?: number
  ) => void;
  isUpdating?: boolean;
}

export default function FinancialCard({
  initialResult,
  capacityKwp,
  panelCount = 8,
  moduleHardwareRm = 580,
  moduleName = "Tier-1 550W Monocrystalline",
  initialMonthlyBillRm = 380,
  onUpdateParams,
  isUpdating = false,
}: FinancialCardProps) {
  // 2025–2027 TNB RP4 & Solar ATAP Rate Presets
  const [tariffPreset, setTariffPreset] = useState<"standard" | "high" | "legacy">("standard");
  const [selfUsePct, setSelfUsePct] = useState<number>(initialResult.finance.self_use_pct || 60);
  const [costPerKwp, setCostPerKwp] = useState<number>(initialResult.finance.cost_per_kwp_rm || 3500);
  const [monthlyBillRm, setMonthlyBillRm] = useState<number>(initialMonthlyBillRm);

  useEffect(() => {
    if (initialMonthlyBillRm && initialMonthlyBillRm > 0) {
      setMonthlyBillRm(initialMonthlyBillRm);
    }
  }, [initialMonthlyBillRm]);

  // SuRIA Home Potential Cash Rebate States (RM 600 / kWac up to RM 3,000 cap)
  // For 4.4 kWp DC system, standard inverter AC rating is typically 4.0 kWac (or up to 5.0 kWac)
  const [inverterKwac, setInverterKwac] = useState<number>(4.0);
  const [applySuriaRebate, setApplySuriaRebate] = useState<boolean>(true);

  // Calculate SuRIA Home Rebate: RM 600/kWac up to max RM 3,000
  const potentialSuriaRebateRm = useMemo(() => {
    return Math.min(3000, Math.round(inverterKwac * 600));
  }, [inverterKwac]);

  // Active Import Tariff and Export Rate under Solar ATAP
  const { importTariff, exportRate, tariffLabel } = useMemo(() => {
    if (tariffPreset === "high") {
      return {
        importTariff: 0.5443,
        exportRate: 0.3703,
        tariffLabel: "TNB High Usage (>1,500 kWh/mo) · Retail: 54.43 sen | Export: 37.03 sen",
      };
    }
    if (tariffPreset === "legacy") {
      return {
        importTariff: 0.390,
        exportRate: 0.390,
        tariffLabel: "Legacy Flat Baseline · 39.0 sen (1:1 Net Metering)",
      };
    }
    return {
      importTariff: 0.4443,
      exportRate: 0.2703,
      tariffLabel: "TNB RP4 Standard (≤1,500 kWh/mo) · Retail: 44.43 sen | Export: 27.03 sen",
    };
  }, [tariffPreset]);

  // Real-Time Calculations (0ms latency, updates live as sliders move)
  const annualGenBase = initialResult.annual_generation_kwh.base;
  const sRatio = selfUsePct / 100.0;
  const eRatio = 1.0 - sRatio;
  const selfKwh = annualGenBase * sRatio;
  const exportKwh = annualGenBase * eRatio;

  // Solar ATAP Dual-Rate formula:
  // Self-consumption offsets full retail rate (avoiding energy + capacity + network charges)
  // Export credits strictly the applicable energy charge rate (no rollover across monthly billing cycles)
  const annualSavingsBase = Number(((selfKwh * importTariff) + (exportKwh * exportRate)).toFixed(2));
  const annualSavingsLow = Number((annualSavingsBase * 0.92).toFixed(2));
  const annualSavingsHigh = Number((annualSavingsBase * 1.06).toFixed(2));

  const grossTotalCostRm = Math.round(capacityKwp * costPerKwp);
  const netOutofPocketCostRm = applySuriaRebate 
    ? Math.max(0, grossTotalCostRm - potentialSuriaRebateRm)
    : grossTotalCostRm;

  const livePaybackYears = annualSavingsBase > 0 
    ? Number((netOutofPocketCostRm / annualSavingsBase).toFixed(1)) 
    : 10;
  const grossPaybackYears = annualSavingsBase > 0 
    ? Number((grossTotalCostRm / annualSavingsBase).toFixed(1)) 
    : 10;

  const liveRoiPct = netOutofPocketCostRm > 0 
    ? Number(((annualSavingsBase / netOutofPocketCostRm) * 100).toFixed(1)) 
    : 0;

  // Monthly Bill Calculations under Solar ATAP
  const preSolarKwh = tnbBillToKwh(monthlyBillRm);
  const monthlySolarGenKwh = (annualGenBase / 12);
  const postSolarKwh = Math.max(0, preSolarKwh - (monthlySolarGenKwh * sRatio));
  const postSolarBillGross = kwhToTnbBill(postSolarKwh);
  const exportCreditMonthlyRm = (monthlySolarGenKwh * eRatio) * exportRate;
  // In Solar ATAP, export credits offset current bill only (cannot result in negative bill payout)
  const postSolarBillRm = Math.max(0, postSolarBillGross - exportCreditMonthlyRm);
  const monthlyBillSavingsRm = Math.max(0, monthlyBillRm - postSolarBillRm);
  const billReductionPct = monthlyBillRm > 0 ? Math.round((monthlyBillSavingsRm / monthlyBillRm) * 100) : 0;

  // Environmental metric (0.589 kg CO2/kWh grid factor)
  const co2TonnesPerYear = ((annualGenBase * 0.589) / 1000).toFixed(2);
  const treesEquiv = Math.round(parseFloat(co2TonnesPerYear) * 45);

  // Exact Hardware vs Turnkey Cost Itemization matching Step 3
  const actualModuleHardwareTotal = panelCount * moduleHardwareRm;
  const inverterCost = Math.round(grossTotalCostRm * 0.25);
  const mountingBosCost = Math.round(grossTotalCostRm * 0.25);
  const permittingSedaCost = Math.max(0, grossTotalCostRm - (actualModuleHardwareTotal + inverterCost + mountingBosCost));

  // Handler for sliders: triggers instantaneous local react state + syncs parent
  const handleSelfUseChange = (newVal: number) => {
    setSelfUsePct(newVal);
    onUpdateParams(newVal, importTariff, costPerKwp, exportRate, applySuriaRebate ? potentialSuriaRebateRm : 0, inverterKwac);
  };

  const handleTariffPresetChange = (newPreset: "standard" | "high" | "legacy") => {
    setTariffPreset(newPreset);
    let newImport = 0.4443;
    let newExport = 0.2703;
    if (newPreset === "high") {
      newImport = 0.5443;
      newExport = 0.3703;
    } else if (newPreset === "legacy") {
      newImport = 0.390;
      newExport = 0.390;
    }
    onUpdateParams(selfUsePct, newImport, costPerKwp, newExport, applySuriaRebate ? potentialSuriaRebateRm : 0, inverterKwac);
  };

  const handleCostChange = (newCost: number) => {
    setCostPerKwp(newCost);
    onUpdateParams(selfUsePct, importTariff, newCost, exportRate, applySuriaRebate ? potentialSuriaRebateRm : 0, inverterKwac);
  };

  const handleInverterKwacChange = (kw: number) => {
    setInverterKwac(kw);
    const newRebate = Math.min(3000, Math.round(kw * 600));
    onUpdateParams(selfUsePct, importTariff, costPerKwp, exportRate, applySuriaRebate ? newRebate : 0, kw);
  };

  const handleToggleSuria = () => {
    const nextActive = !applySuriaRebate;
    setApplySuriaRebate(nextActive);
    onUpdateParams(selfUsePct, importTariff, costPerKwp, exportRate, nextActive ? potentialSuriaRebateRm : 0, inverterKwac);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* Title & Regulatory Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Solar ATAP (2026) Financial &amp; Energy Feasibility Model</span>
          </h3>
          <p className="text-xs text-slate-500">
            Compliant with Suruhanjaya Tenaga (ST) Solar ATAP guidelines &amp; TNB Regulatory Period 4 (RP4 2025–2027) tariffs.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Solar ATAP 2026 Ready
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            SuRIA Home Rebate Eligible
          </span>
        </div>
      </div>

      {/* 1. SuRIA Home Potential Cash Rebate Interactive Module */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-300/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
              SuRIA Home (Suria Madani) Government Cash Rebate Scheme
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Apply Rebate:</span>
            <button
              type="button"
              onClick={handleToggleSuria}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                applySuriaRebate ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  applySuriaRebate ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-xs font-extrabold ${applySuriaRebate ? "text-emerald-700" : "text-slate-400"}`}>
              {applySuriaRebate ? "Active (-RM " + potentialSuriaRebateRm.toLocaleString() + ")" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
          <div className="md:col-span-6 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold text-[11px]">Inverter Rating (kWac):</span>
              <div className="flex items-center gap-1">
                {[4.0, 4.4, 5.0].map((kw) => {
                  const kwRebate = Math.min(3000, Math.round(kw * 600));
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleInverterKwacChange(kw)}
                      className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all cursor-pointer flex flex-col items-center ${
                        inverterKwac === kw
                          ? "bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400 font-extrabold"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span>{kw.toFixed(1)} kWac</span>
                      <span className={`text-[9px] ${inverterKwac === kw ? "text-slate-950 font-black" : "text-emerald-600"}`}>
                        -RM {kwRebate.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Rebate formula: <strong>RM 600 per kWac</strong> inverter capacity (capped at RM 3,000 maximum).
            </p>
          </div>

          <div className="md:col-span-6 bg-white/90 p-2.5 rounded-lg border border-amber-200/80 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Turnkey</span>
              <span className="font-mono text-xs font-bold text-slate-700">
                RM {grossTotalCostRm.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-600 uppercase font-bold block">SuRIA Rebate</span>
              <span className="font-mono text-xs font-extrabold text-amber-700">
                {applySuriaRebate ? `- RM ${potentialSuriaRebateRm.toLocaleString()}` : "RM 0"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-700 uppercase font-bold block">Net Out-of-Pocket</span>
              <span className="font-mono text-xs sm:text-sm font-black text-emerald-700">
                RM {netOutofPocketCostRm.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="text-[10.5px] text-slate-500 leading-relaxed bg-white/60 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>SuRIA Home Eligibility:</strong> Open to Malaysian citizens holding TNB residential accounts who have not previously claimed SolaRIS cash rebates. Allocation is subject to available funding and Solar ATAP registration before Dec 31, 2026.
          </span>
        </div>
      </div>

      {/* 2. Pre-Solar Monthly Bill Input Field & Feasibility Verdict */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>Your Current Monthly TNB Electricity Bill</span>
                <span className="text-[10px] font-normal text-slate-400 hidden md:inline">(Pre-Solar Baseline)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Key in your average monthly electricity bill without solar to calculate savings under Solar ATAP.
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">Presets:</span>
            {[180, 280, 380, 550, 850].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setMonthlyBillRm(amt)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  monthlyBillRm === amt
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                RM {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Bill Slider & Interactive Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Monthly Bill Amount:</span>
              <div className="flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                <span className="text-xs font-bold text-amber-400">RM</span>
                <input
                  type="number"
                  min="50"
                  max="3000"
                  step="10"
                  value={monthlyBillRm}
                  onChange={(e) => setMonthlyBillRm(Math.max(0, Number(e.target.value)))}
                  className="w-20 bg-transparent text-white font-mono font-extrabold text-sm focus:outline-none text-right"
                />
                <span className="text-[11px] text-slate-400">/mo</span>
              </div>
            </div>
            <input
              type="range"
              min="80"
              max="1500"
              step="10"
              value={monthlyBillRm}
              onChange={(e) => setMonthlyBillRm(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>RM 80 (Subsidized)</span>
              <span>RM 380 (Typical Terrace)</span>
              <span>RM 1,500+ (High A/C)</span>
            </div>
          </div>

          {/* Before vs After Solar Comparison Strip */}
          <div className="md:col-span-7 grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-center">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Before Solar</span>
              <p className="font-mono font-black text-white text-sm sm:text-base">
                RM {monthlyBillRm}
              </p>
              <span className="text-[10px] text-slate-400 block">~{Math.round(preSolarKwh)} kWh/mo</span>
            </div>

            <div className="space-y-0.5 border-x border-slate-800 px-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">After Solar</span>
              <p className="font-mono font-black text-emerald-400 text-sm sm:text-base">
                RM {Math.round(postSolarBillRm)}
              </p>
              <span className="text-[10px] text-emerald-300/80 block">~{Math.round(postSolarKwh)} kWh/mo</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Net Savings</span>
              <p className="font-mono font-black text-amber-300 text-sm sm:text-base">
                ↓ {billReductionPct}%
              </p>
              <span className="text-[10px] text-amber-400/80 block">~RM {Math.round(monthlyBillSavingsRm)}/mo</span>
            </div>
          </div>
        </div>

        {/* Dynamic Feasibility / Worthiness Verdict Callout */}
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
          monthlyBillRm >= 280
            ? "bg-emerald-950/70 border-emerald-600/80 text-emerald-200"
            : monthlyBillRm >= 180
            ? "bg-sky-950/70 border-sky-600/80 text-sky-200"
            : "bg-amber-950/70 border-amber-600/80 text-amber-200"
        }`}>
          {monthlyBillRm >= 280 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Feasibility &amp; Worthiness Verdict:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                monthlyBillRm >= 280
                  ? "bg-emerald-500 text-slate-950"
                  : monthlyBillRm >= 180
                  ? "bg-sky-500 text-slate-950"
                  : "bg-amber-500 text-slate-950"
              }`}>
                {monthlyBillRm >= 280
                  ? "Highly Worth It! (Recommended)"
                  : monthlyBillRm >= 180
                  ? "Moderately Worth It"
                  : "Lower Feasibility"}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {monthlyBillRm >= 280
                ? `Your monthly bill of RM ${monthlyBillRm} crosses into TNB's top tariff tiers (51.6–54.6 sen/kWh). Solar directly displaces these expensive peak units, saving ~${billReductionPct}% off your bill with a fast payback of ~${livePaybackYears} years${applySuriaRebate ? ` (with ${inverterKwac.toFixed(1)} kWac SuRIA Home rebate of -RM ${potentialSuriaRebateRm.toLocaleString()})` : ""}.`
                : monthlyBillRm >= 180
                ? `Your consumption reaches TNB Band 3 (51.6 sen). Installing this ${capacityKwp} kWp solar system yields attractive savings (~RM ${Math.round(monthlyBillSavingsRm)}/mo) with a ~${livePaybackYears} year payback${applySuriaRebate ? ` (with ${inverterKwac.toFixed(1)} kWac SuRIA Home rebate of -RM ${potentialSuriaRebateRm.toLocaleString()})` : ""}.`
                : `Your monthly bill of RM ${monthlyBillRm} is currently low and heavily subsidized by TNB's base rate (21.8–33.4 sen). Installing a ${capacityKwp} kWp system has a longer payback (~${livePaybackYears} years) because basic grid power is already very cheap for you. You can improve ROI by choosing a smaller capacity or maximizing SuRIA Home rebate (-RM ${potentialSuriaRebateRm.toLocaleString()} at ${inverterKwac.toFixed(1)} kWac).`}
            </p>
            <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex flex-wrap items-center justify-between gap-1">
              <span>💡 Feasibility rating is determined by your monthly bill, while inverter selection optimizes your net capital cost.</span>
              <span className="font-mono text-amber-300 font-bold">
                Inverter: {inverterKwac.toFixed(1)} kWac · Net Payback: ~{livePaybackYears} Yrs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Sliders Grid (Live Responsive) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200/60">
        {/* Slider 1: Self-Consumption Ratio */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700">Daytime Self-Consumption</span>
            <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {selfUsePct}%
            </span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            value={selfUsePct}
            onChange={(e) => handleSelfUseChange(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>20% (Low Daytime)</span>
            <span>60% (Typical)</span>
            <span>100% (High A/C, EV)</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-900 leading-tight space-y-0.5">
            <div className="font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Solar ATAP Rate Differential:</span>
            </div>
            <p>
              • Self-use offsets retail tariff: <strong>{(importTariff * 100).toFixed(2)} sen/kWh</strong><br />
              • Export credits energy charge only: <strong>{(exportRate * 100).toFixed(2)} sen/kWh</strong><br />
              <span className="text-emerald-700 font-semibold">→ Maximizing daytime usage yields +64% higher return per kWh!</span>
            </p>
          </div>
        </div>

        {/* Slider 2: 2025–2027 TNB Regulatory Period 4 & Solar ATAP Tariff Model */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700">TNB &amp; Solar ATAP Tariff</span>
            <span className="font-extrabold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded text-[11px]">
              {(importTariff * 100).toFixed(2)}¢ / {(exportRate * 100).toFixed(2)}¢
            </span>
          </div>
          <select
            value={tariffPreset}
            onChange={(e) => handleTariffPresetChange(e.target.value as any)}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="standard">TNB RP4 Standard (≤1,500 kWh/mo) · 44.43 sen / 27.03 sen</option>
            <option value="high">TNB High Usage (&gt;1,500 kWh/mo) · 54.43 sen / 37.03 sen</option>
            <option value="legacy">Legacy Flat Baseline · 39.0 sen (1:1 Net Metering)</option>
          </select>
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-[10px] text-slate-600 leading-tight space-y-0.5">
            <p className="font-bold text-slate-700">TNB RP4 Unbundled Structure:</p>
            <p>
              • Energy Charge: 27.03 sen | Capacity: 4.55 sen | Network: 12.85 sen<br />
              • Solar export credits strictly the <strong>Energy Charge (27.03 sen)</strong> under ST guidelines (no monthly rollover).
            </p>
          </div>
        </div>

        {/* Slider 3: Turnkey System Cost (Instant Live Calculation) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700">Turnkey System Cost</span>
            <span className="font-extrabold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded text-[11px]">
              RM {costPerKwp.toLocaleString()}/kWp
            </span>
          </div>
          <input
            type="range"
            min="3000"
            max="4500"
            step="100"
            value={costPerKwp}
            onChange={(e) => handleCostChange(Number(e.target.value))}
            className="w-full accent-slate-800 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>RM 3,000 (Bulk/Direct)</span>
            <span>RM 3,500 (Market Benchmark)</span>
            <span>RM 4,500 (Premium Inverter)</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-tight space-y-0.5">
            <div>
              <span>Gross upfront turnkey: </span>
              <strong className="text-amber-950 font-mono text-xs">RM {grossTotalCostRm.toLocaleString()}</strong>
            </div>
            {applySuriaRebate && (
              <div className="text-emerald-700 font-semibold">
                Net after SuRIA Home: <strong className="font-mono text-xs">RM {netOutofPocketCostRm.toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Financial Metrics Summary (Live Responsive) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Estimated Annual Savings */}
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
            <span>Estimated Annual Savings</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-700">
              RM {annualSavingsBase.toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-800/80 font-medium">
              Range: RM {annualSavingsLow.toLocaleString()} – RM {annualSavingsHigh.toLocaleString()} / yr
            </p>
          </div>
          <div className="text-[10px] text-emerald-800 border-t border-emerald-200/60 pt-1.5 flex justify-between">
            <span>Self-Use Offset:</span>
            <span className="font-bold">
              {Math.round(selfKwh).toLocaleString()} kWh (~RM {Math.round(selfKwh * importTariff).toLocaleString()})
            </span>
          </div>
        </div>

        {/* Simple Payback Period */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-amber-950">
            <span>Estimated Payback Horizon</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-800">
              {livePaybackYears} Years
            </div>
            <p className="text-[11px] text-amber-900/80 font-medium">
              {applySuriaRebate 
                ? `Net: ${livePaybackYears} yrs (Gross: ${grossPaybackYears} yrs)`
                : `Annual ROI: ${liveRoiPct}% / year`}
            </p>
          </div>
          <div className="text-[10px] text-amber-800 border-t border-amber-200/60 pt-1.5 flex justify-between">
            <span>Annual ROI:</span>
            <span className="font-bold font-mono">{liveRoiPct}% / yr</span>
          </div>
        </div>

        {/* Environmental Impact */}
        <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-teal-950">
            <span>Planet Track Impact</span>
            <Leaf className="w-4 h-4 text-teal-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-teal-800">
              {co2TonnesPerYear} t CO₂
            </div>
            <p className="text-[11px] text-teal-900/80 font-medium">
              Avoided carbon emissions annually
            </p>
          </div>
          <div className="text-[10px] text-teal-800 border-t border-teal-200/60 pt-1.5 flex justify-between">
            <span>Equivalent to:</span>
            <span className="font-bold">~{treesEquiv} mature trees planted</span>
          </div>
        </div>
      </div>

      {/* 5. Turnkey Equipment & Capital Expenditure (CAPEX) Exact Itemized Breakdown */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900">
              Turnkey Equipment &amp; CAPEX Investment Breakdown
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-semibold">
              {applySuriaRebate ? "Net Out-of-Pocket:" : "Gross Turnkey:"}
            </span>
            <span className="font-mono text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              RM {netOutofPocketCostRm.toLocaleString()}
            </span>
            {applySuriaRebate && (
              <span className="text-[10px] text-slate-400 font-mono line-through">
                RM {grossTotalCostRm.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Itemized 4-Pillar Grid with Exact Module Unit Price Matching Step 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Item 1: Solar Modules (Factory Bare Hardware) */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Solar PV Modules
              </span>
              <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                {panelCount} Panels
              </span>
            </div>
            <span className="font-mono font-black text-slate-900 text-sm block">
              RM {actualModuleHardwareTotal.toLocaleString()}
            </span>
            <p className="text-[10px] text-slate-500 leading-tight">
              {panelCount} × {moduleName} at <strong>~RM {moduleHardwareRm}/panel</strong> (factory hardware unit price). 25-yr linear power warranty.
            </p>
          </div>

          {/* Item 2: Grid-Tied Inverter (Eligible for SuRIA Rebate) */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Grid-Tied Inverter
              </span>
              <span className="font-mono text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                {inverterKwac.toFixed(1)} kWac
              </span>
            </div>
            <span className="font-mono font-black text-slate-900 text-sm block">
              RM {inverterCost.toLocaleString()}
            </span>
            <p className="text-[10px] text-slate-500 leading-tight">
              Dual-MPPT string inverter with Wi-Fi / Cloud monitoring app, TNB compliance &amp; eligible for RM {potentialSuriaRebateRm.toLocaleString()} SuRIA rebate.
            </p>
          </div>

          {/* Item 3: Mounting & BOS Cabling */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Mounting &amp; BOS
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                AL6005-T5
              </span>
            </div>
            <span className="font-mono font-black text-slate-900 text-sm block">
              RM {mountingBosCost.toLocaleString()}
            </span>
            <p className="text-[10px] text-slate-500 leading-tight">
              Anodized AL6005-T5 aluminum rails, tile brackets, UV-rated DC cables, SPD lightning arrestors &amp; isolators.
            </p>
          </div>

          {/* Item 4: Engineering, SEDA & TNB Meter */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                SEDA &amp; TNB Licensing
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Solar ATAP
              </span>
            </div>
            <span className="font-mono font-black text-slate-900 text-sm block">
              RM {permittingSedaCost.toLocaleString()}
            </span>
            <p className="text-[10px] text-slate-500 leading-tight">
              Solar ATAP 2026 quota registration, PE professional engineer endorsement, and TNB bi-directional smart meter.
            </p>
          </div>
        </div>

        {/* Clear Math Reconciliation Notice: Explaining Hardware vs Turnkey Cost */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-900">
              Cost Transparency Note: Why is Total EPCC (RM {grossTotalCostRm.toLocaleString()}) higher than Bare Modules (RM {actualModuleHardwareTotal.toLocaleString()})?
            </span>
            <p className="leading-relaxed">
              Wholesale solar panels are <strong>RM {moduleHardwareRm}/piece</strong> ({panelCount} panels = <strong>RM {actualModuleHardwareTotal.toLocaleString()}</strong>), which represents ~30% of your total project. The remaining <strong>RM {(grossTotalCostRm - actualModuleHardwareTotal).toLocaleString()}</strong> covers the complete certified turnkey installation: the high-efficiency smart inverter, anti-corrosion anodized aluminum mounting rails, lightning surge arrestors (SPD), certified wireman electrical installation, and official SEDA/TNB bi-directional smart meter replacement.
              {applySuriaRebate && (
                <span className="block text-emerald-700 font-bold mt-1">
                  • SuRIA Home Rebate: Reduces net cash outlay by RM {potentialSuriaRebateRm.toLocaleString()} down to RM {netOutofPocketCostRm.toLocaleString()}.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
