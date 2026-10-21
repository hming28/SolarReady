"""
SolarReady Malaysia - Rooftop Structure & Mounting Cost Service
First-Principles: Structural installation cost varies up to 4x between roof typologies,
representing the single largest BOS cost differentiator in residential solar.
"""

from typing import Dict, Any, List
from pydantic import BaseModel


class StructureTypeInfo(BaseModel):
    id: str
    name: str
    description: str
    structure_cost_rm_per_kwp: float
    labor_difficulty_multiplier: float
    waterproofing_risk: str
    typical_for: str


ROOF_STRUCTURE_DATABASE: Dict[str, StructureTypeInfo] = {
    "solar_ready_greenfield": StructureTypeInfo(
        id="solar_ready_greenfield",
        name="SDP Solar-Ready Factory-Fit (Greenfield)",
        description="Standardized roof truss with pre-embedded mounting rails and pre-cast electrical conduits.",
        structure_cost_rm_per_kwp=95.0,
        labor_difficulty_multiplier=0.4,
        waterproofing_risk="Zero (Factory-Sealed)",
        typical_for="New Sime Darby Property residential phases (e.g. upcoming Elmina launches)",
    ),
    "standard_pitched_tile": StructureTypeInfo(
        id="standard_pitched_tile",
        name="Standard Pitched Clay/Concrete Tile",
        description="Standard Malaysian residential pitched roof requiring tile-hook brackets and manual alignment.",
        structure_cost_rm_per_kwp=240.0,
        labor_difficulty_multiplier=1.0,
        waterproofing_risk="Low-Medium",
        typical_for="Standard 2-storey link houses (Elmina West / East)",
    ),
    "flat_concrete": StructureTypeInfo(
        id="flat_concrete",
        name="Flat Concrete Roof (Ballasted / Stands)",
        description="Requires concrete ballast blocks or anchor penetrations with specialized membrane waterproofing.",
        structure_cost_rm_per_kwp=420.0,
        labor_difficulty_multiplier=1.35,
        waterproofing_risk="Medium-High",
        typical_for="Modern flat-top semi-detached or commercial shophouses",
    ),
    "complex_curved_metal": StructureTypeInfo(
        id="complex_curved_metal",
        name="Complex Pitch / Curved Architectural Profile",
        description="Multi-faceted roof hips, irregular valleys, or steep pitches requiring custom scaffolding and brackets.",
        structure_cost_rm_per_kwp=850.0,
        labor_difficulty_multiplier=1.9,
        waterproofing_risk="High",
        typical_for="Bespoke luxury bungalows or irregular architectural profiles",
    ),
}


def get_structure_info(structure_id: str) -> StructureTypeInfo:
    """Get structure specification by ID, defaulting to standard pitched tile."""
    return ROOF_STRUCTURE_DATABASE.get(
        structure_id, ROOF_STRUCTURE_DATABASE["standard_pitched_tile"]
    )


def list_structure_types() -> List[StructureTypeInfo]:
    """List all available structure types."""
    return list(ROOF_STRUCTURE_DATABASE.values())
