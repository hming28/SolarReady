/**
 * SolarReady Malaysia - Frontend API Client
 */

import {
  Assessment,
  AssessmentCreate,
  AssessmentSummary,
  RoofGeometry,
  LayoutRequest,
  LayoutResponse,
  EnergyEstimateRequest,
  EnergyFinanceResult,
  LcoeCalculationRequest,
  LcoeResult,
  TownshipComparisonScenario,
  StructureTypeInfo,
  TownshipUnit,
  RoofAnalysisResponse,
  GoogleMapsCalibrateResponse,
  SplitRidgeResponse,
  SamPointResponse,
  SamDualPitchResponse,
  CutLineResponse,
  SplitHipResponse,
  GeminiLayoutRecommendResponse,
  GeminiDetectResponse,
} from "./types";

// In browser runtime without explicit NEXT_PUBLIC_API_URL, use relative path ""
// so Next.js rewrites proxy /api/* requests to backend. This enables instant LAN & Tunnel access!
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : (typeof window !== "undefined" ? "" : "http://localhost:8000");

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API Error (${res.status}): ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === "string" 
          ? errorData.detail 
          : JSON.stringify(errorData.detail);
      }
    } catch {
      // Non-JSON response
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<{ status: string; service: string; version: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    return handleResponse(res);
  },

  async createAssessment(payload: AssessmentCreate): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<Assessment>(res);
  },

  async uploadImage(assessmentId: string, file: File): Promise<Assessment> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/image`, {
      method: "POST",
      body: formData,
    });
    return handleResponse<Assessment>(res);
  },

  async getAssessment(assessmentId: string): Promise<Assessment> {
    try {
      const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}`, {
        cache: "no-store",
      });
      const data = await handleResponse<Assessment>(res);
      if (typeof window !== "undefined" && data) {
        try {
          localStorage.setItem(`solarready_assessment_${assessmentId}`, JSON.stringify(data));
        } catch {}
      }
      return data;
    } catch (err: any) {
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`solarready_assessment_${assessmentId}`);
          if (cached) {
            return JSON.parse(cached);
          }
          const savedStr = localStorage.getItem("solarready_saved_projects");
          if (savedStr) {
            const list = JSON.parse(savedStr);
            const matched = list.find((p: any) => p.id === assessmentId);
            if (matched) {
              const fallbackAssessment: Assessment = {
                id: assessmentId,
                created_at: new Date().toISOString(),
                title: matched.title || "Saved Rooftop Solar Project",
                house_type: matched.houseType || "Residential Rooftop",
                location: { text: matched.location || "Peninsular Malaysia", lat: 3.185, lon: 101.512 },
                monthly_bill_rm: 380,
                is_demo: false,
                is_saved: true,
                updated_at: matched.updatedAt || new Date().toISOString(),
                image: {
                  filename: "saved_roof.jpg",
                  path: "",
                  width_px: 1200,
                  height_px: 800,
                  sha256: "saved_cache",
                },
                consent: {
                  image_use: true,
                  timestamp: new Date().toISOString(),
                },
                geometry: {
                  roof_polygons_px: [],
                  tilt_deg: 15.0,
                  obstacles: [],
                  scale: { metres_per_pixel: 0.05, quality_tier: "user_measured", method: "known_line" },
                },
                layout: {
                  capacity_kwp: matched.capacityKwp || 3.85,
                  panel_count: matched.panelCount || 8,
                  module_area_m2: (matched.panelCount || 8) * 2.58,
                  usable_area_m2: (matched.panelCount || 8) * 3.2,
                  placements: [],
                } as any,
              };
              return fallbackAssessment;
            }
          }
        } catch (storageErr) {
          console.warn("Storage fallback error:", storageErr);
        }
      }
      throw err;
    }
  },

  async listAssessments(): Promise<AssessmentSummary[]> {
    const res = await fetch(`${API_BASE}/api/assessments`, { cache: "no-store" });
    return handleResponse<AssessmentSummary[]>(res);
  },

  async updateAssessmentMetadata(
    assessmentId: string,
    payload: { title?: string; house_type?: string; monthly_bill_rm?: number; is_saved?: boolean }
  ): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/metadata`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<Assessment>(res);
  },

  async deleteAssessment(assessmentId: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}`, {
      method: "DELETE",
    });
    return handleResponse<{ status: string; id: string }>(res);
  },

  getImageUrl(assessmentId: string): string {
    return `${API_BASE}/api/assessments/${assessmentId}/image/file`;
  },

  async cropImage(assessmentId: string, box_px: [number, number, number, number]): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ box_px }),
    });
    return handleResponse<Assessment>(res);
  },

  async rotateImage(assessmentId: string, angle_deg: number): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ angle_deg }),
    });
    return handleResponse<Assessment>(res);
  },

  async updateGeometry(assessmentId: string, geometry: RoofGeometry): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/geometry`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geometry),
    });
    return handleResponse<Assessment>(res);
  },

  async optimizeLayout(payload: LayoutRequest): Promise<LayoutResponse> {
    const res = await fetch(`${API_BASE}/api/layouts/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<LayoutResponse>(res);
  },

  async estimateEnergy(payload: EnergyEstimateRequest): Promise<EnergyFinanceResult> {
    const res = await fetch(`${API_BASE}/api/energy/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<EnergyFinanceResult>(res);
  },

  async updateLayout(assessmentId: string, layout: LayoutResponse): Promise<Assessment> {
    const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    return handleResponse<Assessment>(res);
  },

  async splitRidge(
    polygonPx: [number, number][],
    direction: "auto" | "lengthwise" | "crosswise" = "auto"
  ): Promise<SplitRidgeResponse> {
    const res = await fetch(`${API_BASE}/api/geometry/split-ridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon_px: polygonPx,
        direction: direction,
      }),
    });
    return handleResponse<SplitRidgeResponse>(res);
  },

  async cutRoofWithLine(
    roofPolygonsPx: [number, number][][],
    linePx: [number, number][]
  ): Promise<CutLineResponse> {
    const res = await fetch(`${API_BASE}/api/geometry/cut-line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roof_polygons_px: roofPolygonsPx,
        line_px: linePx,
      }),
    });
    return handleResponse<CutLineResponse>(res);
  },

  async getAiSegmentation(
    assessmentId: string,
    splitFacets: boolean = false,
    forceFresh: boolean = false
  ): Promise<{ polygons_px: [number, number][][]; confidence: number }> {
    const url = `${API_BASE}/api/vision/segment?assessment_id=${assessmentId}&split_facets=${splitFacets}&force_fresh=${forceFresh}`;
    const res = await fetch(url, {
      method: "POST",
    });
    return handleResponse<{ polygons_px: [number, number][][]; confidence: number }>(res);
  },

  async geminiDetect(
    assessmentId: string
  ): Promise<GeminiDetectResponse> {
    const res = await fetch(`${API_BASE}/api/vision/gemini-detect?assessment_id=${assessmentId}`, {
      method: "POST",
    });
    return handleResponse<GeminiDetectResponse>(res);
  },

  async geminiRecommendLayout(assessmentId: string): Promise<GeminiLayoutRecommendResponse> {
    const res = await fetch(`${API_BASE}/api/layouts/gemini-recommend?assessment_id=${assessmentId}`, {
      method: "POST",
    });
    return handleResponse<GeminiLayoutRecommendResponse>(res);
  },

  async sam2PointSegment(
    assessmentId: string,
    x: number,
    y: number,
    modelVersion: string = "hiera_b_plus",
    tolerance: number = 2.5
  ): Promise<SamPointResponse> {
    const res = await fetch(`${API_BASE}/api/vision/sam2/point`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessment_id: assessmentId,
        x: x,
        y: y,
        model_version: modelVersion,
        tolerance: tolerance,
      }),
    });
    return handleResponse<SamPointResponse>(res);
  },

  async sam2DualPitchSegment(
    assessmentId: string,
    modelVersion: string = "hiera_b_plus",
    tolerance: number = 2.5
  ): Promise<SamDualPitchResponse> {
    const res = await fetch(`${API_BASE}/api/vision/sam2/dual-pitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessment_id: assessmentId,
        model_version: modelVersion,
        tolerance: tolerance,
      }),
    });
    return handleResponse<SamDualPitchResponse>(res);
  },

  // First-Principles Economics & Township endpoints
  async computeLcoe(payload: LcoeCalculationRequest): Promise<LcoeResult> {
    const res = await fetch(`${API_BASE}/api/economics/lcoe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<LcoeResult>(res);
  },

  async getTownshipScenarios(systemSizeKwp: number = 8.8): Promise<Record<string, TownshipComparisonScenario>> {
    const res = await fetch(`${API_BASE}/api/economics/scenarios?system_size_kwp=${systemSizeKwp}`, {
      cache: "no-store",
    });
    return handleResponse<Record<string, TownshipComparisonScenario>>(res);
  },

  async getStructureTypes(): Promise<StructureTypeInfo[]> {
    const res = await fetch(`${API_BASE}/api/economics/structure-types`, {
      cache: "no-store",
    });
    return handleResponse<StructureTypeInfo[]>(res);
  },

  async getPortfolio(clusterFilter?: string): Promise<TownshipUnit[]> {
    const url = clusterFilter 
      ? `${API_BASE}/api/portfolio?cluster_filter=${clusterFilter}`
      : `${API_BASE}/api/portfolio`;
    const res = await fetch(url, { cache: "no-store" });
    return handleResponse<TownshipUnit[]>(res);
  },

  async analyzeRoof(
    roofPolygonsPx: [number, number][][],
    metresPerPixel?: number | null,
    tiltDeg: number = 15.0,
    canvasRotationDeg: number = 0.0
  ): Promise<RoofAnalysisResponse> {
    const res = await fetch(`${API_BASE}/api/geometry/analyze-roof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roof_polygons_px: roofPolygonsPx,
        metres_per_pixel: metresPerPixel || null,
        tilt_deg: tiltDeg,
        canvas_rotation_deg: canvasRotationDeg || 0.0,
      }),
    });
    return handleResponse<RoofAnalysisResponse>(res);
  },

  async calibrateGoogleMaps(
    barLengthPx: number,
    knownMeters: number = 5.0
  ): Promise<GoogleMapsCalibrateResponse> {
    const res = await fetch(`${API_BASE}/api/geometry/calibrate-google-maps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bar_length_px: barLengthPx,
        known_meters: knownMeters,
      }),
    });
    return handleResponse<GoogleMapsCalibrateResponse>(res);
  },

  async splitHip(polygonPx: [number, number][]): Promise<SplitHipResponse> {
    const res = await fetch(`${API_BASE}/api/geometry/split-hip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon_px: polygonPx,
      }),
    });
    return handleResponse<SplitHipResponse>(res);
  },
};
