import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Crosshair,
  Locate,
  MapPin,
  Minus,
  Mountain,
  Plus,
  Radio,
  ShieldCheck,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { DefenseStation, SuitabilityRating } from '../types';

/**
 * Leaflet DivIcons for the three map roles. Each is a plain DOM node so the map
 * needs no image assets and no API keys, and every one keeps the project's cyan
 * tactical language.
 */

/** The shelter that actually exists in the backend right now. */
const shelterIcon = L.divIcon({
  className: 'aero-shelter-marker',
  html: `<div class="aero-shelter-glyph">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 2 3 6v6c0 5 3.8 8.9 9 10 5.2-1.1 9-5 9-10V6l-9-4z"
              fill="rgba(6,182,212,.22)" stroke="#22d3ee" stroke-width="1.6"/>
        <path d="M8 12.5 12 9l4 3.5V17H8v-4.5z" fill="#22d3ee"/>
      </svg>
    </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

/** A candidate destination that has NOT been committed to yet. */
const destinationIcon = L.divIcon({
  className: 'aero-destination-marker',
  html: `<div class="aero-destination-glyph">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" fill="rgba(251,191,36,.18)" stroke="#fbbf24"
                stroke-width="1.6" stroke-dasharray="3 2.5"/>
        <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" stroke="#fbbf24"
              stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="1.9" fill="#fde68a"/>
      </svg>
    </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

/** Curated reference points. */
const referenceIcon = L.divIcon({
  className: 'aero-reference-marker',
  html: `<div class="aero-reference-glyph"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

/**
 * Leaflet sizes its panes from the container at creation time. Because this
 * component is mounted and unmounted by the tab switch, and because a hidden
 * ancestor can collapse to zero height, the size has to be re-measured once the
 * container is genuinely visible. Without this the tile pane keeps stale
 * dimensions and renders blank.
 */
const ResizeWhenVisible: React.FC<{ active: boolean }> = ({ active }) => {
  const map = useMap();

  useEffect(() => {
    if (!active) return;
    const fix = () => {
      const el = map.getContainer();
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        map.invalidateSize({ animate: false });
        // Panels and sidebars can settle a frame after the transition starts.
        const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 180);
        return () => window.clearTimeout(id);
      }
      return undefined;
    };
    const raf = window.requestAnimationFrame(() => {
      fix();
    });
    return () => {
      window.cancelAnimationFrame(raf);
      map.off('resize', fix);
    };
  }, [map, active]);

  // A late container resize (window resize / breakpoint change) also needs a
  // re-measure; Leaflet's own ResizeObserver covers most of this, but the
  // observer is registered on the container so it survives tab switches.
  useEffect(() => {
    const el = map.getContainer();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  return null;
};

const ClickToSelect: React.FC<{ onSelect: (lat: number, lng: number) => void; enabled: boolean }> = ({
  onSelect,
  enabled,
}) => {
  useMapEvents({
    click(e) {
      if (enabled) onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export type LiveMapView = 'shelter' | 'destination';

export interface LiveMapProps {
  /** Coordinates the shelter occupies in the backend right now. */
  shelter: { latitude: number; longitude: number; elevation: number; name: string } | null;
  /** Coordinates staged by the user, which may differ from the shelter. */
  destination: { latitude: number; longitude: number; elevation: number };
  /** Shelter identity, for the marker popup. */
  shelterId: string | null;
  shelterStatus: string | null;
  /** True when destination differs from shelter by a meaningful distance. */
  hasPendingMove: boolean;
  stations: DefenseStation[];
  suitability: SuitabilityRating | null;
  onSelect: (lat: number, lng: number) => void;
  selectEnabled?: boolean;
  busy?: boolean;
  /** Zoom used when the map first mounts at a location. */
  initialZoom?: number;
  onViewChange?: (view: LiveMapView) => void;
}

const EARTH_RADIUS_M = 6371000;
const metresBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Shelter-scaled default zoom so the map never opens on a continent view, and
 * never so tight that the raster has no detail to show.
 *
 * The span is deliberately regional (tens of km), not the few hundred metres
 * around the shelter: at ~3 km across the viewport the basemap zooms past the
 * level where roads, contours and labels exist, so a valid provider response
 * renders as a featureless field that reads as a broken map.
 */
function zoomFor(latitude: number, targetSpanM: number, viewportPx = 640): number {
  const mPerPx = Math.max(0.3, targetSpanM / viewportPx);
  const z = Math.log2((156543.03392 * Math.cos((latitude * Math.PI) / 180)) / mPerPx);
  return Math.round(Math.max(3, Math.min(18, z)));
}

/** Default framing: wide enough to read terrain, roads and neighbouring sites. */
const DEFAULT_SPAN_M = 16_000;
/** Framing used by the "return to shelter" control. */
const SHELTER_SPAN_M = 6_000;

const TileLayerSwitch: React.FC<{ mode: TileMode }> = ({ mode }) => {
  // Every provider below is keyless, so the map never depends on a paid
  // account and never shows an "API key required" state.
  const cfg = TILE_CONFIG[mode];
  return <TileLayer key={cfg.url} url={cfg.url} attribution={cfg.attr} maxZoom={19} />;
};

type TileMode = 'streets' | 'satellite' | 'terrain';
/**
 * Basemap providers. All are keyless, so the map never depends on a paid
 * account and never shows an "API KEY REQUIRED" or blocked placeholder state.
 *
 * Provider selection was verified by fetching tiles for several widely separated
 * coordinates and confirming the responses actually differ between them:
 *   - CARTO's public `rastertiles` endpoint answers every request with a blank
 *     "API KEY REQUIRED" placeholder, so it is no longer used.
 *   - `tile.openstreetmap.org` returns a byte-identical blocked placeholder
 *     (6933 bytes) for every location and zoom once a client is rate-limited,
 *     which shows up as an empty white map.
 *   - Esri's ArcGIS Online basemaps and OpenTopoMap return real, geographically
 *     varying tiles with no key and are used instead.
 */
const TILE_CONFIG: Record<TileMode, { url: string; attr: string; label: string }> = {
  streets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
    label: 'ESRI TOPO',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagery &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics',
    label: 'ESRI IMAGERY',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    label: 'OPENTOPO',
  },
};

/** Keyboard-accessible popup content shared by both markers. */
const CoordRow: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 text-[11px] leading-relaxed">
    <span className="text-slate-400">{label}</span>
    <span className={`font-bold tabular-nums ${tone ?? 'text-cyan-300'}`}>{value}</span>
  </div>
);

export const LiveMap: React.FC<LiveMapProps> = ({
  shelter,
  destination,
  shelterId,
  shelterStatus,
  hasPendingMove,
  stations,
  suitability,
  onSelect,
  selectEnabled = true,
  busy = false,
  initialZoom,
  onViewChange,
}) => {
  const [tileMode, setTileMode] = useState<TileMode>('streets');
  const [showRadius, setShowRadius] = useState(true);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // The map mounts centred on the shelter if there is one, otherwise on the
  // staged destination.
  const anchor = shelter ?? destination;
  const anchorLat = anchor.latitude;
  const anchorLng = anchor.longitude;
  const [startZoom] = useState(() => initialZoom ?? zoomFor(anchorLat, DEFAULT_SPAN_M));
  const centre: [number, number] = [anchorLat, anchorLng];

  const distance = useMemo(
    () => (shelter ? metresBetween(shelter, destination) : null),
    [shelter, destination]
  );

  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not available in this browser');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onSelect(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Geolocation permission denied — use search or click the map instead'
            : 'Could not acquire a GPS fix — use search or click the map instead'
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  }, [onSelect]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <div className="inline-flex rounded-lg bg-slate-950/80 border border-slate-800 p-0.5">
          {(Object.keys(TILE_CONFIG) as TileMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setTileMode(m)}
              aria-pressed={tileMode === m}
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                tileMode === m ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {TILE_CONFIG[m].label}
            </button>
          ))}
        </div>

        <span className="text-[10px] font-mono px-1.5 py-1 rounded border border-slate-800 bg-slate-950/80 text-slate-400">
          {TILE_CONFIG[tileMode].label}
        </span>

        <button
          onClick={() => setShowRadius((v) => !v)}
          aria-pressed={showRadius}
          className={`text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
            showRadius
              ? 'border-cyan-600/70 bg-cyan-950/70 text-cyan-300'
              : 'border-slate-800 bg-slate-950/80 text-slate-500'
          }`}
          title="Show the shelter perimeter"
        >
          <ShieldCheck className="w-3 h-3" /> PERIMETER
        </button>

        <span className="ml-auto text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <Radio className={`w-3 h-3 ${busy ? 'animate-pulse text-cyan-400' : 'text-slate-600'}`} />
          {busy ? 'SYNCING' : 'READY'}
        </span>
      </div>

      {/* Map. The height is explicit so Leaflet always measures a real box, and
          the container never overflows its panel. */}
      <div className="relative flex-1 min-h-[340px] w-full overflow-hidden bg-[#060e20]">
        <MapContainer
          center={centre}
          zoom={startZoom}
          scrollWheelZoom
          zoomControl={false}
          attributionControl
          className="h-full w-full leaflet-container--accurate"
          preferCanvas={false}
        >
          <TileLayerSwitch mode={tileMode} />
          <ResizeWhenVisible active />
          <ClickToSelect onSelect={onSelect} enabled={selectEnabled && !busy} />
          <CameraBridge
            onViewChange={onViewChange}
            destination={destination}
            shelter={shelter}
          />
          <MapControls
            shelter={shelter}
            destination={destination}
            onViewChange={onViewChange}
            onLocate={locateMe}
            locating={locating}
          />

          {/* Shelter perimeter. Subtle, and only around the real shelter. */}
          {showRadius && shelter && (
            <Circle
              center={[shelter.latitude, shelter.longitude]}
              radius={120}
              pathOptions={{
                color: '#22d3ee',
                weight: 1,
                opacity: 0.55,
                fillColor: '#22d3ee',
                fillOpacity: 0.05,
                dashArray: '3 5',
              }}
            />
          )}

          {/* Reference stations */}
          {stations.map((st) => (
            <Marker key={st.id} position={[st.lat, st.lng]} icon={referenceIcon} zIndexOffset={-200}>
              <Popup>
                <div className="font-mono text-[11px] text-slate-100 space-y-0.5">
                  <div className="font-bold text-amber-400">{st.name}</div>
                  <div className="text-[10px] text-slate-400">{st.region}</div>
                  <CoordRow label="Elevation" value={`${st.elevation_m} m`} />
                  <CoordRow label="Winter min" value={`${st.winter_temp_min} °C`} />
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Committed shelter */}
          {shelter && (
            <Marker
              position={[shelter.latitude, shelter.longitude]}
              icon={shelterIcon}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => onViewChange?.('shelter'),
              }}
            >
              <Popup autoPan={false} className="aero-popup">
                <div className="font-mono text-[11px] text-slate-100 min-w-[210px]">
                  <div className="flex items-center gap-1.5 border-b border-slate-700 pb-1 mb-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold text-cyan-300">ACTIVE SHELTER</span>
                  </div>
                  <div className="font-bold text-slate-100 mb-1">{shelter.name}</div>
                  <CoordRow label="Shelter ID" value={shelterId ?? 'pending'} />
                  <CoordRow
                    label="Latitude"
                    value={`${Math.abs(shelter.latitude).toFixed(4)}° ${shelter.latitude >= 0 ? 'N' : 'S'}`}
                  />
                  <CoordRow
                    label="Longitude"
                    value={`${Math.abs(shelter.longitude).toFixed(4)}° ${shelter.longitude >= 0 ? 'E' : 'W'}`}
                  />
                  <CoordRow label="Elevation" value={`${Math.round(shelter.elevation).toLocaleString()} m ASL`} />
                  <CoordRow
                    label="Status"
                    value={shelterStatus ?? 'unknown'}
                    tone={shelterStatus === 'NOMINAL' ? 'text-emerald-300' : 'text-amber-300'}
                  />
                </div>
              </Popup>
            </Marker>
          )}

          {/* Pending destination */}
          <Marker
            position={[destination.latitude, destination.longitude]}
            icon={destinationIcon}
            zIndexOffset={hasPendingMove ? 1200 : 200}
            eventHandlers={{
              click: () => onViewChange?.('destination'),
            }}
          >
            <Popup autoPan={false} className="aero-popup">
              <div className="font-mono text-[11px] text-slate-100 min-w-[200px]">
                <div className="flex items-center gap-1.5 border-b border-slate-700 pb-1 mb-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-amber-300">
                    {hasPendingMove ? 'PENDING DESTINATION' : 'SELECTED LOCATION'}
                  </span>
                </div>
                <CoordRow
                  label="Latitude"
                  value={`${Math.abs(destination.latitude).toFixed(4)}° ${destination.latitude >= 0 ? 'N' : 'S'}`}
                  tone="text-amber-300"
                />
                <CoordRow
                  label="Longitude"
                  value={`${Math.abs(destination.longitude).toFixed(4)}° ${destination.longitude >= 0 ? 'E' : 'W'}`}
                  tone="text-amber-300"
                />
                <CoordRow
                  label="Elevation"
                  value={
                    Number.isFinite(destination.elevation)
                      ? `${Math.round(destination.elevation).toLocaleString()} m ASL`
                      : 'Unavailable'
                  }
                  tone="text-amber-300"
                />
                {suitability && (
                  <CoordRow
                    label="Suitability"
                    value={suitability.score === null ? suitability.rating : `${suitability.rating} · ${suitability.score}`}
                    tone="text-amber-300"
                  />
                )}
                {distance !== null && distance > 50 && (
                  <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] text-cyan-300">
                    {(distance / 1000).toFixed(1)} km from the active shelter
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Suitability card, only when a rating exists. */}
        {suitability && suitability.score !== null && (
          <div className="absolute top-2.5 left-2.5 z-[500] pointer-events-none">
            <div className="bg-slate-950/92 backdrop-blur-md border border-cyan-700/60 rounded-lg px-2.5 py-2 font-mono">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                <Mountain className="w-3 h-3 text-cyan-400" /> SITE SUITABILITY
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-sm font-black tracking-wide ${
                    suitability.low_confidence
                      ? 'text-amber-300'
                      : suitability.rating === 'EXCELLENT'
                        ? 'text-emerald-300'
                        : suitability.rating === 'FAVOURABLE'
                          ? 'text-cyan-300'
                          : suitability.rating === 'MARGINAL'
                            ? 'text-amber-300'
                            : 'text-red-300'
                  }`}
                >
                  {suitability.rating}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">{suitability.score}/100</span>
              </div>
              <div className="text-[8px] text-slate-500 mt-0.5">
                {suitability.low_confidence
                  ? 'PROVISIONAL · insufficient data'
                  : 'CALCULATED · rules engine'}
              </div>
            </div>
          </div>
        )}

        {/* Coordinate readout, always visible. */}
        <div className="absolute bottom-2.5 left-2.5 z-[500] bg-slate-950/92 backdrop-blur-md border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[10px] space-y-0.5 pointer-events-none">
          <div className="text-slate-500 text-[9px]">SELECTED LOCATION</div>
          <div className="text-amber-300 tabular-nums font-bold">
            {Math.abs(destination.latitude).toFixed(4)}°{destination.latitude >= 0 ? 'N' : 'S'}{' '}
            {Math.abs(destination.longitude).toFixed(4)}°{destination.longitude >= 0 ? 'E' : 'W'}
          </div>
          <div className="text-cyan-300 tabular-nums">
            {Number.isFinite(destination.elevation)
              ? `${Math.round(destination.elevation).toLocaleString()} m ASL`
              : 'Elevation unavailable'}
          </div>
        </div>
      </div>

      {geoError && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border-t border-amber-700/40 text-[10px] font-mono text-amber-300">
          <TriangleAlert className="w-3 h-3 flex-shrink-0" /> {geoError}
        </div>
      )}
    </div>
  );
};
/** Small square control button matching the tactical chrome. */
const MapButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}> = ({ title, onClick, children, active }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded border backdrop-blur-md transition-colors ${
      active
        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
        : 'bg-slate-950/88 border-slate-700 text-slate-300 hover:border-cyan-600 hover:text-cyan-300'
    }`}
  >
    {children}
  </button>
);

/**
 * The control cluster. It lives inside <MapContainer> so it can drive the map
 * through `useMap()` directly — no shared mutable handle, and no stale handler
 * after a tab switch. Absolutely positioned inside the map's own box, so it can
 * neither push the layout nor overflow the panel.
 */
const MapControls: React.FC<{
  shelter: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number };
  onViewChange?: (view: LiveMapView) => void;
  onLocate: () => void;
  locating: boolean;
}> = ({ shelter, destination, onViewChange, onLocate, locating }) => {
  const map = useMap();

  const resetToShelter = useCallback(() => {
    const t = shelter ?? destination;
    map.flyTo([t.latitude, t.longitude], Math.max(map.getZoom(), zoomFor(t.latitude, SHELTER_SPAN_M)), {
      duration: 0.6,
    });
    onViewChange?.('shelter');
  }, [destination, map, onViewChange, shelter]);

  const fitDestination = useCallback(() => {
    // Frame the shelter and the pending move together so the user can judge the
    // relocation in context instead of being teleported with no reference.
    if (shelter && metresBetween(shelter, destination) > 50) {
      map.fitBounds(
        [
          [shelter.latitude, shelter.longitude],
          [destination.latitude, destination.longitude],
        ],
        { padding: [56, 56], maxZoom: 15 }
      );
    } else {
      const t = shelter ?? destination;
      map.flyTo([t.latitude, t.longitude], Math.max(map.getZoom(), zoomFor(t.latitude, SHELTER_SPAN_M)), {
        duration: 0.6,
      });
    }
    onViewChange?.('destination');
  }, [destination, map, onViewChange, shelter]);

  return (
    <div className="absolute top-2.5 right-2.5 z-[500] flex flex-col gap-1 pointer-events-auto">
      <MapButton title="Zoom in" onClick={() => map.zoomIn()}>
        <Plus className="w-3.5 h-3.5" />
      </MapButton>
      <MapButton title="Zoom out" onClick={() => map.zoomOut()}>
        <Minus className="w-3.5 h-3.5" />
      </MapButton>
      <MapButton title="Reset view to the active shelter" onClick={resetToShelter}>
        <Crosshair className="w-3.5 h-3.5" />
      </MapButton>
      <MapButton title="Frame the active shelter and the selected location" onClick={fitDestination}>
        <MapPin className="w-3.5 h-3.5" />
      </MapButton>
      <MapButton title="Use my current location" onClick={onLocate} active={locating}>
        <Locate className={`w-3.5 h-3.5 ${locating ? 'animate-pulse' : ''}`} />
      </MapButton>
    </div>
  );
};

/**
 * Keeps the camera sensible as the selection moves: pans to the destination
 * when the user picks somewhere off-screen, and follows the shelter when it is
 * actually relocated.
 */
const CameraBridge: React.FC<{
  onViewChange?: (view: LiveMapView) => void;
  destination: { latitude: number; longitude: number };
  shelter: { latitude: number; longitude: number } | null;
}> = ({ destination, shelter }) => {
  const map = useMap();

  const lat = destination.latitude;
  const lng = destination.longitude;
  useEffect(() => {
    if (!map.getContainer().clientWidth) return;
    if (!map.getBounds().contains([lat, lng])) {
      map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }
  }, [map, lat, lng]);

  const sLat = shelter?.latitude ?? null;
  const sLng = shelter?.longitude ?? null;
  useEffect(() => {
    if (sLat === null || sLng === null) return;
    if (!map.getBounds().contains([sLat, sLng])) {
      map.panTo([sLat, sLng], { animate: true, duration: 0.4 });
    }
  }, [map, sLat, sLng]);

  return null;
};

export default LiveMap;
