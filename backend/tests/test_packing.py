"""
Unit tests for the Shapely-based constrained geometric panel packing engine.
"""

from shapely.geometry import box, Polygon
from app.schemas import RoofGeometry, ScaleCalibration, Obstacle, PanelSpec, LayoutParams
from app.services.packing import pack_panels


def test_empty_rectangular_roof():
    """10m x 6m empty roof with 0.5m setback and standard 550W panels."""
    # 10m x 6m at 0.02 m/px => 500px x 300px
    geometry = RoofGeometry(
        roof_polygons_px=[
            [[0, 0], [500, 0], [500, 300], [0, 300]]
        ],
        obstacles=[],
        scale=ScaleCalibration(
            method="known_line",
            metres_per_pixel=0.02,
            quality_tier="user_measured",
        ),
    )
    spec = PanelSpec(length_m=2.278, width_m=1.134, rated_power_wp=550.0, min_gap_m=0.02)
    params = LayoutParams(setback_m=0.5, obstacle_buffer_m=0.3, orientation="optimal")

    result = pack_panels(geometry, spec, params)

    assert result.geometry_valid is True
    assert result.panel_count > 0
    assert result.capacity_kwp == round(result.panel_count * 0.55, 2)
    assert result.module_area_m2 > 0


def test_containment_and_zero_overlap():
    """Every placed panel must be completely within setback roof and non-overlapping."""
    # 12m x 8m roof at 0.02 m/px => 600px x 400px
    geometry = RoofGeometry(
        roof_polygons_px=[
            [[0, 0], [600, 0], [600, 400], [0, 400]]
        ],
        obstacles=[],
        scale=ScaleCalibration(metres_per_pixel=0.02, quality_tier="user_measured"),
    )
    params = LayoutParams(setback_m=0.5, obstacle_buffer_m=0.3, orientation="optimal")
    spec = PanelSpec(length_m=2.278, width_m=1.134, rated_power_wp=550.0, min_gap_m=0.02)

    result = pack_panels(geometry, spec, params)

    roof_m = box(0, 0, 12.0, 8.0)
    setback_roof_m = roof_m.buffer(-0.5)

    placed_boxes = []
    for p in result.panels:
        b = box(p.x_m, p.y_m, p.x_m + p.w_m, p.y_m + p.h_m)
        placed_boxes.append(b)

        # 1. Strictly inside setback roof
        assert setback_roof_m.covers(b), f"Panel {p.index} extends outside setback roof!"

    # 2. Mutually non-overlapping
    for i in range(len(placed_boxes)):
        for j in range(i + 1, len(placed_boxes)):
            intersection_area = placed_boxes[i].intersection(placed_boxes[j]).area
            assert intersection_area < 1e-4, f"Panels {i+1} and {j+1} overlap! Area: {intersection_area}"


def test_obstacle_clearance():
    """Panels must not enter obstacle clearance zone."""
    # 10m x 10m roof (500px x 500px at 0.02 m/px) with a 2m x 2m obstacle in center
    # Center obstacle: 4m to 6m in x and y => [200, 200] to [300, 300] px
    geometry = RoofGeometry(
        roof_polygons_px=[
            [[0, 0], [500, 0], [500, 500], [0, 500]]
        ],
        obstacles=[
            Obstacle(
                polygon_px=[[200, 200], [300, 200], [300, 300], [200, 300]],
                type="water_tank",
                buffer_m=0.3,
                user_verified=True,
            )
        ],
        scale=ScaleCalibration(metres_per_pixel=0.02, quality_tier="user_measured"),
    )
    params = LayoutParams(setback_m=0.5, obstacle_buffer_m=0.3, orientation="optimal")
    spec = PanelSpec(length_m=2.278, width_m=1.134, rated_power_wp=550.0)

    result = pack_panels(geometry, spec, params)

    # Obstacle in meters: box(4.0, 4.0, 6.0, 6.0) with 0.3m buffer
    obs_buffer = box(4.0, 4.0, 6.0, 6.0).buffer(0.3)

    for p in result.panels:
        p_box = box(p.x_m, p.y_m, p.x_m + p.w_m, p.y_m + p.h_m)
        assert not obs_buffer.intersects(p_box), f"Panel {p.index} intersects obstacle buffer!"


def test_setback_monotonicity():
    """Increasing setback must never increase panel count."""
    geometry = RoofGeometry(
        roof_polygons_px=[[[0, 0], [500, 0], [500, 400], [0, 400]]],
        obstacles=[],
        scale=ScaleCalibration(metres_per_pixel=0.02, quality_tier="user_measured"),
    )
    spec = PanelSpec(length_m=2.278, width_m=1.134, rated_power_wp=550.0)

    res_small_setback = pack_panels(geometry, spec, LayoutParams(setback_m=0.3))
    res_large_setback = pack_panels(geometry, spec, LayoutParams(setback_m=1.2))

    assert res_large_setback.panel_count <= res_small_setback.panel_count


def test_undersized_roof():
    """Roof smaller than a single panel returns 0 panels without crashing."""
    # 1.5m x 1.0m roof at 0.02 m/px => 75px x 50px
    geometry = RoofGeometry(
        roof_polygons_px=[[[0, 0], [75, 0], [75, 50], [0, 50]]],
        obstacles=[],
        scale=ScaleCalibration(metres_per_pixel=0.02, quality_tier="user_measured"),
    )
    spec = PanelSpec(length_m=2.278, width_m=1.134, rated_power_wp=550.0)
    result = pack_panels(geometry, spec, LayoutParams(setback_m=0.1))

    assert result.panel_count == 0
    assert result.capacity_kwp == 0.0
    assert result.geometry_valid is True
    assert len(result.unplaced_reasons) > 0


def test_uncalibrated_scale():
    """Uncalibrated roof rejects real-world panel placement."""
    geometry = RoofGeometry(
        roof_polygons_px=[[[0, 0], [500, 0], [500, 400], [0, 400]]],
        obstacles=[],
        scale=ScaleCalibration(quality_tier="uncalibrated"),
    )
    result = pack_panels(geometry)
    assert result.geometry_valid is False
    assert result.panel_count == 0


def test_estimated_scale_fallback_and_facet_filtering():
    """When allow_estimated_scale is enabled, pack panels on active facets."""
    geometry = RoofGeometry(
        roof_polygons_px=[
            [[0, 0], [300, 0], [300, 200], [0, 200]],
            [[0, 200], [300, 200], [300, 400], [0, 400]],
        ],
        obstacles=[],
        scale=ScaleCalibration(quality_tier="uncalibrated"),
    )
    # Enable fallback and only pack on facet 0
    params = LayoutParams(allow_estimated_scale=True, active_facet_indices=[0], setback_m=0.3)
    result = pack_panels(geometry, params=params)
    assert result.panel_count > 0
    assert result.scale_fallback_applied is True
    assert len(result.facet_layouts) == 2
    assert result.facet_layouts[0].enabled is True
    assert result.facet_layouts[1].enabled is False
    assert result.facet_layouts[1].panel_count == 0

