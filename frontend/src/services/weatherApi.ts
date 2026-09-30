import { LiveWeatherResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function fetchLiveWeather(
  latitude: number,
  longitude: number,
  forecastDays: number = 7
): Promise<LiveWeatherResponse> {
  const res = await fetch(
    `${API_BASE_URL}/weather?latitude=${latitude}&longitude=${longitude}&forecast_days=${forecastDays}`
  );
  if (!res.ok) {
    throw new Error(`Weather fetch failed with status: ${res.status}`);
  }
  return res.json();
}

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number
): Promise<{ status: string; current: any; location: any }> {
  const res = await fetch(
    `${API_BASE_URL}/weather/current?latitude=${latitude}&longitude=${longitude}`
  );
  if (!res.ok) {
    throw new Error(`Current weather failed with status: ${res.status}`);
  }
  return res.json();
}

export async function fetchForecastWeather(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<{ status: string; daily: any[]; hourly: any[]; location: any }> {
  const res = await fetch(
    `${API_BASE_URL}/weather/forecast?latitude=${latitude}&longitude=${longitude}&days=${days}`
  );
  if (!res.ok) {
    throw new Error(`Forecast weather failed with status: ${res.status}`);
  }
  return res.json();
}
