"""
Unit tests for scale calibration, Google Maps 5m scale bar, and roof dimension extraction.
"""

import math
import pytest
from fastapi import HTTPException
from app.routers.geometry import (
    calculate_scale,
    calibrate_google_maps,
    validate_polygon,
    analyze_roof,
    CalibrationCalcRequest,
    GoogleMapsCalibrateRequest,
    PolygonValidateRequest,
    RoofAnalysisRequest,
)


@pytest.mark.asyncio
async def test_scale_calculation_exact():
    """Known length 10m with 500px distance produces 0.02 m/px."""
    req = CalibrationCalcRequest(
        reference_px=[[100, 100], [600, 100]],
        reference_m=10.0,
    )
    res = await calculate_scale(req)
    assert res.distance_px == 500.0
    assert res.reference_m == 10.0
    assert res.metres_per_pixel == 0.02


@pytest.mark.asyncio
async def test_scale_diagonal_line():
    """Diagonal 300px by 400px line produces 500px distance."""
    req = CalibrationCalcRequest(
        reference_px=[[0, 0], [300, 400]],
        reference_m=15.0,
    )
    res = await calculate_scale(req)
    assert res.distance_px == 500.0
    assert res.metres_per_pixel == 0.03


@pytest.mark.asyncio
async def test_scale_reject_zero_or_negative():
    """Reject zero distance or negative meters."""
    with pytest.raises(HTTPException):
        await calculate_scale(
            CalibrationCalcRequest(reference_px=[[100, 100], [100, 100]], reference_m=10.0)
        )

    with pytest.raises(Exception):  # Pydantic validation rejects le=0
        CalibrationCalcRequest(reference_px=[[100, 100], [200, 100]], reference_m=-5.0)


@pytest.mark.asyncio
async def test_google_maps_5m_calibration():
    """Verify Google Maps 5m scale bar calculation."""
    # Suppose the 5m bar in Google Maps is 50px wide
    req = GoogleMapsCalibrateRequest(bar_length_px=50.0, known_meters=5.0)
    res = await calibrate_google_maps(req)
    assert res.bar_length_px == 50.0
    assert res.known_meters == 5.0
    assert res.metres_per_pixel == 0.10
    assert res.quality_tier == "approx_map_measure"


@pytest.mark.asyncio
async def test_polygon_validation_and_dimensions():
    """Verify polygon dimensions (length, width, perimeter, true area with tilt)."""
    # 500px x 400px rectangle at 0.02 m/px:
    # length = 10.0m, width = 8.0m, planar area = 80 m^2, perimeter = 36.0m
    # at 15 degree tilt: true_area = 80 / cos(15 deg) = 82.82 m^2
    req = PolygonValidateRequest(
        polygon_px=[[0, 0], [500, 0], [500, 400], [0, 400]],
        metres_per_pixel=0.02,
        tilt_deg=15.0,
    )
    res = await validate_polygon(req)
    assert res.is_valid is True
    assert res.area_px2 == 200000.0
    assert res.area_m2 == 80.0
    assert res.length_m == 10.0
    assert res.width_m == 8.0
    assert res.perimeter_m == 36.0
    assert res.true_area_m2 == pytest.approx(82.82, rel=1e-2)
    assert res.slope_direction is not None


@pytest.mark.asyncio
async def test_multi_facet_roof_analysis():
    """Verify multi-facet analysis computes individual and aggregate metrics."""
    # 2 roof facets (e.g. East and West slope)
    face1 = [[0, 0], [300, 0], [300, 200], [0, 200]]  # 6m x 4m = 24 m^2
    face2 = [[0, 250], [300, 250], [300, 450], [0, 450]]  # 6m x 4m = 24 m^2
    req = RoofAnalysisRequest(
        roof_polygons_px=[face1, face2],
        metres_per_pixel=0.02,
        tilt_deg=15.0,
    )
    res = await analyze_roof(req)
    assert len(res.faces) == 2
    assert res.faces[0].length_m == 6.0
    assert res.faces[0].width_m == 4.0
    assert res.faces[0].planar_area_m2 == 24.0
    assert res.total_planar_area_m2 == 48.0
    assert res.total_true_area_m2 == pytest.approx(49.69, rel=1e-2)
    assert res.scale_calibrated is True


@pytest.mark.asyncio
async def test_split_roof_along_ridge():
    """Verify splitting a single gable roof polygon into 2 distinct slope facets along ridge line."""
    from app.routers.geometry import split_roof_along_ridge, SplitRidgeRequest
    roof_poly = [[0, 0], [600, 0], [600, 400], [0, 400]]
    req = SplitRidgeRequest(polygon_px=roof_poly, direction="auto")
    res = await split_roof_along_ridge(req)
    assert res.facet_count == 2
    assert len(res.faces_px) == 2


@pytest.mark.asyncio
async def test_cut_roof_with_line():
    """Verify cutting a roof polygon with a user-drawn line segment."""
    from app.routers.geometry import cut_roof_with_line, CutLineRequest
    roof_poly = [[100, 100], [500, 100], [500, 400], [100, 400]]
    req = CutLineRequest(
        roof_polygons_px=[roof_poly],
        line_px=[[200, 250], [400, 250]]
    )
    res = await cut_roof_with_line(req)
    assert res.split_occurred is True
    assert res.facets_count == 2
    assert len(res.roof_polygons_px) == 2


@pytest.mark.asyncio
async def test_split_hip_roof():
    """Verify 4-pitch hip roof generates exactly 4 facets (2 trapezoids, 2 triangles)."""
    from app.routers.geometry import split_hip_endpoint, SplitHipRequest
    roof_poly = [[80, 65], [337, 65], [337, 265], [80, 265]]
    req = SplitHipRequest(polygon_px=roof_poly)
    res = await split_hip_endpoint(req)
    assert res.facets_count == 4
    assert len(res.roof_polygons_px) == 4



