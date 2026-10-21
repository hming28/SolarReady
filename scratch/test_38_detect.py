import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def main():
    b64, w, h = gemini_vision_service._get_image_base64("sr-8e967491e1")
    prompt = f"""Analyze this top-down aerial rooftop image.
Identify the main central building's elevated roof.
Detect each of the 4 slope facets of this hip roof.
Image dimensions: Width={w}, Height={h}.
Return JSON strictly in this structure:
{{
  "facets": [
    {{
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_px": [[x, y]]
    }}
  ]
}}
Respond ONLY with the JSON object.
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        res = json.loads(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
        print("=== gemini-3.8-flash Result ===", flush=True)
        for i, f in enumerate(res.get("facets", [])):
            pts = f.get("polygon_px", [])
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            print(f"Facet {i+1} ({f.get('slope_direction')}): X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}]", flush=True)

asyncio.run(main())
