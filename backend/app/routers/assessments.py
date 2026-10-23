"""
SolarReady Malaysia - Assessment Router
Handles assessment creation, image upload, image retrieval, and geometry updates.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import math
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from app.config import STORAGE_DIR, SAMPLE_ROOFS_DIR
from app.schemas import (
    Assessment,
    AssessmentCreate,
    AssessmentMetadataUpdate,
    AssessmentSummary,
    RoofGeometry,
    LayoutResponse,
    CropRequest,
    RotateRequest,
)
from app.services.image_service import image_service, ImageValidationError
from app.services.storage import storage_service

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


@router.get("", response_model=List[AssessmentSummary])
async def list_all_assessments():
    """List only explicitly saved user projects and verified benchmark case studies."""
    all_assessments = storage_service.list_assessments()
    summaries: List[AssessmentSummary] = []
    for a in all_assessments:
        is_saved = getattr(a, "is_saved", False)
        is_official_demo = a.id == "demo-elmina-terrace-01"
        if not (is_saved or is_official_demo):
            continue

        cap_kwp = round(a.layout.capacity_kwp, 1) if a.layout and a.layout.capacity_kwp else 4.4
        p_count = a.layout.panel_count if a.layout and a.layout.panel_count else 8
        cost_rm = a.energy.finance.cost_rm if a.energy and a.energy.finance else round(cap_kwp * 3500)
        savings_rm = a.energy.finance.annual_savings_rm.base if a.energy and a.energy.finance else round(cap_kwp * 1385 * 0.4443 * 0.8)
        payback = a.energy.finance.payback_years.base if a.energy and a.energy.finance and a.energy.finance.payback_years.base else round(cost_rm / max(1, savings_rm), 1)

        summaries.append(
            AssessmentSummary(
                id=a.id,
                title=a.title or f"{a.house_type} Rooftop ({a.id[:11]})",
                house_type=a.house_type or "Residential Rooftop",
                location=a.location.text or "Peninsular Malaysia",
                capacity_kwp=cap_kwp,
                panel_count=p_count,
                cost_rm=cost_rm,
                annual_savings_rm=savings_rm,
                payback_years=payback,
                updated_at=a.updated_at or a.created_at[:10],
                is_demo=a.is_demo,
                is_saved=is_saved,
            )
        )
    return summaries


@router.post("", response_model=Assessment, status_code=status.HTTP_201_CREATED)
async def create_assessment(payload: AssessmentCreate):
    """Initialize a new rooftop solar assessment session."""
    assessment_id = f"sr-{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    assessment = Assessment(
        id=assessment_id,
        created_at=now_iso,
        title=f"{payload.house_type or 'Terrace'} Solar ({now_iso[:10]})",
        monthly_bill_rm=payload.monthly_bill_rm,
        location=payload.location,
        house_type=payload.house_type or "Terrace",
        image={
            "filename": "",
            "path": "",
            "width_px": 1,
            "height_px": 1,
        },
        is_demo=payload.is_demo,
        consent=payload.consent,
    )
    storage_service.save_assessment(assessment)
    return assessment


@router.put("/{assessment_id}/metadata", response_model=Assessment)
async def update_assessment_metadata(assessment_id: str, payload: AssessmentMetadataUpdate):
    """Update title, house_type, or monthly bill."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )
    if payload.title is not None:
        assessment.title = payload.title
    if payload.house_type is not None:
        assessment.house_type = payload.house_type
    if payload.monthly_bill_rm is not None:
        assessment.monthly_bill_rm = payload.monthly_bill_rm
    if payload.is_saved is not None:
        assessment.is_saved = payload.is_saved
    assessment.updated_at = datetime.now(timezone.utc).strftime("%b %d, %Y")
    storage_service.save_assessment(assessment)
    return assessment


@router.delete("/{assessment_id}", status_code=status.HTTP_200_OK)
async def delete_assessment(assessment_id: str):
    """Delete assessment from storage."""
    deleted = storage_service.delete_assessment(assessment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )
    return {"status": "deleted", "id": assessment_id}


@router.post("/{assessment_id}/image", response_model=Assessment)
async def upload_assessment_image(assessment_id: str, file: UploadFile = File(...)):
    """Upload and validate rooftop aerial/satellite image."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )

    try:
        content = await file.read()
        rel_path, width, height, sha256 = image_service.validate_and_process(
            file_bytes=content,
            original_filename=file.filename or "roof_image.jpg",
            assessment_id=assessment_id
        )

        assessment.image.filename = file.filename or "roof_image.jpg"
        assessment.image.path = rel_path
        assessment.image.width_px = width
        assessment.image.height_px = height
        assessment.image.sha256 = sha256

        storage_service.save_assessment(assessment)
        return assessment

    except ImageValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process image: {str(e)}"
        )


@router.get("/{assessment_id}/image/file")
async def get_assessment_image_file(assessment_id: str):
    """Serve the working sanitized image file."""
    # Check working image in storage
    working_file = STORAGE_DIR / f"{assessment_id}_working.jpg"
    if working_file.exists():
        return FileResponse(
            working_file,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )

    # Check sample demo images
    sample_file = SAMPLE_ROOFS_DIR / f"{assessment_id}.jpg"
    if sample_file.exists():
        return FileResponse(
            sample_file,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )

    # No image found – return 404 so the frontend can prompt re-upload
    # (Do NOT silently serve sample_elmina_terrace.jpg here; that causes
    #  user projects to display the wrong roof image after a server restart.)
    raise HTTPException(status_code=404, detail="Image file not found for this assessment. Please re-upload your roof image.")


@router.get("/{assessment_id}", response_model=Assessment)
async def get_assessment(assessment_id: str):
    """Retrieve full assessment bundle."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )
    return assessment


@router.post("/{assessment_id}/crop", response_model=Assessment)
async def crop_assessment_image(assessment_id: str, payload: CropRequest):
    """
    Crops the working image to a user-defined bounding box (e.g. single target house).
    Preserves scale calibration (metres_per_pixel) and adjusts existing polygon coordinates.
    """
    from PIL import Image

    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )

    # Find working or original image
    image_path = None
    candidates = [
        STORAGE_DIR / f"{assessment_id}_working.jpg",
        (STORAGE_DIR / f"{assessment_id}_orig_{assessment.image.filename}") if assessment.image.filename else None,
        (STORAGE_DIR / assessment.image.filename) if assessment.image.filename else None,
        (SAMPLE_ROOFS_DIR / "sample_elmina_terrace.jpg") if assessment.is_demo else None,
        SAMPLE_ROOFS_DIR / "sample_elmina_terrace.jpg",
    ]
    for cand in candidates:
        if cand and cand.is_file() and cand.exists():
            image_path = cand
            break

    if not image_path:
        raise HTTPException(status_code=404, detail="Working image file not found.")

    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            orig_w, orig_h = img.size

            box = payload.box_px
            x1 = max(0.0, min(float(box[0]), float(box[2])))
            x2 = min(float(orig_w), max(float(box[0]), float(box[2])))
            y1 = max(0.0, min(float(box[1]), float(box[3])))
            y2 = min(float(orig_h), max(float(box[1]), float(box[3])))

            crop_w = int(round(x2 - x1))
            crop_h = int(round(y2 - y1))

            if crop_w < 30 or crop_h < 30:
                raise HTTPException(
                    status_code=400,
                    detail="Crop area too small (minimum 30x30 pixels required)."
                )

            # Crop image
            cropped_img = img.crop((int(x1), int(y1), int(x2), int(y2)))

            # Save cropped image back to working path
            dest_path = STORAGE_DIR / f"{assessment_id}_working.jpg"
            cropped_img.save(dest_path, "JPEG", quality=95)

            # Update assessment image dimensions
            assessment.image.width_px = crop_w
            assessment.image.height_px = crop_h

            # Adjust geometry coordinates
            if assessment.geometry:
                geom = assessment.geometry
                # Shift polygons
                shifted_polys = []
                for poly in geom.roof_polygons_px:
                    shifted_poly = []
                    for pt in poly:
                        shifted_poly.append([round(pt[0] - x1, 1), round(pt[1] - y1, 1)])
                    inside_pts = [p for p in shifted_poly if 0 <= p[0] <= crop_w and 0 <= p[1] <= crop_h]
                    if len(inside_pts) >= 3:
                        shifted_polys.append(shifted_poly)
                geom.roof_polygons_px = shifted_polys

                # Shift obstacles
                shifted_obs = []
                for obs in geom.obstacles:
                    s_obs_poly = []
                    for pt in obs.polygon_px:
                        s_obs_poly.append([round(pt[0] - x1, 1), round(pt[1] - y1, 1)])
                    inside_obs_pts = [p for p in s_obs_poly if 0 <= p[0] <= crop_w and 0 <= p[1] <= crop_h]
                    if len(inside_obs_pts) >= 3:
                        obs.polygon_px = s_obs_poly
                        shifted_obs.append(obs)
                geom.obstacles = shifted_obs

                # Handle scale calibration - METRES PER PIXEL IS PRESERVED
                if geom.scale and geom.scale.metres_per_pixel and geom.scale.metres_per_pixel > 0:
                    if geom.scale.reference_px:
                        ref1 = geom.scale.reference_px[0]
                        ref2 = geom.scale.reference_px[1]
                        if (x1 <= ref1[0] <= x2 and y1 <= ref1[1] <= y2 and
                            x1 <= ref2[0] <= x2 and y1 <= ref2[1] <= y2):
                            geom.scale.reference_px = [
                                [round(ref1[0] - x1, 1), round(ref1[1] - y1, 1)],
                                [round(ref2[0] - x1, 1), round(ref2[1] - y1, 1)],
                            ]
                        else:
                            geom.scale.reference_px = None
                            note_text = geom.scale.notes or ""
                            geom.scale.notes = f"{note_text} (Preserved from pre-crop scale calibration)".strip()

                # Recalculate area
                if geom.scale and geom.scale.metres_per_pixel and geom.scale.metres_per_pixel > 0 and geom.roof_polygons_px:
                    total_px_area = 0.0
                    for poly in geom.roof_polygons_px:
                        if len(poly) >= 3:
                            n = len(poly)
                            area = 0.0
                            for i in range(n):
                                j = (i + 1) % n
                                area += poly[i][0] * poly[j][1]
                                area -= poly[j][0] * poly[i][1]
                            total_px_area += abs(area) / 2.0
                    geom.roof_area_px2 = round(total_px_area, 2)
                    geom.roof_area_m2 = round(total_px_area * (geom.scale.metres_per_pixel ** 2), 2)
                else:
                    geom.roof_area_px2 = 0.0
                    geom.roof_area_m2 = None

            storage_service.save_assessment(assessment)
            return assessment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to crop image: {str(e)}"
        )


@router.post("/{assessment_id}/rotate", response_model=Assessment)
async def rotate_assessment_image(assessment_id: str, payload: RotateRequest):
    """
    Rotates the working satellite image by angle_deg (clockwise) to horizontally level roof ridge/eaves.
    Transforms existing roof polygons and scale calibration points to preserve layout integrity.
    Maintains cumulative canvas_rotation_deg for true solar azimuth compensation.
    """
    from PIL import Image

    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )

    angle_deg = float(payload.angle_deg)
    if abs(angle_deg) < 0.01:
        return assessment

    # Find working or original image
    image_path = None
    candidates = [
        STORAGE_DIR / f"{assessment_id}_working.jpg",
        (STORAGE_DIR / f"{assessment_id}_orig_{assessment.image.filename}") if assessment.image.filename else None,
        (STORAGE_DIR / assessment.image.filename) if assessment.image.filename else None,
        (SAMPLE_ROOFS_DIR / "sample_elmina_terrace.jpg") if assessment.is_demo else None,
        SAMPLE_ROOFS_DIR / "sample_elmina_terrace.jpg",
    ]
    for cand in candidates:
        if cand and cand.is_file() and cand.exists():
            image_path = cand
            break

    if not image_path:
        raise HTTPException(status_code=404, detail="Working image file not found.")

    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            w0, h0 = img.size

            # In PIL, rotate(angle) is counter-clockwise.
            # Clockwise rotation of angle_deg requires passing -angle_deg.
            # expand=True adjusts image canvas bounds to contain the full rotated image.
            # fillcolor=(15, 23, 42) matches the dark slate theme of the app.
            rotated_img = img.rotate(
                -angle_deg,
                resample=Image.Resampling.BICUBIC,
                expand=True,
                fillcolor=(15, 23, 42)
            )
            w1, h1 = rotated_img.size

            # Save rotated image back to working path
            dest_path = STORAGE_DIR / f"{assessment_id}_working.jpg"
            rotated_img.save(dest_path, "JPEG", quality=95)

            # Update assessment image dimensions
            assessment.image.width_px = w1
            assessment.image.height_px = h1

            # Adjust geometry coordinates
            if assessment.geometry:
                geom = assessment.geometry
                cx0, cy0 = w0 / 2.0, h0 / 2.0
                cx1, cy1 = w1 / 2.0, h1 / 2.0
                rad = math.radians(angle_deg)
                cos_a = math.cos(rad)
                sin_a = math.sin(rad)

                def transform_pt(pt: List[float]) -> List[float]:
                    dx = pt[0] - cx0
                    dy = pt[1] - cy0
                    nx = cx1 + (dx * cos_a - dy * sin_a)
                    ny = cy1 + (dx * sin_a + dy * cos_a)
                    return [round(nx, 1), round(ny, 1)]

                # Transform existing roof polygons
                transformed_polys = []
                for poly in geom.roof_polygons_px:
                    if len(poly) >= 3:
                        transformed_poly = [transform_pt(pt) for pt in poly]
                        transformed_polys.append(transformed_poly)
                geom.roof_polygons_px = transformed_polys

                # Transform existing obstacles
                for obs in geom.obstacles:
                    if len(obs.polygon_px) >= 3:
                        obs.polygon_px = [transform_pt(pt) for pt in obs.polygon_px]

                # Transform scale reference points if present (scale metres_per_pixel is 100% preserved)
                if geom.scale and geom.scale.reference_px and len(geom.scale.reference_px) == 2:
                    geom.scale.reference_px = [
                        transform_pt(geom.scale.reference_px[0]),
                        transform_pt(geom.scale.reference_px[1]),
                    ]

                # Update cumulative rotation angle
                prev_rot = float(geom.canvas_rotation_deg or 0.0)
                geom.canvas_rotation_deg = round((prev_rot + angle_deg) % 360.0, 2)

            storage_service.save_assessment(assessment)
            return assessment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rotate image: {str(e)}"
        )


@router.put("/{assessment_id}/geometry", response_model=Assessment)
async def update_assessment_geometry(assessment_id: str, geometry: RoofGeometry):
    """Save user-verified roof polygons, obstacles, and scale calibration."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )

    # Calculate metric area if scale calibration is valid
    if geometry.scale and geometry.scale.metres_per_pixel and geometry.scale.metres_per_pixel > 0:
        m_per_px = geometry.scale.metres_per_pixel
        # Compute area using Shapely if available or standard shoelace formula
        total_px_area = 0.0
        for poly in geometry.roof_polygons_px:
            if len(poly) >= 3:
                # Shoelace formula for polygon area
                n = len(poly)
                area = 0.0
                for i in range(n):
                    j = (i + 1) % n
                    area += poly[i][0] * poly[j][1]
                    area -= poly[j][0] * poly[i][1]
                total_px_area += abs(area) / 2.0

        geometry.roof_area_px2 = round(total_px_area, 2)
        geometry.roof_area_m2 = round(total_px_area * (m_per_px ** 2), 2)
    else:
        geometry.roof_area_m2 = None

    assessment.geometry = geometry
    storage_service.save_assessment(assessment)
    return assessment


@router.put("/{assessment_id}/layout", response_model=Assessment)
async def update_assessment_layout(assessment_id: str, layout: LayoutResponse):
    """Save calculated solar panel packing layout to assessment bundle."""
    assessment = storage_service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found."
        )
    assessment.layout = layout
    storage_service.save_assessment(assessment)
    return assessment
