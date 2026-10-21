from pathlib import Path

p = Path("backend/app/services/gemini_service.py")
content = p.read_text(encoding="utf-8")

# 1. Update model default from gemini-3.5-flash-lite to gemini-3.5-flash
content = content.replace(
    'self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")',
    'self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")'
)

# 2. Update rectification logic
old_block = """        # Check if an elongated hip roof was collapsed into a pyramid peak
        if (result.get("roof_type") == "hip" or len(cleaned_polygons) == 4) and len(cleaned_polygons) == 4:
            all_triangles = all(len(poly) == 3 for poly in cleaned_polygons)
            if all_triangles:
                all_pts = [pt for poly in cleaned_polygons for pt in poly]
                min_x = min(pt[0] for pt in all_pts)
                max_x = max(pt[0] for pt in all_pts)
                min_y = min(pt[1] for pt in all_pts)
                max_y = max(pt[1] for pt in all_pts)
                w = max_x - min_x
                h = max_y - min_y
                if max(w, h) / max(min(w, h), 1.0) >= 1.15:
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

new_block = """        # Check if an elongated hip roof has collapsed ridge or collapsed facets
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

assert old_block in content, "old_block not found in gemini_service.py!"
content = content.replace(old_block, new_block)
p.write_text(content, encoding="utf-8")
print("Updated gemini_service.py successfully!")
