import sys, time
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def test_model(m):
    b64, w, h = gemini_vision_service._get_image_base64("sr-463e57f5f8")
    prompt = """Analyze this top-down aerial rooftop image of a residential house.
The house has an elongated hip roof (wider than it is tall).
It has a horizontal central ridge line running between two distinct apices.
North and South facets are TRAPEZOIDS (4 vertices).
East and West facets are TRIANGLES (3 vertices).
Return JSON with polygon_1000: [[y, x]].
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    t0 = time.time()
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(url, json=payload)
            dt = time.time() - t0
            print(f"[{m}] HTTP {resp.status_code} in {dt:.1f}s")
            if resp.status_code == 200:
                res = json.loads(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
                facets = res.get("facets", [])
                print(f"   facets count: {len(facets)}")
                for f in facets:
                    pts = f.get("polygon_1000", [])
                    xs = [p[1] * w / 1000.0 for p in pts]
                    ys = [p[0] * h / 1000.0 for p in pts]
                    print(f"   {f.get('slope_direction')}: {len(pts)} pts, X in [{min(xs):.1f}, {max(xs):.1f}], Y in [{min(ys):.1f}, {max(ys):.1f}]")
        except Exception as e:
            print(f"[{m}] Failed: {e}")

async def main():
    await test_model("gemini-3.5-flash")
    await test_model("gemini-3.8-flash")

asyncio.run(main())
