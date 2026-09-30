import { OptimizationResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function runOptimizer(
  troops: number,
  targetTempC: number,
  missionDurationDays: number,
  latitude: number,
  elevationM: number,
  hourlyWeather?: Array<{ hour: number; ambient_temp: number; solar_ghi: number; wind_speed: number }>
): Promise<OptimizationResponse> {
  const res = await fetch(`${API_BASE_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      troops,
      target_temp_c: targetTempC,
      mission_duration_days: missionDurationDays,
      latitude,
      elevation_m: elevationM,
      hourly_weather: hourlyWeather,
    }),
  });
  if (!res.ok) {
    throw new Error(`Optimizer failed with status: ${res.status}`);
  }
  return res.json();
}
