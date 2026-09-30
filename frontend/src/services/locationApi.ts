import { LocationSearchResult } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function searchLocationsApi(
  query: string,
  count: number = 8
): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const res = await fetch(
    `${API_BASE_URL}/location/search?q=${encodeURIComponent(query.trim())}&count=${count}`
  );
  if (!res.ok) {
    throw new Error(`Location search failed with status: ${res.status}`);
  }
  const data = await res.json();
  return data.results || [];
}
