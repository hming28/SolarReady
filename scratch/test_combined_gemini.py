import os
import json
import base64
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
api_key = os.getenv("GEMINI_API_KEY")

img_path = Path("data/sample_roofs/user_test_roof_sharp.jpg")
with open(img_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """
Analyze this top-down aerial rooftop image for solar CAD blueprinting.
Output a valid JSON object strictly complying with:
{
  "roof_type": "hip" | "gable" | "flat" | "shed" | "complex",
  "roof_material": string,
  "estimated_pitch_deg": number,
  "pitch_confidence_range": [number, number],
  "pitch_reasoning": string,
  "facet_count": integer,
  "outer_box_px": [min_x, min_y, max_x, max_y],
  "ridge_apexes_px": [[x, y]],
  "facets": [
    {
      "facet_index": integer,
      "slope_direction": "North" | "South" | "East" | "West",
      "polygon_px": [[x, y]],
      "confidence": float
    }
  ]
}
Ensure polygon coordinates are accurate within 1200x900 image dimensions.
Respond ONLY with the JSON object.
"""

payload = {
    "contents": [{
        "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}}
        ]
    }],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.1
    }
}

r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}", json=payload, timeout=60.0)
data = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])

print(f"=== Combined Detection Result ===", flush=True)
print(f"Roof Type: {data.get('roof_type')}", flush=True)
print(f"Roof Material: {data.get('roof_material')}", flush=True)
print(f"Estimated Pitch: {data.get('estimated_pitch_deg')}° (Confidence: {data.get('pitch_confidence_range')})", flush=True)
print(f"Pitch Reasoning: {data.get('pitch_reasoning')}", flush=True)
print(f"Facets Detected Count: {len(data.get('facets', []))}", flush=True)
for i, f in enumerate(data.get("facets", [])):
    print(f"  - Facet {i+1}: {f.get('slope_direction')} ({len(f.get('polygon_px', []))} vertices, confidence: {f.get('confidence')})", flush=True)
