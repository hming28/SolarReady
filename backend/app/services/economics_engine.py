"""
SolarReady Malaysia - First-Principles Economics & LCOE Engine
Calculates Levelized Cost of Delivered Energy (LCOE), grid wheeling charges,
and developer vertical integration margins (Brownfield Retrofit vs. Greenfield Solar-Ready).
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from app.services.structure_cost import get_structure_info, StructureTypeInfo


class LcoeCalculationRequest(BaseModel):
    module_fob_usd_per_w: float = Field(0.116, ge=0.05, le=0.30, description="Module FOB price in USD/W")
    usd_to_myr: float = Field(4.30, ge=3.5, le=5.5, description="Currency exchange rate")
    structure_type: str = Field("standard_pitched_tile", description="Structure type ID")
    cac_rm_per_kwp: float = Field(600.0, ge=0.0, le=1500.0, description="Customer acquisition & sales cost in RM/kWp")
    wacc: float = Field(0.08, ge=0.04, le=0.15, description="Weighted average cost of capital (e.g. 0.08 = 8%)")
    wheeling_charge_sen: float = Field(9.0, ge=0.0, le=25.0, description="Grid wheeling charge (TPA / CREAM) in sen/kWh")
    offtaker_tariff_sen: float = Field(36.0, ge=20.0, le=60.0, description="C&I offtaker energy replacement value in sen/kWh")
    specific_yield_kwh: float = Field(1385.0, ge=1100.0, le=1600.0, description="Annual specific yield in kWh/kWp")
    lifetime_years: int = Field(25, ge=15, le=30)
    system_size_kwp: float = Field(8.8, gt=0, description="Standard residential system size in kWp")


class CapexBreakdown(BaseModel):
    module_rm_per_kwp: float
    inverter_bos_rm_per_kwp: float
    structure_rm_per_kwp: float
    installation_labor_rm_per_kwp: float
    cac_rm_per_kwp: float
    total_capex_rm_per_kwp: float
    total_system_cost_rm: float
    idiot_index: float  # Total cost / Raw module FOB cost


class LcoeResult(BaseModel):
    capex_breakdown: CapexBreakdown
    generation_lcoe_sen: float
    wheeling_charge_sen: float
    delivered_lcoe_sen: float
    offtaker_tariff_sen: float
    margin_sen_per_kwh: float
    viable_lease: bool
    annual_generation_kwh: float
    max_viable_annual_rent_per_kwp_rm: float
    typical_homeowner_monthly_rent_rm: float
    aggregator_irr_pct: float
    structure_info: StructureTypeInfo


class TownshipComparisonScenario(BaseModel):
    scenario_name: str
    description: str
    capex_rm_per_kwp: float
    delivered_lcoe_sen: float
    margin_sen_per_kwh: float
    homeowner_monthly_rent_rm: float
    viable_lease: bool
    cac_rm_per_home: float
    structure_cost_rm_per_kwp: float
    scope2_abatement_tonnes_per_home_yr: float


def calculate_lcoe(req: LcoeCalculationRequest) -> LcoeResult:
    """
    Computes Capex breakdown, generation LCOE, and delivered LCOE including grid wheeling fees.
    """
    struct_info = get_structure_info(req.structure_type)

    # 1. First-principles Capex breakdown (RM / kWp = 1000 Wp)
    # Raw module cost = FOB USD/W * 1000 * Exchange Rate (~RM 500/kWp)
    module_rm_per_kwp = round(req.module_fob_usd_per_w * 1000.0 * req.usd_to_myr, 2)

    # Inverters, electrical BOS (cables, DC isolators, distribution board, surge protection)
    inverter_bos_rm_per_kwp = 620.0

    # Mounting structure based on roof type
    structure_rm_per_kwp = struct_info.structure_cost_rm_per_kwp

    # Installation labor, scaffolding, testing & commissioning (scales with roof complexity)
    base_labor = 650.0
    installation_labor_rm_per_kwp = round(base_labor * struct_info.labor_difficulty_multiplier, 2)

    # Permitting, PE structural sign-off, SEDA submission fees
    base_permitting = 300.0
    permitting_rm_per_kwp = round(base_permitting * (1.5 if struct_info.labor_difficulty_multiplier > 1.2 else 1.0), 2)

    # Customer acquisition / sales channel cost
    cac_rm_per_kwp = req.cac_rm_per_kwp

    # Total turnkey Capex per kWp
    total_capex_per_kwp = round(
        module_rm_per_kwp
        + inverter_bos_rm_per_kwp
        + structure_rm_per_kwp
        + installation_labor_rm_per_kwp
        + permitting_rm_per_kwp
        + cac_rm_per_kwp,
        2,
    )

    total_system_cost_rm = round(total_capex_per_kwp * req.system_size_kwp, 2)
    idiot_index = round(total_capex_per_kwp / module_rm_per_kwp, 1)

    # 2. Capital Recovery Factor (CRF)
    r = req.wacc
    n = req.lifetime_years
    crf = (r * (1 + r) ** n) / ((1 + r) ** n - 1)

    # Annualized capital cost + 1.5% annual O&M
    annual_capital_cost_rm = total_capex_per_kwp * crf
    annual_om_rm = total_capex_per_kwp * 0.015
    total_annual_cost_rm = annual_capital_cost_rm + annual_om_rm

    # Generation LCOE (sen / kWh)
    generation_lcoe_sen = round((total_annual_cost_rm / req.specific_yield_kwh) * 100.0, 2)

    # Delivered LCOE = Generation + Wheeling
    delivered_lcoe_sen = round(generation_lcoe_sen + req.wheeling_charge_sen, 2)

    # Margin vs C&I off-taker value
    margin_sen = round(req.offtaker_tariff_sen - delivered_lcoe_sen, 2)
    viable_lease = margin_sen > 0.0

    # 3. Viable Homeowner Rent (RM / year per kWp)
    # If margin is positive, 40% of surplus margin is allocated to homeowner roof rent
    if viable_lease:
        max_annual_rent_per_kwp = round((margin_sen / 100.0) * req.specific_yield_kwh * 0.40, 2)
        homeowner_monthly_rent = round((max_annual_rent_per_kwp * req.system_size_kwp) / 12.0, 2)
        # Approximate IRR: project return given the margin spread
        aggregator_irr = round(req.wacc * 100.0 + (margin_sen * 0.65), 1)
    else:
        max_annual_rent_per_kwp = 0.0
        homeowner_monthly_rent = 0.0
        aggregator_irr = 0.0

    annual_gen_kwh = round(req.system_size_kwp * req.specific_yield_kwh, 1)

    capex_breakdown = CapexBreakdown(
        module_rm_per_kwp=module_rm_per_kwp,
        inverter_bos_rm_per_kwp=inverter_bos_rm_per_kwp,
        structure_rm_per_kwp=structure_rm_per_kwp,
        installation_labor_rm_per_kwp=installation_labor_rm_per_kwp,
        cac_rm_per_kwp=cac_rm_per_kwp,
        total_capex_rm_per_kwp=total_capex_per_kwp,
        total_system_cost_rm=total_system_cost_rm,
        idiot_index=idiot_index,
    )

    return LcoeResult(
        capex_breakdown=capex_breakdown,
        generation_lcoe_sen=generation_lcoe_sen,
        wheeling_charge_sen=req.wheeling_charge_sen,
        delivered_lcoe_sen=delivered_lcoe_sen,
        offtaker_tariff_sen=req.offtaker_tariff_sen,
        margin_sen_per_kwh=margin_sen,
        viable_lease=viable_lease,
        annual_generation_kwh=annual_gen_kwh,
        max_viable_annual_rent_per_kwp_rm=max_annual_rent_per_kwp,
        typical_homeowner_monthly_rent_rm=homeowner_monthly_rent,
        aggregator_irr_pct=aggregator_irr,
        structure_info=struct_info,
    )


def compare_brownfield_vs_greenfield(
    system_size_kwp: float = 8.8,
) -> Dict[str, TownshipComparisonScenario]:
    """
    Head-to-head comparison:
    - Brownfield: Existing retrofitted terrace with tile hooks & retail door-to-door sales.
    - Greenfield: SDP Solar-Ready New Phase with factory pre-embedded rails & S&P bundled zero-CAC.
    """
    # 1. Brownfield Retrofit
    res_brown = calculate_lcoe(
        LcoeCalculationRequest(
            structure_type="standard_pitched_tile",
            cac_rm_per_kwp=600.0,
            system_size_kwp=system_size_kwp,
        )
    )

    # 2. Greenfield Solar-Ready
    res_green = calculate_lcoe(
        LcoeCalculationRequest(
            structure_type="solar_ready_greenfield",
            cac_rm_per_kwp=0.0,  # Zero customer acquisition! Bundled in sales contract
            system_size_kwp=system_size_kwp,
        )
    )

    annual_gen = system_size_kwp * 1385.0
    scope2_tonnes = round((annual_gen * 0.694) / 1000.0, 1)

    return {
        "brownfield_retrofit": TownshipComparisonScenario(
            scenario_name="Brownfield Retrofit (Existing Phases)",
            description="Conventional retrofit on existing roofs. High structural bracket cost and high door-to-door customer acquisition.",
            capex_rm_per_kwp=res_brown.capex_breakdown.total_capex_rm_per_kwp,
            delivered_lcoe_sen=res_brown.delivered_lcoe_sen,
            margin_sen_per_kwh=res_brown.margin_sen_per_kwh,
            homeowner_monthly_rent_rm=res_brown.typical_homeowner_monthly_rent_rm,
            viable_lease=res_brown.viable_lease,
            cac_rm_per_home=round(600.0 * system_size_kwp, 0),
            structure_cost_rm_per_kwp=res_brown.capex_breakdown.structure_rm_per_kwp,
            scope2_abatement_tonnes_per_home_yr=scope2_tonnes,
        ),
        "greenfield_solar_ready": TownshipComparisonScenario(
            scenario_name="SDP Solar-Ready Factory-Fit (New Phases)",
            description="Pre-embedded roof mounting rails and pre-cast electrical conduits. Solar lease bundled directly into S&P purchase contract at zero CAC.",
            capex_rm_per_kwp=res_green.capex_breakdown.total_capex_rm_per_kwp,
            delivered_lcoe_sen=res_green.delivered_lcoe_sen,
            margin_sen_per_kwh=res_green.margin_sen_per_kwh,
            homeowner_monthly_rent_rm=res_green.typical_homeowner_monthly_rent_rm,
            viable_lease=res_green.viable_lease,
            cac_rm_per_home=0.0,
            structure_cost_rm_per_kwp=res_green.capex_breakdown.structure_rm_per_kwp,
            scope2_abatement_tonnes_per_home_yr=scope2_tonnes,
        ),
    }
