"""
Unit and integration tests for Meta SAM 2 vision endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import ROBOFLOW_API_KEY


@pytest.mark.asyncio
async def test_sam2_endpoints_registered():
    """Verify SAM 2 endpoints are registered and respond properly to validation errors or requests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check invalid point request (missing fields)
        resp = await client.post("/api/vision/sam2/point", json={})
        assert resp.status_code == 422

        # Check invalid dual pitch request (missing assessment_id)
        resp2 = await client.post("/api/vision/sam2/dual-pitch", json={})
        assert resp2.status_code == 422
