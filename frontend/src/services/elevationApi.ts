import { ElevationPointResult, ElevationProfileResult } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function fetchElevation(
  latitude: number,
  longitude: number
): Promise<ElevationPointResult> {
  const res = await fetch(
    `${API_BASE_URL}/elevation?latitude=${latitude}&longitude=${longitude}`
  );
  if (!res.ok) {
    throw new Error(`Elevation lookup failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchElevationProfile(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<ElevationProfileResult> {
  const locStr = waypoints.map((p) => `${p.lat},${p.lng}`).join('|');
  const res = await fetch(
    `${API_BASE_URL}/elevation?locations=${encodeURIComponent(locStr)}`
  );
  if (!res.ok) {
    throw new Error(`Elevation profile lookup failed: ${res.status}`);
  }
  return res.json();
}
