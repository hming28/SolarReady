import sys, time
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

candidates = [
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
]

async def test_m(m):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_vision_service.api_key}"
    payload = {
        "contents": [{"parts": [{"text": "Reply with 'ready'"}]}],
    }
    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            dt = time.time() - t0
            print(f"{m}: HTTP {resp.status_code} in {dt:.2f}s", flush=True)
            if resp.status_code == 200:
                print("   ->", resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip())
    except Exception as e:
        print(f"{m}: FAILED ({e}) in {time.time()-t0:.2f}s", flush=True)

async def main():
    for m in candidates:
        await test_m(m)

asyncio.run(main())
