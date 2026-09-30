import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocationAnalysis, RecommendedConfiguration, SimulationResult } from '../types';
import {
  analyzeLocation,
  fetchRecommendedConfiguration,
} from '../services/locationAnalysisApi';
import { assessSuitability } from '../services/suitabilityService';

/** Cadence for the environment block of the analysis panel. */
const REFRESH_MS = 60_000;

/**
 * Quiet period before an automatic analysis runs.
 *
 * Selecting a point on the map stages a new coordinate on every click, and each
 * analysis spends four external requests (DEM, weather, terrain grid, stations).
 * Without a debounce, dragging around the map would queue a request per click.
 * The explicit ANALYZE LOCATION button bypasses this and runs immediately.
 */
const AUTO_ANALYSE_DEBOUNCE_MS = 600;

export interface AnalysisAssetRatings {
  solar_capacity_kw: number | null;
  battery_capacity_kwh: number | null;
  fuel_capacity_l: number | null;
}

export interface UseLocationAnalysisArgs {
  latitude: number;
  longitude: number;
  name: string;
  /** True once the user (or the initial load) has committed to this location. */
  enabled: boolean;
  troops: number;
  simResult: SimulationResult | null;
  /** Fixed ratings declared by the deployed twin; null until it is deployed. */
  assets: AnalysisAssetRatings;
}

/**
 * Owns the ANALYZE LOCATION step of the flow.
 *
 * Nothing here fabricates data: `analyzeLocation` composes the project's
 * existing endpoints and marks anything it could not fill as unavailable. The
 * hook only sequences the calls and refreshes them on a timer.
 */
export function useLocationAnalysis({
  latitude,
  longitude,
  name,
  enabled,
  troops,
  simResult,
  assets,
}: UseLocationAnalysisArgs) {
  const [analysis, setAnalysis] = useState<LocationAnalysis | null>(null);
  const [config, setConfig] = useState<RecommendedConfiguration | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const run = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setAnalysing(true);
    setError(null);
    try {
      const next = await analyzeLocation({ latitude, longitude, name });
      if (!aliveRef.current) return;
      setAnalysis(next);
    } catch (e) {
      if (aliveRef.current) {
        setError(e instanceof Error ? e.message : 'Location analysis failed');
      }
    } finally {
      inFlightRef.current = false;
      if (aliveRef.current) setAnalysing(false);
    }
  }, [enabled, latitude, longitude, name]);

  /**
   * Immediate analysis for the explicit ANALYZE LOCATION button: cancels any
   * pending debounce so the two paths can never race each other.
   */
  const runNow = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    return run();
  }, [run]);

  // Analyse whenever the staged location settles, then keep the environment
  // block fresh on a slow timer so the readout stays honest without polling
  // the external APIs hard.
  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const settle = window.setTimeout(() => {
      debounceRef.current = null;
      void run();
    }, AUTO_ANALYSE_DEBOUNCE_MS);

    return () => window.clearTimeout(settle);
  }, [enabled, run]);

  // Separate slow timer: refreshes the environment for the location already
  // under analysis without being reset by every coordinate change.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void run(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, run]);

  // The recommended configuration needs the analysed elevation first, then the
  // simulation result for the same coordinate.
  useEffect(() => {
    if (!analysis || analysis.elevation.value === null || !Number.isFinite(analysis.elevation.value)) {
      return;
    }
    let cancelled = false;
    setConfigLoading(true);
    // The siting rating is derived from the same analysis, so it is always
    // available by the time the configuration is requested.
    const suitability = assessSuitability(analysis);
    fetchRecommendedConfiguration({
      latitude: analysis.latitude,
      elevation_m: analysis.elevation.value,
      troops,
      simResult,
      assets,
      ambient_temp_c: analysis.temperature.value,
      wind_speed_mps: analysis.wind_speed_mps.value,
      solar_w_m2: analysis.solar_radiation_w_m2.value,
      suitability,
    })
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `assets` is memoised by the caller, so its identity only changes when a
    // rating actually changes.
  }, [analysis, troops, simResult, assets]);

  /** True when the displayed analysis matches the staged coordinates. */
  const isCurrent =
    analysis !== null &&
    Math.abs(analysis.latitude - latitude) < 1e-4 &&
    Math.abs(analysis.longitude - longitude) < 1e-4;

  // Pure derivation from the analysis, so it is recomputed during render rather
  // than pushed through an effect.
  const suitability = useMemo(
    () => (analysis ? assessSuitability(analysis) : null),
    [analysis]
  );

  return { analysis, config, analysing, configLoading, error, run: runNow, isCurrent, suitability };
}
