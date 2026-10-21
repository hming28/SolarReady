"""
Unit tests for solar energy generation and TNB financial modeling.
"""

import pytest
from app.schemas import EnergyEstimateRequest
from app.services.energy_service import energy_service, is_peninsular_malaysia


@pytest.mark.asyncio
async def test_conservation_of_energy():
    """Self-consumption kWh + Export kWh must exactly equal total annual generation kWh."""
    req = EnergyEstimateRequest(
        capacity_kwp=8.0,
        lat=3.18,
        lon=101.50,
        self_use_pct=60.0,
        tariff_rm_per_kwh=0.39,
        export_rate_rm_per_kwh=0.39,
        cost_per_kwp_rm=3500.0,
    )
    res = await energy_service.estimate(req)

    # Check conservation across low, base, and high tiers
    fin = res.finance
    gen = res.annual_generation_kwh

    assert round(fin.annual_self_consumption_kwh.base + fin.annual_export_kwh.base, 1) == gen.base
    assert round(fin.annual_self_consumption_kwh.low + fin.annual_export_kwh.low, 1) == gen.low
    assert round(fin.annual_self_consumption_kwh.high + fin.annual_export_kwh.high, 1) == gen.high


@pytest.mark.asyncio
async def test_yield_bounds_order():
    """Low yield <= Base yield <= High yield."""
    req = EnergyEstimateRequest(capacity_kwp=6.6, lat=3.18, lon=101.5)
    res = await energy_service.estimate(req)

    assert res.specific_yield_kwh_per_kwp.low <= res.specific_yield_kwh_per_kwp.base <= res.specific_yield_kwh_per_kwp.high
    assert res.annual_generation_kwh.low <= res.annual_generation_kwh.base <= res.annual_generation_kwh.high
    assert res.finance.annual_savings_rm.low <= res.finance.annual_savings_rm.base <= res.finance.annual_savings_rm.high


@pytest.mark.asyncio
async def test_peninsular_malaysia_policy_check():
    """Elmina / Selangor coordinates must resolve to verified_peninsular policy status."""
    assert is_peninsular_malaysia(3.185, 101.512) is True  # Selangor
    assert is_peninsular_malaysia(1.492, 103.741) is True  # Johor Bahru
    assert is_peninsular_malaysia(5.414, 100.328) is True  # Penang
    assert is_peninsular_malaysia(4.535, 114.727) is False  # Borneo / Sarawak

    req_elmina = EnergyEstimateRequest(capacity_kwp=5.0, lat=3.185, lon=101.512)
    res_elmina = await energy_service.estimate(req_elmina)
    assert res_elmina.policy_status == "verified_peninsular"


@pytest.mark.asyncio
async def test_payback_handling_for_zero_tariff():
    """Zero savings must handle payback as None without crashing."""
    req = EnergyEstimateRequest(
        capacity_kwp=5.0,
        tariff_rm_per_kwh=0.0001,
        export_rate_rm_per_kwh=0.0001,
    )
    res = await energy_service.estimate(req)
    assert res.finance.payback_years.base is not None
