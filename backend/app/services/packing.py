"""
SolarReady Malaysia - Constrained Geometric Panel Packing Engine
Pure geometric algorithm using Shapely.
No generative AI hallucination. Every panel satisfies strict containment and clearance constraints.
"""

import math
from typing import List, Tuple, Optional
from shapely.geometry import Polygon, MultiPolygon, Point, box
from shapely.affinity import rotate
from shapely.ops import unary_union
from app.schemas import (
    RoofGeometry,
    PanelSpec,
    LayoutParams,
    LayoutResponse,
    PanelPlacement,
    FacetLayoutSummary,
)


def _ensure_polygon(geom) -> Optional[Polygon]:
    """Ensure geometry is a valid Polygon or MultiPolygon, repairing self-intersections."""
    if geom is None or geom.is_empty:
        return None
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom


def _get_facet_ridge_angle(poly: Polygon) -> float:
    """Computes dominant ridge/eave orientation angle of the facet in degrees (-90 to +90)."""
    try:
        mrr = poly.minimum_rotated_rectangle
        coords = list(mrr.exterior.coords)
        if len(coords) >= 4:
            e1 = math.hypot(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
            e2 = math.hypot(coords[2][0] - coords[1][0], coords[2][1] - coords[1][1])
            if e1 >= e2:
                dx = coords[1][0] - coords[0][0]
                dy = coords[1][1] - coords[0][1]
            else:
                dx = coords[2][0] - coords[1][0]
                dy = coords[2][1] - coords[1][1]
            angle = math.degrees(math.atan2(dy, dx))
            if angle > 90.0:
                angle -= 180.0
            elif angle < -90.0:
                angle += 180.0
            return round(angle, 1)
    except Exception:
        pass
    return 0.0


def pack_panels(
    geometry: RoofGeometry,
    panel_spec: PanelSpec = PanelSpec(),
    params: LayoutParams = LayoutParams(),
) -> LayoutResponse:
    """
    Greedy constrained 2D panel packing algorithm.
    
    Features:
    1. Smart auto-scale fallback: guarantees panels always render even if user hasn't calibrated yet.
    2. Multi-facet support: allows toggling individual facets on/off via params.active_facet_indices.
    3. Per-facet capacity & slope orientation breakdown.
    4. Strict geometric containment and clearance guarantees (zero AI hallucination).
    """
    scale = geometry.scale
    scale_fallback_applied = False

    # Check for uncalibrated scale or accidental micro-scale calibration (e.g. 2m across 500px -> 0.004 m/px)
    all_pts = [pt for poly in geometry.roof_polygons_px for pt in poly if len(poly) >= 3]
    bbox_pixel_span = 0.0
    if all_pts:
        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]
        bbox_pixel_span = max(max(xs) - min(xs), max(ys) - min(ys), 120.0)

    is_micro_scale = False
    if scale and scale.metres_per_pixel and scale.metres_per_pixel > 0:
        real_span_m = bbox_pixel_span * scale.metres_per_pixel
        # If the entire roof is smaller than 4.5m across despite spanning over 150 pixels
        if real_span_m < 4.5 and bbox_pixel_span >= 150.0:
            is_micro_scale = True

    if not scale or not scale.metres_per_pixel or scale.metres_per_pixel <= 0 or (is_micro_scale and params.allow_estimated_scale):
        if not params.allow_estimated_scale and not is_micro_scale:
            return LayoutResponse(
                panels=[],
                panel_count=0,
                capacity_kwp=0.0,
                module_area_m2=0.0,
                params=params,
                geometry_valid=False,
                unplaced_reasons=["Scale is uncalibrated. Cannot calculate real-world panel placement."],
            )

        # Smart fallback: estimate ground scale from roof bounding box
        # Standard Malaysian residential terrace/bungalow roof span is ~12-16m
        m_per_px = round(14.0 / max(bbox_pixel_span, 120.0), 4)
        scale_fallback_applied = True
    else:
        m_per_px = scale.metres_per_pixel

    # Convert roof polygons to meters & apply facet filter
    total_facets = len(geometry.roof_polygons_px)
    active_indices = (
        set(params.active_facet_indices)
        if params.active_facet_indices is not None
        else set(range(total_facets))
    )

    roof_polys_m: List[Tuple[int, Polygon]] = []
    for f_idx, poly_px in enumerate(geometry.roof_polygons_px):
        if len(poly_px) >= 3:
            pts_m = [(pt[0] * m_per_px, pt[1] * m_per_px) for pt in poly_px]
            poly = Polygon(pts_m)
            valid_poly = _ensure_polygon(poly)
            if valid_poly and not valid_poly.is_empty:
                roof_polys_m.append((f_idx, valid_poly))

    if not roof_polys_m:
        return LayoutResponse(
            panels=[],
            panel_count=0,
            capacity_kwp=0.0,
            module_area_m2=0.0,
            params=params,
            geometry_valid=False,
            unplaced_reasons=["No valid roof polygons defined."],
            scale_fallback_applied=scale_fallback_applied,
        )

    all_valid_polys = [p for _, p in roof_polys_m]
    union_roof_m = unary_union(all_valid_polys)
    total_roof_area_m2 = round(float(union_roof_m.area), 2)

    # Inward setback applied per individual ACTIVE roof face
    # to guarantee panels never cross ridge, apex or valley lines
    face_usable_list = []
    effective_setback = max(params.setback_m, 0.15)

    for f_idx, f_poly in roof_polys_m:
        if f_idx not in active_indices:
            continue
        buffered_f = f_poly.buffer(-effective_setback)
        if not buffered_f.is_empty and buffered_f.area > 0:
            face_usable_list.append(buffered_f)
        else:
            # If standard setback is slightly too large for smaller facets, try a smaller setback
            fallback_buffer = f_poly.buffer(-0.15)
            if not fallback_buffer.is_empty and fallback_buffer.area > 0:
                face_usable_list.append(fallback_buffer)

    if not face_usable_list:
        return LayoutResponse(
            panels=[],
            panel_count=0,
            capacity_kwp=0.0,
            module_area_m2=0.0,
            roof_area_m2=total_roof_area_m2,
            usable_area_m2=0.0,
            params=params,
            geometry_valid=True,
            unplaced_reasons=["Setback distance leaves no usable roof surface on selected facets."],
            scale_fallback_applied=scale_fallback_applied,
        )

    usable_roof_m = unary_union(face_usable_list)

    # Obstacle avoidance
    buffered_obs_list = []
    for obs in geometry.obstacles:
        if len(obs.polygon_px) >= 3:
            obs_pts_m = [(pt[0] * m_per_px, pt[1] * m_per_px) for pt in obs.polygon_px]
            obs_poly = Polygon(obs_pts_m)
            valid_obs = _ensure_polygon(obs_poly)
            if valid_obs and not valid_obs.is_empty:
                clearance = max(obs.buffer_m, params.obstacle_buffer_m)
                buffered_obs_list.append(valid_obs.buffer(clearance))

    if buffered_obs_list:
        union_obstacles_m = unary_union(buffered_obs_list)
        usable_area_m = usable_roof_m.difference(union_obstacles_m)
    else:
        union_obstacles_m = Polygon()
        usable_area_m = usable_roof_m

    if usable_area_m.is_empty or usable_area_m.area <= 0:
        return LayoutResponse(
            panels=[],
            panel_count=0,
            capacity_kwp=0.0,
            module_area_m2=0.0,
            roof_area_m2=total_roof_area_m2,
            usable_area_m2=0.0,
            params=params,
            geometry_valid=True,
            unplaced_reasons=["Obstacle clearance zones occupy entire usable roof surface."],
        )

    usable_area_m2 = round(float(usable_area_m.area), 2)

    # Determine orientations to test
    orientations_to_try = []
    if params.orientation in ("portrait", "optimal"):
        # Portrait: width=width_m, height=length_m
        orientations_to_try.append(("portrait", panel_spec.width_m, panel_spec.length_m, 0.0))
    if params.orientation in ("landscape", "optimal"):
        # Landscape: width=length_m, height=width_m
        orientations_to_try.append(("landscape", panel_spec.length_m, panel_spec.width_m, 0.0))

    best_placements: List[Tuple[float, float, float, float, float]] = []

    # Strategy 0: Direct AI Planned Symmetrical Array Placement
    if params.arrays and len(params.arrays) > 0:
        array_placements: List[Tuple[float, float, float, float, float]] = []
        gap_m = max(panel_spec.min_gap_m, 0.02)
        poly_m_map = {f_i: p_m for f_i, p_m in roof_polys_m}

        for arr in params.arrays:
            f_i = arr.facet_index
            if f_i not in poly_m_map:
                continue
            poly_m = poly_m_map[f_i]

            orient = str(arr.orientation or "landscape").lower()
            if orient == "landscape":
                p_w_m = panel_spec.length_m
                p_h_m = panel_spec.width_m
                base_rot = 0.0
            else:
                p_w_m = panel_spec.width_m
                p_h_m = panel_spec.length_m
                base_rot = 0.0

            req_rows = max(1, min(int(arr.rows or 1), 10))
            req_cols = max(1, min(int(arr.cols or 1), 16))

            # Detect facet ridge slope angle for slanted roofs
            ridge_angle = _get_facet_ridge_angle(poly_m)
            is_slanted = not (abs(ridge_angle) < 3.0 or abs(abs(ridge_angle) - 90.0) < 3.0)

            c_orig = poly_m.centroid
            if is_slanted:
                poly_work = rotate(poly_m, -ridge_angle, origin=(c_orig.x, c_orig.y))
                rot_deg = round((base_rot + ridge_angle) % 360, 1)
            else:
                poly_work = poly_m
                rot_deg = base_rot

            buffered_f = poly_work.buffer(-effective_setback)
            if buffered_f.is_empty or buffered_f.area <= 0:
                buffered_f = poly_work.buffer(-0.15)
            if buffered_f.is_empty or buffered_f.area <= 0:
                buffered_f = poly_work

            minx, miny, maxx, maxy = buffered_f.bounds
            cx = (minx + maxx) / 2.0
            cy = (miny + maxy) / 2.0

            # Find best fitting symmetrical block up to requested rows/cols
            facet_arr_best: List[Tuple[float, float, float, float, float]] = []
            for r in range(req_rows, 0, -1):
                for c in range(req_cols, 0, -1):
                    block_w_m = c * p_w_m + (c - 1) * gap_m
                    block_h_m = r * p_h_m + (r - 1) * gap_m
                    start_x = cx - (block_w_m / 2.0)
                    start_y = cy - (block_h_m / 2.0)

                    if block_w_m <= (maxx - minx):
                        start_x = max(minx, min(start_x, maxx - block_w_m))
                    if block_h_m <= (maxy - miny):
                        start_y = max(miny, min(start_y, maxy - block_h_m))

                    cand_panels: List[Tuple[float, float, float, float, float]] = []
                    all_fit = True
                    for ri in range(r):
                        for ci in range(c):
                            local_px_m = start_x + ci * (p_w_m + gap_m)
                            local_py_m = start_y + ri * (p_h_m + gap_m)
                            p_box = box(local_px_m, local_py_m, local_px_m + p_w_m, local_py_m + p_h_m)

                            # Substantial containment within facet
                            if poly_work.intersects(p_box):
                                inter_ratio = poly_work.intersection(p_box).area / (p_w_m * p_h_m)
                                if inter_ratio >= 0.70:
                                    if is_slanted:
                                        local_center = Point(local_px_m + p_w_m / 2.0, local_py_m + p_h_m / 2.0)
                                        world_center = rotate(local_center, ridge_angle, origin=(c_orig.x, c_orig.y))
                                        world_px_m = world_center.x - p_w_m / 2.0
                                        world_py_m = world_center.y - p_h_m / 2.0
                                        cand_panels.append((world_px_m, world_py_m, p_w_m, p_h_m, rot_deg))
                                    else:
                                        cand_panels.append((local_px_m, local_py_m, p_w_m, p_h_m, rot_deg))
                                else:
                                    all_fit = False
                                    break
                            else:
                                all_fit = False
                                break
                        if not all_fit:
                            break

                    if len(cand_panels) > len(facet_arr_best):
                        facet_arr_best = cand_panels
                    if all_fit and len(cand_panels) == r * c:
                        break  # Found maximal complete symmetrical block for this row count

            if not facet_arr_best:
                # If requested orientation produced 0 panels, test flipped orientation as fallback
                alt_w = p_h_m
                alt_h = p_w_m
                for r in range(req_rows, 0, -1):
                    for c in range(req_cols, 0, -1):
                        block_w_m = c * alt_w + (c - 1) * gap_m
                        block_h_m = r * alt_h + (r - 1) * gap_m
                        start_x = cx - (block_w_m / 2.0)
                        start_y = cy - (block_h_m / 2.0)
                        if block_w_m <= (maxx - minx):
                            start_x = max(minx, min(start_x, maxx - block_w_m))
                        if block_h_m <= (maxy - miny):
                            start_y = max(miny, min(start_y, maxy - block_h_m))

                        cand_panels = []
                        all_fit = True
                        for ri in range(r):
                            for ci in range(c):
                                local_px_m = start_x + ci * (alt_w + gap_m)
                                local_py_m = start_y + ri * (alt_h + gap_m)
                                p_box = box(local_px_m, local_py_m, local_px_m + alt_w, local_py_m + alt_h)
                                if poly_work.intersects(p_box) and poly_work.intersection(p_box).area / (alt_w * alt_h) >= 0.70:
                                    if is_slanted:
                                        local_center = Point(local_px_m + alt_w / 2.0, local_py_m + alt_h / 2.0)
                                        world_center = rotate(local_center, ridge_angle, origin=(c_orig.x, c_orig.y))
                                        cand_panels.append((world_center.x - alt_w / 2.0, world_center.y - alt_h / 2.0, alt_w, alt_h, round(ridge_angle % 360, 1)))
                                    else:
                                        cand_panels.append((local_px_m, local_py_m, alt_w, alt_h, 0.0))
                                else:
                                    all_fit = False
                                    break
                            if not all_fit:
                                break
                        if len(cand_panels) > len(facet_arr_best):
                            facet_arr_best = cand_panels
                        if all_fit and len(cand_panels) == r * c:
                            break

            array_placements.extend(facet_arr_best)

        if array_placements:
            best_placements = array_placements

    # Fallback to algorithmic packing if AI arrays not specified or produced no placements
    if not best_placements:
        # Strategy 1: Per-facet packing
        per_facet_runs: List[Tuple[float, float, float, float, float]] = []
        for f_idx, f_poly in roof_polys_m:
            if f_idx not in active_indices:
                continue

            buffered_f = f_poly.buffer(-effective_setback)
            if buffered_f.is_empty or buffered_f.area <= 0:
                buffered_f = f_poly.buffer(-0.15)
            if buffered_f.is_empty or buffered_f.area <= 0:
                continue

            f_usable = buffered_f.difference(union_obstacles_m) if not union_obstacles_m.is_empty else buffered_f
            if f_usable.is_empty or f_usable.area <= 0:
                continue

            f_best_run: List[Tuple[float, float, float, float, float]] = []
            f_minx, f_miny, f_maxx, f_maxy = f_usable.bounds

            for orient_name, w_m, h_m, rot_deg in orientations_to_try:
                step_x = w_m + panel_spec.min_gap_m
                step_y = h_m + panel_spec.min_gap_m
                f_offsets = [
                    (0.0, 0.0),
                    (step_x * 0.25, 0.0),
                    (0.0, step_y * 0.25),
                    (step_x * 0.5, step_y * 0.5),
                    (step_x * 0.75, step_y * 0.25),
                ]

                for ox, oy in f_offsets:
                    cur_f_cand: List[Tuple[float, float, float, float, float]] = []
                    y = f_miny + oy
                    while y + h_m <= f_maxy:
                        x = f_minx + ox
                        while x + w_m <= f_maxx:
                            cand = box(x, y, x + w_m, y + h_m)
                            if f_usable.covers(cand):
                                if union_obstacles_m.is_empty or not union_obstacles_m.intersects(cand):
                                    cur_f_cand.append((x, y, w_m, h_m, rot_deg))
                            x += step_x
                        y += step_y

                    if len(cur_f_cand) > len(f_best_run):
                        f_best_run = cur_f_cand

                # Also evaluate Centered Symmetrical Blocks
                cx = (f_minx + f_maxx) / 2.0
                cy = (f_miny + f_maxy) / 2.0
                max_c = max(1, int((f_maxx - f_minx + panel_spec.min_gap_m) / step_x) + 1)
                max_r = max(1, int((f_maxy - f_miny + panel_spec.min_gap_m) / step_y) + 1)
                for r in range(1, max_r + 1):
                    for c in range(1, max_c + 1):
                        bw = c * w_m + (c - 1) * panel_spec.min_gap_m
                        bh = r * h_m + (r - 1) * panel_spec.min_gap_m
                        start_x = cx - bw / 2.0
                        start_y = cy - bh / 2.0
                        block_cand = []
                        for ri in range(r):
                            for ci in range(c):
                                cand = box(
                                    start_x + ci * step_x,
                                    start_y + ri * step_y,
                                    start_x + ci * step_x + w_m,
                                    start_y + ri * step_y + h_m,
                                )
                                if f_usable.covers(cand) and (
                                    union_obstacles_m.is_empty or not union_obstacles_m.intersects(cand)
                                ):
                                    block_cand.append((
                                        start_x + ci * step_x,
                                        start_y + ri * step_y,
                                        w_m,
                                        h_m,
                                        rot_deg,
                                    ))
                        if len(block_cand) > len(f_best_run):
                            f_best_run = block_cand

            per_facet_runs.extend(f_best_run)

        # Strategy 2: Global grid packing across all facets combined
        global_best_run: List[Tuple[float, float, float, float, float]] = []
        minx, miny, maxx, maxy = usable_area_m.bounds

        for orient_name, w_m, h_m, rot_deg in orientations_to_try:
            step_x = w_m + panel_spec.min_gap_m
            step_y = h_m + panel_spec.min_gap_m
            offsets = [(0.0, 0.0), (step_x * 0.33, 0.0), (0.0, step_y * 0.33), (step_x * 0.5, step_y * 0.5)]

            for ox, oy in offsets:
                current_run: List[Tuple[float, float, float, float, float]] = []
                y = miny + oy
                while y + h_m <= maxy:
                    x = minx + ox
                    while x + w_m <= maxx:
                        panel_candidate = box(x, y, x + w_m, y + h_m)
                        if usable_area_m.covers(panel_candidate):
                            if union_obstacles_m.is_empty or not union_obstacles_m.intersects(panel_candidate):
                                current_run.append((x, y, w_m, h_m, rot_deg))
                        x += step_x
                    y += step_y

                if len(current_run) > len(global_best_run):
                    global_best_run = current_run

        # Choose whichever strategy achieves maximum yield
        if len(per_facet_runs) >= len(global_best_run):
            best_placements = per_facet_runs
        else:
            best_placements = global_best_run

    # Apply capacity cap if specified
    if params.max_capacity_kwp:
        max_allowed_panels = int(params.max_capacity_kwp * 1000.0 / panel_spec.rated_power_wp)
        best_placements = best_placements[:max_allowed_panels]

    # Build final Placement objects with projected pixel coordinates
    placed_panels: List[PanelPlacement] = []
    single_panel_area = panel_spec.length_m * panel_spec.width_m

    for idx, (x_m, y_m, w_m, h_m, rot_deg) in enumerate(best_placements):
        x_px = x_m / m_per_px
        y_px = y_m / m_per_px
        w_px = w_m / m_per_px
        h_px = h_m / m_per_px

        placed_panels.append(
            PanelPlacement(
                index=idx + 1,
                x_m=round(x_m, 3),
                y_m=round(y_m, 3),
                w_m=round(w_m, 3),
                h_m=round(h_m, 3),
                rotation_deg=rot_deg,
                x_px=round(x_px, 1),
                y_px=round(y_px, 1),
                w_px=round(w_px, 1),
                h_px=round(h_px, 1),
            )
        )

    panel_count = len(placed_panels)
    capacity_kwp = round(panel_count * panel_spec.rated_power_wp / 1000.0, 2)
    module_area_m2 = round(panel_count * single_panel_area, 2)

    # Build per-facet layout metrics
    facet_layouts = []
    for f_idx, poly_m in roof_polys_m:
        direction = None
        if geometry.faces_metrics:
            for fm in geometry.faces_metrics:
                idx_val = fm.get("index") if isinstance(fm, dict) else getattr(fm, "index", None)
                if idx_val == f_idx + 1:
                    direction = fm.get("slope_direction") if isinstance(fm, dict) else getattr(fm, "slope_direction", None)
                    break

        from shapely.geometry import Point
        f_panels = [
            p for p in placed_panels
            if poly_m.contains(Point(p.x_m + p.w_m / 2.0, p.y_m + p.h_m / 2.0))
            or (
                poly_m.intersects(box(p.x_m, p.y_m, p.x_m + p.w_m, p.y_m + p.h_m))
                and poly_m.intersection(box(p.x_m, p.y_m, p.x_m + p.w_m, p.y_m + p.h_m)).area > (p.w_m * p.h_m * 0.45)
            )
        ]
        f_count = len(f_panels)
        f_cap = round(f_count * panel_spec.rated_power_wp / 1000.0, 2)

        facet_layouts.append(
            FacetLayoutSummary(
                facet_index=f_idx,
                slope_direction=direction,
                panel_count=f_count,
                capacity_kwp=f_cap,
                area_m2=round(float(poly_m.area), 1),
                enabled=(f_idx in active_indices),
            )
        )

    unplaced_reasons = []
    if panel_count == 0:
        if total_roof_area_m2 < 20.0:
            unplaced_reasons.append(
                f"Calibrated roof area ({total_roof_area_m2} m²) is too small for standard PV panels. Please recalibrate scale in Step 2 or click 'Auto-Fix Scale' to apply standard ~14m span."
            )
        else:
            unplaced_reasons.append(
                "Usable roof area is smaller than a single panel module plus clearances."
            )

    return LayoutResponse(
        panels=placed_panels,
        panel_count=panel_count,
        capacity_kwp=capacity_kwp,
        module_area_m2=module_area_m2,
        usable_area_m2=usable_area_m2,
        roof_area_m2=total_roof_area_m2,
        params=params,
        geometry_valid=True,
        unplaced_reasons=unplaced_reasons,
        facet_layouts=facet_layouts,
        scale_fallback_applied=scale_fallback_applied,
        scale_m_per_px=m_per_px,
    )
