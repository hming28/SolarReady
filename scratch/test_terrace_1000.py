import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def main():
    b64, w, h = gemini_vision_service._get_image_base64("sr-84db2ff5ba")
    print(f"Terrace image size: {w} x {h}")
    prompt = """Analyze this top-down aerial rooftop image of a residential house for solar CAD layout.
Identify the primary house roof in the center.
Notice the roof ends at the eaves/gutters, and exclude any ground, driveway, cars, or road below the eaves.
Exclude adjoining neighboring houses beyond dividing property lines.

Return coordinates on a normalized [0, 1000] scale:
{
  "roof_type": "gable" | "hip",
  "facets": [
    {
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_1000": [[y, x]]
    }
  ]
}
Respond ONLY with the JSON object.
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        res = json.loads(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
        print("=== Normalized 1000 Result on Terrace ===", flush=True)
        for i, f in enumerate(res.get("facets", [])):
            pts = f.get("polygon_1000", [])
            xs = [p[1] * w / 1000.0 for p in pts]
            ys = [p[0] * h / 1000.0 for p in pts]
            print(f"Facet {i+1} ({f.get('slope_direction')}): X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}], pts={len(pts)}", flush=True)

asyncio.run(main())
