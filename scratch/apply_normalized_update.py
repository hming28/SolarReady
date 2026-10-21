from pathlib import Path

p = Path("backend/app/services/gemini_service.py")
content = p.read_text(encoding="utf-8")

old_prompt_block = '''        prompt = f"""
Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
CRITICAL SUBJECT & BOUNDARY RULES:
1. TARGET BUILDING ISOLATION:
   - Identify the SINGLE PRIMARY HOUSE located near the CENTER of the frame.
   - In Malaysian terrace / linked housing developments, homes are attached in a continuous row. You must ONLY segment the CENTRAL SUBJECT PROPERTY.
   - STRICT NEGATIVE CONSTRAINTS:
     * NEVER place polygons over adjoining NEIGHBORING houses (e.g. the adjacent unit on the left or top). Look for boundary step-downs, parapet walls, or dividing gutters that mark property lines.
     * NEVER place polygons over ground driveways, concrete car porches, pavement, or green grass yards.
     * ONLY segment the actual pitched roof surfaces belonging to the central subject building.
2. ROOF PLANES:
   - Detect each watertight slope facet (planar pitch) of the central target house meeting at the roof ridge line.
   - Coordinates MUST trace the real perimeter eaves and ridge lines of the roof planes.
   - Image Dimensions: Width={width} px, Height={height} px. All coordinates [x, y] must strictly lie within [0, {width}] and [0, {height}].

Output a valid JSON object strictly complying with:
{{
  "roof_type": "hip" | "gable" | "flat" | "shed" | "complex",
  "ridge_orientation": "horizontal" | "vertical" | "diagonal",
  "roof_material": string,
  "estimated_pitch_deg": number,
  "pitch_confidence_range": [number, number],
  "pitch_reasoning": string,
  "facet_count": integer,
  "outer_box_px": [min_x, min_y, max_x, max_y],
  "ridge_apexes_px": [[x, y]],
  "facets": [
    {{
      "facet_index": integer,
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_px": [[x, y]],
      "confidence": float
    }}
  ]
}}
For "estimated_pitch_deg", estimate the real-world roof slope pitch/tilt angle in degrees based on architectural style, roofing material (concrete/clay tile typically 18°-25°, metal deck 5°-10°, flat 0°-3°), and tropical storm drainage requirements in Peninsular Malaysia.
Respond ONLY with the JSON object.
"""'''

new_prompt_block = '''        prompt = f"""
Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
CRITICAL SUBJECT & BOUNDARY RULES:
1. TARGET BUILDING ISOLATION:
   - Identify the primary house located near the CENTER of the frame.
   - Segment ONLY the elevated pitched roof planes belonging to this central building.
   - The roof terminates strictly at the outer perimeter eaves and gutters. NEVER include ground dirt, white rubble, lawn, driveway, cars, or road below or around the eaves!
   - Exclude adjoining neighboring buildings beyond dividing property lines or parapet walls.
2. ROOF PLANES & FACETS:
   - Detect each watertight slope facet meeting at the roof ridge line.
   - Return coordinates normalized on a standard 0 to 1000 scale: [y, x] where y is vertical [0..1000] (0=top edge, 1000=bottom edge) and x is horizontal [0..1000] (0=left edge, 1000=right edge).

Output a valid JSON object strictly complying with:
{{
  "roof_type": "hip" | "gable" | "flat" | "shed" | "complex",
  "ridge_orientation": "horizontal" | "vertical" | "diagonal",
  "roof_material": string,
  "estimated_pitch_deg": number,
  "pitch_confidence_range": [number, number],
  "pitch_reasoning": string,
  "facet_count": integer,
  "outer_box_1000": [ymin, xmin, ymax, xmax],
  "facets": [
    {{
      "facet_index": integer,
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_1000": [[y, x]],
      "confidence": float
    }}
  ]
}}
For "estimated_pitch_deg", estimate the real-world roof slope pitch/tilt angle in degrees based on architectural style, roofing material (concrete/clay tile typically 18°-25°, metal deck 5°-10°, flat 0°-3°), and tropical storm drainage requirements in Peninsular Malaysia.
Respond ONLY with the JSON object.
"""'''

assert old_prompt_block in content, "old_prompt_block not found in content!"
content = content.replace(old_prompt_block, new_prompt_block)

old_parse_block = '''        raw_facets = result.get("facets", [])
        all_ys = [pt[1] for f in raw_facets for pt in f.get("polygon_px", []) if len(pt) >= 2]
        all_xs = [pt[0] for f in raw_facets for pt in f.get("polygon_px", []) if len(pt) >= 2]

        # Detect if model normalized Y or X to 1000
        scale_y = 1.0
        if all_ys and max(all_ys) > height * 1.05 and max(all_ys) <= 1050 and height < 950:
            scale_y = height / max(all_ys)

        scale_x = 1.0
        if all_xs and max(all_xs) > width * 1.05 and max(all_xs) <= 1050 and width < 950:
            scale_x = width / max(all_xs)

        for idx, f in enumerate(raw_facets):
            raw_pts = f.get("polygon_px", [])
            scaled_pts = []
            for p in raw_pts:
                if len(p) >= 2:
                    x = round(min(max(0.0, p[0] * scale_x), float(width)), 1)
                    y = round(min(max(0.0, p[1] * scale_y), float(height)), 1)
                    scaled_pts.append([x, y])'''

new_parse_block = '''        raw_facets = result.get("facets", [])

        for idx, f in enumerate(raw_facets):
            raw_pts = f.get("polygon_1000") or f.get("polygon_px", [])
            scaled_pts = []
            for p in raw_pts:
                if len(p) >= 2:
                    if "polygon_1000" in f:
                        # Model outputs normalized [y, x] in 0..1000
                        y_norm, x_norm = p[0], p[1]
                        x = round(min(max(0.0, x_norm * width / 1000.0), float(width)), 1)
                        y = round(min(max(0.0, y_norm * height / 1000.0), float(height)), 1)
                    else:
                        # Fallback for legacy [x, y] coordinates
                        raw_x = p[0]
                        raw_y = p[1]
                        if raw_x > width * 1.05 and raw_x <= 1050:
                            raw_x = raw_x * width / 1000.0
                        if raw_y > height * 1.05 and raw_y <= 1050:
                            raw_y = raw_y * height / 1000.0
                        x = round(min(max(0.0, raw_x), float(width)), 1)
                        y = round(min(max(0.0, raw_y), float(height)), 1)
                    scaled_pts.append([x, y])'''

assert old_parse_block in content, "old_parse_block not found in content!"
content = content.replace(old_parse_block, new_parse_block)

p.write_text(content, encoding="utf-8")
print("Successfully applied normalized update to gemini_service.py!")
