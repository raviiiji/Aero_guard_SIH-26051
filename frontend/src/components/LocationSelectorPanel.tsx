import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  Crosshair,
  Loader2,
  X,
  Navigation,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { DefenseStation, LocationSearchResult } from '../types';
import { searchLocationsApi } from '../services/locationApi';

interface LocationSelectorPanelProps {
  /** Currently staged location. The map and the twin both follow this. */
  latitude: number;
  longitude: number;
  name: string;
  stations: DefenseStation[];
  /** True once the analysis for the staged location has completed. */
  analysed: boolean;
  busy?: boolean;
  onStageLocation: (lat: number, lng: number, name: string, elevation?: number) => void;
  onAnalyze: () => void;
  /** Scrolls the map viewport into view so the user can click a point. */
  onPickOnMap: () => void;
}

function formatCoord(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

export const LocationSelectorPanel: React.FC<LocationSelectorPanelProps> = ({
  latitude,
  longitude,
  name,
  stations,
  analysed,
  busy = false,
  onStageLocation,
  onAnalyze,
  onPickOnMap,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [latInput, setLatInput] = useState(latitude.toFixed(4));
  const [lngInput, setLngInput] = useState(longitude.toFixed(4));
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the manual inputs aligned with an externally staged location.
  useEffect(() => {
    setLatInput(latitude.toFixed(4));
    setLngInput(longitude.toFixed(4));
  }, [latitude, longitude]);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  // Debounced Open-Meteo geocoding through the existing /api/location/search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchLocationsApi(q, 8)
        .then((res) => {
          setResults(res);
          setShowResults(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selectResult = useCallback(
    (item: LocationSearchResult) => {
      setShowResults(false);
      setQuery('');
      setResults([]);
      onStageLocation(item.latitude, item.longitude, item.name, item.elevation);
    },
    [onStageLocation]
  );

  /** Manual coordinate entry is validated before it is staged. */
  const applyManual = useCallback(() => {
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGeoError('Latitude and longitude must be numbers.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGeoError('Latitude must be within ±90 and longitude within ±180.');
      return;
    }
    setGeoError(null);
    // Elevation is intentionally omitted so the backend resolves the real DEM
    // value rather than trusting a client-supplied number.
    onStageLocation(lat, lng, `${formatCoord(lat, 'N', 'S')}, ${formatCoord(lng, 'E', 'W')}`);
  }, [latInput, lngInput, onStageLocation]);

  /** Browser geolocation. Permission denial is surfaced, never faked. */
  const useMyLocation = useCallback(() => {
    setGeoError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('This browser does not expose a geolocation API.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onStageLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          `My location (${pos.coords.accuracy.toFixed(0)} m accuracy)`
        );
      },
      (err) => {
        setLocating(false);
        setGeoError(`Geolocation unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, [onStageLocation]);

  return (
    <div ref={rootRef} className="space-y-2.5 font-mono">
      {/* Staged selection summary */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30">
        <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-100 truncate">{name}</div>
          <div className="text-[11px] text-cyan-300 mt-0.5">
            {formatCoord(latitude, 'N', 'S')} &nbsp;|&nbsp; {formatCoord(longitude, 'E', 'W')}
          </div>
        </div>
        {analysed && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/50 text-emerald-300 text-[9px] font-bold flex-shrink-0">
            <Check className="w-2.5 h-2.5" /> ANALYSED
          </span>
        )}
      </div>

      {/* Search by name */}
      <div className="relative">
        <div className="flex items-center bg-slate-900 border border-slate-700 focus-within:border-cyan-500 rounded-lg px-2.5 py-1.5 transition-colors">
          <Search className="w-3.5 h-3.5 text-cyan-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setGeoError(null);
            }}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showResults && results.length > 0) {
                selectResult(results[0]);
              }
            }}
            placeholder="Search a place — e.g. Leh, New Delhi, Siachen"
            aria-label="Search for a location by name"
            className="w-full bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none text-[11px]"
          />
          {searching && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin flex-shrink-0" />}
          {query && !searching && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              aria-label="Clear search"
              className="text-slate-500 hover:text-slate-200 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b1329] border border-cyan-500/40 rounded-lg shadow-2xl overflow-hidden z-50 max-h-56 overflow-y-auto">
            {results.map((item) => (
              <button
                key={item.id}
                onClick={() => selectResult(item)}
                className="w-full text-left px-3 py-2 hover:bg-cyan-950/60 border-b border-slate-800/60 last:border-b-0 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-100 truncate flex items-center gap-1.5">
                    {item.name}
                    {item.is_defense_station && (
                      <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-600/50 flex-shrink-0">
                        MIL BASE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {[item.region, item.country].filter(Boolean).join(', ')}
                  </div>
                </div>
                <div className="text-[10px] text-cyan-400 flex-shrink-0">
                  {item.elevation > 0 ? `${Math.round(item.elevation)} m` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual coordinates */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Latitude</span>
          <input
            type="number"
            step="0.0001"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyManual()}
            aria-label="Latitude in decimal degrees"
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Longitude</span>
          <input
            type="number"
            step="0.0001"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyManual()}
            aria-label="Longitude in decimal degrees"
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 focus:outline-none"
          />
        </label>
      </div>

      {/* Curated stations */}
      {stations.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const st = stations.find((s) => s.id === e.target.value);
            if (st) {
              setGeoError(null);
              onStageLocation(st.lat, st.lng, st.name, st.elevation_m);
            }
          }}
          aria-label="Curated high-altitude stations"
          className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none"
        >
          <option value="">Curated high-altitude stations…</option>
          {stations.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} — {Math.round(st.elevation_m)} m
            </option>
          ))}
        </select>
      )}

      {geoError && (
        <div className="flex items-start gap-1.5 text-[10px] text-red-300 leading-tight">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
          {geoError}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={applyManual}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 text-[10px] font-bold transition-colors"
          title="Stage the coordinates typed above"
        >
          USE COORDINATES
        </button>
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 text-[10px] font-bold transition-colors disabled:opacity-50"
          title="Request the browser's geolocation permission"
        >
          {locating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Crosshair className="w-3 h-3" />
          )}
          USE MY LOCATION
        </button>
      </div>
      <button
        onClick={onPickOnMap}
        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 text-[10px] font-bold transition-colors"
        title="Scroll to the live map and click a point on it"
      >
        <Navigation className="w-3 h-3" /> SELECT ON MAP
      </button>

      <button
        onClick={onAnalyze}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-cyan-500/60 bg-cyan-950/70 text-cyan-200 hover:bg-cyan-900 text-[11px] font-bold tracking-wide transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {analysed ? 'RE-ANALYZE LOCATION' : 'ANALYZE LOCATION'}
      </button>
    </div>
  );
};
