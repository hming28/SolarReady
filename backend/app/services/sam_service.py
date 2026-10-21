"""
SolarReady Malaysia - Meta SAM 2 (Segment Anything Model 2) Service
Integrates Meta's SAM 2 vision foundation model via Roboflow Serverless Cloud API.
Supports single-point click segmentation, multi-point dual-pitch segmentation, and polygon simplification.
"""

import base64
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import httpx
from shapely.geometry import Polygon, MultiPolygon
from app.config import STORAGE_DIR, ROBOFLOW_API_KEY
from app.services.storage import storage_service
from app.routers.geometry import split_polygon_along_ridge


class Sam2Service:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or ROBOFLOW_API_KEY
        self.base_url = "https://serverless.roboflow.com/sam2/segment_image"
        self.default_model = "hiera_b_plus"

    def _get_image_base64(self, assessment_id: str) -> Tuple[str, int, int]:
        """Load working image for assessment and return base64 string, width, height."""
        assessment = storage_service.get_assessment(assessment_id)
        if not assessment:
            raise ValueError(f"Assessment {assessment_id} not found.")

        image_path = STORAGE_DIR / f"{assessment_id}_working.jpg"
        if not image_path.exists():
            image_path = STORAGE_DIR / f"{assessment_id}_orig_{assessment.image.filename}"
        if not image_path.exists():
            image_path = STORAGE_DIR / f"{assessment.image.filename}"

        if not image_path.exists():
            raise FileNotFoundError(f"Image for assessment {assessment_id} not found on disk.")

        with open(image_path, "rb") as f:
            b64_str = base64.b64encode(f.read()).decode("utf-8")

        width = assessment.image.width_px or 1200
        height = assessment.image.height_px or 900
        return b64_str, width, height

    def _extract_largest_polygon(self, masks_list: List[Any], min_area: float = 100.0) -> Optional[Polygon]:
        """
        Roboflow SAM 2 returns multiple disconnected contours in masks.
        Extract and return the valid contour with the largest surface area.
        """
        valid_polys = []
        for m in masks_list:
            if isinstance(m, list) and len(m) >= 3:
                try:
                    poly = Polygon(m)
                    if not poly.is_valid:
                        poly = poly.buffer(0)
                    if isinstance(poly, MultiPolygon):
                        poly = max(poly.geoms, key=lambda g: g.area)
                    if poly.area > min_area:
                        valid_polys.append((poly.area, poly))
                except Exception:
                    pass

        if not valid_polys:
            return None

        valid_polys.sort(key=lambda x: x[0], reverse=True)
        return valid_polys[0][1]

    async def segment_point(
        self,
        assessment_id: str,
        point_x: float,
        point_y: float,
        model_version: str = "hiera_b_plus",
        tolerance: float = 2.5,
    ) -> List[List[float]]:
        """
        Segment a single roof facet or obstacle via a click point prompt using Meta SAM 2.
        """
        if not self.api_key:
            raise ValueError("Roboflow API key is required to invoke SAM 2.")

        b64_image, _, _ = self._get_image_base64(assessment_id)

        payload = {
            "image": {"type": "base64", "value": b64_image},
            "prompts": [
                {"points": [{"x": float(point_x), "y": float(point_y), "positive": True}]}
            ],
            "sam2_version_id": model_version,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}?api_key={self.api_key}",
                json=payload,
                headers=headers,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"SAM 2 inference failed with HTTP {resp.status_code}: {resp.text}"
                )
            data = resp.json()

        preds = data.get("predictions", [])
        if not preds or not preds[0].get("masks"):
            raise RuntimeError("SAM 2 did not return any valid masks for this point.")

        masks_list = preds[0]["masks"]
        best_poly = self._extract_largest_polygon(masks_list, min_area=50.0)
        if not best_poly:
            raise RuntimeError("SAM 2 did not detect a closed contour at the clicked location.")

        simplified = best_poly.simplify(tolerance=tolerance, preserve_topology=True)
        if isinstance(simplified, MultiPolygon):
            simplified = max(simplified.geoms, key=lambda g: g.area)

        coords = list(simplified.exterior.coords)[:-1]
        return [[round(pt[0], 1), round(pt[1], 1)] for pt in coords]

    async def segment_dual_pitch(
        self,
        assessment_id: str,
        model_version: str = "hiera_b_plus",
        tolerance: float = 2.5,
    ) -> List[List[List[float]]]:
        """
        Auto-prompt SAM 2 on both sides of the roof center to extract the two distinct pitch slope facets.
        If SAM 2 produces one consolidated building mask, bisects along ridge line into 2 slopes.
        """
        if not self.api_key:
            raise ValueError("Roboflow API key is required to invoke SAM 2.")

        b64_image, width, height = self._get_image_base64(assessment_id)
        assessment = storage_service.get_assessment(assessment_id)

        # Estimate sample points for East vs West slope facets
        cx, cy = width / 2.0, height / 2.0
        offset_x = width * 0.14
        offset_y = height * 0.12

        if assessment and assessment.geometry and assessment.geometry.roof_polygons_px:
            all_pts = [pt for poly in assessment.geometry.roof_polygons_px for pt in poly]
            if all_pts:
                xs = [p[0] for p in all_pts]
                ys = [p[1] for p in all_pts]
                cx = (min(xs) + max(xs)) / 2.0
                cy = (min(ys) + max(ys)) / 2.0
                bw = max(xs) - min(xs)
                offset_x = max(bw * 0.22, 35.0)

        # Prompts: Left/West slope and Right/East slope
        prompt_w = {"points": [{"x": cx - offset_x, "y": cy, "positive": True}]}
        prompt_e = {"points": [{"x": cx + offset_x, "y": cy, "positive": True}]}

        payload = {
            "image": {"type": "base64", "value": b64_image},
            "prompts": [prompt_w, prompt_e],
            "sam2_version_id": model_version,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(
                f"{self.base_url}?api_key={self.api_key}",
                json=payload,
                headers=headers,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"SAM 2 dual-pitch inference failed with HTTP {resp.status_code}: {resp.text}"
                )
            data = resp.json()

        results_polys: List[Polygon] = []
        for pred in data.get("predictions", []):
            masks = pred.get("masks", [])
            poly = self._extract_largest_polygon(masks, min_area=(width * height * 0.015))
            if poly:
                results_polys.append(poly)

        # If SAM 2 returned 2 distinct facets with minimal overlap, format and return both
        if len(results_polys) >= 2:
            p1, p2 = results_polys[0], results_polys[1]
            overlap_ratio = p1.intersection(p2).area / min(p1.area, p2.area) if min(p1.area, p2.area) > 0 else 1.0
            if overlap_ratio < 0.70:
                out = []
                for p in [p1, p2]:
                    simp = p.simplify(tolerance=tolerance, preserve_topology=True)
                    if isinstance(simp, MultiPolygon):
                        simp = max(simp.geoms, key=lambda g: g.area)
                    coords = list(simp.exterior.coords)[:-1]
                    if len(coords) >= 3:
                        out.append([[round(pt[0], 1), round(pt[1], 1)] for pt in coords])
                if len(out) == 2:
                    return out

        # If SAM 2 returned 1 consolidated roof polygon (or two heavily overlapping ones),
        # bisect it along its ridge line using split_polygon_along_ridge!
        target_poly = results_polys[0] if results_polys else None
        if not target_poly:
            # Fallback to single center prompt
            center_payload = {
                "image": {"type": "base64", "value": b64_image},
                "prompts": [{"points": [{"x": cx, "y": cy, "positive": True}]}],
                "sam2_version_id": model_version,
            }
            async with httpx.AsyncClient(timeout=25.0) as client:
                c_resp = await client.post(
                    f"{self.base_url}?api_key={self.api_key}",
                    json=center_payload,
                    headers=headers,
                )
                if c_resp.status_code == 200:
                    c_data = c_resp.json()
                    c_preds = c_data.get("predictions", [])
                    if c_preds and c_preds[0].get("masks"):
                        target_poly = self._extract_largest_polygon(c_preds[0]["masks"], min_area=width * height * 0.02)

        if target_poly:
            simp = target_poly.simplify(tolerance=tolerance, preserve_topology=True)
            if isinstance(simp, MultiPolygon):
                simp = max(simp.geoms, key=lambda g: g.area)
            split_faces = split_polygon_along_ridge(simp)
            if len(split_faces) >= 2:
                return split_faces
            else:
                return [[[round(pt[0], 1), round(pt[1], 1)] for pt in list(simp.exterior.coords)[:-1]]]

        # Ultimate geometric fallback: image-relative perimeter bisected along ridge
        margin_x = width * 0.18
        margin_y = height * 0.15
        default_poly = Polygon([
            [margin_x, margin_y],
            [width - margin_x, margin_y],
            [width - margin_x, height - margin_y],
            [margin_x, height - margin_y]
        ])
        return split_polygon_along_ridge(default_poly)


sam2_service = Sam2Service()
