import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio
from app.services.gemini_service import gemini_vision_service

async def main():
    res = await gemini_vision_service.detect_facets("sr-8e967491e1")
    print("Roof Type:", res.get("roof_type"))
    print("Facets count:", len(res.get("polygons_px", [])))
    for i, p in enumerate(res.get("polygons_px", [])):
        print(f"Facet {i+1} ({len(p)} vertices): {p}")

asyncio.run(main())
