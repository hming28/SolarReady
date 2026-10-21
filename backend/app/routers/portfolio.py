"""
SolarReady Malaysia - Township Portfolio Router (SDP Planner P1)
Aggregates township solar potential scenarios for Sime Darby Property townships,
ranking properties by Delivered LCOE (sen/kWh) and Structural Feasibility.
"""

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/portfolio", tags=["SDP Township Planner"])


class TownshipUnit(BaseModel):
    id: str
    township: str
    cluster_type: str  # "greenfield_launch" vs "brownfield_retrofit"
    property_type: str
    address: str
    structure_type: str
    structure_cost_rm_per_kwp: float
    roof_ready_tier: str  # "Ready", "Obstacle Clearance Needed", "Complex Pitch / Non-Viable"
    potential_kwp: float
    usable_area_m2: float
    delivered_lcoe_sen: float  # Delivery cost to off-taker including 9 sen wheeling fee
    viable_lease: bool
    viable_monthly_rent_rm: float
    estimated_annual_savings_rm: float
    simple_payback_years: float
    scale_confidence: str
    demo_flag: bool = True


@router.get("", response_model=List[TownshipUnit])
async def get_township_portfolio(cluster_filter: Optional[str] = None):
    """
    Returns aggregated township rooftop feasibility assessments.
    Ranked strictly by Delivered LCOE (sen/kWh) and Structural Readiness Tier.
    """
    all_units = [
        # Unit 1: Greenfield Pilot (Best LCOE, Pre-embedded rails)
        TownshipUnit(
            id="ELM-GF-2027",
            township="City of Elmina (Elmina Green Phase 7)",
            cluster_type="greenfield_launch",
            property_type="2-Storey Link House (Solar-Ready)",
            address="Upcoming Phase 7, Elmina Green",
            structure_type="SDP Solar-Ready Factory-Fit",
            structure_cost_rm_per_kwp=95.0,
            roof_ready_tier="Ready",
            potential_kwp=9.9,
            usable_area_m2=64.0,
            delivered_lcoe_sen=21.2,  # Generation 12.2 + Wheeling 9.0
            viable_lease=True,
            viable_monthly_rent_rm=155.0,
            estimated_annual_savings_rm=5450.0,
            simple_payback_years=5.1,
            scale_confidence="user_measured",
            demo_flag=True,
        ),
        # Unit 2: Standard Pitched Tile (Good LCOE)
        TownshipUnit(
            id="ELM-W-0102",
            township="City of Elmina (Elmina West)",
            cluster_type="brownfield_retrofit",
            property_type="2-Storey Link (22' x 75')",
            address="Jalan Metafasa 1, Elmina West",
            structure_type="Standard Pitched Clay/Concrete Tile",
            structure_cost_rm_per_kwp=240.0,
            roof_ready_tier="Ready",
            potential_kwp=8.8,
            usable_area_m2=58.2,
            delivered_lcoe_sen=29.4,  # Generation 20.4 + Wheeling 9.0
            viable_lease=True,
            viable_monthly_rent_rm=58.0,
            estimated_annual_savings_rm=4750.0,
            simple_payback_years=6.5,
            scale_confidence="user_measured",
            demo_flag=True,
        ),
        # Unit 3: Semi-D Pitched Tile
        TownshipUnit(
            id="ELM-E-0409",
            township="City of Elmina (Elmina East)",
            cluster_type="brownfield_retrofit",
            property_type="Semi-D (40' x 80')",
            address="Jalan Sakura 3, Elmina East",
            structure_type="Standard Pitched Clay/Concrete Tile",
            structure_cost_rm_per_kwp=240.0,
            roof_ready_tier="Ready",
            potential_kwp=15.4,
            usable_area_m2=98.5,
            delivered_lcoe_sen=28.8,
            viable_lease=True,
            viable_monthly_rent_rm=110.0,
            estimated_annual_savings_rm=8310.0,
            simple_payback_years=6.2,
            scale_confidence="approx_map_measure",
            demo_flag=True,
        ),
        # Unit 4: Flat Concrete Roof (Higher Structure Cost)
        TownshipUnit(
            id="DA-0812",
            township="Denai Alam",
            cluster_type="brownfield_retrofit",
            property_type="2-Storey Link (Flat Roof Section)",
            address="Jalan Elektron U16/88, Denai Alam",
            structure_type="Flat Concrete Roof (Ballasted/Stands)",
            structure_cost_rm_per_kwp=420.0,
            roof_ready_tier="Obstacle Clearance Needed",
            potential_kwp=6.6,
            usable_area_m2=42.0,
            delivered_lcoe_sen=33.1,  # Generation 24.1 + Wheeling 9.0
            viable_lease=True,
            viable_monthly_rent_rm=24.0,  # Thin margin
            estimated_annual_savings_rm=3550.0,
            simple_payback_years=7.6,
            scale_confidence="user_measured",
            demo_flag=True,
        ),
        # Unit 5: Complex Curved Metal Profile (Non-Viable for Lease)
        TownshipUnit(
            id="BDR-0219",
            township="Bandar Bukit Raja (Klang)",
            cluster_type="brownfield_retrofit",
            property_type="Custom Architectural Bungalow",
            address="Jalan Rodat 2, Bandar Bukit Raja",
            structure_type="Complex Pitch / Curved Metal Profile",
            structure_cost_rm_per_kwp=850.0,
            roof_ready_tier="Complex Pitch / Non-Viable",
            potential_kwp=5.5,
            usable_area_m2=35.0,
            delivered_lcoe_sen=39.5,  # 30.5 + 9.0 = 39.5 sen > 36.0 sen offtaker ceiling!
            viable_lease=False,       # Negative margin!
            viable_monthly_rent_rm=0.0,
            estimated_annual_savings_rm=2960.0,
            simple_payback_years=9.8,
            scale_confidence="approx_map_measure",
            demo_flag=True,
        ),
    ]

    if cluster_filter:
        all_units = [u for u in all_units if u.cluster_type == cluster_filter]

    # Strictly sort by Delivered LCOE ascending (lowest cost of electricity delivery first)
    all_units.sort(key=lambda u: (not u.viable_lease, u.delivered_lcoe_sen))
    return all_units
