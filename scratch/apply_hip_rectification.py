from pathlib import Path

p = Path("backend/app/services/gemini_service.py")
content = p.read_text(encoding="utf-8")

old_prompt_chunk = """2. ROOF PLANES & FACETS:
   - Detect each watertight slope facet meeting at the roof ridge line.
   - Return coordinates normalized on a standard 0 to 1000 scale: [y, x] where y is vertical [0..1000] (0=top edge, 1000=bottom edge) and x is horizontal [0..1000] (0=left edge, 1000=right edge)."""

new_prompt_chunk = """2. ROOF PLANES & FACETS:
   - Carefully trace the roof ridge and facets:
     * If the building is an elongated hip roof, notice the horizontal central ridge line segment between two distinct apices (North/South facets are 4-vertex trapezoids, West/East facets are 3-vertex triangles). Do not collapse the ridge line into a single pyramid point!
     * If gable roof, detect the 2 opposing slope facets meeting along the central ridge line.
   - Return coordinates normalized on a standard 0 to 1000 scale: [y, x] where y is vertical [0..1000] (0=top edge, 1000=bottom edge) and x is horizontal [0..1000] (0=left edge, 1000=right edge)."""

assert old_prompt_chunk in content, "old_prompt_chunk not found!"
content = content.replace(old_prompt_chunk, new_prompt_chunk)

old_post_chunk = """        # Extract pitch metrics
        raw_pitch = result.get("estimated_pitch_deg")"""

new_post_chunk = """        # Check if an elongated hip roof was collapsed into a pyramid peak
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
                            ]

        # Extract pitch metrics
        raw_pitch = result.get("estimated_pitch_deg")"""

assert old_post_chunk in content, "old_post_chunk not found!"
content = content.replace(old_post_chunk, new_post_chunk)

p.write_text(content, encoding="utf-8")
print("Successfully updated gemini_service.py with hip roof rectification!")
