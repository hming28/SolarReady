import os
import json
import base64
import httpx
from pathlib import Path
from dotenv import load_dotenv

# Load env
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
api_key = os.getenv("GEMINI_API_KEY")

models_to_test = ["gemini-3.5-flash-lite", "gemini-3.7-flash"]
test_images = [
    ("User Complex Hip Roof", Path("data/sample_roofs/user_test_roof_sharp.jpg")),
    ("Elmina Gable Terrace", Path("data/sample_roofs/sample_elmina_terrace.jpg")),
    ("Latest Upload Roof", Path("data/storage/sr-c075d1c4e9_working.jpg")),
]

prompt = """
You are an expert civil structural engineer and rooftop solar CAD architect specializing in Southeast Asian / Malaysian residential architecture.

Analyze this rooftop aerial image carefully and extract roof geometric and pitch properties:
1. "roof_type": What architectural roof style is this? (e.g. "hip", "gable", "complex hip-and-valley", "flat", etc.)
2. "roof_material": Identify the roofing material from texture, color, and joint lines (e.g., concrete interlocking tiles, clay tiles, metal deck, flat concrete deck, asphalt shingles).
3. "estimated_pitch_deg": The most probable roof slope pitch / tilt angle in degrees. (Note: standard Malaysian pitched tile roofs are designed for rapid monsoonal tropical storm drainage, typically 15°-25°, while metal deck is 5°-10°, flat is 0°-3°).
4. "pitch_confidence_range": [min_deg, max_deg] (e.g., [18, 24])
5. "solar_flush_mount_tilt": Recommended panel tilt when flush-mounted on this roof slope.
6. "reasoning": Detailed architectural, geometric, and visual evidence explaining how you determined the roof pitch from this 2D aerial image (discussing ridge-to-eave aspect ratio, hip diagonal angles, tile texture, shadows, and tropical rainfall drainage slope standards).

Respond strictly with a valid JSON object matching these keys:
{
  "roof_type": string,
  "roof_material": string,
  "estimated_pitch_deg": number,
  "pitch_confidence_range": [number, number],
  "solar_flush_mount_tilt": number,
  "reasoning": string
}
"""

def test_model(image_label, img_path):
    print(f"\n=======================================================", flush=True)
    print(f"Testing on Image: {image_label} ({img_path})", flush=True)
    print(f"=======================================================", flush=True)
    
    if not img_path.exists():
        print(f"Error: {img_path} not found", flush=True)
        return

    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

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

    for model in models_to_test:
        print(f"Calling Gemini API with model: {model}...", flush=True)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = httpx.post(url, json=payload, timeout=60.0)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                res = json.loads(text)
                print(f"\n[Model: {model}] SUCCESS:", flush=True)
                print(json.dumps(res, indent=2), flush=True)
                break
            else:
                print(f"[{model}] Status {resp.status_code}: {resp.text[:150]}", flush=True)
        except Exception as e:
            print(f"[{model}] Exception: {e}", flush=True)

if __name__ == "__main__":
    for label, path in test_images:
        test_model(label, path)
