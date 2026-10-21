"""
SolarReady Malaysia - Economics & First-Principles Router
API endpoints for LCOE sensitivity sandbox, structure costs, and Greenfield scenarios.
"""

from typing import Dict, List
from fastapi import APIRouter
from app.services.economics_engine import (
    calculate_lcoe,
    compare_brownfield_vs_greenfield,
    LcoeCalculationRequest,
    LcoeResult,
    TownshipComparisonScenario,
)
from app.services.structure_cost import list_structure_types, StructureTypeInfo

router = APIRouter(prefix="/api/economics", tags=["First-Principles Economics"])


@router.post("/lcoe", response_model=LcoeResult)
async def compute_lcoe_sensitivity(payload: LcoeCalculationRequest):
    """
    Compute real-time LCOE, grid wheeling charges, margin, and viable homeowner rent
    based on module FOB price, WACC, wheeling fees, and roof structure types.
    """
    return calculate_lcoe(payload)


@router.get("/scenarios", response_model=Dict[str, TownshipComparisonScenario])
async def get_township_scenarios(system_size_kwp: float = 8.8):
    """
    Compare conventional Brownfield Retrofit vs. SDP Greenfield Solar-Ready Factory-Fit.
    """
    return compare_brownfield_vs_greenfield(system_size_kwp=system_size_kwp)


@router.get("/structure-types", response_model=List[StructureTypeInfo])
async def get_structure_types():
    """
    List all roof mounting structure types and per-kWp costs.
    """
    return list_structure_types()
