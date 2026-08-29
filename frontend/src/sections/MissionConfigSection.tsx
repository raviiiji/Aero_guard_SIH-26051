import React, { useState } from 'react';
import {
  ShelterGeometry,
  SimulationParameters,
  EnvelopeSection,
  DefenseStation,
  WeatherResponse,
  MaterialDef,
  GlazingDef,
  SectionUValue,
} from '../types';
import { GeospatialMap } from '../components/GeospatialMap';
import { ControlPanel } from '../components/ControlPanel';
import { MaterialStackBuilder } from '../components/MaterialStackBuilder';
import { CustomDataSynthesizer } from '../components/CustomDataSynthesizer';
import { Sliders, Database, Sparkles } from 'lucide-react';

interface MissionConfigSectionProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  roofEnvelope: EnvelopeSection;
  wallEnvelope: EnvelopeSection;
  floorEnvelope: EnvelopeSection;
  latitude: number;
  longitude: number;
  elevation: number;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  weatherData: WeatherResponse | null;
  materialsDB: Record<string, MaterialDef>;
  glazingDB: Record<string, GlazingDef>;
  uValues?: {
    roof: SectionUValue;
    walls: SectionUValue;
    floor: SectionUValue;
    glazing: { name: string; u_value: number; shgc: number };
  };
  onUpdateGeometry: (updates: Partial<ShelterGeometry>) => void;
  onUpdateParams: (updates: Partial<SimulationParameters>) => void;
  onUpdateRoof: (env: EnvelopeSection) => void;
  onUpdateWall: (env: EnvelopeSection) => void;
  onUpdateFloor: (env: EnvelopeSection) => void;
  onUpdateGlazing: (gid: string) => void;
  onLocationSelect: (lat: number, lng: number) => void;
  onApplySynthesizedDesign: (
    geomUpdates: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string
  ) => void;
  onNavigateTo: (section: any) => void;
}

export const MissionConfigSection: React.FC<MissionConfigSectionProps> = ({
  geometry,
  params,
  roofEnvelope,
  wallEnvelope,
  floorEnvelope,
  latitude,
  longitude,
  elevation,
  currentStation,
  stations,
  weatherData,
  materialsDB,
  glazingDB,
  uValues,
  onUpdateGeometry,
  onUpdateParams,
  onUpdateRoof,
  onUpdateWall,
  onUpdateFloor,
  onUpdateGlazing,
  onLocationSelect,
  onApplySynthesizedDesign,
  onNavigateTo,
}) => {
  const [activeMode, setActiveMode] = useState<'standard' | 'data_synthesizer'>('standard');

  return (
    <div className="space-y-4 font-mono">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between p-1.5 bg-[#060e20] border border-[#8aebff]/20 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMode('standard')}
            className={`px-4 py-2 rounded font-bold uppercase transition-all flex items-center gap-2 ${
              activeMode === 'standard'
                ? 'bg-[#8aebff] text-[#060e20] shadow-[0_0_12px_rgba(138,235,255,0.4)]'
                : 'text-[#bbc9cd] hover:text-[#8aebff]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive 3-Column Studio (Map + Envelope + Controls)</span>
          </button>

          <button
            onClick={() => setActiveMode('data_synthesizer')}
            className={`px-4 py-2 rounded font-bold uppercase transition-all flex items-center gap-2 ${
              activeMode === 'data_synthesizer'
                ? 'bg-[#22d3ee] text-[#060e20] shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'text-[#bbc9cd] hover:text-[#22d3ee]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Manual Data & Custom Material Synthesizer</span>
          </button>
        </div>

        <span className="text-[11px] text-[#45da7d] font-bold hidden md:inline pr-2">
          {params.troops} Soldiers ({params.troops * 85}W Sensible Heat) | {params.mission_duration_days} Days Campaign
        </span>
      </div>

      {activeMode === 'standard' ? (
        /* Standard 3-Column Studio */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Col 1: Geospatial Deployment Map (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <GeospatialMap
              latitude={latitude}
              longitude={longitude}
              elevation={elevation}
              currentStation={currentStation}
              stations={stations}
              weatherData={weatherData}
              onLocationSelect={onLocationSelect}
            />
          </div>

          {/* Col 2: Parametric Geometric & Mission Controls (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <ControlPanel
              geometry={geometry}
              params={params}
              onUpdateGeometry={onUpdateGeometry}
              onUpdateParams={onUpdateParams}
            />
          </div>

          {/* Col 3: Envelope Multi-Layer Insulation Stack (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <MaterialStackBuilder
              roofEnvelope={roofEnvelope}
              wallEnvelope={wallEnvelope}
              floorEnvelope={floorEnvelope}
              glazingId={geometry.glazing_id}
              materialsDB={materialsDB}
              glazingDB={glazingDB}
              uValues={uValues}
              onUpdateRoof={onUpdateRoof}
              onUpdateWall={onUpdateWall}
              onUpdateFloor={onUpdateFloor}
              onUpdateGlazing={onUpdateGlazing}
            />
          </div>
        </div>
      ) : (
        /* Manual Data & Custom Material Synthesizer Mode */
        <CustomDataSynthesizer
          geometry={geometry}
          params={params}
          latitude={latitude}
          elevation={elevation}
          onUpdateGeometry={onUpdateGeometry}
          onUpdateParams={onUpdateParams}
          onApplySynthesizedDesign={onApplySynthesizedDesign}
          onNavigateTo={onNavigateTo}
        />
      )}
    </div>
  );
};
