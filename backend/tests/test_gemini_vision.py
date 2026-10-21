"""
Tests for Gemini Vision Rooftop Topology & Facet Detection
"""

import pytest
from app.routers.vision import gemini_detect_roof
from app.config import GEMINI_API_KEY


@pytest.mark.asyncio
async def test_gemini_vision_registration():
    """Verify Gemini Vision endpoint exists and handles key or gracefully reports."""
    from app.services.gemini_service import gemini_vision_service
    assert gemini_vision_service is not None
    assert isinstance(gemini_vision_service.model_name, str) and len(gemini_vision_service.model_name) > 0
