import json
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from app.services.storage import storage_service
from app.schemas import (
    RoofGeometry,
    PanelSpec,
    LayoutParams,
    LayoutResponse,
    PanelPlacement,
    FacetLayoutSummary,
    ArrayBlockRecommendation
)

assessment = storage_service.get_assessment("sr-7e9baa9611")
geom = assessment.geometry

test_arrays = [
    ArrayBlockRecommendation(facet_index=0, facet_name="Plane 1: North Upper", orientation="landscape", rows=1, cols=5),
    ArrayBlockRecommendation(facet_index=4, facet_name="Plane 5: South Wing", orientation="portrait", rows=2, cols=3),
    ArrayBlockRecommendation(facet_index=6, facet_name="Plane 7: East Wing", orientation="portrait", rows=3, cols=1),
]

def pack_array_blocks(geometry, panel_spec, params):
    scale = geometry.scale
    all_pts = [pt for poly in geometry.roof_polygons_px for pt in poly if len(poly) >= 3]
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    bbox_span = max(max(xs) - min(xs), max(ys) - min(ys), 120.0)
    m_per_px = scale.metres_per_pixel if (scale and scale.metres_per_pixel) else round(14.0 / bbox_span, 4)
    
    total_facets = len(geometry.roof_polygons_px)
    placed_panels = []
    gap_m = 0.02 # 20mm clamp gap
    
    # Obstacles
    obs_list = []
    for obs in geometry.obstacles:
        if len(obs.polygon_px) >= 3:
            obs_poly = Polygon([(pt[0] * m_per_px, pt[1] * m_per_px) for pt in obs.polygon_px])
            if obs_poly.is_valid:
                obs_list.append(obs_poly.buffer(params.obstacle_buffer_m))
    union_obs = unary_union(obs_list) if obs_list else Polygon()

    panel_idx = 1
    for arr in params.arrays:
        f_i = arr.facet_index
        if f_i < 0 or f_i >= total_facets:
            continue
        poly_px = geometry.roof_polygons_px[f_i]
        if len(poly_px) < 3:
            continue
        poly_m = Polygon([(pt[0] * m_per_px, pt[1] * m_per_px) for pt in poly_px])
        if not poly_m.is_valid:
            poly_m = poly_m.buffer(0)
            
        orient = arr.orientation.lower()
        if orient == "landscape":
            p_w_m = panel_spec.length_m
            p_h_m = panel_spec.width_m
            rot_deg = 90.0
        else:
            p_w_m = panel_spec.width_m
            p_h_m = panel_spec.length_m
            rot_deg = 0.0
            
        rows = max(1, min(arr.rows, 10))
        cols = max(1, min(arr.cols, 16))
        block_w_m = cols * p_w_m + (cols - 1) * gap_m
        block_h_m = rows * p_h_m + (rows - 1) * gap_m
        
        buffered_f = poly_m.buffer(-max(params.setback_m, 0.15))
        if buffered_f.is_empty or buffered_f.area <= 0:
            buffered_f = poly_m.buffer(-0.1)
        if buffered_f.is_empty or buffered_f.area <= 0:
            buffered_f = poly_m
            
        cx = buffered_f.centroid.x
        cy = buffered_f.centroid.y
        start_x = cx - (block_w_m / 2.0)
        start_y = cy - (block_h_m / 2.0)
        
        minx, miny, maxx, maxy = buffered_f.bounds
        if block_w_m <= (maxx - minx):
            start_x = max(minx, min(start_x, maxx - block_w_m))
        if block_h_m <= (maxy - miny):
            start_y = max(miny, min(start_y, maxy - block_h_m))
            
        for r in range(rows):
            for c in range(cols):
                px_m = start_x + c * (p_w_m + gap_m)
                py_m = start_y + r * (p_h_m + gap_m)
                p_box = box(px_m, py_m, px_m + p_w_m, py_m + p_h_m)
                
                if not union_obs.is_empty and union_obs.intersects(p_box):
                    continue
                # Keep panel if it mostly intersects or is within roof
                if poly_m.intersects(p_box):
                    placed_panels.append(
                        PanelPlacement(
                            index=panel_idx,
                            x_m=round(px_m, 3),
                            y_m=round(py_m, 3),
                            w_m=round(p_w_m, 3),
                            h_m=round(p_h_m, 3),
                            rotation_deg=rot_deg,
                            x_px=round(px_m / m_per_px, 1),
                            y_px=round(py_m / m_per_px, 1),
                            w_px=round(p_w_m / m_per_px, 1),
                            h_px=round(p_h_m / m_per_px, 1),
                        )
                    )
                    panel_idx += 1

    print(f"SUCCESS: Generated {len(placed_panels)} panels from AI planned arrays!")
    for p in placed_panels[:5]:
        print(f"  Panel #{p.index}: x_px={p.x_px}, y_px={p.y_px}, w_px={p.w_px}, h_px={p.h_px}")

pack_array_blocks(geom, PanelSpec(), LayoutParams(setback_m=0.35, arrays=test_arrays))
