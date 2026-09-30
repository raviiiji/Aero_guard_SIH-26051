import React, { useState, useEffect, useCallback } from 'react';
import { NavigationSidebar, NavSection } from './components/NavigationSidebar';
import { TopAppBar } from './components/TopAppBar';
import { StrategicOverviewSection } from './sections/StrategicOverviewSection';
import { DigitalTwinSection } from './sections/DigitalTwinSection';
import { DataImportSection } from './sections/DataImportSection';
import { RecommendedBlueprintSection } from './sections/RecommendedBlueprintSection';
import { MissionConfigSection } from './sections/MissionConfigSection';
import { ThermalAnalyticsSection } from './sections/ThermalAnalyticsSection';
import { AIOptimizerSection } from './sections/AIOptimizerSection';
import { CADStudioSection } from './sections/CADStudioSection';
import { SystemLogsSection } from './sections/SystemLogsSection';
import { DossierSection } from './sections/DossierSection';

import {
  ShelterGeometry,
  SimulationParameters,
  EnvelopeSection,
  DefenseStation,
  WeatherResponse,
  SimulationResult,
  MaterialDef,
  GlazingDef,
} from './types';

import {
  fetchMaterials,
  fetchDefenseStations,
  fetchWeatherAndCluster,
  runSimulation,
} from './services/api';

import { listShelters } from './services/shelterApi';

import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { SystemStatusModal } from './components/SystemStatusModal';
import { UnifiedMissionModal } from './components/UnifiedMissionModal';

export function App() {
  // 1. Navigation State
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

  // Modals & Drawers State
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [locationName, setLocationName] = useState<string>('Leh Military Station');

  // 2. Geographic & Station State
  const [stations, setStations] = useState<DefenseStation[]>([]);
  const [currentStation, setCurrentStation] = useState<DefenseStation | null>(null);
  const [latitude, setLatitude] = useState<number>(34.15); // Leh default
  const [longitude, setLongitude] = useState<number>(77.58);
  const [elevation, setElevation] = useState<number>(3500);

  // 3. Materials & Glazing DB
  const [materialsDB, setMaterialsDB] = useState<Record<string, MaterialDef>>({});
  const [glazingDB, setGlazingDB] = useState<Record<string, GlazingDef>>({});

  // 4. Geometry State
  const [geometry, setGeometry] = useState<ShelterGeometry>({
    archetype: 'trombe_wall',
    length_m: 6.0,
    width_m: 4.0,
    height_m: 2.8,
    roof_pitch_deg: 15.0,
    window_area_m2: 3.8,
    glazing_id: 'triple_low_e',
    window_orientation_deg: 180.0,
    trombe_wall_area_m2: 4.5,
    earth_bermed_depth_m: 0.0,
  });

  // 5. Envelope Multi-Layer Sections
  const [roofEnvelope, setRoofEnvelope] = useState<EnvelopeSection>({
    layers: [
      { material_id: 'aluminum_composite', thickness_mm: 3 },
      { material_id: 'puf', thickness_mm: 120 },
      { material_id: 'fiberglass_frp', thickness_mm: 4 },
    ],
  });

  const [wallEnvelope, setWallEnvelope] = useState<EnvelopeSection>({
    layers: [
      { material_id: 'aluminum_composite', thickness_mm: 3 },
      { material_id: 'puf', thickness_mm: 80 },
      { material_id: 'aerogel', thickness_mm: 20 },
      { material_id: 'fiberglass_frp', thickness_mm: 4 },
    ],
  });

  const [floorEnvelope, setFloorEnvelope] = useState<EnvelopeSection>({
    layers: [
      { material_id: 'xps', thickness_mm: 100 },
    ],
  });

  // 6. Mission Parameters
  const [params, setParams] = useState<SimulationParameters>({
    troops: 8,
    target_temp_c: 19.0,
    mission_duration_days: 90,
    infiltration_ach_base: 0.35,
    equipment_heat_w: 150.0,
    burner_efficiency: 0.82,
    diesel_energy_density_kwh_l: 10.6,
  });

  // 7. Simulation & Data State
  // Active digital-twin shelter id. Kept at app level so the twin survives
  // section switches and map selections elsewhere in the application.
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  // Imported CSV weather — overrides Open-Meteo when set
  const [importedWeather, setImportedWeather] = useState<Array<{
    hour: number; ambient_temp: number; solar_ghi: number; wind_speed: number; relative_humidity: number;
  }> | null>(null);

  // Initial Data Ingestion
  useEffect(() => {
    fetchMaterials()
      .then((data) => {
        setMaterialsDB(data.materials);
        setGlazingDB(data.glazing);
      })
      .catch((err) => console.error('Failed to load materials:', err));

    // Resolve the initial geographic anchor.
    //
    // The deployed twin is authoritative: the 3D map, the LIVE MAP and the
    // telemetry header all anchor off this state, so on reload they must adopt
    // wherever the shelter was actually relocated to. Previously this was seeded
    // from the first defence station, which meant a relocated shelter snapped
    // back to that station's coordinates on every page load while the twin
    // itself still reported the real position.
    //
    // Both requests are started together and the station result is only used as
    // a fallback, so the two cannot race and overwrite each other.
    let stationFallback: { lat: number; lng: number; elevation_m: number } | null = null;

    const stationsPromise = fetchDefenseStations()
      .then((stList) => {
        setStations(stList);
        if (stList.length > 0) {
          setCurrentStation(stList[0]);
          stationFallback = {
            lat: stList[0].lat,
            lng: stList[0].lng,
            elevation_m: stList[0].elevation_m,
          };
        }
      })
      .catch((err) => console.error('Failed to load stations:', err));

    const twinPromise = listShelters()
      .then(({ shelters }) => {
        const twin = shelters?.[0];
        if (twin?.location) {
          setSelectedShelterId(twin.id);
          setLatitude(twin.location.latitude);
          setLongitude(twin.location.longitude);
          setElevation(twin.location.elevation_m);
          return true;
        }
        return false;
      })
      .catch((err) => {
        console.warn('No deployed shelter to anchor to:', err);
        return false;
      });

    Promise.all([stationsPromise, twinPromise]).then(([, twinApplied]) => {
      // Only fall back to the station default when no twin claimed the anchor.
      if (!twinApplied && stationFallback) {
        setLatitude(stationFallback.lat);
        setLongitude(stationFallback.lng);
        setElevation(stationFallback.elevation_m);
      }
    });
  }, []);

  // Fetch Weather on Lat/Lng Change
  const loadWeather = useCallback(() => {
    fetchWeatherAndCluster(latitude, longitude, elevation)
      .then((wData) => {
        setWeatherData(wData);
        if (wData.location && wData.location.elevation_m) {
          setElevation(wData.location.elevation_m);
        }
      })
      .catch((err) => console.error('Failed to fetch weather:', err));
  }, [latitude, longitude, elevation]);

  useEffect(() => {
    loadWeather();
  }, [latitude, longitude]);

  // Execute Dynamic Simulation whenever any design parameter changes
  const executeSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      const res = await runSimulation(
        geometry,
        roofEnvelope,
        wallEnvelope,
        floorEnvelope,
        params,
        latitude,
        elevation,
        importedWeather ?? undefined
      );
      setSimResult(res);
    } catch (err) {
      console.error('Simulation execution failed:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [geometry, roofEnvelope, wallEnvelope, floorEnvelope, params, latitude, elevation, importedWeather]);

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSimulation();
    }, 100);
    return () => clearTimeout(timer);
  }, [executeSimulation]);

  // Handler: imported CSV weather feeds simulation directly
  const handleWeatherImported = (hourly: typeof importedWeather) => {
    setImportedWeather(hourly);
  };

  // Handler: imported CSV materials merge into the materialsDB
  const handleMaterialsImported = (newMats: Record<string, any>) => {
    setMaterialsDB((prev) => ({ ...prev, ...newMats }));
  };

  // Handlers
  const handleSelectStation = (st: DefenseStation) => {
    setCurrentStation(st);
    setLatitude(st.lat);
    setLongitude(st.lng);
    setElevation(st.elevation_m);
    setLocationName(st.name);
  };

  const handleSelectCustomLocation = (lat: number, lng: number, name?: string, elev?: number) => {
    setCurrentStation(null);
    setLatitude(lat);
    setLongitude(lng);
    if (elev !== undefined && elev > 0) {
      setElevation(elev);
    }
    if (name) {
      setLocationName(name);
    } else {
      setLocationName(`Coord (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`);
    }
  };

  const handleLocationSelect = (lat: number, lng: number, name?: string) => {
    setCurrentStation(null);
    setLatitude(lat);
    setLongitude(lng);
    setLocationName(name || `Custom Target (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`);
  };

  const handleApplyExactDesign = (
    geomUpdates: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string,
    troopCount?: number
  ) => {
    setGeometry((prev) => ({ ...prev, ...geomUpdates, glazing_id: glazingId }));
    setRoofEnvelope(roofEnv);
    setWallEnvelope(wallEnv);
    setFloorEnvelope(floorEnv);
    if (troopCount && troopCount > 0) {
      setParams((prev) => ({ ...prev, troops: troopCount }));
    }
    setActiveSection('overview');
  };

  const handleApplyCAD = (geomUpdates: Partial<ShelterGeometry>) => {
    setGeometry((prev) => ({ ...prev, ...geomUpdates }));
    setActiveSection('overview');
  };

  const handleEmergencyBoost = () => {
    setParams((prev) => ({ ...prev, target_temp_c: Math.min(23.0, prev.target_temp_c + 2.0) }));
  };

  const handleForceRefresh = () => {
    loadWeather();
    executeSimulation();
  };

  return (
    <div className="min-h-screen bg-[#060e20] text-[#dae2fd] flex font-sans selection:bg-[#22d3ee] selection:text-[#060e20]">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 scanline z-50 pointer-events-none" />

      {/* 1. Left Tactical Navigation Sidebar */}
      <NavigationSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onForceRefresh={handleForceRefresh}
        isSimulating={isSimulating}
        fuelSavedPct={simResult?.summary.fuel_saving_percentage || 0}
        simResult={simResult}
        weatherData={weatherData}
        params={params}
        geometry={geometry}
        latitude={latitude}
        elevation={elevation}
      />

      {/* 2. Main Content Wrapper (Shifted Right by 64 = 256px) */}
      <div className="md:ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top App Bar */}
        <TopAppBar
          activeSection={activeSection}
          currentStation={currentStation}
          stations={stations}
          latitude={latitude}
          longitude={longitude}
          elevation={elevation}
          weatherData={weatherData}
          onSelectStation={handleSelectStation}
          onSelectCustomLocation={handleSelectCustomLocation}
          onEmergencyBoost={handleEmergencyBoost}
          onOpenStatusModal={() => setIsStatusModalOpen(true)}
          onToggleAIAssistant={() => setIsAIAssistantOpen((prev) => !prev)}
          onOpenMissionModal={() => setIsMissionModalOpen(true)}
        />

        {/* Section Viewport Container */}
        <main className="flex-1 mt-16 p-4 md:p-6 overflow-y-auto">
          {activeSection === 'overview' && (
            <StrategicOverviewSection
              geometry={geometry}
              params={params}
              simResult={simResult}
              weatherData={weatherData}
              onUpdateGeometry={(updates) => setGeometry((prev) => ({ ...prev, ...updates }))}
              onUpdateParams={(updates) => setParams((prev) => ({ ...prev, ...updates }))}
              onNavigateTo={setActiveSection}
            />
          )}

          {activeSection === 'shelter_twin' && (
            <DigitalTwinSection
              geometry={geometry}
              simResult={simResult}
              troops={params.troops}
              latitude={latitude}
              longitude={longitude}
              elevation={elevation}
              locationName={locationName}
              currentStation={currentStation}
              stations={stations}
              weatherData={weatherData}
              onLocationSelect={handleLocationSelect}
              selectedShelterId={selectedShelterId}
              onShelterChange={setSelectedShelterId}
            />
          )}

          {activeSection === 'data_import' && (
            <DataImportSection
              onWeatherImported={handleWeatherImported}
              onMaterialsImported={handleMaterialsImported}
              onNavigateTo={setActiveSection}
            />
          )}

          {activeSection === 'shelter_blueprint' && (
            <RecommendedBlueprintSection
              latitude={latitude}
              elevation={elevation}
              troops={params.troops}
              onApplyExactDesign={handleApplyExactDesign}
              onNavigateTo={setActiveSection}
              simResult={simResult}
              weatherData={weatherData}
            />
          )}

          {activeSection === 'mission_config' && (
            <MissionConfigSection
              geometry={geometry}
              params={params}
              roofEnvelope={roofEnvelope}
              wallEnvelope={wallEnvelope}
              floorEnvelope={floorEnvelope}
              latitude={latitude}
              longitude={longitude}
              elevation={elevation}
              currentStation={currentStation}
              stations={stations}
              weatherData={weatherData}
              materialsDB={materialsDB}
              glazingDB={glazingDB}
              uValues={simResult?.u_values}
              onUpdateGeometry={(updates) => setGeometry((prev) => ({ ...prev, ...updates }))}
              onUpdateParams={(updates) => setParams((prev) => ({ ...prev, ...updates }))}
              onUpdateRoof={setRoofEnvelope}
              onUpdateWall={setWallEnvelope}
              onUpdateFloor={setFloorEnvelope}
              onUpdateGlazing={(gid) => setGeometry((prev) => ({ ...prev, glazing_id: gid }))}
              onLocationSelect={handleLocationSelect}
              onApplySynthesizedDesign={handleApplyExactDesign}
              onNavigateTo={setActiveSection}
            />
          )}

          {activeSection === 'thermal_analytics' && (
            <ThermalAnalyticsSection
              simResult={simResult}
              weatherData={weatherData}
            />
          )}

          {activeSection === 'ai_optimizer' && (
            <AIOptimizerSection
              troops={params.troops}
              targetTemp={params.target_temp_c}
              missionDuration={params.mission_duration_days}
              latitude={latitude}
              elevation={elevation}
              onApplyConfiguration={handleApplyExactDesign}
              onNavigateTo={setActiveSection}
            />
          )}

          {activeSection === 'cad_studio' && (
            <CADStudioSection
              onApplyCAD={handleApplyCAD}
              onNavigateTo={setActiveSection}
            />
          )}

          {activeSection === 'system_logs' && (
            <SystemLogsSection
              geometry={geometry}
              params={params}
              simResult={simResult}
              weatherData={weatherData}
              latitude={latitude}
              longitude={longitude}
              elevation={elevation}
            />
          )}

          {activeSection === 'dossier' && (
            <DossierSection
              geometry={geometry}
              params={params}
              simResult={simResult}
              weatherData={weatherData}
              latitude={latitude}
              longitude={longitude}
              elevation={elevation}
            />
          )}
        </main>
      </div>

      {/* Tactical AI Co-Pilot Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        contextData={{
          location: { name: locationName, latitude, longitude, elevation },
          weather: weatherData?.metrics_90day || {},
          shelter: geometry,
          simulation: simResult?.summary || {},
          params: params,
          envelope: { roof: roofEnvelope, wall: wallEnvelope, floor: floorEnvelope },
        }}
      />

      {/* System Subsystems Health & API Status Modal */}
      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Unified Multi-Domain Mission Assessment Report Modal */}
      <UnifiedMissionModal
        isOpen={isMissionModalOpen}
        onClose={() => setIsMissionModalOpen(false)}
        latitude={latitude}
        longitude={longitude}
        locationName={locationName}
        troops={params.troops}
        targetTempC={params.target_temp_c}
        missionDurationDays={params.mission_duration_days}
        archetype={geometry.archetype}
      />
    </div>
  );
}

export default App;
