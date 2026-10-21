import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

prompt_original = """Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
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
"""

async def run():
    b64, w, h = gemini_vision_service._get_image_base64("sr-1a819c740e")
    p = prompt_original.format(width=w, height=h)
    payload = {
        "contents": [{"parts": [{"text": p}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        data, model = await gemini_vision_service._generate_content(client, payload)
        res = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        print("=== Original Prompt Result on Hip Roof ===")
        print("Model used:", model)
        print("Roof Type:", res.get("roof_type"))
        print("Ridge:", res.get("ridge_orientation"))
        print("Facets count:", len(res.get("facets", [])))
        for i, f in enumerate(res.get("facets", [])):
            pts = f.get("polygon_px", [])
            print(f"  Facet {i+1} ({f.get('slope_direction')}): {len(pts)} points -> {pts[:2]} ...")

asyncio.run(run())
