// TypeScript Interfaces for AERO-SHIELD

export interface MaterialDef {
  name: string;
  k: number; // Thermal conductivity W/m·K
  density: number; // kg/m³
  cp: number; // J/kg·K
  cost_per_m2_100mm: number; // INR
  embodied_co2_kg_m3: number;
  category: string;
  description: string;
}

export interface GlazingDef {
  name: string;
  u_value: number; // W/m²·K
  shgc: number;
  cost_per_m2: number;
  description: string;
}

export interface LayerSpec {
  material_id: string;
  thickness_mm: number;
}

export interface EnvelopeSection {
  layers: LayerSpec[];
}

export interface ShelterGeometry {
  archetype: 'modular_box' | 'trombe_wall' | 'earth_bermed' | 'quonset_dome' | 'custom_cad';
  length_m: number;
  width_m: number;
  height_m: number;
  roof_pitch_deg: number;
  window_area_m2: number;
  glazing_id: string;
  window_orientation_deg: number;
  trombe_wall_area_m2: number;
  earth_bermed_depth_m: number;
}

export interface SimulationParameters {
  troops: number;
  target_temp_c: number;
  mission_duration_days: number;
  infiltration_ach_base: number;
  equipment_heat_w: number;
  burner_efficiency: number;
  diesel_energy_density_kwh_l: number;
}

export interface HourlyDataPoint {
  hour: number;
  hour_label: string;
  ambient_temp: number;
  inside_temp_unheated: number;
  target_temp: number;
  solar_ghi: number;
  solar_gain_w: number;
  internal_gain_w: number;
  total_loss_w: number;
  auxiliary_heating_deficit_w: number;
  roof_loss_w: number;
  wall_loss_w: number;
  floor_loss_w: number;
  window_loss_w: number;
  infiltration_loss_w: number;
}

export interface SimulationSummary {
  daily_deficit_kwh: number;
  daily_fuel_liters: number;
  campaign_fuel_liters: number;
  campaign_fuel_barrels_200l: number;
  baseline_campaign_fuel_liters: number;
  fuel_saved_liters: number;
  fuel_saving_percentage: number;
  co2_emissions_saved_kg: number;
  total_daily_heat_loss_kwh: number;
  total_daily_solar_gain_kwh: number;
  total_daily_metabolic_gain_kwh: number;
  passive_solar_fraction_pct: number;
  total_shelter_weight_kg: number;
  total_construction_cost_inr: number;
  shelters_needed_for_platoon: number;
}

export interface SectionUValue {
  u_value: number;
  r_value: number;
  thickness_mm: number;
  weight_per_m2: number;
  cost_per_m2: number;
  heat_capacity_per_m2: number;
}

export interface SimulationResult {
  summary: SimulationSummary;
  u_values: {
    roof: SectionUValue;
    walls: SectionUValue;
    floor: SectionUValue;
    glazing: {
      name: string;
      u_value: number;
      shgc: number;
    };
  };
  geometry: {
    floor_area: number;
    roof_area: number;
    wall_area_exposed: number;
    wall_area_bermed: number;
    window_area: number;
    trombe_area: number;
    volume: number;
    total_envelope_area: number;
  };
  loss_breakdown_pct: {
    walls: number;
    roof: number;
    floor: number;
    windows: number;
    infiltration: number;
  };
  hourly_timeseries: HourlyDataPoint[];
}

export interface DefenseStation {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  elevation_m: number;
  climate_type: string;
  solar_annual_kwh_m2: number;
  winter_temp_min: number;
  winter_temp_mean: number;
  description: string;
}

export interface WeatherClusterCentroid {
  mean_temp_c: number;
  min_temp_c: number;
  solar_kwh_m2_day: number;
  mean_wind_mps: number;
  peak_wind_mps: number;
}

export interface WeatherCluster {
  cluster_id: number;
  phase_name: string;
  severity_level: string;
  color_hex: string;
  description: string;
  day_count: number;
  weight_pct: number;
  day_indices: number[];
  centroid: WeatherClusterCentroid;
  representative_diurnal_24h: Array<{
    hour: number;
    hour_label: string;
    ambient_temp: number;
    solar_ghi: number;
    wind_speed: number;
  }>;
}

export interface WeatherResponse {
  location: {
    lat: number;
    lng: number;
    elevation_m: number;
    station_info?: DefenseStation | null;
    data_source: string;
  };
  metrics_90day: {
    avg_temperature_c: number;
    extreme_min_temp_c: number;
    avg_daily_solar_kwh_m2: number;
    total_seasonal_solar_kwh_m2: number;
    avg_peak_wind_mps: number;
  };
  clustering: {
    algorithm: string;
    total_days_analyzed: number;
    cluster_count: number;
    silhouette_score: number;
    clusters: WeatherCluster[];
  };
  daily_timeseries: Array<{
    day: number;
    date_label: string;
    mean_temp: number;
    min_temp: number;
    max_temp: number;
    solar_kwh_m2: number;
    mean_wind: number;
    max_wind: number;
  }>;
}

export interface CandidateOptimization {
  config_id: string;
  name: string;
  archetype: string;
  tag: string;
  description: string;
  glazing_name: string;
  u_value_wall: number;
  u_value_roof: number;
  campaign_fuel_liters: number;
  campaign_fuel_barrels_200l: number;
  fuel_saved_liters: number;
  fuel_saving_percentage: number;
  daily_fuel_liters: number;
  passive_solar_fraction_pct: number;
  total_shelter_weight_kg: number;
  total_cost_inr: number;
  co2_saved_kg: number;
  wall_layers: LayerSpec[];
  roof_layers: LayerSpec[];
  floor_layers: LayerSpec[];
  window_area_m2: number;
  trombe_area_m2: number;
  earth_bermed_depth_m: number;
}

export interface OptimizationResponse {
  candidate_comparisons: CandidateOptimization[];
  recommendations: {
    best_overall: CandidateOptimization;
    min_fuel_consumption: CandidateOptimization;
    lightweight_airlift: CandidateOptimization;
  };
}

export interface CADParseResponse {
  filename: string;
  is_watertight: boolean;
  vertex_count: number;
  face_count: number;
  unit_detected: string;
  dimensions: {
    length_m: number;
    width_m: number;
    height_m: number;
    volume_m3: number;
    total_surface_area_m2: number;
  };
  surface_decomposition: {
    roof_area_m2: number;
    wall_area_m2: number;
    floor_area_m2: number;
    south_facing_wall_m2: number;
    north_facing_wall_m2: number;
  };
  recommended_simulation_inputs: {
    length_m: number;
    width_m: number;
    height_m: number;
    roof_area_m2: number;
    wall_area_m2: number;
    window_area_m2: number;
  };
}

// ---------------------------------------------------------------------------
// External & Internal Integration API Types
// ---------------------------------------------------------------------------
export interface LiveWeatherCurrent {
  temperature_c: number;
  apparent_temperature_c: number;
  relative_humidity_pct: number;
  precipitation_mm: number;
  rain_mm: number;
  snowfall_cm: number;
  weather_code: number;
  weather_description: string;
  condition: string;
  icon: string;
  cloud_cover_pct: number;
  surface_pressure_hpa: number;
  wind_speed_mps: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_mps: number;
  visibility_m: number;
  time: string;
}

export interface LiveWeatherHourly {
  time: string;
  hour: number;
  temperature_c: number;
  apparent_temperature_c: number;
  relative_humidity_pct: number;
  solar_radiation_w_m2: number;
  wind_speed_mps: number;
  wind_speed_kmh: number;
  precipitation_mm: number;
  weather_code: number;
  weather_description: string;
}

export interface LiveWeatherDaily {
  date: string;
  weather_code: number;
  description: string;
  condition: string;
  temp_max_c: number;
  temp_min_c: number;
  apparent_max_c: number;
  apparent_min_c: number;
  precipitation_sum_mm: number;
  snowfall_sum_cm: number;
  wind_speed_max_kmh: number;
  wind_gusts_max_kmh: number;
  solar_radiation_sum_mj_m2: number;
  uv_index_max: number;
}

export interface LiveWeatherResponse {
  status: string;
  source: string;
  location: {
    latitude: number;
    longitude: number;
    elevation_m: number;
    timezone: string;
  };
  current: LiveWeatherCurrent;
  hourly: LiveWeatherHourly[];
  daily: LiveWeatherDaily[];
  cached?: boolean;
}

export interface LocationSearchResult {
  id: string;
  name: string;
  country: string;
  country_code?: string;
  region: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  is_defense_station: boolean;
  type?: string;
  description?: string;
}

export interface ElevationPointResult {
  latitude: number;
  longitude: number;
  elevation: number;
  unit: string;
  source: string;
  cached?: boolean;
}

export interface ElevationProfileResult {
  count: number;
  source: string;
  min_elevation_m: number;
  max_elevation_m: number;
  avg_elevation_m: number;
  profile: Array<{
    index: number;
    latitude: number;
    longitude: number;
    elevation_m: number;
    label: string;
  }>;
}

export interface SatelliteScene {
  scene_id: string;
  date: string;
  cloud_cover_pct: number;
  snow_ice_cover_pct?: number;
  constellation: string;
  resolution_m: number;
  instrument?: string;
  bands_available?: string[];
}

export interface SatelliteSearchResponse {
  status: string;
  configured: boolean;
  message?: string;
  setup_guide?: string;
  satellite_provider?: string;
  count?: number;
  scenes?: SatelliteScene[];
  sample_scenes?: SatelliteScene[];
}

export interface AircraftContact {
  icao24: string;
  callsign: string;
  origin_country: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  velocity_mps: number;
  velocity_kmh: number;
  heading_deg: number;
  vertical_rate_mps: number;
  on_ground: boolean;
  aircraft_type: 'commercial' | 'military_transport' | 'tactical_uav' | 'high_altitude_transit' | 'unknown';
  is_uav: boolean;
  sensor_payload?: string;
  battery_pct?: number;
  link_quality_pct?: number;
  timestamp: number;
}

export interface AirspaceReport {
  status: string;
  source: string;
  count: number;
  uav_count: number;
  commercial_count: number;
  aircraft: AircraftContact[];
  cached?: boolean;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
}

export interface AIChatResponse {
  status: string;
  source: string;
  is_real_ai: boolean;
  response: string;
}

export interface SubsystemStatusReport {
  status: string;
  system_version: string;
  drdo_problem_id: string;
  subsystems: {
    backend: string;
    weather: string;
    maps: string;
    satellite: string;
    elevation: string;
    aircraft: string;
    ai: string;
    ml: string;
    cad: string;
    optimizer: string;
    simulation: string;
  };
  details: Record<string, string>;
}

export interface UnifiedMissionReport {
  status: string;
  mission_name: string;
  location: {
    latitude: number;
    longitude: number;
    elevation_m: number;
    elevation_source: string;
  };
  environmental_telemetry: {
    temperature_c: number;
    wind_speed_mps: number;
    weather_condition: string;
    satellite_status: string;
  };
  airspace_security: {
    tracked_contacts: number;
    uav_active: boolean;
    uav_callsign: string;
  };
  thermal_logistics: {
    daily_fuel_liters: number;
    campaign_fuel_barrels: number;
    fuel_saving_percentage: number;
    passive_solar_fraction: number;
    anomalies: Array<{ type: string; severity: string; message: string }>;
  };
  ai_executive_brief: string;
}

// ===========================================================================
// SHELTER DIGITAL TWIN — Location-Aware Deployed Shelter Types
// Mirrors backend/services/shelter_service.py
// ===========================================================================

/** Geographic anchor for a deployed shelter. WGS84. Never hardcoded. */
export interface ShelterAnchor {
  id: string;
  latitude: number;
  longitude: number;
  elevation: number;
  /** Compass heading in degrees, 0 = north, 180 = south-facing solar facade. */
  heading: number;
  timestamp: number;
}

export type FuelStatus = 'NORMAL' | 'LOW' | 'CRITICAL' | 'EMPTY';
export type GeneratorStatus = 'RUNNING' | 'OFF';
export type PowerSource = 'GRID' | 'GENERATOR' | 'SOLAR' | 'BATTERY' | 'NONE';
export type OperationalStatus = 'NOMINAL' | 'DEGRADED' | 'OFFLINE';

/** Real DEM grid in a WGS84 local tangent plane: x = +East, z = -North, y = up. */
export interface ShelterTerrain {
  latitude: number;
  longitude: number;
  span_m: number;
  samples: number;
  grid_m: number[][];
  min_elevation_m: number;
  max_elevation_m: number;
  is_simulated: boolean;
  coordinate_note: string;
}

export interface ShelterFuelState {
  fuel_level_l: number;
  fuel_capacity_l: number;
  fuel_pct: number;
  status: FuelStatus;
  consumption_rate_lph: number;
  remaining_runtime_hours: number | null;
}

export interface ShelterGeneratorState {
  status: GeneratorStatus;
  rated_load_w: number;
  stop_reason: string | null;
}

export interface ShelterPowerState {
  source: PowerSource;
  available_sources: PowerSource[];
  load_w: number;
  grid_connected: boolean;
}

export interface ShelterBatteryState {
  battery_level_kwh: number;
  battery_capacity_kwh: number;
  battery_pct: number;
  charging: boolean;
  charging_enabled: boolean;
}

export interface ShelterSolarState {
  capacity_kw: number;
  input_w: number;
  generating: boolean;
}

export interface ShelterTelemetry {
  outside_temperature_c: number | null;
  inside_temperature_c: number | null;
  relative_humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_mps: number | null;
  wind_gusts_mps: number | null;
  precipitation_mm: number | null;
  visibility_m: number | null;
  condition: string | null;
  occupancy: number;
  occupancy_capacity: number;
  air_quality: string;
  water_availability_l: number;
  communication: {
    status: string;
    link: string;
    signal_pct: number;
    is_simulated: boolean;
  };
}

export interface ShelterTwin {
  id: string;
  name: string;
  archetype: string;
  location: {
    latitude: number;
    longitude: number;
    elevation_m: number;
    elevation_source: string;
    heading_deg: number;
    coordinate_system: string;
  };
  telemetry: ShelterTelemetry;
  environment: {
    source: string;
    is_simulated: boolean;
    solar_radiation_w_m2: number;
    observed_at: string | null;
  };
  fuel: ShelterFuelState;
  generator: ShelterGeneratorState;
  power: ShelterPowerState;
  battery: ShelterBatteryState;
  solar: ShelterSolarState;
  operational_status: OperationalStatus;
  /** True when any displayed figure came from a labelled simulated fallback. */
  is_simulated: boolean;
  simulated_fields: string[];
  deployed_at: number;
  last_updated: number;
  last_updated_iso: string;
  relocated?: boolean;
  command?: {
    action: string;
    accepted: boolean;
    message: string;
  };
}

/** Identifiable shelter subsystems that are clickable in the 3D scene. */
export type ShelterPartId =
  | 'shelter_shell'
  | 'glazing'
  | 'entrance'
  | 'generator'
  | 'fuel_tank'
  | 'battery'
  | 'solar_array'
  | 'ventilation'
  | 'comms';

export interface ShelterPartMeta {
  id: ShelterPartId;
  label: string;
  description: string;
}

// ===========================================================================
// LOCATION ANALYSIS
// Composed in the browser from the endpoints the project ALREADY exposes
// (GET /api/elevation, GET /api/weather/current, GET /api/shelter-terrain,
// GET /api/stations). Nothing here is hardcoded and nothing here adds a new
// backend endpoint; every field keeps the provenance of the call that filled
// it so the UI can label MEASURED vs DERIVED vs UNAVAILABLE.
// ===========================================================================

/** Where a displayed value came from. Nothing is presented without one. */
export type FieldOrigin = 'live' | 'derived' | 'simulated' | 'unavailable';

export interface AnalyzedField<T> {
  value: T | null;
  origin: FieldOrigin;
  /** Endpoint or dataset that produced the value. Shown in the UI tooltip. */
  source?: string;
  unit?: string;
}

export interface TerrainSummary {
  min_elevation_m: number;
  max_elevation_m: number;
  relief_m: number;
  /** DEM sample count backing the relief figure. */
  total_samples: number;
  span_m: number;
  origin: FieldOrigin;
  source: string;
}

export interface ClimateSummary {
  /** Climate label from the curated station record, when one is in range. */
  label: string | null;
  /** Name of the station the label came from. */
  station_name: string | null;
  /** Great-circle distance from the analysed point to that station, in km. */
  distance_km: number | null;
  origin: FieldOrigin;
  source: string;
}

export interface LocationAnalysis {
  latitude: number;
  longitude: number;
  name: string;
  elevation: AnalyzedField<number>;
  temperature: AnalyzedField<number>;
  apparent_temperature: AnalyzedField<number>;
  humidity: AnalyzedField<number>;
  wind_speed_mps: AnalyzedField<number>;
  wind_gusts_mps: AnalyzedField<number>;
  wind_direction_deg: AnalyzedField<number>;
  precipitation_mm: AnalyzedField<number>;
  snowfall_cm: AnalyzedField<number>;
  cloud_cover_pct: AnalyzedField<number>;
  pressure_hpa: AnalyzedField<number>;
  solar_radiation_w_m2: AnalyzedField<number>;
  condition: AnalyzedField<string>;
  terrain: TerrainSummary | null;
  climate: ClimateSummary;
  /** Server observation time when the weather API supplied one. */
  observed_at: string | null;
  /** When this analysis was assembled in the browser. */
  analysed_at: string;
  /** True when any field fell back to a labelled simulated source. */
  is_simulated: boolean;
}

// ===========================================================================
// LOCATION-BASED SHELTER CONFIGURATION
// Mirrors GET /api/design-template (backend/weather_service.py) plus the
// already-running POST /api/simulate U-values. Values are labelled by kind so
// recommendations are never presented as measurements.
// ===========================================================================

/**
 * MEASURED   - read straight from a live external API.
 * CALCULATED - produced by an existing backend model on real inputs
 *              (/api/simulate, /api/design-template).
 * RECOMMENDED- a rule-engine recommendation, not an engineering certification.
 * ASSET      - a fixed rating declared by the backend twin, not site-derived.
 */
export type ConfigValueKind = 'measured' | 'calculated' | 'recommended' | 'asset';

export interface DesignLayer {
  layer: string;
  mat: string;
  thickness_mm: number;
  k: number;
}

export interface SiteDesignTemplate {
  model: string;
  capacity: string;
  dimensions: {
    length_m: number;
    width_m: number;
    height_m: number;
    roof_pitch_deg: number;
    floor_area_m2: number;
    volume_m3: number;
    window_area_m2: number;
    trombe_wall_area_m2: number;
    window_orientation_deg: number;
  };
  envelope_stack: {
    wall_layers: DesignLayer[];
    roof_layers: DesignLayer[];
    floor_layers: DesignLayer[];
    glazing_id: string;
  };
  trombe_wall: {
    material: string;
    area_m2: number;
    absorptance: number;
    emittance: number;
    thermal_lag_hours: number;
  };
  vestibule: {
    dimensions: string;
    infiltration_reduction_pct: number;
  };
}

export interface RecommendedConfiguration {
  /** Real inputs the recommendation was derived from. */
  inputs: {
    latitude: number;
    elevation_m: number;
    troops: number;
    ambient_temp_c: number | null;
    wind_speed_mps: number | null;
    solar_w_m2: number | null;
  };
  template: SiteDesignTemplate | null;
  /** U-values from the existing /api/simulate run for this exact location. */
  thermal: {
    roof_u: number | null;
    wall_u: number | null;
    floor_u: number | null;
    glazing_u: number | null;
    glazing_shgc: number | null;
    /** W/m² of measured solar flux on the south facade right now. */
    incident_solar_w_m2: number | null;
    /** Auxiliary heating deficit at the worst modelled hour, in watts. */
    peak_heating_deficit_w: number | null;
  };
  /** Fixed asset ratings declared by the backend shelter twin. */
  assets: {
    solar_capacity_kw: number | null;
    battery_capacity_kwh: number | null;
    fuel_capacity_l: number | null;
  };
  /** Fuel campaign from the existing /api/simulate run. */
  fuel: {
    daily_liters: number | null;
    campaign_liters: number | null;
    campaign_barrels_200l: number | null;
    saving_pct: number | null;
  };
  /** Altitude variant the backend rules engine selected, verbatim. */
  model_variant: string | null;
  /** Capacity designation string the backend rules engine selected, verbatim. */
  capacity_designation: string | null;
  /** Transparent rules-engine rating for the siting decision. */
  suitability: SuitabilityRating;
  analysed_at: string;
}

export type SuitabilityRatingLabel = 'EXCELLENT' | 'FAVOURABLE' | 'MARGINAL' | 'POOR' | 'UNKNOWN';

/** One weighted input to the siting rating, with the note explaining its score. */
export interface SuitabilityFactor {
  key: 'thermal' | 'wind' | 'solar' | 'terrain' | 'altitude';
  label: string;
  /** Measured value, or null when the underlying field was unavailable. */
  value: number | null;
  unit: string;
  /** 0..100 for this factor alone, or null when unavailable. */
  score: number | null;
  /** Relative influence on the overall rating, in percent. */
  weight: number;
  available: boolean;
  note: string;
}

/**
 * Site suitability for shelter siting. Always CALCULATED (or explicitly
 * UNKNOWN) — never presented as a certified engineering assessment.
 */
export interface SuitabilityRating {
  rating: SuitabilityRatingLabel;
  /** 0..100, null when no input could be evaluated. */
  score: number | null;
  /** Percent of total weight that could actually be evaluated. */
  coverage_pct: number;
  /**
   * True when too little of the weighted input was available for the rating to
   * be treated as a verdict. A high score off a single reading must never be
   * presented as a confident assessment.
   */
  low_confidence: boolean;
  factors: SuitabilityFactor[];
  basis: string;
  origin: 'calculated' | 'unavailable';
}
