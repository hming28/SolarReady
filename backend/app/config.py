"""
SolarReady Malaysia - Configuration Settings
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Load .env from backend directory or project root
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / ".env")

# Robust directory resolution (resolves relative paths against BASE_DIR)
_env_storage = os.getenv("STORAGE_DIR")
if _env_storage:
    STORAGE_DIR = (BASE_DIR / _env_storage).resolve() if not Path(_env_storage).is_absolute() else Path(_env_storage).resolve()
else:
    STORAGE_DIR = (PROJECT_ROOT / "data" / "storage").resolve()

_env_samples = os.getenv("SAMPLE_ROOFS_DIR")
if _env_samples:
    SAMPLE_ROOFS_DIR = (BASE_DIR / _env_samples).resolve() if not Path(_env_samples).is_absolute() else Path(_env_samples).resolve()
else:
    SAMPLE_ROOFS_DIR = (PROJECT_ROOT / "data" / "sample_roofs").resolve()

# Ensure storage directories exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_ROOFS_DIR.mkdir(parents=True, exist_ok=True)

# Default location for demo
DEFAULT_LOCATION = {
    "text": "Elmina West, City of Elmina, 40160 Shah Alam, Selangor",
    "lat": 3.1850,
    "lon": 101.5120
}

# Optional Roboflow Universe Rooftop Segmentation integration
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "rooftop-segmentation-y0ovu/1")

# Google Gemini Vision API for Intelligent Rooftop Topology & Facet Detection
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

