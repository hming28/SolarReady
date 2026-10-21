"""
SolarReady Malaysia - Backend API
FastAPI Entry Point
"""

from datetime import datetime, timezone
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import assessments, geometry, layout, energy, vision, portfolio, economics

app = FastAPI(
    title="SolarReady Malaysia API",
    description="End-to-end solar feasibility engine with scale calibration, geometric packing, and financial estimation.",
    version="1.0.0",
)

# Configure CORS for local Next.js frontend
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(assessments.router)
app.include_router(geometry.router)
app.include_router(layout.router)
app.include_router(energy.router)
app.include_router(vision.router)
app.include_router(portfolio.router)
app.include_router(economics.router)


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify backend status."""
    return {
        "status": "ok",
        "service": "SolarReady Malaysia API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
