"""
SolarReady Malaysia - Geometry, Scale Calibration & Roof Dimension Router
Validation, distance calculation, scale calibration, Google Maps 5m scale bar, and multi-facet polygon metrics.
"""

import math
from typing import List, Optional, Literal, Tuple
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import split

router = APIRouter(prefix="/api/geometry", tags=["Geometry"])


class CalibrationCalcRequest(BaseModel):
    reference_px: List[List[float]] = Field(
        ..., min_length=2, max_length=2, description="Two points [[x1, y1], [x2, y2]]"
    )
    reference_m: float = Field(..., gt=0, description="Known ground length in meters")


class CalibrationCalcResponse(BaseModel):
    distance_px: float
    reference_m: float
    metres_per_pixel: float


class GoogleMapsCalibrateRequest(BaseModel):
    bar_length_px: float = Field(..., gt=0, description="Pixel length of the 5m scale bar on Google Maps")
    known_meters: float = Field(5.0, gt=0, description="Scale bar length, default 5.0m")


class GoogleMapsCalibrateResponse(BaseModel):
    bar_length_px: float
    known_meters: float
    metres_per_pixel: float
    quality_tier: str
    message: str


class PolygonValidateRequest(BaseModel):
    polygon_px: List[List[float]] = Field(..., min_length=3)
    metres_per_pixel: Optional[float] = Field(None, gt=0)
    tilt_deg: float = Field(15.0, ge=0.0, le=60.0, description="Roof pitch angle in degrees")
    canvas_rotation_deg: float = Field(0.0, description="Clockwise rotation angle in degrees applied to level satellite imagery from True North")


class PolygonValidateResponse(BaseModel):
    is_valid: bool
    area_px2: float
    area_m2: Optional[float] = None
    true_area_m2: Optional[float] = None
    perimeter_px: float
    perimeter_m: Optional[float] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    aspect_ratio: Optional[float] = None
    azimuth_deg: Optional[float] = None
    slope_direction: Optional[str] = None
    message: str


class RoofAnalysisRequest(BaseModel):
    roof_polygons_px: List[List[List[float]]] = Field(..., description="List of roof polygon contours")
    metres_per_pixel: Optional[float] = Field(None, gt=0)
    tilt_deg: float = Field(15.0, ge=0.0, le=60.0, description="Roof pitch angle in degrees")
    canvas_rotation_deg: float = Field(0.0, description="Clockwise rotation angle in degrees applied to level satellite imagery from True North")


class RoofFaceMetrics(BaseModel):
    index: int
    is_valid: bool
    area_px2: float
    planar_area_m2: Optional[float] = None
    true_area_m2: Optional[float] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    perimeter_m: Optional[float] = None
    aspect_ratio: Optional[float] = None
    azimuth_deg: Optional[float] = None
    slope_direction: Optional[str] = None


class RoofAnalysisResponse(BaseModel):
    faces: List[RoofFaceMetrics]
    total_planar_area_m2: Optional[float] = None
    total_true_area_m2: Optional[float] = None
    tilt_deg: float
    scale_calibrated: bool
    message: str


class SplitRidgeRequest(BaseModel):
    polygon_px: List[List[float]] = Field(..., min_length=3, description="Contour points of roof polygon")
    direction: Literal["lengthwise", "crosswise", "auto"] = Field(
        "auto", description="Cut direction along ridge"
    )


class SplitRidgeResponse(BaseModel):
    faces_px: List[List[List[float]]] = Field(..., description="Array of resulting facet polygons")
    facet_count: int
    message: str


def _get_slope_direction(azimuth: float) -> str:
    """Classify compass azimuth into human-readable slope orientation."""
    az = azimuth % 360.0
    if az >= 315.0 or az < 45.0:
        return "North-facing"
    elif 45.0 <= az < 135.0:
        return "East-facing"
    elif 135.0 <= az < 225.0:
        return "South-facing"
    else:
        return "West-facing"


def _extract_poly_metrics(
    poly: Polygon,
    metres_per_pixel: Optional[float],
    tilt_deg: float,
    canvas_rotation_deg: float = 0.0,
):
    """Compute physical width, length, perimeter, planar and pitch-adjusted true areas."""
    area_px = float(poly.area)
    perimeter_px = float(poly.length)

    area_m2 = None
    true_area_m2 = None
    perimeter_m = None
    length_m = None
    width_m = None
    aspect_ratio = None
    azimuth_deg = None
    slope_direction = None

    if metres_per_pixel and metres_per_pixel > 0:
        area_m2 = round(area_px * (metres_per_pixel ** 2), 2)
        tilt_rad = math.radians(tilt_deg)
        cos_tilt = max(math.cos(tilt_rad), 0.1)
        true_area_m2 = round(area_m2 / cos_tilt, 2)
        perimeter_m = round(perimeter_px * metres_per_pixel, 2)

        try:
            mrr = poly.minimum_rotated_rectangle
            coords = list(mrr.exterior.coords)
            if len(coords) >= 4:
                e1 = math.hypot(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
                e2 = math.hypot(coords[2][0] - coords[1][0], coords[2][1] - coords[1][1])
                len_px = max(e1, e2)
                wid_px = min(e1, e2)
                length_m = round(len_px * metres_per_pixel, 2)
                width_m = round(wid_px * metres_per_pixel, 2)
                aspect_ratio = round(length_m / max(width_m, 0.01), 2)

                # Determine azimuth along the longest edge
                if e1 >= e2:
                    dx = coords[1][0] - coords[0][0]
                    dy = coords[1][1] - coords[0][1]
                else:
                    dx = coords[2][0] - coords[1][0]
                    dy = coords[2][1] - coords[1][1]

                # Map screen coordinates (x right, y down) to compass azimuth (0=N, 90=E, 180=S, 270=W)
                # Angle perpendicular to the ridge/eave line represents the slope normal
                normal_dx = -dy
                normal_dy = dx
                image_azimuth_deg = round((math.degrees(math.atan2(normal_dx, -normal_dy)) + 360) % 360, 1)

                # True Geographic Azimuth compensates for image rotation:
                # True Solar Azimuth = (Image Azimuth - canvas_rotation_deg) mod 360
                true_azimuth_deg = round((image_azimuth_deg - canvas_rotation_deg + 360.0) % 360.0, 1)
                azimuth_deg = true_azimuth_deg
                slope_direction = _get_slope_direction(azimuth_deg)
        except Exception:
            pass

    return {
        "area_px2": round(area_px, 2),
        "area_m2": area_m2,
        "true_area_m2": true_area_m2,
        "perimeter_px": round(perimeter_px, 2),
        "perimeter_m": perimeter_m,
        "length_m": length_m,
        "width_m": width_m,
        "aspect_ratio": aspect_ratio,
        "azimuth_deg": azimuth_deg,
        "slope_direction": slope_direction,
    }


@router.post("/calibrate", response_model=CalibrationCalcResponse)
async def calculate_scale(payload: CalibrationCalcRequest):
    """
    Compute metres_per_pixel based on 2 clicked pixel coordinates and a known real-world distance (m).
    Formula: metres_per_pixel = reference_m / pixel_distance
    """
    p1 = payload.reference_px[0]
    p2 = payload.reference_px[1]

    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist_px = math.sqrt(dx * dx + dy * dy)

    if dist_px < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reference line is too short (less than 1 pixel). Please select distinct points."
        )

    if payload.reference_m <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reference distance must be greater than zero."
        )

    m_per_px = payload.reference_m / dist_px

    return CalibrationCalcResponse(
        distance_px=round(dist_px, 2),
        reference_m=round(payload.reference_m, 2),
        metres_per_pixel=round(m_per_px, 6),
    )


@router.post("/calibrate-google-maps", response_model=GoogleMapsCalibrateResponse)
async def calibrate_google_maps(payload: GoogleMapsCalibrateRequest):
    """
    Compute metres_per_pixel from the 5m Google Maps satellite view scale bar.
    """
    if payload.bar_length_px < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scale bar pixel length must be at least 1 pixel."
        )

    m_per_px = payload.known_meters / payload.bar_length_px

    return GoogleMapsCalibrateResponse(
        bar_length_px=round(payload.bar_length_px, 2),
        known_meters=round(payload.known_meters, 2),
        metres_per_pixel=round(m_per_px, 6),
        quality_tier="approx_map_measure",
        message=f"Google Maps 5m scale calibrated at {m_per_px:.4f} m/px",
    )


@router.post("/validate-polygon", response_model=PolygonValidateResponse)
async def validate_polygon(payload: PolygonValidateRequest):
    """
    Verify polygon validity (no self-intersection), and compute pixel and metric areas and dimensions.
    """
    try:
        poly = Polygon(payload.polygon_px)
        is_valid = poly.is_valid
        if not is_valid:
            poly = poly.buffer(0)
            is_valid = poly.is_valid

        msg = "Valid polygon" if is_valid else "Polygon is self-intersecting or invalid"

        metrics = _extract_poly_metrics(
            poly,
            payload.metres_per_pixel,
            payload.tilt_deg,
            payload.canvas_rotation_deg,
        )

        return PolygonValidateResponse(
            is_valid=is_valid,
            area_px2=metrics["area_px2"],
            area_m2=metrics["area_m2"],
            true_area_m2=metrics["true_area_m2"],
            perimeter_px=metrics["perimeter_px"],
            perimeter_m=metrics["perimeter_m"],
            length_m=metrics["length_m"],
            width_m=metrics["width_m"],
            aspect_ratio=metrics["aspect_ratio"],
            azimuth_deg=metrics["azimuth_deg"],
            slope_direction=metrics["slope_direction"],
            message=msg,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error evaluating polygon: {str(e)}"
        )


@router.post("/analyze-roof", response_model=RoofAnalysisResponse)
async def analyze_roof(payload: RoofAnalysisRequest):
    """
    Analyze all individual roof plane facets: length, width, perimeter, orientation, and true slope area.
    """
    faces: List[RoofFaceMetrics] = []
    total_planar = 0.0
    total_true = 0.0

    for idx, face_pts in enumerate(payload.roof_polygons_px):
        if len(face_pts) < 3:
            continue
        try:
            poly = Polygon(face_pts)
            if not poly.is_valid:
                poly = poly.buffer(0)

            m = _extract_poly_metrics(
                poly,
                payload.metres_per_pixel,
                payload.tilt_deg,
                payload.canvas_rotation_deg,
            )
            face_metric = RoofFaceMetrics(
                index=idx + 1,
                is_valid=poly.is_valid,
                area_px2=m["area_px2"],
                planar_area_m2=m["area_m2"],
                true_area_m2=m["true_area_m2"],
                length_m=m["length_m"],
                width_m=m["width_m"],
                perimeter_m=m["perimeter_m"],
                aspect_ratio=m["aspect_ratio"],
                azimuth_deg=m["azimuth_deg"],
                slope_direction=m["slope_direction"],
            )
            faces.append(face_metric)

            if m["area_m2"] is not None:
                total_planar += m["area_m2"]
            if m["true_area_m2"] is not None:
                total_true += m["true_area_m2"]
        except Exception:
            continue

    has_scale = payload.metres_per_pixel is not None and payload.metres_per_pixel > 0
    return RoofAnalysisResponse(
        faces=faces,
        total_planar_area_m2=round(total_planar, 2) if has_scale else None,
        total_true_area_m2=round(total_true, 2) if has_scale else None,
        tilt_deg=payload.tilt_deg,
        scale_calibrated=has_scale,
        message=f"Successfully analyzed {len(faces)} roof plane facet(s) at {payload.tilt_deg}° tilt."
    )


def split_polygon_along_ridge(poly: Polygon, direction: str = "auto") -> List[List[List[float]]]:
    """
    Splits a roof polygon along its central apex ridge into 2 distinct slope facets (e.g. East vs West).
    """
    if not poly.is_valid:
        poly = poly.buffer(0)

    try:
        mrr = poly.minimum_rotated_rectangle
        coords = list(mrr.exterior.coords)
        if len(coords) < 4:
            return [[[round(p[0], 1), round(p[1], 1)] for p in list(poly.exterior.coords)[:-1]]]

        p0, p1, p2, p3 = coords[0], coords[1], coords[2], coords[3]
        e1 = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        e2 = math.hypot(p2[0] - p1[0], p2[1] - p1[1])

        # For a pitched/gable roof, the ridge line runs along the LONGER dimension of the roof
        if (direction == "lengthwise") or (direction == "auto"):
            if e1 >= e2:
                # Longer edge is p0-p1 and p3-p2. Shorter edges are p0-p3 and p1-p2
                m_start = ((p0[0] + p3[0]) / 2.0, (p0[1] + p3[1]) / 2.0)
                m_end = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)
            else:
                # Longer edge is p1-p2 and p0-p3. Shorter edges are p0-p1 and p3-p2
                m_start = ((p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0)
                m_end = ((p3[0] + p2[0]) / 2.0, (p3[1] + p2[1]) / 2.0)
        else:
            # Crosswise cut
            if e1 >= e2:
                m_start = ((p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0)
                m_end = ((p3[0] + p2[0]) / 2.0, (p3[1] + p2[1]) / 2.0)
            else:
                m_start = ((p0[0] + p3[0]) / 2.0, (p0[1] + p3[1]) / 2.0)
                m_end = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)

        # Extend cutter line by 40% on each end to guarantee crossing the polygon exterior
        dx = m_end[0] - m_start[0]
        dy = m_end[1] - m_start[1]
        ext_start = (m_start[0] - dx * 0.4, m_start[1] - dy * 0.4)
        ext_end = (m_end[0] + dx * 0.4, m_end[1] + dy * 0.4)
        cutter = LineString([ext_start, ext_end])

        split_res = split(poly, cutter)
        split_faces = []
        for g in split_res.geoms:
            if isinstance(g, Polygon) and g.area > (poly.area * 0.05):
                pts = [[round(p[0], 1), round(p[1], 1)] for p in list(g.exterior.coords)[:-1]]
                if len(pts) >= 3:
                    split_faces.append(pts)

        if len(split_faces) >= 2:
            return split_faces
    except Exception:
        pass

    return [[[round(p[0], 1), round(p[1], 1)] for p in list(poly.exterior.coords)[:-1]]]


@router.post("/split-ridge", response_model=SplitRidgeResponse)
async def split_roof_along_ridge(payload: SplitRidgeRequest):
    """
    Split a roof polygon along its central ridge line into separate slope facets (East vs West pitch).
    """
    try:
        poly = Polygon(payload.polygon_px)
        if not poly.is_valid:
            poly = poly.buffer(0)

        faces = split_polygon_along_ridge(poly, payload.direction)
        return SplitRidgeResponse(
            faces_px=faces,
            facet_count=len(faces),
            message=f"Successfully separated roof into {len(faces)} slope facet(s) along ridge line."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to split roof along ridge: {str(e)}"
        )


class CutLineRequest(BaseModel):
    roof_polygons_px: List[List[List[float]]] = Field(..., description="List of roof polygon contours")
    line_px: List[List[float]] = Field(..., min_length=2, max_length=2, description="Two points defining cut line [[x1, y1], [x2, y2]]")


class CutLineResponse(BaseModel):
    roof_polygons_px: List[List[List[float]]]
    split_occurred: bool
    facets_count: int
    message: str


def cut_polygons_with_line(
    roof_polygons_px: List[List[List[float]]],
    line_px: List[List[float]]
) -> Tuple[List[List[List[float]]], bool]:
    p1 = line_px[0]
    p2 = line_px[1]
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    if dist < 5.0:
        return roof_polygons_px, False

    mid = Point((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)
    raw_segment = LineString([p1, p2])

    # Find the target polygon: either containing midpoint, or intersecting segment with minimum distance
    target_idx = -1
    min_dist = float('inf')
    polys: List[Optional[Polygon]] = []
    for idx, pts in enumerate(roof_polygons_px):
        if len(pts) < 3:
            polys.append(None)
            continue
        poly = Polygon(pts)
        if not poly.is_valid:
            poly = poly.buffer(0)
        polys.append(poly)
        if poly.contains(mid):
            target_idx = idx
            break
        d = poly.distance(mid)
        if d < min_dist and (poly.intersects(raw_segment) or d < 30.0):
            min_dist = d
            target_idx = idx

    if target_idx == -1:
        if len(roof_polygons_px) == 1:
            target_idx = 0
        else:
            return roof_polygons_px, False

    target_poly = polys[target_idx]
    if target_poly is None or target_poly.is_empty:
        return roof_polygons_px, False

    # Extend line cleanly across target_poly bounds only
    minx, miny, maxx, maxy = target_poly.bounds
    diag = math.hypot(maxx - minx, maxy - miny) + 50.0
    norm_x = dx / dist
    norm_y = dy / dist
    ext_p1 = (p1[0] - norm_x * diag, p1[1] - norm_y * diag)
    ext_p2 = (p2[0] + norm_x * diag, p2[1] + norm_y * diag)
    cutter = LineString([ext_p1, ext_p2])

    split_res = split(target_poly, cutter)
    valid_geoms = [
        g for g in split_res.geoms
        if isinstance(g, Polygon) and g.area > (target_poly.area * 0.05)
    ]
    if len(valid_geoms) < 2:
        return roof_polygons_px, False

    new_polys: List[List[List[float]]] = []
    for i, pts in enumerate(roof_polygons_px):
        if i == target_idx:
            for g in valid_geoms:
                coords = [[round(p[0], 1), round(p[1], 1)] for p in list(g.exterior.coords)[:-1]]
                if len(coords) >= 3:
                    new_polys.append(coords)
        else:
            new_polys.append(pts)

    return new_polys, True


class SplitHipRequest(BaseModel):
    polygon_px: List[List[float]] = Field(..., min_length=3, description="Outer perimeter polygon of hip roof")


class SplitHipResponse(BaseModel):
    roof_polygons_px: List[List[List[float]]]
    facets_count: int
    message: str


def split_hip_roof(
    poly_pts: List[List[float]],
    ridge_coord: Optional[float] = None,
    apex1_coord: Optional[float] = None,
    apex2_coord: Optional[float] = None,
) -> List[List[List[float]]]:
    """
    Deconstructs a 4-pitch Hip Roof into 4 watertight slope facets:
    - 2 trapezoids (North / South or East / West)
    - 2 triangles (East / West or North / South)
    Accepts optional visual ridge_coord and apex1_coord / apex2_coord to preserve
    perspective-accurate ridge heights and junction points.
    """
    poly = Polygon(poly_pts)
    min_x, min_y, max_x, max_y = poly.bounds
    w = max_x - min_x
    h = max_y - min_y

    tl = [round(min_x, 1), round(min_y, 1)]
    tr = [round(max_x, 1), round(min_y, 1)]
    br = [round(max_x, 1), round(max_y, 1)]
    bl = [round(min_x, 1), round(max_y, 1)]

    if w >= h:
        mid_y = ridge_coord if ridge_coord is not None else (min_y + max_y) / 2.0
        offset = min(h * 0.45, w * 0.35)
        a1_x = apex1_coord if apex1_coord is not None else (min_x + offset)
        a2_x = apex2_coord if apex2_coord is not None else (max_x - offset)
        a1 = [round(a1_x, 1), round(mid_y, 1)]
        a2 = [round(a2_x, 1), round(mid_y, 1)]
        return [
            [tl, tr, a2, a1],
            [bl, a1, a2, br],
            [tl, a1, bl],
            [tr, br, a2],
        ]
    else:
        mid_x = ridge_coord if ridge_coord is not None else (min_x + max_x) / 2.0
        offset = min(w * 0.45, h * 0.35)
        a1_y = apex1_coord if apex1_coord is not None else (min_y + offset)
        a2_y = apex2_coord if apex2_coord is not None else (max_y - offset)
        a1 = [round(mid_x, 1), round(a1_y, 1)]
        a2 = [round(mid_x, 1), round(a2_y, 1)]
        return [
            [tl, a1, a2, bl],
            [tr, br, a2, a1],
            [tl, tr, a1],
            [bl, a2, br],
        ]


@router.post("/cut-line", response_model=CutLineResponse)
async def cut_roof_with_line(payload: CutLineRequest):
    """
    Split one or more roof polygons along a user-drawn cut line.
    """
    try:
        new_polys, split_occurred = cut_polygons_with_line(
            payload.roof_polygons_px, payload.line_px
        )
        if split_occurred:
            msg = f"Successfully sliced roof along cut line into {len(new_polys)} facet(s)."
        else:
            msg = "Cut line did not cross through any roof polygon. Try drawing across the roof boundary."

        return CutLineResponse(
            roof_polygons_px=new_polys,
            split_occurred=split_occurred,
            facets_count=len(new_polys),
            message=msg,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cut roof with line: {str(e)}"
        )


@router.post("/split-hip", response_model=SplitHipResponse)
async def split_hip_endpoint(payload: SplitHipRequest):
    """
    Split a roof perimeter into 4 distinct hip roof facets (2 trapezoids + 2 triangles).
    """
    try:
        facets = split_hip_roof(payload.polygon_px)
        return SplitHipResponse(
            roof_polygons_px=facets,
            facets_count=len(facets),
            message=f"Successfully partitioned hip roof into {len(facets)} slope facets (2 trapezoids, 2 triangles)."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to split hip roof: {str(e)}"
        )


