"""
SolarReady Malaysia - Energy & Finance Router
Calculates solar generation (PVGIS v6) and TNB savings / payback period.
"""

from fastapi import APIRouter, HTTPException, status
from app.schemas import EnergyEstimateRequest, EnergyFinanceResult
from app.services.energy_service import energy_service
from app.services.storage import storage_service

router = APIRouter(prefix="/api/energy", tags=["Energy & Finance"])


@router.post("/estimate", response_model=EnergyFinanceResult)
async def estimate_energy_and_finance(payload: EnergyEstimateRequest):
    """
    Estimate conservative, base, and optimistic annual generation (kWh)
    along with TNB bill savings and payback period.
    """
    try:
        result = await energy_service.estimate(payload)
        if payload.assessment_id:
            assessment = storage_service.get_assessment(payload.assessment_id)
            if assessment:
                assessment.energy = result
                storage_service.save_assessment(assessment)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to estimate solar energy yields: {str(e)}"
        )
