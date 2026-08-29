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
