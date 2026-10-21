"""
SolarReady Malaysia - Layout Optimization Router
Computes constrained 2D panel packing.
"""

from fastapi import APIRouter, HTTPException, status
from app.schemas import LayoutRequest, LayoutResponse
from app.services.packing import pack_panels

router = APIRouter(prefix="/api/layouts", tags=["Layout"])


@router.post("/optimize", response_model=LayoutResponse)
async def optimize_layout(payload: LayoutRequest):
    """
    Computes optimal, collision-free solar panel placement based on:
    - Roof perimeter (inward setback)
    - Obstacle polygons (outward buffer)
    - Configurable panel dimensions and orientations
    """
    try:
        response = pack_panels(
            geometry=payload.geometry,
            panel_spec=payload.panel_spec,
            params=payload.params,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize solar layout: {str(e)}"
        )


@router.post("/gemini-recommend")
async def gemini_recommend_layout(assessment_id: str):
    """
    Leverages Gemini Multimodal AI to evaluate sun angles, roof facets, and Malaysian tropical
    meteorology (Selangor/TNB) to recommend the optimal array orientation, setback, and active facets.
    """
    from app.services.gemini_service import gemini_vision_service
    from app.schemas import GeminiLayoutRecommendResponse
    try:
        rec = await gemini_vision_service.recommend_layout(assessment_id)
        return GeminiLayoutRecommendResponse(**rec)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini layout recommendation failed: {str(e)}"
        )

