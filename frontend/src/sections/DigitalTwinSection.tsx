import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Loader2,
  AlertTriangle,
  Info,
  MousePointerClick,
  Layers,
  Orbit,
  Move3d,
  Rocket,
  Crosshair,
  Cpu,
  LayoutGrid,
  Map as MapIcon,
  Box,
  Activity,
  Play,
  Square,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { GeospatialMap } from '../components/GeospatialMap';
import { LiveMap } from '../components/LiveMap';
import { RelocateConfirmDialog } from '../components/RelocateConfirmDialog';
import { Shelter3DViewer } from '../components/Shelter3DViewer';
import { ShelterTwinPanel } from '../components/ShelterTwinPanel';
import { LocationSelectorPanel } from '../components/LocationSelectorPanel';
import { LocationAnalysisPanel } from '../components/LocationAnalysisPanel';
import { LocationConfigPanel } from '../components/LocationConfigPanel';
import { ShelterComponentPanel } from '../components/ShelterComponentPanel';
import {
  ShelterAnchor,
  ShelterGeometry,
  ShelterPartId,
  ShelterTerrain,
  ShelterTwin,
  SimulationResult,
  DefenseStation,
  WeatherResponse,
} from '../types';
import { MapCameraState } from '../hooks/useMapGeoSync';
import { useLocationAnalysis } from '../hooks/useLocationAnalysis';
import type { SelectedLocation } from '../services/geoProjection';
import { zoomForFeature, mercatorScaleFactor } from '../services/geoProjection';
import {
  deployShelter,
  fetchShelter,
  fetchShelterTerrain,
  listShelters,
  sendShelterCommand,
} from '../services/shelterApi';

/** Telemetry cadence. Within the 5-30 s guidance for a responsive demo. */
const TELEMETRY_POLL_MS = 10_000;
/** Terrain is a slow-changing physical field; re-sample far less often. */
const TERRAIN_TTL_MS = 10 * 60_000;
const TERRAIN_SPAN_M = 200;
const TERRAIN_SAMPLES = 7;
/** Zoom that makes a ~7 m shelter about 60 px tall on a typical viewport. */
const SHELTER_VIEW_METERS = 7;
const SHELTER_VIEW_PIXELS = 60;
/** Tilt for the synced 3D view. 0 = straight down = pixel-exact map overlay. */
const PITCH_TILTED_DEG = 55;
const PITCH_TOP_DOWN_DEG = 0;

type TwinTab = 'scene' | 'map' | 'telemetry' | 'deployment';

const TWIN_TABS: Array<{ id: TwinTab; label: string; icon: React.ElementType }> = [
  { id: 'scene', label: '3D SHELTER', icon: Box },
  { id: 'map', label: 'LIVE MAP', icon: MapIcon },
  { id: 'telemetry', label: 'LIVE TELEMETRY', icon: Activity },
  { id: 'deployment', label: 'DEPLOYMENT', icon: Rocket },
];

interface DigitalTwinSectionProps {
  geometry: ShelterGeometry;
  simResult: SimulationResult | null;
  troops: number;
  latitude: number;
  longitude: number;
  elevation: number;
  locationName: string;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  weatherData: WeatherResponse | null;
  onLocationSelect: (lat: number, lng: number, name?: string) => void;
  selectedShelterId: string | null;
  onShelterChange: (id: string) => void;
}

export const DigitalTwinSection: React.FC<DigitalTwinSectionProps> = ({
  geometry,
  simResult,
  troops,
  latitude,
  longitude,
  elevation,
  locationName,
  currentStation,
  stations,
  weatherData,
  onLocationSelect,
  selectedShelterId,
  onShelterChange,
}) => {
  // ---------------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH.
  // Both the map centre and the 3D shelter position derive from this object.
  // There is no second copy of the coordinates anywhere in this section.
  // ---------------------------------------------------------------------------
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
    latitude,
    longitude,
    elevation,
    timestamp: Date.now(),
  });
  const [twin, setTwin] = useState<ShelterTwin | null>(null);
  const [mapCamera, setMapCamera] = useState<MapCameraState | null>(null);
  const [mapZoom, setMapZoom] = useState(8);
  const [terrain, setTerrain] = useState<ShelterTerrain | null>(null);
  const [selectedPart, setSelectedPart] = useState<ShelterPartId | null>(null);
  const [busy, setBusy] = useState(false);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<{ accepted: boolean; message: string } | null>(null);
  const [pitchDeg, setPitchDeg] = useState(PITCH_TILTED_DEG);
  const [tab, setTab] = useState<TwinTab>('scene');
  /**
   * Deployment gate.
   *
   * OFF by default so the flow is explicit: pick a site, ANALYZE LOCATION, then
   * RELOCATE SHELTER behind a confirmation. A click on the map stages a
   * destination; it must never move the deployed shelter on its own.
   *
   * Turning this ON restores the one-click behaviour, but only for map clicks.
   * The initial page load still adopts/deploys through the effect above, so a
   * refresh keeps working either way.
   */
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  /** Bumped by RESET VIEW to force the map back onto the shelter anchor. */
  const [resetToken, setResetToken] = useState(0);

  // Asset ratings come from the deployed twin so the recommended-configuration
  // panel never invents a number the backend has not declared.
  const assetRatings = useMemo(
    () => ({
      solar_capacity_kw: twin?.solar.capacity_kw ?? null,
      battery_capacity_kwh: twin?.battery.battery_capacity_kwh ?? null,
      fuel_capacity_l: twin?.fuel.fuel_capacity_l ?? null,
    }),
    [twin?.solar.capacity_kw, twin?.battery.battery_capacity_kwh, twin?.fuel.fuel_capacity_l]
  );

  const { analysis, config, analysing, configLoading, run: runAnalysis, isCurrent: analysisIsCurrent, suitability } =
    useLocationAnalysis({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      name: locationName,
      enabled: true,
      troops,
      simResult,
      assets: assetRatings,
    });

  /**
   * Web Mercator stretch at the shelter's latitude, surfaced in the HUD so the
   * ground-plane scale is never mistaken for true ground distance.
   */
  const mercatorFactor = mercatorScaleFactor(selectedLocation.latitude);
  const [overlayInteractive, setOverlayInteractive] = useState(false);

  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);
  const terrainKeyRef = useRef<string | null>(null);
  const terrainTimeRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * Adopt a freshly received twin. The backend's DEM-resolved coordinates are
   * authoritative, so this is what promotes the user's click into a real
   * surveyed position.
   */
  const applyTwin = useCallback((next: ShelterTwin) => {
    setTwin(next);
    setSelectedLocation({
      latitude: next.location.latitude,
      longitude: next.location.longitude,
      elevation: next.location.elevation_m,
      timestamp: Date.now(),
    });
    setError(null);
  }, []);

  const deploy = useCallback(
    async (lat: number, lng: number) => {
      setBusy(true);
      setError(null);
      try {
        // Elevation is omitted so the backend resolves the real DEM value
        // instead of trusting a client-supplied number.
        const next = await deployShelter({
          latitude: lat,
          longitude: lng,
          troops,
          archetype: geometry.archetype,
        });
        applyTwin(next);
        onShelterChange(next.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Deployment failed');
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [applyTwin, geometry.archetype, onShelterChange, troops]
  );

  // Adopt an externally selected shelter, or deploy at the incoming location.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        // Prefer an already-deployed shelter over creating one.
        //
        // `latitude`/`longitude` are only a default anchor, so deploying them
        // unconditionally would silently relocate the shelter back to the
        // built-in default position on every page load. Adopting the existing
        // twin keeps the deployment, the 3D map and the telemetry in agreement,
        // and a genuine first run (no shelter on the backend) still deploys.
        const existing = selectedShelterId
          ? await fetchShelter(selectedShelterId)
          : ((await listShelters()).shelters?.[0] ??
            (await deployShelter({
              latitude,
              longitude,
              troops,
              archetype: geometry.archetype,
            })));
        if (cancelled) return;
        applyTwin(existing);
        if (!selectedShelterId) onShelterChange(existing.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load shelter twin');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only the selected shelter identity should re-run adoption; later map
    // clicks re-anchor explicitly through handleMapSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShelterId]);

  // Fly the map to a shelter-scale zoom the first time a position is adopted.
  const flownForRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${selectedLocation.latitude.toFixed(5)},${selectedLocation.longitude.toFixed(5)}`;
    if (flownForRef.current === key) return;
    flownForRef.current = key;
    setMapZoom(
      Math.max(16, Math.min(20, Math.round(zoomForFeature(SHELTER_VIEW_METERS, SHELTER_VIEW_PIXELS, selectedLocation.latitude))))
    );
  }, [selectedLocation.latitude, selectedLocation.longitude]);

  // Telemetry polling. Self-cleaning, guarded against overlap.
  useEffect(() => {
    if (!twin) return;
    const id = twin.id;
    const tick = async () => {
      if (!aliveRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const next = await fetchShelter(id);
        if (aliveRef.current) setTwin(next);
      } catch {
        /* transient failure: keep the last good frame */
      } finally {
        inFlightRef.current = false;
      }
    };
    const timer = window.setInterval(tick, TELEMETRY_POLL_MS);
    return () => window.clearInterval(timer);
    // Only the shelter identity should restart the poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twin?.id]);

  // Sample the real DEM grid for the selection, with caching.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = `${selectedLocation.latitude.toFixed(4)},${selectedLocation.longitude.toFixed(4)}`;
    if (terrainKeyRef.current === key && Date.now() - terrainTimeRef.current < TERRAIN_TTL_MS) {
      return;
    }
    let cancelled = false;
    setTerrainLoading(true);
    fetchShelterTerrain(selectedLocation.latitude, selectedLocation.longitude, TERRAIN_SPAN_M, TERRAIN_SAMPLES)
      .then((t) => {
        if (cancelled) return;
        terrainKeyRef.current = key;
        terrainTimeRef.current = Date.now();
        setTerrain(t);
      })
      .catch(() => {
        if (!cancelled) setTerrain(null);
      })
      .finally(() => {
        if (!cancelled) setTerrainLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLocation.latitude, selectedLocation.longitude]);

  /**
   * Distance between the deployed shelter and the staged destination. Used to
   * decide whether there is anything to relocate and to state the change in the
   * confirmation dialog.
   */
  const pendingDistanceM = useMemo(() => {
    if (!twin) return null;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(selectedLocation.latitude - twin.location.latitude);
    const dLng = toRad(selectedLocation.longitude - twin.location.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(twin.location.latitude)) *
        Math.cos(toRad(selectedLocation.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }, [twin, selectedLocation.latitude, selectedLocation.longitude]);

  /** Below this, "relocation" would be a no-op against the backend. */
  const hasPendingMove = pendingDistanceM !== null && pendingDistanceM > 25;
  const canRelocate = hasPendingMove && !busy;

  /** Map click: stages a destination. It does NOT move the shelter. */
  const handleMapSelect = useCallback(
    (lat: number, lng: number) => {
      setSelectedLocation((prev) => ({ ...prev, latitude: lat, longitude: lng, timestamp: Date.now() }));
      onLocationSelect(lat, lng, `Map Target (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`);
      // Auto-deploy only ever applies to a map click, and only when the user
      // has explicitly asked for it.
      if (autoDeploy) void deploy(lat, lng);
    },
    [autoDeploy, deploy, onLocationSelect]
  );

  /** Search / manual / geolocation all stage a location through this. */
  const handleStageLocation = useCallback(
    (lat: number, lng: number, name: string, elev?: number) => {
      setSelectedLocation((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        elevation: elev !== undefined && elev > 0 ? elev : prev.elevation,
        timestamp: Date.now(),
      }));
      onLocationSelect(lat, lng, name);
      setSelectedPart(null);
    },
    [onLocationSelect]
  );

  /**
   * RELOCATE SHELTER. Opens the confirmation instead of deploying, so the
   * destructive step is always deliberate. A first deployment (no twin yet) is
   * not a relocation and needs no confirmation.
   */
  const handleRelocateRequest = useCallback(() => {
    if (!twin || !hasPendingMove) return;
    setConfirmOpen(true);
  }, [hasPendingMove, twin]);

  const handleRelocateConfirm = useCallback(async () => {
    setConfirmOpen(false);
    await deploy(selectedLocation.latitude, selectedLocation.longitude);
  }, [deploy, selectedLocation.latitude, selectedLocation.longitude]);

  const handleDeployHere = useCallback(() => {
    void deploy(selectedLocation.latitude, selectedLocation.longitude);
  }, [deploy, selectedLocation.latitude, selectedLocation.longitude]);

  /**
   * When auto-deploy is OFF nothing re-anchors the shelter, so the analysis'
   * DEM elevation has to reach the staged location itself. Otherwise the HUD
   * would keep advertising the previous site's altitude.
   */
  const analysedElevation = analysis?.elevation.value ?? null;
  useEffect(() => {
    if (analysedElevation === null || !Number.isFinite(analysedElevation)) return;
    if (!autoDeploy) {
      setSelectedLocation((prev) => ({ ...prev, elevation: analysedElevation }));
    }
  }, [analysedElevation, autoDeploy]);

  const handleCommand = useCallback(
    async (
      action: 'start_generator' | 'stop_generator' | 'toggle_grid' | 'refuel',
      liters?: number
    ) => {
      if (!twin) return;
      setBusy(true);
      try {
        const next = await sendShelterCommand(twin.id, action, liters);
        applyTwin(next);
        setLastCommand(next.command ?? null);
      } catch (e) {
        setLastCommand({ accepted: false, message: e instanceof Error ? e.message : 'Command failed' });
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [applyTwin, twin]
  );

  const handleRefresh = useCallback(() => {
    if (!twin) return;
    setBusy(true);
    Promise.all([fetchShelter(twin.id), runAnalysis()])
      .then(([next]) => applyTwin(next))
      .catch(() => undefined)
      .finally(() => {
        if (aliveRef.current) setBusy(false);
      });
  }, [applyTwin, runAnalysis, twin]);

  /** Restores the map camera, the pitch and the analysis cadence to defaults. */
  const handleResetView = useCallback(() => {
    const lat = selectedLocation.latitude;
    setMapZoom(
      Math.max(16, Math.min(20, Math.round(zoomForFeature(SHELTER_VIEW_METERS, SHELTER_VIEW_PIXELS, lat))))
    );
    setPitchDeg(PITCH_TILTED_DEG);
    setOverlayInteractive(false);
    setSelectedPart(null);
    setResetToken((n) => n + 1);
  }, [selectedLocation.latitude]);

  /** The 3D shelter anchor is projected from the shared location, nothing else. */
  const anchor: ShelterAnchor = useMemo(
    () => ({
      id: twin?.id ?? 'pending',
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      elevation: selectedLocation.elevation,
      heading: twin?.location.heading_deg ?? 180,
      timestamp: selectedLocation.timestamp,
    }),
    [twin?.id, twin?.location.heading_deg, selectedLocation]
  );

  const relief = terrain ? (terrain.max_elevation_m - terrain.min_elevation_m).toFixed(0) : null;
  const topDown = pitchDeg <= 2;
  const genRunning = twin?.generator.status === 'RUNNING';

  return (
    <div className="space-y-3">
      {/* ---------------- HERO HEADER ---------------- */}
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <h1 className="text-base font-bold text-slate-100 font-mono tracking-wide">
                LIVE SHELTER DIGITAL TWIN
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-slate-200 font-bold">
                <MapPin className="w-3 h-3 text-orange-400" />
                {locationName}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-cyan-300 tabular-nums">
                {Math.abs(selectedLocation.latitude).toFixed(4)}°
                {selectedLocation.latitude >= 0 ? 'N' : 'S'}
              </span>
              <span className="text-cyan-300 tabular-nums">
                {Math.abs(selectedLocation.longitude).toFixed(4)}°
                {selectedLocation.longitude >= 0 ? 'E' : 'W'}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-300 tabular-nums">
                {analysis?.elevation.value !== null && analysis?.elevation.value !== undefined
                  ? `${Math.round(analysis.elevation.value).toLocaleString()} m ASL`
                  : `${selectedLocation.elevation.toFixed(0)} m ASL`}
              </span>
            </div>
          </div>

          {/* Deployment status */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            {twin ? (
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-bold ${
                  twin.relocated
                    ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-200'
                    : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {twin.relocated ? 'RELOCATED' : 'DEPLOYED'} · {twin.id}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-slate-400 font-bold">
                NOT DEPLOYED
              </span>
            )}
            <span className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-950/50 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              TELEMETRY {TELEMETRY_POLL_MS / 1000}s
            </span>
            {mapCamera && (
              <span
                className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300"
                title="Map ground resolution. Web Mercator stretches north-south by 1/cos(latitude), so the 3D ground plane shares the map's Mercator scale to stay pixel-aligned; the vertical axis stays in true metres."
              >
                Z{mapCamera.zoom} &middot; {mapCamera.metersPerPixel.toFixed(3)} m/px
                {mercatorFactor > 1.005 ? ` · MERCATOR ×${mercatorFactor.toFixed(3)}` : ''}
              </span>
            )}
            {relief && (
              <span className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300">
                DEM RELIEF {relief} m / {TERRAIN_SPAN_M} m
              </span>
            )}
            {terrainLoading && (
              <span className="flex items-center gap-1 px-2 py-1 rounded border border-cyan-500/40 bg-cyan-950/50 text-cyan-300">
                <Loader2 className="w-3 h-3 animate-spin" /> SAMPLING DEM
              </span>
            )}
          </div>
        </div>

        {/* Sub-navigation for the digital twin */}
        <div className="flex flex-wrap items-center gap-1 mt-3 pt-3 border-t border-slate-800">
          <LayoutGrid className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {TWIN_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold font-mono transition-colors ${
                  tab === t.id
                    ? 'border-cyan-500/60 bg-cyan-950/70 text-cyan-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" /> {t.label}
              </button>
            );
          })}
          <span className="text-[10px] text-slate-500 font-mono ml-auto hidden lg:block">
            One Leaflet map and one Three.js scene share a single WGS84 origin
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 bg-red-950/40 text-red-200 text-[11px] font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ---------------- MAIN GRID ---------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Left: the 3D shelter / map viewport */}
        <div className="xl:col-span-9 space-y-2">
          {/* Hero controls */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-800 bg-[#0b1329]">
            <button
              onClick={() => void runAnalysis()}
              disabled={analysing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/50 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900 text-[10px] font-bold transition-colors disabled:opacity-50"
            >
              {analysing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
              ANALYZE LOCATION
            </button>
            {/*
              With no deployed twin this is a first deployment, so it needs no
              confirmation. Once a twin exists, RELOCATE opens the confirmation
              dialog and is disabled until a different site is actually staged.
            */}
            <button
              onClick={twin ? handleRelocateRequest : handleDeployHere}
              disabled={busy || (twin !== null && !canRelocate)}
              title={
                twin === null
                  ? 'Deploy the shelter at the analysed location'
                  : hasPendingMove
                    ? 'Review and confirm moving the shelter to the selected site'
                    : 'Select a different location on the map first'
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold transition-colors disabled:opacity-40 ${
                twin && !hasPendingMove
                  ? 'border-slate-700 bg-slate-900 text-slate-500'
                  : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900'
              }`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              {twin ? 'RELOCATE SHELTER' : 'DEPLOY SHELTER'}
            </button>
            <button
              onClick={() => handleCommand(genRunning ? 'stop_generator' : 'start_generator')}
              disabled={!twin || busy}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold transition-colors disabled:opacity-40 ${
                genRunning
                  ? 'border-red-500/50 bg-red-950/60 text-red-200 hover:bg-red-900'
                  : 'border-amber-500/50 bg-amber-950/60 text-amber-200 hover:bg-amber-900'
              }`}
            >
              {genRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {genRunning ? 'STOP GENERATOR' : 'START GENERATOR'}
            </button>
            <button
              onClick={handleResetView}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100 text-[10px] font-bold transition-colors"
              title="Restore the default map zoom, tilt and camera framing"
            >
              <RotateCcw className="w-3.5 h-3.5" /> RESET VIEW
            </button>
            <label className="flex items-center gap-1.5 ml-auto text-[10px] font-mono text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDeploy}
                onChange={(e) => setAutoDeploy(e.target.checked)}
                className="accent-cyan-400"
              />
              AUTO-DEPLOY ON LOCATION CHANGE
            </label>
          </div>

          {/* ---------------- LIVE MAP VIEW ----------------
              A genuine map, not the 3D overlay. The shelter and the staged
              destination are two separate markers, so the user can see what
              they are about to change before anything moves. */}
          {tab === 'map' && (
            <div
              className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden flex flex-col h-[620px] xl:h-[700px]"
              ref={mapViewportRef}
            >
              <div className="px-3.5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
                <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <MapIcon className="w-3.5 h-3.5" />
                  LIVE MAP · SELECT A DESTINATION
                </span>
                <div className="flex items-center gap-1.5">
                  {hasPendingMove && pendingDistanceM !== null && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded border border-amber-500/50 bg-amber-950/60 text-amber-200 text-[10px] font-mono font-bold">
                      <Crosshair className="w-3 h-3" />
                      PENDING MOVE {(pendingDistanceM / 1000).toFixed(1)} KM
                    </span>
                  )}
                  <button
                    onClick={handleRelocateRequest}
                    disabled={!canRelocate}
                    title={
                      canRelocate
                        ? 'Review and confirm the relocation'
                        : 'Select a different location on the map first'
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-bold transition-colors disabled:opacity-40 border-emerald-500/50 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900"
                  >
                    <Rocket className="w-3 h-3" /> RELOCATE
                  </button>
                </div>
              </div>

              {/* Fills the remaining box height; the map is never a fixed small
                  strip and never overflows the panel. */}
              <div className="flex-1 min-h-0">
                <LiveMap
                  shelter={
                    twin
                      ? {
                          latitude: twin.location.latitude,
                          longitude: twin.location.longitude,
                          elevation: twin.location.elevation_m,
                          name: locationName,
                        }
                      : null
                  }
                  destination={{
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                    elevation: analysisIsCurrent
                      ? (analysis?.elevation.value ?? selectedLocation.elevation)
                      : selectedLocation.elevation,
                  }}
                  shelterId={twin?.id ?? null}
                  shelterStatus={twin?.operational_status ?? null}
                  hasPendingMove={hasPendingMove}
                  stations={stations}
                  suitability={suitability}
                  onSelect={handleMapSelect}
                  selectEnabled={!busy}
                  busy={busy}
                />
              </div>
            </div>
          )}

          {/* ---------------- 3D SHELTER VIEW ----------------
              The Three.js shelter sits over the Leaflet tiles in one shared box,
              so the two stay pixel-aligned. This is the only view with the 3D
              overlay on it. */}
          {tab === 'scene' && (
            <div className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  GEOSPATIAL 3D SHELTER
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPitchDeg(topDown ? PITCH_TILTED_DEG : PITCH_TOP_DOWN_DEG)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                      topDown
                        ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                    title="Switch between a pixel-exact top-down overlay and a tilted 3D view"
                  >
                    {topDown ? <Move3d className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                    {topDown ? 'TOP-DOWN (PIXEL-EXACT)' : `TILT ${PITCH_TILTED_DEG}°`}
                  </button>
                  <button
                    onClick={() => setOverlayInteractive((v) => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                      overlayInteractive
                        ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                    title="Capture pointer events on the 3D overlay to click shelter subsystems"
                  >
                    <Orbit className="w-3 h-3" />
                    {overlayInteractive ? '3D PICKING ON' : '3D PICKING OFF'}
                  </button>
                </div>
              </div>

              {/* The 3D shelter is the visual hero, so it gets the largest box.
                  The Leaflet map and the Three.js canvas share this one viewport
                  and the same projection — there is no second map. */}
              <div className="relative h-[620px] xl:h-[700px]">
                <GeospatialMap
                  latitude={selectedLocation.latitude}
                  longitude={selectedLocation.longitude}
                  elevation={selectedLocation.elevation}
                  currentStation={currentStation}
                  stations={stations}
                  weatherData={weatherData}
                  onLocationSelect={handleMapSelect}
                  zoom={mapZoom}
                  viewResetKey={resetToken}
                  onCameraChange={setMapCamera}
                  cameraCenterElevation={selectedLocation.elevation}
                  cameraPitchDeg={pitchDeg}
                />

                {/* 3D overlay, same pixel box as the map, no second map involved. */}
                <div
                  className="absolute inset-0"
                  style={{ pointerEvents: overlayInteractive ? 'auto' : 'none' }}
                >
                  <Shelter3DViewer
                    geometry={geometry}
                    simResult={simResult}
                    troops={troops}
                    anchor={anchor}
                    terrain={terrain}
                    showEquipment
                    cameraSync={mapCamera}
                    overlay
                    onPartSelect={setSelectedPart}
                    highlightPart={selectedPart}
                  />
                </div>

                {/* Selected component callout, anchored over the scene. */}
                {selectedPart && overlayInteractive && (
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span className="px-2 py-1 rounded bg-cyan-950/85 border border-cyan-500/50 text-cyan-200 text-[10px] font-mono font-bold">
                      SUBSYSTEM SELECTED — see the component panel →
                    </span>
                  </div>
                )}

                {!twin && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 font-mono text-xs pointer-events-none">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                    {busy ? 'Resolving DEM and deploying twin...' : 'No shelter deployed'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hint strip. The wording follows the active view so it never tells
              the user to click a 3D overlay that is not on screen. */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-[10px] text-slate-400 font-mono leading-relaxed">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-cyan-500" />
            {tab === 'scene' ? (
              <span>
                The 3D shelter is rendered over the map tiles in one shared box, so the scene and
                the basemap stay pixel-aligned to the same WGS84 point. Pan and zoom and the camera
                follows at the same ground resolution. Enable <strong className="text-slate-300">3D
                picking</strong> to click shelter subsystems directly in the scene.
              </span>
            ) : tab === 'map' ? (
              <span>
                Click anywhere on the map to stage a destination — the amber marker and the readout
                follow the cursor, and nothing moves yet. Run <strong className="text-slate-300">ANALYZE
                LOCATION</strong> to read the live DEM, Open-Meteo conditions and site suitability, then{' '}
                <strong className="text-slate-300">RELOCATE SHELTER</strong> to move the existing twin
                after confirmation. The cyan marker is the shelter that is actually deployed.
              </span>
            ) : (
              <span>
                Deploy the shelter at the analysed coordinates, then start the generator to watch
                fuel, battery and power respond to live telemetry. Relocating preserves the shelter
                identity, fuel load and battery state.
              </span>
            )}
          </div>
        </div>

        {/* Right rail. The location selector is available on the map and
            deployment tabs, because that is where a destination is chosen. */}
        <div className="xl:col-span-3 space-y-3">
          {(tab === 'deployment' || tab === 'telemetry' || tab === 'map') && (
            <div className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5" /> DEPLOYMENT CONTROL
                </span>
              </div>
              <div className="p-3.5">
                <LocationSelectorPanel
                  latitude={selectedLocation.latitude}
                  longitude={selectedLocation.longitude}
                  name={locationName}
                  stations={stations}
                  analysed={analysisIsCurrent}
                  busy={analysing}
                  onStageLocation={handleStageLocation}
                  onAnalyze={() => void runAnalysis()}
                  onPickOnMap={() => {
                    setTab('map');
                    // The viewport is unmounted on the other tabs, so wait for
                    // the next paint before the ref resolves to a live node.
                    requestAnimationFrame(() =>
                      mapViewportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    );
                  }}
                />
              </div>
            </div>
          )}

          {(tab === 'deployment' || tab === 'map') && analysis && (
            <div className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> LOCATION ANALYSIS
                </span>
                {analysing && (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-cyan-300">
                    <Loader2 className="w-3 h-3 animate-spin" /> ANALYSING
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <LocationAnalysisPanel analysis={analysis} suitability={suitability} />
              </div>
            </div>
          )}

          {tab === 'deployment' && (
            <div className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-800">
                <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> RECOMMENDED SHELTER CONFIGURATION
                </span>
              </div>
              <LocationConfigPanel config={config} loading={configLoading} />
            </div>
          )}

          {/* Live twin panel: the operational readout. */}
          {(tab === 'telemetry' || tab === 'scene' || tab === 'map') && (
            <div className="bg-[#0b1329] border border-command-700/80 rounded-xl overflow-hidden xl:h-[700px]">
              {twin ? (
                <ShelterTwinPanel
                  twin={twin}
                  selectedPart={selectedPart}
                  onSelectPart={setSelectedPart}
                  onCommand={(a) => void handleCommand(a)}
                  busy={busy}
                  lastCommand={lastCommand}
                  onRefresh={handleRefresh}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-2 text-slate-500 font-mono text-xs">
                  <MousePointerClick className="w-6 h-6 animate-pulse text-cyan-600" />
                  Select a location, then deploy the shelter
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Component inspector: sits under the scene so clicking a 3D part is
          immediately answered without losing the hero view. */}
      {selectedPart && (
        <div className="bg-[#0b1329] border border-cyan-500/40 rounded-xl overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> COMPONENT INSPECTOR
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              Values read from the deployed twin — click another part in the 3D scene to switch
            </span>
          </div>
          <div className="p-3.5 max-w-md">
            <ShelterComponentPanel
              part={selectedPart}
              twin={twin}
              busy={busy}
              onCommand={handleCommand}
              onClose={() => setSelectedPart(null)}
            />
          </div>
        </div>
      )}
      {/* Relocation gate. Nothing moves until this is confirmed, which is what
          makes ANALYZE LOCATION and RELOCATE SHELTER real steps in the flow. */}
      <RelocateConfirmDialog
        open={confirmOpen}
        target={{
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          elevation: analysisIsCurrent ? (analysis?.elevation.value ?? selectedLocation.elevation) : selectedLocation.elevation,
          elevationKnown: analysisIsCurrent && analysis?.elevation.value != null,
          name: locationName,
        }}
        current={
          twin
            ? {
                latitude: twin.location.latitude,
                longitude: twin.location.longitude,
                name: locationName,
              }
            : null
        }
        distanceKm={pendingDistanceM === null ? null : pendingDistanceM / 1000}
        suitability={suitability}
        busy={busy}
        onConfirm={() => void handleRelocateConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
