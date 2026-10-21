"""
Unit tests for the first-principles economics, LCOE, and Greenfield comparison engine.
"""

from app.services.economics_engine import (
    calculate_lcoe,
    compare_brownfield_vs_greenfield,
    LcoeCalculationRequest,
)


def test_lcoe_baseline_economics():
    """Verify standard tile baseline delivers LCOE in the 28 - 31 sen/kWh range."""
    req = LcoeCalculationRequest(
        module_fob_usd_per_w=0.116,
        usd_to_myr=4.30,
        structure_type="standard_pitched_tile",
        cac_rm_per_kwp=600.0,
        wacc=0.08,
        wheeling_charge_sen=9.0,
        offtaker_tariff_sen=36.0,
        specific_yield_kwh=1385.0,
    )
    res = calculate_lcoe(req)

    # Generation LCOE should be ~19-22 sen
    assert 18.0 <= res.generation_lcoe_sen <= 23.0
    # Delivered LCOE should be ~28-31 sen
    assert 27.0 <= res.delivered_lcoe_sen <= 32.0
    assert res.delivered_lcoe_sen == round(res.generation_lcoe_sen + 9.0, 2)
    assert res.viable_lease is True
    assert res.margin_sen_per_kwh > 0


def test_greenfield_advantage():
    """Verify Greenfield Solar-Ready achieves >= 60% structure cost reduction and delivered LCOE ~21 sen."""
    scenarios = compare_brownfield_vs_greenfield(system_size_kwp=8.8)
    brown = scenarios["brownfield_retrofit"]
    green = scenarios["greenfield_solar_ready"]

    # Greenfield Capex is lower due to zero CAC and factory pre-embedded rails
    assert green.capex_rm_per_kwp < brown.capex_rm_per_kwp
    assert green.structure_cost_rm_per_kwp == 95.0
    assert brown.structure_cost_rm_per_kwp == 240.0
    assert green.cac_rm_per_home == 0.0
    assert brown.cac_rm_per_home > 0.0

    # Delivered LCOE for Greenfield should be substantially lower (~21 sen vs ~29 sen)
    assert green.delivered_lcoe_sen < brown.delivered_lcoe_sen
    assert green.delivered_lcoe_sen <= 23.0

    # Homeowner rental capacity is much higher in Greenfield due to healthier margin
    assert green.homeowner_monthly_rent_rm > brown.homeowner_monthly_rent_rm


def test_complex_roof_unviable_lease():
    """Verify that complex architectural roofs (RM850 structure) are flagged as non-viable."""
    req = LcoeCalculationRequest(
        structure_type="complex_curved_metal",
        cac_rm_per_kwp=600.0,
        wacc=0.08,
        wheeling_charge_sen=9.0,
        offtaker_tariff_sen=36.0,
    )
    res = calculate_lcoe(req)

    # Delivered LCOE exceeds 36 sen ceiling
    assert res.delivered_lcoe_sen > 36.0
    assert res.viable_lease is False
    assert res.margin_sen_per_kwh <= 0.0
    assert res.typical_homeowner_monthly_rent_rm == 0.0
