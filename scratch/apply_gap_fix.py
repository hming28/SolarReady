from pathlib import Path

p = Path("backend/app/services/gemini_service.py")
content = p.read_text(encoding="utf-8")

old_code = """        # Check if an elongated hip roof has collapsed ridge or collapsed facets
        if (result.get("roof_type") == "hip" or len(cleaned_polygons) == 4) and len(cleaned_polygons) == 4:
            all_pts = [pt for poly in cleaned_polygons for pt in poly]
            min_x = min(pt[0] for pt in all_pts)
            max_x = max(pt[0] for pt in all_pts)
            min_y = min(pt[1] for pt in all_pts)
            max_y = max(pt[1] for pt in all_pts)
            w = max_x - min_x
            h = max_y - min_y
            aspect_ratio = max(w, h) / max(min(w, h), 1.0)

            # For rectangular hip roofs, check if horizontal or vertical ridge collapsed into a pyramid point
            needs_rectification = False
            if aspect_ratio >= 1.15:
                if w >= h:
                    # In a horizontally wide hip roof, North (poly 0) and South (poly 1) MUST be trapezoids (>= 4 vertices)
                    # If either is a triangle, or all are triangles, the horizontal ridge has collapsed!
                    if any(len(poly) <= 3 for poly in cleaned_polygons[:2]) or all(len(poly) <= 3 for poly in cleaned_polygons):
                        needs_rectification = True
                else:
                    if any(len(poly) <= 3 for poly in cleaned_polygons[2:4]) or all(len(poly) <= 3 for poly in cleaned_polygons):
                        needs_rectification = True

            if needs_rectification:
                from app.routers.geometry import split_hip_roof
                outer_rect = [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]
                proper_hip_facets = split_hip_roof(outer_rect)
                if len(proper_hip_facets) == 4:
                    cleaned_polygons = proper_hip_facets
                    if w >= h:
                        faces_meta = [
                            {"index": 1, "slope_direction": "North", "confidence": 0.98},
                            {"index": 2, "slope_direction": "South", "confidence": 0.98},
                            {"index": 3, "slope_direction": "West", "confidence": 0.98},
                            {"index": 4, "slope_direction": "East", "confidence": 0.98},
                        ]
                    else:
                        faces_meta = [
                            {"index": 1, "slope_direction": "West", "confidence": 0.98},
                            {"index": 2, "slope_direction": "East", "confidence": 0.98},
                            {"index": 3, "slope_direction": "North", "confidence": 0.98},
                            {"index": 4, "slope_direction": "South", "confidence": 0.98},
                        ]"""

new_code = """        # Ensure 4-pitch Hip Roof facets are watertight with zero gap and a single unified ridge line
        if (result.get("roof_type") == "hip" or len(cleaned_polygons) == 4) and len(cleaned_polygons) == 4:
            all_pts = [pt for poly in cleaned_polygons for pt in poly]
            min_x = min(pt[0] for pt in all_pts)
            max_x = max(pt[0] for pt in all_pts)
            min_y = min(pt[1] for pt in all_pts)
            max_y = max(pt[1] for pt in all_pts)
            w = max_x - min_x
            h = max_y - min_y
            aspect_ratio = max(w, h) / max(min(w, h), 1.0)

            needs_rectification = False
            if aspect_ratio >= 1.15:
                if w >= h:
                    # In a horizontally wide hip roof:
                    # 1. Check if any polygon is a triangle (collapsed ridge)
                    is_collapsed = any(len(poly) <= 3 for poly in cleaned_polygons[:2]) or all(len(poly) <= 3 for poly in cleaned_polygons)
                    
                    # 2. Check if there is a vertical gap / unjoined gap along the ridge
                    f1_inner = sorted(cleaned_polygons[0], key=lambda p: p[1])[2:] if len(cleaned_polygons[0]) >= 4 else []
                    f2_inner = sorted(cleaned_polygons[1], key=lambda p: p[1])[:2] if len(cleaned_polygons[1]) >= 4 else []
                    f1_ys = [p[1] for p in f1_inner]
                    f2_ys = [p[1] for p in f2_inner]
                    gap_y = abs(min(f2_ys) - max(f1_ys)) if (f1_ys and f2_ys) else 999.0
                    
                    if is_collapsed or gap_y > 2.0:
                        needs_rectification = True
                else:
                    is_collapsed = any(len(poly) <= 3 for poly in cleaned_polygons[2:4]) or all(len(poly) <= 3 for poly in cleaned_polygons)
                    f3_inner = sorted(cleaned_polygons[2], key=lambda p: p[0])[2:] if len(cleaned_polygons[2]) >= 4 else []
                    f4_inner = sorted(cleaned_polygons[3], key=lambda p: p[0])[:2] if len(cleaned_polygons[3]) >= 4 else []
                    f3_xs = [p[0] for p in f3_inner]
                    f4_xs = [p[0] for p in f4_inner]
                    gap_x = abs(min(f4_xs) - max(f3_xs)) if (f3_xs and f4_xs) else 999.0
                    
                    if is_collapsed or gap_x > 2.0:
                        needs_rectification = True

            if needs_rectification:
                from app.routers.geometry import split_hip_roof
                outer_rect = [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]
                proper_hip_facets = split_hip_roof(outer_rect)
                if len(proper_hip_facets) == 4:
                    cleaned_polygons = proper_hip_facets
                    if w >= h:
                        faces_meta = [
                            {"index": 1, "slope_direction": "North", "confidence": 0.98},
                            {"index": 2, "slope_direction": "South", "confidence": 0.98},
                            {"index": 3, "slope_direction": "West", "confidence": 0.98},
                            {"index": 4, "slope_direction": "East", "confidence": 0.98},
                        ]
                    else:
                        faces_meta = [
                            {"index": 1, "slope_direction": "West", "confidence": 0.98},
                            {"index": 2, "slope_direction": "East", "confidence": 0.98},
                            {"index": 3, "slope_direction": "North", "confidence": 0.98},
                            {"index": 4, "slope_direction": "South", "confidence": 0.98},
                        ]"""

assert old_code in content, "old_code block not found!"
content = content.replace(old_code, new_code)
p.write_text(content, encoding="utf-8")
print("Successfully applied zero-gap watertight hip roof rectification to gemini_service.py!")
