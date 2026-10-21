import sys
from pathlib import Path
sys.path.insert(0, str(Path("backend").resolve()))
import asyncio, httpx, json
from app.services.gemini_service import gemini_vision_service

async def main():
    b64, w, h = gemini_vision_service._get_image_base64("sr-8e967491e1")
    print(f"Image actual size: {w} x {h}")
    res = await gemini_vision_service.detect_facets("sr-8e967491e1")
    print("=== detect_facets result ===")
    print("Roof Type:", res.get("roof_type"))
    print("Ridge:", res.get("ridge_orientation"))
    print("Model:", res.get("model_name"))
    print("Polygons px count:", len(res.get("polygons_px", [])))
    for idx, poly in enumerate(res.get("polygons_px", [])):
        print(f"Poly {idx+1}: {poly}")

asyncio.run(main())
