import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.5-pro"]

async def test_model(m, b64, prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                res = json.loads(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
                facets = res.get("facets", [])
                print(f"[{m}] SUCCESS! Roof Type: {res.get('roof_type')}, Facets: {len(facets)}")
                for i, f in enumerate(facets):
                    pts = f.get("polygon_px", [])
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    print(f"   Facet {i+1} ({f.get('slope_direction')}): X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}]")
            else:
                print(f"[{m}] HTTP {resp.status_code}: {resp.text[:150]}")
        except Exception as e:
            print(f"[{m}] ERROR: {e}")

async def main():
    b64, w, h = gemini_vision_service._get_image_base64("sr-8e967491e1")
    prompt = f"""Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
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
   - Image Dimensions: Width={w} px, Height={h} px. All coordinates [x, y] must strictly lie within [0, {w}] and [0, {h}].

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
    for m in models:
        await test_model(m, b64, prompt)

asyncio.run(main())
