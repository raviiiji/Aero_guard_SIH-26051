import {
  ShelterGeometry,
  EnvelopeSection,
  SimulationParameters,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

function buildPayload(
  geometry: ShelterGeometry,
  roof: EnvelopeSection,
  wall: EnvelopeSection,
  floor: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation: number
) {
  return {
    geometry,
    roof_envelope: roof,
    wall_envelope: wall,
    floor_envelope: floor,
    params,
    latitude,
    elevation_m: elevation,
  };
}

export async function fetchEnginePrediction(
  geometry: ShelterGeometry,
  roof: EnvelopeSection,
  wall: EnvelopeSection,
  floor: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation: number
) {
  const res = await fetch(`${API_BASE_URL}/engine/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(geometry, roof, wall, floor, params, latitude, elevation)),
  });
  if (!res.ok) throw new Error(`Engine prediction failed: ${res.status}`);
  return res.json();
}

export async function fetchEngineHealth(
  geometry: ShelterGeometry,
  roof: EnvelopeSection,
  wall: EnvelopeSection,
  floor: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation: number
) {
  const res = await fetch(`${API_BASE_URL}/engine/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(geometry, roof, wall, floor, params, latitude, elevation)),
  });
  if (!res.ok) throw new Error(`Engine health failed: ${res.status}`);
  return res.json();
}

export async function fetchEngineAnomalies(
  geometry: ShelterGeometry,
  roof: EnvelopeSection,
  wall: EnvelopeSection,
  floor: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation: number
) {
  const res = await fetch(`${API_BASE_URL}/engine/anomaly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(geometry, roof, wall, floor, params, latitude, elevation)),
  });
  if (!res.ok) throw new Error(`Engine anomaly check failed: ${res.status}`);
  return res.json();
}

export async function fetchEngineComfortAnalysis(
  geometry: ShelterGeometry,
  roof: EnvelopeSection,
  wall: EnvelopeSection,
  floor: EnvelopeSection,
  params: SimulationParameters,
  latitude: number,
  elevation: number
) {
  const res = await fetch(`${API_BASE_URL}/engine/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(geometry, roof, wall, floor, params, latitude, elevation)),
  });
  if (!res.ok) throw new Error(`Engine comfort analysis failed: ${res.status}`);
  return res.json();
}
