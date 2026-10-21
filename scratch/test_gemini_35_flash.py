import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def main():
    b64, w, h = gemini_vision_service._get_image_base64("sr-463e57f5f8")
    prompt = f"""Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
CRITICAL SUBJECT & BOUNDARY RULES:
1. TARGET BUILDING ISOLATION:
   - Identify the primary house located near the CENTER of the frame.
   - Segment ONLY the elevated pitched roof planes belonging to this central building.
   - The roof terminates strictly at the outer perimeter eaves and gutters. NEVER include ground dirt, white rubble, lawn, driveway, cars, or road below or around the eaves!
   - Exclude adjoining neighboring buildings beyond dividing property lines or parapet walls.
2. ROOF PLANES & FACETS:
   - Carefully trace the roof ridge and facets:
     * If the building is an elongated hip roof, notice the horizontal central ridge line segment between two distinct apices (North/South facets are 4-vertex trapezoids, West/East facets are 3-vertex triangles). Do not collapse the ridge line into a single pyramid point!
     * If gable roof, detect the 2 opposing slope facets meeting along the central ridge line.
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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        data = resp.json()
        print("gemini-3.5-flash status:", resp.status_code)
        res = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        print("Roof Type:", res.get("roof_type"))
        print("Ridge:", res.get("ridge_orientation"))
        print("Facets count:", len(res.get("facets", [])))
        for i, f in enumerate(res.get("facets", [])):
            pts = f.get("polygon_1000", [])
            xs = [p[1] * w / 1000.0 for p in pts]
            ys = [p[0] * h / 1000.0 for p in pts]
            print(f"Facet {i+1} ({f.get('slope_direction')}): {len(pts)} pts, X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}]")
            print("   Pts:", [[round(x, 1), round(y, 1)] for x, y in zip(xs, ys)])

asyncio.run(main())
