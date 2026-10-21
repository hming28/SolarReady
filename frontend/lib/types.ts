/**
 * SolarReady Malaysia - TypeScript Type Definitions
 * Mirrored from backend schemas with unit-safe separation and first-principles economics.
 */

export interface LocationMeta {
  text: string;
  lat?: number | null;
  lon?: number | null;
}

export interface ImageMeta {
  filename: string;
  path: string;
  width_px: number;
  height_px: number;
  sha256?: string | null;
}

export interface Consent {
  image_use: boolean;
  timestamp: string;
}

export interface AssessmentCreate {
  location: LocationMeta;
  house_type?: string;
  monthly_bill_rm?: number | null;
  consent: Consent;
  is_demo?: boolean;
}

export type ObstacleType = "water_tank" | "ac" | "skylight" | "chimney" | "vent" | "unknown";
export type ScaleTier = "uncalibrated" | "approx_map_measure" | "user_measured";
export type ScaleMethod = "known_line" | "four_corners" | "none";

export interface Obstacle {
  id?: string;
  polygon_px: [number, number][]; // [[x, y], ...]
  type: ObstacleType;
  buffer_m: number;
  user_verified: boolean;
}

export interface ScaleCalibration {
  method: ScaleMethod;
  metres_per_pixel?: number | null;
  reference_px?: [[number, number], [number, number]] | null;
  reference_m?: number | null;
  quality_tier: ScaleTier;
  notes?: string | null;
}

export interface RoofFaceMetrics {
  index: number;
  is_valid: boolean;
  area_px2: number;
  planar_area_m2?: number | null;
  true_area_m2?: number | null;
  length_m?: number | null;
  width_m?: number | null;
  perimeter_m?: number | null;
  aspect_ratio?: number | null;
  azimuth_deg?: number | null;
  slope_direction?: string | null;
}

export interface RoofAnalysisResponse {
  faces: RoofFaceMetrics[];
  total_planar_area_m2?: number | null;
  total_true_area_m2?: number | null;
  tilt_deg: number;
  scale_calibrated: boolean;
  message: string;
}

export interface GoogleMapsCalibrateResponse {
  bar_length_px: number;
  known_meters: number;
  metres_per_pixel: number;
  quality_tier: string;
  message: string;
}

export interface SplitRidgeResponse {
  faces_px: [number, number][][];
  facet_count: number;
  message: string;
}

export interface RoofGeometry {
  roof_polygons_px: [number, number][][];
  obstacles: Obstacle[];
  scale: ScaleCalibration;
  roof_area_m2?: number | null;
  roof_area_px2?: number | null;
  tilt_deg?: number;
  faces_metrics?: RoofFaceMetrics[];
  roof_material?: string | null;
  estimated_pitch_deg?: number | null;
  pitch_confidence_range?: [number, number] | null;
  pitch_reasoning?: string | null;
  canvas_rotation_deg?: number;
}

export interface PanelSpec {
  name: string;
  length_m: number;
  width_m: number;
  rated_power_wp: number;
  min_gap_m: number;
}

export interface PanelPlacement {
  index: number;
  x_m: number;
  y_m: number;
  w_m: number;
  h_m: number;
  rotation_deg: number;
  x_px?: number | null;
  y_px?: number | null;
  w_px?: number | null;
  h_px?: number | null;
}

export interface FacetLayoutSummary {
  facet_index: number;
  slope_direction?: string | null;
  panel_count: number;
  capacity_kwp: number;
  area_m2: number;
  enabled: boolean;
}

export interface LayoutParams {
  setback_m: number;
  obstacle_buffer_m: number;
  orientation: "portrait" | "landscape" | "optimal";
  max_capacity_kwp?: number | null;
  active_facet_indices?: number[] | null;
  allow_estimated_scale?: boolean;
  arrays?: ArrayBlockRecommendation[] | null;
}

export interface LayoutRequest {
  geometry: RoofGeometry;
  panel_spec: PanelSpec;
  params: LayoutParams;
}

export interface LayoutResponse {
  panels: PanelPlacement[];
  panel_count: number;
  capacity_kwp: number;
  module_area_m2: number;
  usable_area_m2?: number | null;
  roof_area_m2?: number | null;
  params: LayoutParams;
  geometry_valid: boolean;
  unplaced_reasons: string[];
  facet_layouts?: FacetLayoutSummary[];
  scale_fallback_applied?: boolean;
  scale_m_per_px?: number | null;
}

export interface ArrayBlockRecommendation {
  facet_index: number;
  facet_name: string;
  orientation: string;
  rows: number;
  cols: number;
  reason: string;
}

export interface GeminiLayoutRecommendResponse {
  recommended_orientation: "optimal" | "portrait" | "landscape";
  recommended_setback_m: number;
  recommended_active_facets: number[];
  recommended_preset_index: number;
  summary_insights: string;
  azimuth_analysis: string;
  arrays?: ArrayBlockRecommendation[];
}

export interface RangeMetric {
  low: number;
  base: number;
  high: number;
}

export interface RangeMetricOptional {
  low?: number | null;
  base?: number | null;
  high?: number | null;
}

export interface FinanceResult {
  cost_rm: number;
  cost_per_kwp_rm: number;
  self_use_pct: number;
  tariff_rm_per_kwh: number;
  export_rate_rm_per_kwh: number;
  annual_self_consumption_kwh: RangeMetric;
  annual_export_kwh: RangeMetric;
  annual_savings_rm: RangeMetric;
  payback_years: RangeMetricOptional;
}

export interface EnergyFinanceResult {
  source: "PVGIS" | "NASA_POWER" | "FALLBACK_SAMPLE";
  retrieved_at: string;
  specific_yield_kwh_per_kwp: RangeMetric;
  annual_generation_kwh: RangeMetric;
  finance: FinanceResult;
  policy_status: "unverified" | "verified_peninsular";
  assumptions: string[];
  disclaimer: string;
}

export interface EnergyEstimateRequest {
  capacity_kwp: number;
  lat?: number;
  lon?: number;
  self_use_pct?: number;
  tariff_rm_per_kwh?: number;
  export_rate_rm_per_kwh?: number;
  cost_per_kwp_rm?: number;
  assessment_id?: string;
}

export interface Assessment {
  id: string;
  created_at: string;
  title?: string | null;
  monthly_bill_rm?: number | null;
  updated_at?: string | null;
  is_saved?: boolean;
  location: LocationMeta;
  house_type: string;
  image: ImageMeta;
  is_demo: boolean;
  consent: Consent;
  geometry?: RoofGeometry | null;
  layout?: LayoutResponse | null;
  energy?: EnergyFinanceResult | null;
}

export interface AssessmentSummary {
  id: string;
  title: string;
  house_type: string;
  location: string;
  capacity_kwp: number;
  panel_count: number;
  cost_rm: number;
  annual_savings_rm: number;
  payback_years: number;
  updated_at: string;
  is_demo?: boolean;
  is_saved?: boolean;
}

// ==========================================
// First-Principles Economics & Township Types
// ==========================================

export interface StructureTypeInfo {
  id: string;
  name: string;
  description: string;
  structure_cost_rm_per_kwp: number;
  labor_difficulty_multiplier: number;
  waterproofing_risk: string;
  typical_for: string;
}

export interface CapexBreakdown {
  module_rm_per_kwp: number;
  inverter_bos_rm_per_kwp: number;
  structure_rm_per_kwp: number;
  installation_labor_rm_per_kwp: number;
  cac_rm_per_kwp: number;
  total_capex_rm_per_kwp: number;
  total_system_cost_rm: number;
  idiot_index: number;
}

export interface LcoeCalculationRequest {
  module_fob_usd_per_w?: number;
  usd_to_myr?: number;
  structure_type?: string;
  cac_rm_per_kwp?: number;
  wacc?: number;
  wheeling_charge_sen?: number;
  offtaker_tariff_sen?: number;
  specific_yield_kwh?: number;
  lifetime_years?: number;
  system_size_kwp?: number;
}

export interface LcoeResult {
  capex_breakdown: CapexBreakdown;
  generation_lcoe_sen: number;
  wheeling_charge_sen: number;
  delivered_lcoe_sen: number;
  offtaker_tariff_sen: number;
  margin_sen_per_kwh: number;
  viable_lease: boolean;
  annual_generation_kwh: number;
  max_viable_annual_rent_per_kwp_rm: number;
  typical_homeowner_monthly_rent_rm: number;
  aggregator_irr_pct: number;
  structure_info: StructureTypeInfo;
}

export interface TownshipComparisonScenario {
  scenario_name: string;
  description: string;
  capex_rm_per_kwp: number;
  delivered_lcoe_sen: number;
  margin_sen_per_kwh: number;
  homeowner_monthly_rent_rm: number;
  viable_lease: boolean;
  cac_rm_per_home: number;
  structure_cost_rm_per_kwp: number;
  scope2_abatement_tonnes_per_home_yr: number;
}

export interface TownshipUnit {
  id: string;
  township: string;
  cluster_type: "greenfield_launch" | "brownfield_retrofit";
  property_type: string;
  address: string;
  structure_type: string;
  structure_cost_rm_per_kwp: number;
  roof_ready_tier: string;
  potential_kwp: number;
  usable_area_m2: number;
  delivered_lcoe_sen: number;
  viable_lease: boolean;
  viable_monthly_rent_rm: number;
  estimated_annual_savings_rm: number;
  simple_payback_years: number;
  scale_confidence: string;
  demo_flag: boolean;
}

export interface SamPointResponse {
  polygon_px: [number, number][];
  model_name: string;
  message: string;
}

export interface SamDualPitchResponse {
  polygons_px: [number, number][][];
  facet_count: number;
  model_name: string;
  message: string;
}

export interface CutLineResponse {
  roof_polygons_px: [number, number][][];
  split_occurred: boolean;
  facets_count: number;
  message: string;
}

export interface SplitHipResponse {
  roof_polygons_px: [number, number][][];
  facets_count: number;
  message: string;
}

export interface GeminiDetectResponse {
  polygons_px: [number, number][][];
  confidence: number;
  model_name: string;
  notes: string;
  roof_type?: string;
  roof_material?: string;
  estimated_pitch_deg?: number;
  pitch_confidence_range?: [number, number];
  pitch_reasoning?: string;
}

export interface CropRequest {
  box_px: [number, number, number, number];
}



