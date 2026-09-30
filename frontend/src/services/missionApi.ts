import { UnifiedMissionReport, SubsystemStatusReport } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

export async function runUnifiedMissionAnalysis(
  latitude: number,
  longitude: number,
  locationName: string,
  troops: number = 8,
  targetTempC: number = 19.0,
  missionDurationDays: number = 90,
  archetype: string = 'trombe_wall'
): Promise<UnifiedMissionReport> {
  const res = await fetch(`${API_BASE_URL}/mission/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude,
      longitude,
      location_name: locationName,
      troops,
      target_temp_c: targetTempC,
      mission_duration_days: missionDurationDays,
      archetype,
    }),
  });
  if (!res.ok) {
    throw new Error(`Mission analysis failed with status: ${res.status}`);
  }
  return res.json();
}

export async function fetchSystemStatus(): Promise<SubsystemStatusReport> {
  const res = await fetch(`${API_BASE_URL}/status`);
  if (!res.ok) {
    throw new Error(`System status failed: ${res.status}`);
  }
  return res.json();
}
