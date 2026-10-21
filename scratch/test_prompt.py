import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def main():
    gemini_vision_service.model_name = "gemini-2.5-flash"
    b64, w, h = gemini_vision_service._get_image_base64("sr-84db2ff5ba")
    prompt = f"""Analyze this top-down aerial rooftop image of a Malaysian residential linked terrace house for solar PV layout.
CRITICAL BOUNDARY RULES:
1. TARGET ISOLATION:
   - Segment ONLY the elevated pitched ROOF TILES of the central subject house.
2. STRICT NEGATIVE REJECTIONS:
   - NEVER EVER segment the front asphalt road, tarmac street (e.g. Jalan Setia), cars, or concrete driveway/car porch at the bottom of the image!
   - Look closely at where the red roof tiles end: the roof ends at the front eaves/gutter line. Everything below the gutter is ground/car porch/road and MUST BE COMPLETELY EXCLUDED!
   - NEVER segment neighboring houses beyond the dividing parapet walls on the left/right.
3. TYPICAL ROOF TOPOLOGY:
   - A standard Malaysian terrace house has TWO main symmetrical slope facets (Left/West and Right/East) meeting along the central longitudinal ridge line.
   - Do NOT output tiny fragmented triangles or segment roads. Trace the clean outer boundary of the actual roof tiles.

Image Dimensions: Width={w} px, Height={h} px.
Output valid JSON strictly matching:
{{
  "roof_type": "gable" | "hip",
  "ridge_orientation": "diagonal" | "vertical" | "horizontal",
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
        print("Model used:", model)
        print("Roof type:", result.get("roof_type"))
        print("Facets count:", len(result.get("facets", [])))
        for idx, f in enumerate(result.get("facets", [])):
            ys = [p[1] for p in f.get("polygon_px", [])]
            xs = [p[0] for f in result.get("facets", []) for p in f.get("polygon_px", [])]
            print(f"Facet {idx+1} ({f.get('slope_direction')}): Y in [{min(ys):.1f}, {max(ys):.1f}], Points: {len(f.get('polygon_px', []))}")

asyncio.run(main())
