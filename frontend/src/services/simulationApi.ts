import {
  ShelterGeometry,
  EnvelopeSection,
  SimulationParameters,
  SimulationResult,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function runSimulation(
  geometry: ShelterGeometry,
  roofEnvelope: EnvelopeSection,
  wallEnvelope: EnvelopeSection,
  floorEnvelope: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation_m: number,
  hourlyWeatherOverride?: Array<{
    hour: number;
    ambient_temp: number;
    solar_ghi: number;
    wind_speed: number;
    relative_humidity: number;
  }>
): Promise<SimulationResult> {
  const payload = {
    geometry,
    roof_envelope: roofEnvelope,
    wall_envelope: wallEnvelope,
    floor_envelope: floorEnvelope,
    params,
    latitude,
    elevation_m,
    hourly_weather_override: hourlyWeatherOverride,
  };

  const res = await fetch(`${API_BASE_URL}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Simulation failed with status: ${res.status}`);
  }
  return res.json();
}
