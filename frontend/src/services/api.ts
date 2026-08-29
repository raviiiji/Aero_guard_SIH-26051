import {
  MaterialDef,
  GlazingDef,
  DefenseStation,
  WeatherResponse,
  SimulationResult,
  OptimizationResponse,
  CADParseResponse,
  ShelterGeometry,
  EnvelopeSection,
  SimulationParameters,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';


export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    console.warn('Backend connection error:', e);
    return false;
  }
}

export async function fetchMaterials(): Promise<{
  materials: Record<string, MaterialDef>;
  glazing: Record<string, GlazingDef>;
}> {
  const res = await fetch(`${API_BASE_URL}/materials`);
  if (!res.ok) throw new Error('Failed to fetch materials');
  return res.json();
}

export async function fetchDefenseStations(): Promise<DefenseStation[]> {
  const res = await fetch(`${API_BASE_URL}/stations`);
  if (!res.ok) throw new Error('Failed to fetch defense stations');
  const data = await res.json();
  return data.stations;
}

export async function fetchDesignTemplate(
  lat: number,
  elevation_m: number,
  troops: number
): Promise<any> {
  const res = await fetch(
    `${API_BASE_URL}/design-template?latitude=${lat}&elevation_m=${elevation_m}&troops=${troops}`
  );
  if (!res.ok) throw new Error('Failed to fetch design template');
  return res.json();
}

export async function fetchWeatherAndCluster(
  lat: number,
  lng: number,
  elevation_m?: number,
  algorithm: string = 'kmeans'
): Promise<WeatherResponse> {
  const res = await fetch(`${API_BASE_URL}/weather`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: lat,
      longitude: lng,
      elevation_m,
      algorithm,
    }),
  });
  if (!res.ok) throw new Error('Failed to fetch weather and cluster');
  return res.json();
}

export async function runSimulation(
  geometry: ShelterGeometry,
  roof_envelope: EnvelopeSection,
  wall_envelope: EnvelopeSection,
  floor_envelope: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation_m: number,
  hourly_weather?: Array<{ hour: number; ambient_temp: number; solar_ghi: number; wind_speed: number }>
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE_URL}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      geometry,
      roof_envelope,
      wall_envelope,
      floor_envelope,
      params,
      latitude,
      elevation_m,
      hourly_weather,
    }),
  });
  if (!res.ok) throw new Error('Thermal simulation failed');
  return res.json();
}

export async function runOptimization(
  troops: number,
  target_temp_c: number,
  mission_duration_days: number,
  latitude: number,
  elevation_m: number,
  hourly_weather?: Array<{ hour: number; ambient_temp: number; solar_ghi: number; wind_speed: number }>
): Promise<OptimizationResponse> {
  const res = await fetch(`${API_BASE_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      troops,
      target_temp_c,
      mission_duration_days,
      latitude,
      elevation_m,
      hourly_weather,
    }),
  });
  if (!res.ok) throw new Error('Optimization failed');
  return res.json();
}

export async function parseCadFile(file: File): Promise<CADParseResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/parse-cad`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload error' }));
    throw new Error(err.detail || 'CAD parse failed');
  }
  return res.json();
}

export interface WeatherCsvImportResult {
  status: string;
  rows_parsed: number;
  hourly_weather: Array<{
    hour: number;
    ambient_temp: number;
    solar_ghi: number;
    wind_speed: number;
    relative_humidity: number;
  }>;
  summary: {
    min_temp_c: number;
    max_temp_c: number;
    avg_temp_c: number;
    peak_solar_w_m2: number;
    daily_ghi_kwh_m2: number;
    avg_wind_mps: number;
    max_wind_mps: number;
  };
}

export interface MaterialCsvImportResult {
  status: string;
  materials_imported: number;
  materials: Record<string, {
    name: string;
    k: number;
    density: number;
    cp: number;
    cost_per_m2_100mm: number;
    default_thickness_mm: number;
    category: string;
    description: string;
  }>;
}

export async function importCsvWeather(file: File): Promise<WeatherCsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/import-csv-weather`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Weather CSV import failed');
  }
  return res.json();
}

export async function importCsvMaterials(file: File): Promise<MaterialCsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/import-csv-materials`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Materials CSV import failed');
  }
  return res.json();
}
