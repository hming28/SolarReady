import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def test_run(trial):
    b64, w, h = gemini_vision_service._get_image_base64("sr-8e967491e1")
    prompt = f"""Analyze this top-down aerial rooftop image for residential solar CAD layout feasibility.
CRITICAL SUBJECT & BOUNDARY RULES:
1. TARGET BUILDING ISOLATION:
   - Identify the primary house located near the CENTER of the frame.
   - Segment ONLY the elevated pitched roof planes belonging to this central building.
   - The roof terminates strictly at the outer perimeter eaves and gutters. NEVER include ground dirt, white rubble, lawn, driveway, cars, or road below or around the eaves!
   - Exclude adjoining neighboring buildings beyond dividing property lines or parapet walls.
2. ROOF PLANES & FACETS:
   - Carefully observe the central roof ridge line:
     * This is an elongated hip roof with a horizontal central ridge line segment running between TWO distinct ridge apices (left-apex and right-apex).
     * North and South slope facets are 4-vertex TRAPEZOIDS meeting along the horizontal ridge line.
     * West and East slope facets are 3-vertex TRIANGLES meeting at their respective ridge apex.
     * Do NOT collapse the horizontal ridge line into a single pyramid point!
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
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_vision_service.api_key}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        data = resp.json()
        res = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        facets = res.get("facets", [])
        print(f"\n--- Trial {trial} ---")
        print(f"Roof Type: {res.get('roof_type')}, Ridge: {res.get('ridge_orientation')}, Facets: {len(facets)}")
        for i, f in enumerate(facets):
            raw_pts = f.get("polygon_1000", [])
            xs = [p[1] * w / 1000.0 for p in raw_pts]
            ys = [p[0] * h / 1000.0 for p in raw_pts]
            print(f"  Facet {i+1} ({f.get('slope_direction')}): {len(raw_pts)} vertices (X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}])")

async def main():
    for t in range(1, 3):
        await test_run(t)

asyncio.run(main())
