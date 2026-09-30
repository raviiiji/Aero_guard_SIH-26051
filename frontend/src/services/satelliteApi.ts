import { SatelliteSearchResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function searchSatelliteScenes(
  lat: number,
  lng: number,
  startDate?: string,
  endDate?: string,
  cloudCover: number = 30
): Promise<SatelliteSearchResponse> {
  const url = new URL(`${API_BASE_URL}/satellite/search`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  if (startDate) url.searchParams.set('start_date', startDate);
  if (endDate) url.searchParams.set('end_date', endDate);
  url.searchParams.set('cloud_cover', String(cloudCover));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Satellite search failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSatelliteStatistics(
  lat: number,
  lng: number
): Promise<{ status: string; indices: any; mission_assessment: string }> {
  const res = await fetch(
    `${API_BASE_URL}/satellite/statistics?lat=${lat}&lng=${lng}`
  );
  if (!res.ok) {
    throw new Error(`Satellite statistics failed: ${res.status}`);
  }
  return res.json();
}
