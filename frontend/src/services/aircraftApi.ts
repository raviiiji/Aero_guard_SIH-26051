import { AirspaceReport } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function fetchAirspaceTraffic(
  latitude: number,
  longitude: number,
  radiusKm: number = 80
): Promise<AirspaceReport> {
  const res = await fetch(
    `${API_BASE_URL}/aircraft?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`
  );
  if (!res.ok) {
    throw new Error(`Airspace traffic query failed: ${res.status}`);
  }
  return res.json();
}
