"""
SolarReady Malaysia - Unified Data Schemas (Pydantic v2)
Strict separation of pixel coordinates (_px) and metric coordinates (_m).
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ==========================================
# 1. Location & Assessment Metadata
# ==========================================

class LocationMeta(BaseModel):
    text: str = Field(..., description="Township, City or Postal Code e.g. Elmina, Selangor")
    lat: Optional[float] = Field(None, description="Latitude (WGS84)")
    lon: Optional[float] = Field(None, description="Longitude (WGS84)")


class ImageMeta(BaseModel):
    filename: str
    path: str
    width_px: int = Field(..., gt=0)
    height_px: int = Field(..., gt=0)
    sha256: Optional[str] = None


class Consent(BaseModel):
    image_use: bool = Field(True, description="User consent for assessment processing")
    timestamp: str = Field(..., description="ISO 8601 consent timestamp")


class AssessmentCreate(BaseModel):
    location: LocationMeta
    house_type: Optional[str] = Field("Terrace", description="Terrace, Semi-D, Bungalow, Commercial")
    monthly_bill_rm: Optional[float] = Field(None, ge=0, description="User average monthly TNB bill in RM")
    consent: Consent
    is_demo: bool = False


# ==========================================
# 2. Roof Geometry & Calibration
# ==========================================

ObstacleType = Literal["water_tank", "ac", "skylight", "chimney", "vent", "unknown"]
ScaleTier = Literal["uncalibrated", "approx_map_measure", "user_measured"]
ScaleMethod = Literal["known_line", "four_corners", "none"]


class Obstacle(BaseModel):
    id: Optional[str] = None
    polygon_px: List[List[float]] = Field(..., description="Obstacle boundary points [[x, y], ...]")
    type: ObstacleType = "water_tank"
    buffer_m: float = Field(0.3, ge=0.0, le=2.0, description="Clearance buffer in meters")
    user_verified: bool = True


class ScaleCalibration(BaseModel):
    method: ScaleMethod = "known_line"
    metres_per_pixel: Optional[float] = Field(None, gt=0, description="Scale ratio (m/px)")
    reference_px: Optional[List[List[float]]] = Field(
        None, description="Reference line points [[x1, y1], [x2, y2]] in pixels"
    )
    reference_m: Optional[float] = Field(None, gt=0, description="Actual ground length in meters")
    quality_tier: ScaleTier = "uncalibrated"
    notes: Optional[str] = None


class RoofGeometry(BaseModel):
    roof_polygons_px: List[List[List[float]]] = Field(
        default_factory=list, description="Array of roof face polygons in pixels"
    )
    obstacles: List[Obstacle] = Field(default_factory=list)
    scale: ScaleCalibration = Field(default_factory=ScaleCalibration)
    roof_area_m2: Optional[float] = Field(
        None, description="Calculated metric roof area (None if uncalibrated)"
    )
    roof_area_px2: Optional[float] = Field(None, description="Pixel area for verification")
    tilt_deg: float = Field(15.0, ge=0.0, le=60.0, description="Roof pitch/tilt angle in degrees")
    faces_metrics: Optional[List[dict]] = Field(
        default_factory=list, description="Computed metrics for individual roof plane facets"
    )
    roof_material: Optional[str] = None
    estimated_pitch_deg: Optional[float] = None
    pitch_confidence_range: Optional[List[float]] = None
    pitch_reasoning: Optional[str] = None
    canvas_rotation_deg: float = Field(
        0.0,
        description="Cumulative clockwise rotation in degrees applied to level satellite imagery from True North"
    )



# ==========================================
# 3. Solar Panel Specifications & Layout
# ==========================================

class PanelSpec(BaseModel):
    name: str = "Tier-1 550W Monocrystalline"
    length_m: float = Field(2.278, gt=0, description="Panel length in meters")
    width_m: float = Field(1.134, gt=0, description="Panel width in meters")
    rated_power_wp: float = Field(550.0, gt=0, description="Rated peak power in Watts")
    min_gap_m: float = Field(0.02, ge=0.0, description="Minimum gap between modules")


class PanelPlacement(BaseModel):
    index: int
    x_m: float
    y_m: float
    w_m: float
    h_m: float
    rotation_deg: float = 0.0
    # Projected pixel coordinates for instant canvas rendering
    x_px: Optional[float] = None
    y_px: Optional[float] = None
    w_px: Optional[float] = None
    h_px: Optional[float] = None


class FacetLayoutSummary(BaseModel):
    facet_index: int
    slope_direction: Optional[str] = None
    panel_count: int = 0
    capacity_kwp: float = 0.0
    area_m2: float = 0.0
    enabled: bool = True


class ArrayBlockRecommendation(BaseModel):
    facet_index: int
    facet_name: str = ""
    orientation: str = "optimal"
    rows: int = 1
    cols: int = 2
    reason: str = ""


class LayoutParams(BaseModel):
    setback_m: float = Field(0.5, ge=0.0, le=2.0, description="Inward roof edge clearance in meters")
    obstacle_buffer_m: float = Field(0.3, ge=0.0, le=2.0, description="Clearance around obstacles")
    orientation: Literal["portrait", "landscape", "optimal"] = "optimal"
    max_capacity_kwp: Optional[float] = Field(None, gt=0, description="Optional inverter / NEM cap")
    active_facet_indices: Optional[List[int]] = Field(None, description="Indices of active facets to pack panels on (0-indexed)")
    allow_estimated_scale: bool = Field(False, description="Allow smart estimated scale fallback if uncalibrated")
    arrays: Optional[List[ArrayBlockRecommendation]] = Field(None, description="Direct AI-planned symmetrical array blocks to place")


class LayoutRequest(BaseModel):
    geometry: RoofGeometry
    panel_spec: PanelSpec = Field(default_factory=PanelSpec)
    params: LayoutParams = Field(default_factory=LayoutParams)


class LayoutResponse(BaseModel):
    panels: List[PanelPlacement] = Field(default_factory=list)
    panel_count: int = 0
    capacity_kwp: float = 0.0
    module_area_m2: float = 0.0
    usable_area_m2: Optional[float] = None
    roof_area_m2: Optional[float] = None
    params: LayoutParams
    geometry_valid: bool = True
    unplaced_reasons: List[str] = Field(default_factory=list)
    facet_layouts: List[FacetLayoutSummary] = Field(default_factory=list)
    scale_fallback_applied: bool = False
    scale_m_per_px: Optional[float] = None


class GeminiLayoutRecommendResponse(BaseModel):
    recommended_orientation: Literal["optimal", "portrait", "landscape"] = "optimal"
    recommended_setback_m: float = 0.35
    recommended_active_facets: List[int] = Field(default_factory=list)
    recommended_preset_index: int = 0
    summary_insights: str = ""
    azimuth_analysis: str = ""
    arrays: List[ArrayBlockRecommendation] = Field(default_factory=list)


# ==========================================
# 4. Energy Generation & TNB Financial Models
# ==========================================

class RangeMetric(BaseModel):
    low: float
    base: float
    high: float


class RangeMetricOptional(BaseModel):
    low: Optional[float] = None
    base: Optional[float] = None
    high: Optional[float] = None


class FinanceResult(BaseModel):
    cost_rm: float
    cost_per_kwp_rm: float
    self_use_pct: float = Field(..., ge=0, le=100)
    tariff_rm_per_kwh: float
    export_rate_rm_per_kwh: float
    annual_self_consumption_kwh: RangeMetric
    annual_export_kwh: RangeMetric
    annual_savings_rm: RangeMetric
    payback_years: RangeMetricOptional


class EnergyFinanceResult(BaseModel):
    source: Literal["PVGIS", "NASA_POWER", "FALLBACK_SAMPLE"]
    retrieved_at: str
    specific_yield_kwh_per_kwp: RangeMetric
    annual_generation_kwh: RangeMetric
    finance: FinanceResult
    policy_status: Literal["unverified", "verified_peninsular"]
    assumptions: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "Preliminary estimate only. Not an engineering sign-off, structural guarantee, "
        "or commercial quotation. Requires physical site survey by an SEDA-certified PV installer."
    )


class EnergyEstimateRequest(BaseModel):
    capacity_kwp: float = Field(..., gt=0)
    lat: float = 3.18
    lon: float = 101.50
    self_use_pct: float = Field(60.0, ge=0.0, le=100.0)
    tariff_rm_per_kwh: float = Field(0.4443, gt=0, description="TNB retail tariff avoided for self-consumption (44.43 sen)")
    export_rate_rm_per_kwh: float = Field(0.2703, ge=0, description="Solar ATAP export energy charge rate (27.03 sen)")
    cost_per_kwp_rm: float = Field(3500.0, gt=0, description="Turnkey cost per kWp in RM")
    assessment_id: Optional[str] = None


# ==========================================
# 5. Full Assessment Aggregate Bundle
# ==========================================

class Assessment(BaseModel):
    id: str
    created_at: str
    title: Optional[str] = None
    monthly_bill_rm: Optional[float] = None
    updated_at: Optional[str] = None
    is_saved: bool = False
    location: LocationMeta
    house_type: str = "Terrace"
    image: ImageMeta
    is_demo: bool = False
    consent: Consent
    geometry: Optional[RoofGeometry] = None
    layout: Optional[LayoutResponse] = None
    energy: Optional[EnergyFinanceResult] = None


class AssessmentMetadataUpdate(BaseModel):
    title: Optional[str] = None
    house_type: Optional[str] = None
    monthly_bill_rm: Optional[float] = None
    is_saved: Optional[bool] = None


class AssessmentSummary(BaseModel):
    id: str
    title: str
    house_type: str
    location: str
    capacity_kwp: float
    panel_count: int
    cost_rm: float
    annual_savings_rm: float
    payback_years: float
    updated_at: str
    is_demo: bool = False
    is_saved: bool = False


class CropRequest(BaseModel):
    box_px: List[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="[min_x, min_y, max_x, max_y] bounding box in original image pixels"
    )


class RotateRequest(BaseModel):
    angle_deg: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Clockwise rotation angle in degrees (-180 to 180) to level satellite imagery"
    )


