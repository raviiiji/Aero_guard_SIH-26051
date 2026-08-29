import React, { useState, useEffect, useCallback } from 'react';
import { NavigationSidebar, NavSection } from './components/NavigationSidebar';
import { TopAppBar } from './components/TopAppBar';
import { StrategicOverviewSection } from './sections/StrategicOverviewSection';
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

export function App() {
  // 1. Navigation State
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

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

    fetchDefenseStations()
      .then((stList) => {
        setStations(stList);
        if (stList.length > 0) {
          setCurrentStation(stList[0]);
          setLatitude(stList[0].lat);
          setLongitude(stList[0].lng);
          setElevation(stList[0].elevation_m);
        }
      })
      .catch((err) => console.error('Failed to load stations:', err));
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
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setCurrentStation(null);
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleApplyExactDesign = (
    geomUpdates: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string
  ) => {
    setGeometry((prev) => ({ ...prev, ...geomUpdates, glazing_id: glazingId }));
    setRoofEnvelope(roofEnv);
    setWallEnvelope(wallEnv);
    setFloorEnvelope(floorEnv);
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
          onEmergencyBoost={handleEmergencyBoost}
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
    </div>
  );
}

export default App;
