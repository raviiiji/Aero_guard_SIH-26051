import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { DefenseStation, WeatherResponse, AircraftContact } from '../types';
import {
  ThermometerSnowflake,
  Sun,
  Wind,
  Mountain,
  Compass,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { fetchAirspaceTraffic } from '../services/aircraftApi';
import { MapCameraReporter, MapCameraState } from '../hooks/useMapGeoSync';

// Custom icons using HTML DivIcons
const tacticalPinIcon = new L.DivIcon({
  className: 'custom-military-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #06b6d4 0%, #1e3a8a 100%);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 14px #06b6d4;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    ">
      <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const stationIcon = new L.DivIcon({
  className: 'custom-station-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #f59e0b 0%, #78350f 100%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #fef08a;
      box-shadow: 0 0 10px #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 5px; height: 5px; background: #ffffff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const activeStationIcon = new L.DivIcon({
  className: 'custom-station-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #fbbf24 0%, #78350f 100%);
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 16px #fbbf24;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 7px; height: 7px; background: #ffffff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const uavIcon = new L.DivIcon({
  className: 'custom-uav-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #10b981 0%, #064e3b 100%);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #a7f3d0;
      box-shadow: 0 0 12px #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 8px; height: 8px; background: #ffffff; clip-path: polygon(50% 0%, 0% 100%, 100% 100%);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const aircraftIcon = new L.DivIcon({
  className: 'custom-aircraft-pin',
  html: `
    <div style="
      background: rgba(30, 58, 138, 0.85);
      border: 1px solid #60a5fa;
      border-radius: 4px;
      padding: 2px 4px;
      box-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
      font-size: 9px;
      font-family: monospace;
      color: #93c5fd;
      display: flex;
      align-items: center;
      gap: 2px;
    ">
      ✈
    </div>
  `,
  iconSize: [20, 16],
  iconAnchor: [10, 8],
});

interface MapClickHandlerProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ChangeMapView: React.FC<{ coords: [number, number]; zoom?: number; resetKey?: number }> = ({
  coords,
  zoom,
  resetKey,
}) => {
  const map = useMap();
  // Depend on the scalars, not the array identity: `position` is a fresh array
  // on every render, and calling setView re-fires map move/zoom events, which
  // would otherwise loop the camera synchronisation.
  const lat = coords[0];
  const lng = coords[1];
  // Bumping resetKey forces a re-centre even when lat/lng/zoom are unchanged,
  // which is what the RESET VIEW control needs after the user has panned away.
  const forced = resetKey !== undefined && resetKey > 0;
  useEffect(() => {
    const targetZoom = zoom ?? map.getZoom();
    const center = map.getCenter();
    const moved =
      Math.abs(center.lat - lat) > 1e-9 || Math.abs(center.lng - lng) > 1e-9;
    const zoomed = Math.abs(map.getZoom() - targetZoom) > 1e-9;
    if (moved || zoomed || forced) map.setView([lat, lng], targetZoom);
  }, [lat, lng, zoom, map, resetKey, forced]);
  return null;
};

/**
 * Leaflet caches its pane size at creation. This component is mounted and
 * unmounted by the digital-twin tab switch, and a collapsed ancestor can leave
 * it with a zero-height box, so the size has to be re-measured once the
 * container is genuinely visible or the tile pane renders blank.
 */
const MapSizeWatcher: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    const fix = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) map.invalidateSize({ animate: false });
    };
    const raf = window.requestAnimationFrame(fix);
    const timer = window.setTimeout(fix, 200);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fix);
      ro.observe(el);
    }
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      ro?.disconnect();
    };
  }, [map]);

  return null;
};

interface GeospatialMapProps {
  latitude: number;
  longitude: number;
  elevation: number;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  weatherData: WeatherResponse | null;
  onLocationSelect: (lat: number, lng: number) => void;
  /**
   * When provided, the map republishes its camera (centre, zoom, bearing,
   * pitch, viewport) so the 3D shelter can be driven from the same
   * projection the tiles use. Purely observational: the map is unchanged.
   */
  onCameraChange?: (state: MapCameraState) => void;
  /** DEM elevation used as the 3D scene's vertical datum. */
  cameraCenterElevation?: number;
  /** Tilt for the synced 3D view. 0 = straight down (pixel-exact overlay). */
  cameraPitchDeg?: number;
  /** Externally controlled zoom, so the map can be flown to a selection. */
  zoom?: number;
  /**
   * Increment to force the map back onto the supplied centre and zoom. Used by
   * the RESET VIEW control; defaults to undefined, which changes nothing.
   */
  viewResetKey?: number;
}

export const GeospatialMap: React.FC<GeospatialMapProps> = ({
  latitude,
  longitude,
  elevation,
  currentStation,
  stations,
  weatherData,
  onLocationSelect,
  onCameraChange,
  cameraCenterElevation = 0,
  cameraPitchDeg,
  zoom: zoomProp,
  viewResetKey,
}) => {
  const position: [number, number] = [latitude, longitude];

  // MapTiler Configuration & Layer Selection
  const maptilerKey = (import.meta.env.VITE_MAPTILER_API_KEY as string) || '';
  // Basemap mode for the 3D view.
  //
  // Defaults to satellite imagery on purpose. The 3D shelter is framed at a
  // building-scale zoom, where the vector basemaps have no data at all over
  // remote high-altitude terrain: at z18 the Esri topographic and street layers
  // return a single flat colour for the whole viewport, which looks exactly
  // like a broken/placeholder map. Imagery has coverage at every zoom and gives
  // the shelter real terrain context. Streets and terrain remain selectable.
  const [mapMode, setMapMode] = useState<'streets' | 'satellite' | 'terrain'>('satellite');
  const [showAirspace, setShowAirspace] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);

  // Live Aircraft Traffic from OpenSky.
  //
  // Polling is keyed on a QUANTISED position, not the raw coordinates. Keying on
  // the raw values meant every map click — a single pan-click on the tactical map
  // — fired a fresh network request to an external service, which both throttles
  // the endpoint and makes the marker count flicker. A ~25 km grid is well below
  // the resolution at which regional airspace traffic is meaningful here.
  const [aircraft, setAircraft] = useState<AircraftContact[]>([]);
  const [loadingAirspace, setLoadingAirspace] = useState(false);
  const airspaceKey = `${Math.round(latitude / 0.25)}:${Math.round(longitude / 0.25)}`;

  useEffect(() => {
    let isMounted = true;
    let cancelled = false;
    setLoadingAirspace(true);
    fetchAirspaceTraffic(latitude, longitude, 80)
      .then((data) => {
        if (isMounted) setAircraft(data.aircraft || []);
      })
      .catch((err) => console.warn('Airspace poll warning:', err))
      .finally(() => {
        if (!cancelled && isMounted) setLoadingAirspace(false);
      });

    return () => {
      cancelled = true;
      isMounted = false;
    };
    // `airspaceKey` is derived from latitude/longitude; depending on the raw
    // values would re-poll on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airspaceKey]);

  // Determine Tile URLs (MapTiler with robust fallbacks)
  const getTileConfig = () => {
    if (maptilerKey && maptilerKey.trim().length > 5) {
      if (mapMode === 'satellite') {
        return {
          url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${maptilerKey}`,
          attr: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OpenStreetMap',
          sourceLabel: 'MapTiler Satellite',
        };
      }
      if (mapMode === 'terrain') {
        return {
          url: `https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
          attr: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OpenStreetMap',
          sourceLabel: 'MapTiler Topo/Terrain',
        };
      }
      return {
        url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
        attr: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; OpenStreetMap',
        sourceLabel: 'MapTiler Streets',
      };
    }

    // Keyless open-data fallbacks.
    //
    // These must never require a credential, and they must not return a
    // placeholder image. Both were verified by fetching tiles for widely
    // separated coordinates and confirming the responses differ:
    //   - CARTO's public `rastertiles` endpoint (the previous default) now
    //     answers every request with an "API KEY REQUIRED" placeholder.
    //   - `tile.openstreetmap.org` returns a byte-identical blocked placeholder
    //     once rate-limited, which blanks the tactical map.
    // Esri's ArcGIS Online basemaps and OpenTopoMap serve real tiles with no key.
    if (mapMode === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: 'Imagery &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics',
        sourceLabel: 'Esri World Imagery',
      };
    }
    if (mapMode === 'terrain') {
      return {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
        sourceLabel: 'OpenTopoMap (Terrain)',
      };
    }
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attr: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
      sourceLabel: 'Esri World Topographic',
    };
  };

  const tileConfig = getTileConfig();

  // Synthetic Mission Route waypoints (Launch base -> Waypoint 1 -> Target Zone)
  const missionRoute: [number, number][] = [
    [latitude - 0.12, longitude - 0.14],
    [latitude - 0.05, longitude - 0.06],
    [latitude, longitude],
  ];

  return (
    <div className="tactical-card p-3.5 flex flex-col h-full bg-[#0b1329] border border-cyan-950/60 rounded-xl">
      {/* Card Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Geospatial Tactical Map & Airspace Radar
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-mono">
            {tileConfig.sourceLabel}
          </span>
        </div>

        {/* Map Layer Mode & Overlay Toggles */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <div className="inline-flex rounded-lg bg-slate-900/90 border border-slate-800 p-0.5">
            <button
              onClick={() => setMapMode('streets')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                mapMode === 'streets'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Streets
            </button>
            <button
              onClick={() => setMapMode('satellite')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                mapMode === 'satellite'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapMode('terrain')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                mapMode === 'terrain'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Terrain
            </button>
          </div>

          <button
            onClick={() => setShowAirspace(!showAirspace)}
            className={`px-2 py-1 rounded border text-[10px] flex items-center gap-1 ${
              showAirspace
                ? 'bg-blue-950/70 border-blue-500/80 text-blue-300'
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}
            title="Toggle Live OpenSky Airspace Traffic"
          >
            <Radio className={`w-3 h-3 ${loadingAirspace ? 'animate-pulse' : ''}`} />
            <span>Radar ({aircraft.length})</span>
          </button>

          <button
            onClick={() => setShowRiskZones(!showRiskZones)}
            className={`px-2 py-1 rounded border text-[10px] flex items-center gap-1 ${
              showRiskZones
                ? 'bg-red-950/70 border-red-500/80 text-red-300'
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}
            title="Toggle Katabatic Wind & Thermal Risk Zones"
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Hazards</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-slate-800/80 h-72 md:h-80 w-full">
        <MapContainer
          center={position}
          zoom={zoomProp ?? 8}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          {/* maxNativeZoom stops Leaflet requesting tiles a provider cannot
              serve (OpenTopoMap stops at z17); without it the layer over-zooms
              into a uniform blank instead of gracefully staying put. */}
          <TileLayer
            attribution={tileConfig.attr}
            url={tileConfig.url}
            maxNativeZoom={19}
            maxZoom={19}
          />

          <ChangeMapView coords={position} zoom={zoomProp} resetKey={viewResetKey} />
          <MapSizeWatcher />
          <MapClickHandler onLocationSelect={onLocationSelect} />
          {onCameraChange && (
            <MapCameraReporter
              centerElevation={cameraCenterElevation}
              pitchDeg={cameraPitchDeg ?? 55}
              onCameraChange={onCameraChange}
            />
          )}

          {/* Mission Flight Path Route */}
          <Polyline
            positions={missionRoute}
            color="#22d3ee"
            weight={2.5}
            dashArray="6, 8"
          />

          {/* Risk Zones (Sub-zero freeze boundary & Katabatic wind corridor) */}
          {showRiskZones && (
            <>
              <Circle
                center={position}
                radius={8500}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '4, 6',
                }}
              >
                <Popup>
                  <div className="font-mono text-[11px] text-slate-200">
                    <strong className="text-red-400">Extreme Freeze Perimeter</strong>
                    <div>Sub-zero freeze threshold requiring auxiliary fuel reserve.</div>
                  </div>
                </Popup>
              </Circle>
              <Circle
                center={[latitude + 0.04, longitude + 0.05]}
                radius={5000}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.1,
                  weight: 1.2,
                }}
              >
                <Popup>
                  <div className="font-mono text-[11px] text-slate-200">
                    <strong className="text-amber-400">Katabatic Wind Corridor</strong>
                    <div>High infiltration air change pressure (&gt;12 m/s gusts).</div>
                  </div>
                </Popup>
              </Circle>
            </>
          )}

          {/* Preset Military Stations. The active one is drawn larger so the
              current site is distinguishable from the rest of the registry. */}
          {stations.map((st) => {
            const active = currentStation?.id === st.id;
            return (
              <Marker
                key={st.id}
                position={[st.lat, st.lng]}
                icon={active ? activeStationIcon : stationIcon}
                zIndexOffset={active ? 300 : 0}
                eventHandlers={{
                  click: () => onLocationSelect(st.lat, st.lng),
                }}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-100">
                    <div className="font-bold text-amber-400">
                      {st.name}
                      {active && <span className="ml-1 text-[9px] text-cyan-300">ACTIVE</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">{st.region}</div>
                    <div className="mt-1 text-[11px]">
                      Alt: <strong className="text-cyan-400">{st.elevation_m}m</strong> | Min T:{' '}
                      <strong className="text-blue-400">{st.winter_temp_min}°C</strong>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">{st.description}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Current Selected Tactical Deployment Site Pin */}
          <Marker position={position} icon={tacticalPinIcon}>
            <Popup>
              <div className="p-1 font-mono text-xs text-slate-100">
                <div className="font-bold text-cyan-400">Active Deployment Site</div>
                <div>Lat: {latitude.toFixed(3)}°N, Lng: {longitude.toFixed(3)}°E</div>
                <div>Ground Elevation: {elevation} m ASL</div>
              </div>
            </Popup>
          </Marker>

          {/* Live Aircraft & UAV Contacts (OpenSky Network) */}
          {showAirspace &&
            aircraft.map((ac, idx) => (
              <Marker
                key={`${ac.icao24}_${idx}`}
                position={[ac.latitude, ac.longitude]}
                icon={ac.is_uav ? uavIcon : aircraftIcon}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-100">
                    <div className={`font-bold ${ac.is_uav ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {ac.is_uav ? '🛡️ ' : '✈️ '} {ac.callsign} ({ac.icao24})
                    </div>
                    <div className="text-[10px] text-slate-400">{ac.origin_country}</div>
                    <div className="mt-1 text-[11px]">
                      Altitude: <strong className="text-cyan-300">{ac.altitude_m}m</strong> | Spd:{' '}
                      <strong>{ac.velocity_kmh} km/h</strong>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Heading: {ac.heading_deg}° | Type: {ac.aircraft_type}
                    </div>
                    {ac.sensor_payload && (
                      <div className="mt-1 text-[10px] text-emerald-300 border-t border-slate-700 pt-1">
                        Payload: {ac.sensor_payload}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Floating Telemetry Badge on Map */}
        <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[11px] flex items-center gap-3">
          <div className="flex items-center gap-1 text-cyan-400">
            <Mountain className="w-3.5 h-3.5" />
            <span>{elevation}m ASL</span>
          </div>
          <div className="flex items-center gap-1 text-slate-300 border-l border-slate-700 pl-2">
            <span>{latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E</span>
          </div>
          {showAirspace && (
            <div className="flex items-center gap-1 text-emerald-400 border-l border-slate-700 pl-2">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{aircraft.length} Contacts</span>
            </div>
          )}
        </div>
      </div>

      {/* Meteorological Summary Grid */}
      {weatherData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 font-mono">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2 flex items-center gap-2">
            <ThermometerSnowflake className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">90d Min Temp</div>
              <div className="text-xs font-bold text-blue-400">
                {weatherData.metrics_90day.extreme_min_temp_c}°C
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Avg Solar Yield</div>
              <div className="text-xs font-bold text-amber-400">
                {weatherData.metrics_90day.avg_daily_solar_kwh_m2}{' '}
                <span className="text-[10px]">kWh/m²/d</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2 flex items-center gap-2">
            <Wind className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Peak Wind Gust</div>
              <div className="text-xs font-bold text-slate-200">
                {weatherData.metrics_90day.avg_peak_wind_mps} m/s
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2 flex items-center gap-2">
            <Mountain className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Seasonal Solar</div>
              <div className="text-xs font-bold text-emerald-400">
                {weatherData.metrics_90day.total_seasonal_solar_kwh_m2}{' '}
                <span className="text-[10px]">kWh/m²</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
