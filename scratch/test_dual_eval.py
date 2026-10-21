import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def test_roof(aid, label):
    b64, w, h = gemini_vision_service._get_image_base64(aid)
    prompt = f"""Analyze this top-down aerial / drone rooftop image for residential solar CAD layout feasibility.
CRITICAL SUBJECT & BOUNDARY RULES:
1. TARGET BUILDING ISOLATION:
   - Identify the primary building located near the CENTER of the frame.
   - Segment ONLY the elevated pitched roof planes of this building.
   - STRICT GROUND & SHADOW EXCLUSIONS:
     * NEVER place polygons over ground grass, lawn, dirt, driveway, cars, or asphalt roads outside the roof eaves perimeter!
     * NEVER include ground shadows cast by the roof onto surrounding grass/ground.
     * Polygons must terminate strictly at the outer eaves/gutters of the actual roof structure.
2. ROOF PLANES & TOPOLOGY:
   - Automatically determine the roof structure type:
     * If HIP ROOF (4-pitch / 庑殿顶): Segment into 4 distinct facets (2 trapezoids + 2 triangles) meeting at the hip ridge lines.
     * If GABLE ROOF (2-pitch / 双坡顶): Segment into 2 opposing slope facets meeting along the central ridge.
     * If SHED / FLAT / COMPLEX: Segment each planar watertight slope pitch.
   - Trace the true ridge lines and perimeter eaves cleanly.

Image Dimensions: Width={w} px, Height={h} px.
Output valid JSON strictly matching:
{{
  "roof_type": "hip" | "gable" | "flat" | "shed" | "complex",
  "ridge_orientation": "horizontal" | "vertical" | "diagonal",
  "roof_material": string,
  "estimated_pitch_deg": number,
  "pitch_confidence_range": [number, number],
  "pitch_reasoning": string,
  "facets": [
    {{
      "facet_index": integer,
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_px": [[x, y]],
      "confidence": float
    }}
  ]
}}
Respond ONLY with the JSON object.
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        data, model = await gemini_vision_service._generate_content(client, payload)
        result = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        print(f"[{label}] Roof Type: {result.get('roof_type')}, Ridge: {result.get('ridge_orientation')}, Facets: {len(result.get('facets', []))}")
        for idx, f in enumerate(result.get("facets", [])):
            ys = [p[1] for p in f.get("polygon_px", [])]
            xs = [p[0] for p in f.get("polygon_px", [])]
            print(f"   Facet {idx+1} ({f.get('slope_direction')}): X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}]")

async def main():
    print("Testing Hip Roof (sr-1a819c740e):")
    await test_roof("sr-1a819c740e", "HIP ROOF")
    print("\nTesting Cropped Terrace (sr-84db2ff5ba):")
    await test_roof("sr-84db2ff5ba", "TERRACE CROP")

asyncio.run(main())
