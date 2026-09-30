/**
 * Location analysis for the live shelter digital twin.
 *
 * This module ADDS NO BACKEND ENDPOINT. It composes the endpoints the project
 * already exposes into one readout, keeping the provenance of every value so
 * the UI can honestly separate measured / derived / simulated / unavailable:
 *
 *   GET /api/elevation        -> services/elevation_service.py (OpenTopo / Copernicus / Open-Meteo DEM)
 *   GET /api/weather          -> services/weather_integration.py (Open-Meteo)
 *   GET /api/shelter-terrain  -> services/shelter_service.py terrain_profile()
 *   GET /api/stations         -> curated high-altitude station registry (climate records)
 *
 * A field that no endpoint could fill is returned as `origin: 'unavailable'`
 * with a null value. It is never substituted with a plausible number.
 */
import {
  AnalyzedField,
  ClimateSummary,
  DefenseStation,
  FieldOrigin,
  LocationAnalysis,
  ShelterTerrain,
  SimulationResult,
} from '../types';
import { fetchElevation } from './elevationApi';
import { fetchLiveWeather } from './weatherApi';
import { fetchShelterTerrain } from './shelterApi';
import { fetchDefenseStations, fetchDesignTemplate } from './api';
import type { SiteDesignTemplate } from '../types';

const STATION_CACHE_TTL_MS = 30 * 60_000;
let stationCache: { stations: DefenseStation[]; at: number } | null = null;

async function loadStations(): Promise<DefenseStation[]> {
  if (stationCache && Date.now() - stationCache.at < STATION_CACHE_TTL_MS) {
    return stationCache.stations;
  }
  const stations = await fetchDefenseStations();
  stationCache = { stations, at: Date.now() };
  return stations;
}

/** Great-circle distance in metres, WGS84 sphere. */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Stations further than this are not treated as representative of the site. */
const CLIMATE_MATCH_RADIUS_KM = 60;

function numField(
  value: unknown,
  origin: FieldOrigin,
  source: string,
  unit?: string
): AnalyzedField<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { value: null, origin: 'unavailable', source, unit };
  }
  return { value, origin, source, unit };
}

function strField(
  value: unknown,
  origin: FieldOrigin,
  source: string
): AnalyzedField<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return { value: null, origin: 'unavailable', source };
  }
  return { value, origin, source };
}

/**
 * Nearest curated station climate record, and only when it is genuinely
 * representative. Beyond the radius the field reports `unavailable` rather
 * than borrowing a label from a station hundreds of kilometres away.
 */
function resolveClimate(
  lat: number,
  lng: number,
  stations: DefenseStation[]
): ClimateSummary {
  let best: { st: DefenseStation; distKm: number } | null = null;
  for (const st of stations) {
    const d = haversineM(lat, lng, st.lat, st.lng) / 1000;
    if (!best || d < best.distKm) best = { st, distKm: d };
  }
  if (!best || best.distKm > CLIMATE_MATCH_RADIUS_KM || !best.st.climate_type) {
    return {
      label: null,
      station_name: best ? best.st.name : null,
      distance_km: best ? Math.round(best.distKm * 10) / 10 : null,
      origin: 'unavailable',
      source: 'GET /api/stations — no curated climate record within range',
    };
  }
  return {
    label: best.st.climate_type,
    station_name: best.st.name,
    distance_km: Math.round(best.distKm * 10) / 10,
    origin: 'derived',
    source: `GET /api/stations — nearest record: ${best.st.name}`,
  };
}

/** Pick the hourly solar radiation sample matching the current hour, else peak. */
function pickSolarWattage(
  hourly: Array<{ hour?: number; solar_radiation_w_m2?: number | null }>,
  currentTime: string | null
): { value: number | null; source: string } {
  const usable = hourly.filter((h) => typeof h.solar_radiation_w_m2 === 'number');
  if (usable.length === 0) return { value: null, source: 'GET /api/weather — no hourly radiation series' };
  if (currentTime && currentTime.includes('T')) {
    const hour = Number(currentTime.split('T')[1].split(':')[0]);
    const exact = usable.find((h) => h.hour === hour);
    if (exact && typeof exact.solar_radiation_w_m2 === 'number') {
      return {
        value: exact.solar_radiation_w_m2,
        source: 'GET /api/weather — hourly shortwave radiation at observation hour',
      };
    }
  }
  const peak = usable.reduce((a, b) =>
    (b.solar_radiation_w_m2 ?? -1) > (a.solar_radiation_w_m2 ?? -1) ? b : a
  );
  return {
    value: peak.solar_radiation_w_m2 ?? null,
    source: 'GET /api/weather — peak of hourly shortwave radiation series',
  };
}

function summariseTerrain(terrain: ShelterTerrain): LocationAnalysis['terrain'] {
  return {
    min_elevation_m: terrain.min_elevation_m,
    max_elevation_m: terrain.max_elevation_m,
    relief_m: Math.round((terrain.max_elevation_m - terrain.min_elevation_m) * 10) / 10,
    total_samples: terrain.samples * terrain.samples,
    span_m: terrain.span_m,
    origin: terrain.is_simulated ? 'simulated' : 'live',
    source: terrain.is_simulated
      ? 'GET /api/shelter-terrain — DEM grid partially filled (is_simulated)'
      : 'GET /api/shelter-terrain — full DEM grid',
  };
}

export interface AnalyzeLocationInput {
  latitude: number;
  longitude: number;
  name: string;
  /** DEM grid half-extent in metres. Defaults to the shelter plot size. */
  terrainSpanM?: number;
  terrainSamples?: number;
}

/**
 * Assemble the full LOCATION ANALYSIS readout for a point.
 *
 * Each sub-request is independent: a failure in one (for example, the terrain
 * sampler timing out) degrades only its own fields.
 */
export async function analyzeLocation(input: AnalyzeLocationInput): Promise<LocationAnalysis> {
  const { latitude, longitude, name } = input;
  const spanM = input.terrainSpanM ?? 200;
  const samples = input.terrainSamples ?? 5;

  const [elevationRes, weatherRes, terrainRes, stationsRes] = await Promise.allSettled([
    fetchElevation(latitude, longitude),
    fetchLiveWeather(latitude, longitude, 1),
    fetchShelterTerrain(latitude, longitude, spanM, samples),
    loadStations(),
  ]);

  // --- Elevation ------------------------------------------------------------
  const elevation: AnalyzedField<number> =
    elevationRes.status === 'fulfilled' && elevationRes.value.elevation !== null
      ? {
          value: elevationRes.value.elevation,
          origin: elevationRes.value.source === 'unavailable' ? 'simulated' : 'live',
          source: `GET /api/elevation — ${elevationRes.value.source}`,
          unit: 'm ASL',
        }
      : { value: null, origin: 'unavailable', source: 'GET /api/elevation — unavailable' };

  // --- Weather --------------------------------------------------------------
  const wx = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const current = wx?.current;
  // services/weather_integration.py only sets status="online" for a real
  // Open-Meteo response; it raises instead of substituting synthetic numbers.
  const live = wx?.status === 'online';
  const wxOrigin: FieldOrigin = live ? 'live' : wx ? 'derived' : 'unavailable';
  const wxSource = wx
    ? `GET /api/weather — ${wx.source ?? 'Open-Meteo'}${wx.cached ? ' (cached)' : ''}`
    : 'GET /api/weather — unavailable';
  const solar = pickSolarWattage(wx?.hourly ?? [], current?.time ?? null);

  const stations = stationsRes.status === 'fulfilled' ? stationsRes.value : [];
  const climate = resolveClimate(latitude, longitude, stations);

  return {
    latitude,
    longitude,
    name,
    elevation,
    temperature: numField(current?.temperature_c, wxOrigin, wxSource, '°C'),
    apparent_temperature: numField(current?.apparent_temperature_c, wxOrigin, wxSource, '°C'),
    humidity: numField(current?.relative_humidity_pct, wxOrigin, wxSource, '%'),
    wind_speed_mps: numField(current?.wind_speed_mps, wxOrigin, wxSource, 'm/s'),
    wind_gusts_mps: numField(current?.wind_gusts_mps, wxOrigin, wxSource, 'm/s'),
    wind_direction_deg: numField(current?.wind_direction_deg, wxOrigin, wxSource, '°'),
    precipitation_mm: numField(current?.precipitation_mm, wxOrigin, wxSource, 'mm'),
    snowfall_cm: numField(current?.snowfall_cm, wxOrigin, wxSource, 'cm'),
    cloud_cover_pct: numField(current?.cloud_cover_pct, wxOrigin, wxSource, '%'),
    pressure_hpa: numField(current?.surface_pressure_hpa, wxOrigin, wxSource, 'hPa'),
    solar_radiation_w_m2: numField(
      solar.value,
      live ? 'live' : wx ? 'derived' : 'unavailable',
      solar.source,
      'W/m²'
    ),
    condition: strField(current?.condition ?? current?.weather_description, wxOrigin, wxSource),
    terrain: terrainRes.status === 'fulfilled' ? summariseTerrain(terrainRes.value) : null,
    climate,
    observed_at: current?.time ?? null,
    analysed_at: new Date().toISOString(),
    is_simulated: !live || elevation.origin === 'simulated' || climate.origin === 'simulated',
  };
}

/**
 * Location-driven shelter configuration.
 *
 * The structural recommendation is the project's existing
 * GET /api/design-template, whose altitude branch thresholds live in the
 * backend rules engine — this module only reports which variant came back.
 * The thermal figures come from the /api/simulate run the app already keeps in
 * memory for this exact latitude and elevation, so no new model is introduced
 * and no second simulation is launched.
 */
export async function fetchRecommendedConfiguration(params: {
  latitude: number;
  elevation_m: number;
  troops: number;
  simResult: SimulationResult | null;
  assets: { solar_capacity_kw: number | null; battery_capacity_kwh: number | null; fuel_capacity_l: number | null };
  ambient_temp_c: number | null;
  wind_speed_mps: number | null;
  solar_w_m2: number | null;
  /** Siting rating from the transparent rules engine in suitabilityService. */
  suitability: import('../types').SuitabilityRating;
}): Promise<import('../types').RecommendedConfiguration> {
  // The design template is a separate failure domain: if the rules engine is
  // unreachable the thermal/fuel figures from the simulation stay useful.
  let template: SiteDesignTemplate | null = null;
  if (params.elevation_m > 0) {
    try {
      template = (await fetchDesignTemplate(params.latitude, params.elevation_m, params.troops)) as SiteDesignTemplate;
    } catch {
      template = null;
    }
  }

  const sim = params.simResult;
  const summary = sim?.summary;
  const peakDeficit = sim?.hourly_timeseries?.length
    ? Math.max(...sim.hourly_timeseries.map((h) => h.auxiliary_heating_deficit_w ?? 0))
    : null;

  return {
    inputs: {
      latitude: params.latitude,
      elevation_m: params.elevation_m,
      troops: params.troops,
      ambient_temp_c: params.ambient_temp_c,
      wind_speed_mps: params.wind_speed_mps,
      solar_w_m2: params.solar_w_m2,
    },
    template,
    thermal: {
      roof_u: sim?.u_values.roof.u_value ?? null,
      wall_u: sim?.u_values.walls.u_value ?? null,
      floor_u: sim?.u_values.floor.u_value ?? null,
      glazing_u: sim?.u_values.glazing.u_value ?? null,
      glazing_shgc: sim?.u_values.glazing.shgc ?? null,
      incident_solar_w_m2: params.solar_w_m2,
      peak_heating_deficit_w: peakDeficit,
    },
    assets: params.assets,
    fuel: {
      daily_liters: summary?.daily_fuel_liters ?? null,
      campaign_liters: summary?.campaign_fuel_liters ?? null,
      campaign_barrels_200l: summary?.campaign_fuel_barrels_200l ?? null,
      saving_pct: summary?.fuel_saving_percentage ?? null,
    },
    // Altitude variant / capacity wording is reported exactly as the backend
    // rules engine chose it. The client never re-derives the band thresholds.
    model_variant: template?.model ?? null,
    capacity_designation: template?.capacity ?? null,
    suitability: params.suitability,
    analysed_at: new Date().toISOString(),
  };
}
