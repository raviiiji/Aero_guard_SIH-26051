import { ShelterAnchor, ShelterPartId, ShelterTerrain, ShelterTwin } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000/api';

/** Extract the human-readable message from a FastAPI error body. */
async function readError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return new Error(detail);
    if (Array.isArray(detail) && detail.length > 0) {
      return new Error(detail.map((d: { msg?: string }) => d.msg).join('; '));
    }
  } catch {
    /* body was not JSON */
  }
  return new Error(`${fallback} (HTTP ${res.status})`);
}

/**
 * Deploy a shelter digital twin at real coordinates.
 *
 * The backend relocates an existing twin when one is already anchored within
 * 100 m rather than creating a duplicate, so repeatedly selecting a new map
 * point moves the same shelter instead of accumulating clones.
 */
export async function deployShelter(params: {
  latitude: number;
  longitude: number;
  elevation?: number;
  headingDeg?: number;
  troops?: number;
  archetype?: string;
}): Promise<ShelterTwin> {
  const res = await fetch(`${API_BASE_URL}/shelters/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: params.latitude,
      longitude: params.longitude,
      elevation: params.elevation,
      heading_deg: params.headingDeg,
      troops: params.troops,
      archetype: params.archetype,
    }),
  });
  if (!res.ok) throw await readError(res, 'Shelter deployment failed');
  return res.json();
}

export async function listShelters(): Promise<{ count: number; shelters: ShelterTwin[] }> {
  const res = await fetch(`${API_BASE_URL}/shelters`);
  if (!res.ok) throw await readError(res, 'Shelter list failed');
  return res.json();
}

export async function fetchShelter(shelterId: string): Promise<ShelterTwin> {
  const res = await fetch(`${API_BASE_URL}/shelters/${encodeURIComponent(shelterId)}`);
  if (!res.ok) throw await readError(res, 'Shelter fetch failed');
  return res.json();
}

export async function updateShelter(
  shelterId: string,
  updates: {
    name?: string;
    heading_deg?: number;
    latitude?: number;
    longitude?: number;
    elevation?: number;
    troops?: number;
    grid_connected?: boolean;
  }
): Promise<ShelterTwin> {
  const res = await fetch(`${API_BASE_URL}/shelters/${encodeURIComponent(shelterId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw await readError(res, 'Shelter update failed');
  return res.json();
}

/** Interactive subsystem control. Rejected commands (e.g. start on an empty
 *  tank) still return HTTP 200 with `command.accepted === false`. */
export async function sendShelterCommand(
  shelterId: string,
  action: 'start_generator' | 'stop_generator' | 'refuel' | 'toggle_grid',
  liters?: number
): Promise<ShelterTwin> {
  const res = await fetch(`${API_BASE_URL}/shelters/${encodeURIComponent(shelterId)}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, liters }),
  });
  if (!res.ok) throw await readError(res, 'Shelter command failed');
  return res.json();
}

export async function fetchShelterFuel(shelterId: string): Promise<ShelterTwin['fuel']> {
  const res = await fetch(`${API_BASE_URL}/shelters/${encodeURIComponent(shelterId)}/fuel`);
  if (!res.ok) throw await readError(res, 'Fuel fetch failed');
  const data = await res.json();
  return data.fuel;
}

export async function fetchShelterPower(
  shelterId: string
): Promise<{ power: ShelterTwin['power']; battery: ShelterTwin['battery']; solar: ShelterTwin['solar'] }> {
  const res = await fetch(`${API_BASE_URL}/shelters/${encodeURIComponent(shelterId)}/power`);
  if (!res.ok) throw await readError(res, 'Power fetch failed');
  return res.json();
}

/** Sample a real DEM grid so the 3D shelter is seated on actual ground. */
export async function fetchShelterTerrain(
  latitude: number,
  longitude: number,
  spanM = 200,
  samples = 7
): Promise<ShelterTerrain> {
  const url =
    `${API_BASE_URL}/shelter-terrain?latitude=${latitude}&longitude=${longitude}` +
    `&span_m=${spanM}&samples=${samples}`;
  const res = await fetch(url);
  if (!res.ok) throw await readError(res, 'Terrain sampling failed');
  return res.json();
}

/** Build the local shelter anchor from a live twin. */
export function anchorFromTwin(twin: ShelterTwin): ShelterAnchor {
  return {
    id: twin.id,
    latitude: twin.location.latitude,
    longitude: twin.location.longitude,
    elevation: twin.location.elevation_m,
    heading: twin.location.heading_deg,
    timestamp: twin.last_updated,
  };
}

/** Metadata for clickable 3D shelter subsystems. */
export const SHELTER_PARTS: Record<ShelterPartId, { label: string; description: string }> = {
  shelter_shell: { label: 'Shelter Shell', description: 'Insulated envelope and structural frame' },
  glazing: { label: 'Solar Glazing', description: 'South-facing Trombe glazing aperture' },
  entrance: { label: 'Entrance Airlock', description: 'Pressure-locked troop entry point' },
  generator: { label: 'Generator Set', description: 'Diesel generator supplying auxiliary power' },
  fuel_tank: { label: 'Fuel Tank', description: 'Bulk diesel storage feeding the burner' },
  battery: { label: 'Battery Bank', description: 'Lithium bank for load buffering and black-start' },
  solar_array: { label: 'Solar Array', description: 'Photovoltaic array supplementing generation' },
  ventilation: { label: 'Ventilation', description: 'Manual purge and fresh-air exchange' },
  comms: { label: 'Communications', description: 'SATCOM and tactical data terminal' },
};
