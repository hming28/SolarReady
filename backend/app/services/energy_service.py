"""
SolarReady Malaysia - Solar Energy Yield & TNB Financial Engine
Integrates PVGIS v6 API with snake_case handling, robust offline fallbacks,
and Malaysian TNB / Solar ATAP financial modeling.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from app.schemas import (
    EnergyEstimateRequest,
    EnergyFinanceResult,
    FinanceResult,
    RangeMetric,
    RangeMetricOptional,
)

# Standard PVGIS v6 API endpoint
PVGIS_API_URL = "https://re.jrc.ec.europa.eu/api/v6/PVcalc"

# Peninsular Malaysia Historical Solar Irradiation Baseline (kWh/kWp/year)
PENINSULAR_BASELINE = {
    "conservative": 1280.0,
    "base": 1385.0,
    "optimistic": 1460.0,
}


def is_peninsular_malaysia(lat: float, lon: float) -> bool:
    """Check if coordinates fall within Peninsular Malaysia geographic bounding box."""
    return (1.0 <= lat <= 7.0) and (99.5 <= lon <= 104.6)


class EnergyService:
    async def estimate(self, req: EnergyEstimateRequest) -> EnergyFinanceResult:
        """
        Calculates conservative, base, and optimistic annual kWh generation
        and corresponding TNB bill savings and payback period.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        source = "FALLBACK_SAMPLE"
        assumptions: List[str] = [
            "System losses estimated at 14.0% (inverter efficiency, wiring, thermal coefficient, soiling)",
            "Roof tilt assumed at 10.0° optimal for equatorial latitude, facing south",
            f"TNB domestic retail tariff avoided (self-consumption offset): RM {req.tariff_rm_per_kwh:.4f}/kWh",
            f"Solar ATAP export credit rate applied (energy charge only): RM {req.export_rate_rm_per_kwh:.4f}/kWh",
            f"Self-consumption ratio: {req.self_use_pct:.0f}%",
            f"Turnkey installation benchmark: RM {req.cost_per_kwp_rm:,.2f}/kWp",
        ]

        # 1. Attempt PVGIS v6 query
        pvgis_yield_base = None
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                params = {
                    "lat": req.lat,
                    "lon": req.lon,
                    "peakpower": req.capacity_kwp,
                    "loss": 14,
                    "mountingplace": "building",
                    "angle": 10,
                    "aspect": 0,
                    "outputformat": "json",
                }
                resp = await client.get(PVGIS_API_URL, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    # PVGIS v6 snake_case schema parsing
                    outputs = data.get("outputs", {})
                    totals = outputs.get("totals", {}).get("fixed", {})
                    annual_gen = totals.get("e_y") or totals.get("E_y")
                    if annual_gen and annual_gen > 0:
                        pvgis_yield_base = annual_gen / req.capacity_kwp
                        source = "PVGIS"
                        assumptions.append("Solar irradiance retrieved live from PVGIS v6 (European Commission JRC)")
        except Exception:
            # Graceful network timeout fallback
            pass

        if not pvgis_yield_base:
            pvgis_yield_base = PENINSULAR_BASELINE["base"]
            assumptions.append("Solar irradiance sourced from SEDA / Peninsular Malaysia historical benchmarks")

        # Compute specific yields (kWh/kWp/year)
        specific_yields = RangeMetric(
            low=round(pvgis_yield_base * 0.92, 1),
            base=round(pvgis_yield_base, 1),
            high=round(pvgis_yield_base * 1.06, 1),
        )

        # Compute annual kWh generations
        annual_kwh = RangeMetric(
            low=round(req.capacity_kwp * specific_yields.low, 1),
            base=round(req.capacity_kwp * specific_yields.base, 1),
            high=round(req.capacity_kwp * specific_yields.high, 1),
        )

        # Financial Calculations
        self_use_ratio = req.self_use_pct / 100.0
        export_ratio = 1.0 - self_use_ratio

        annual_self_kwh = RangeMetric(
            low=round(annual_kwh.low * self_use_ratio, 1),
            base=round(annual_kwh.base * self_use_ratio, 1),
            high=round(annual_kwh.high * self_use_ratio, 1),
        )

        annual_export_kwh = RangeMetric(
            low=round(annual_kwh.low * export_ratio, 1),
            base=round(annual_kwh.base * export_ratio, 1),
            high=round(annual_kwh.high * export_ratio, 1),
        )

        # Savings = (Self_kWh * Tariff) + (Export_kWh * Export_Rate)
        def calc_savings(gen_kwh: float) -> float:
            self_k = gen_kwh * self_use_ratio
            exp_k = gen_kwh * export_ratio
            return round(self_k * req.tariff_rm_per_kwh + exp_k * req.export_rate_rm_per_kwh, 2)

        annual_savings = RangeMetric(
            low=calc_savings(annual_kwh.low),
            base=calc_savings(annual_kwh.base),
            high=calc_savings(annual_kwh.high),
        )

        total_cost_rm = round(req.capacity_kwp * req.cost_per_kwp_rm, 2)

        def calc_payback(savings: float) -> Optional[float]:
            if savings <= 0:
                return None
            return round(total_cost_rm / savings, 1)

        payback = RangeMetricOptional(
            low=calc_payback(annual_savings.high),  # High savings = lowest payback years
            base=calc_payback(annual_savings.base),
            high=calc_payback(annual_savings.low),  # Low savings = highest payback years
        )

        policy_status = "verified_peninsular" if is_peninsular_malaysia(req.lat, req.lon) else "unverified"
        if policy_status == "unverified":
            assumptions.append("Policy eligibility outside Peninsular Malaysia requires separate utility verification")

        finance = FinanceResult(
            cost_rm=total_cost_rm,
            cost_per_kwp_rm=req.cost_per_kwp_rm,
            self_use_pct=req.self_use_pct,
            tariff_rm_per_kwh=req.tariff_rm_per_kwh,
            export_rate_rm_per_kwh=req.export_rate_rm_per_kwh,
            annual_self_consumption_kwh=annual_self_kwh,
            annual_export_kwh=annual_export_kwh,
            annual_savings_rm=annual_savings,
            payback_years=payback,
        )

        return EnergyFinanceResult(
            source=source,
            retrieved_at=now_iso,
            specific_yield_kwh_per_kwp=specific_yields,
            annual_generation_kwh=annual_kwh,
            finance=finance,
            policy_status=policy_status,
            assumptions=assumptions,
        )


energy_service = EnergyService()
