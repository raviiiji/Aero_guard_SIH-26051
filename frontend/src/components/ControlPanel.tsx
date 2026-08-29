import React from 'react';
import {
  Sliders,
  Users,
  Thermometer,
  Calendar,
  Compass,
  Wind,
  Shield,
  Sun,
  Home,
} from 'lucide-react';
import { ShelterGeometry, SimulationParameters } from '../types';

interface ControlPanelProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  onUpdateGeometry: (updates: Partial<ShelterGeometry>) => void;
  onUpdateParams: (updates: Partial<SimulationParameters>) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  geometry,
  params,
  onUpdateGeometry,
  onUpdateParams,
}) => {
  // Preset Archetypes
  const archetypes = [
    { id: 'modular_box', name: 'Modular Box', icon: Home, desc: 'Quick deploy standard shelter' },
    { id: 'trombe_wall', name: 'Trombe Wall', icon: Sun, desc: 'South solar heat storage wall' },
    { id: 'earth_bermed', name: 'Earth-Bermed', icon: Shield, desc: 'Subterranean wind/chill bunker' },
    { id: 'quonset_dome', name: 'Quonset Arch', icon: Wind, desc: 'Aerodynamic wind shedding' },
  ];

  const handleArchetypeSelect = (archId: any) => {
    let updates: Partial<ShelterGeometry> = { archetype: archId };
    if (archId === 'trombe_wall') {
      updates.trombe_wall_area_m2 = 4.5;
      updates.earth_bermed_depth_m = 0.0;
      updates.window_orientation_deg = 180; // South
    } else if (archId === 'earth_bermed') {
      updates.earth_bermed_depth_m = 1.8;
      updates.trombe_wall_area_m2 = 0.0;
    } else {
      updates.trombe_wall_area_m2 = 0.0;
      updates.earth_bermed_depth_m = 0.0;
    }
    onUpdateGeometry(updates);
  };

  return (
    <div className="tactical-card p-3.5 flex flex-col gap-3.5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-command-700/60">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-tactical-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Parametric Controls & Mission Profile
          </h2>
        </div>
      </div>

      {/* 1. Structural Archetype Selector */}
      <div>
        <label className="text-[11px] font-mono font-bold text-slate-300 uppercase block mb-1.5">
          Shelter Structural Archetype
        </label>
        <div className="grid grid-cols-2 gap-1.5 font-mono">
          {archetypes.map((arch) => {
            const Icon = arch.icon;
            const isSelected = geometry.archetype === arch.id;
            return (
              <button
                key={arch.id}
                onClick={() => handleArchetypeSelect(arch.id)}
                className={`p-2 rounded border text-left flex items-start gap-2 transition-all ${
                  isSelected
                    ? 'bg-command-800 border-tactical-cyan text-tactical-cyan shadow-glow-cyan/20'
                    : 'bg-command-950/70 border-command-700/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold">{arch.name}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{arch.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Geometric Dimensions Sliders */}
      <div className="space-y-2.5 font-mono text-xs pt-1 border-t border-command-700/60">
        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
          Shelter Dimensions & Solar Fenestration
        </div>

        {/* Length */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span>Length ($L$)</span>
            <strong className="text-tactical-cyan">{geometry.length_m} m</strong>
          </div>
          <input
            type="range"
            min={3.0}
            max={12.0}
            step={0.2}
            value={geometry.length_m}
            onChange={(e) => onUpdateGeometry({ length_m: parseFloat(e.target.value) })}
            className="w-full accent-tactical-cyan cursor-pointer"
          />
        </div>

        {/* Width */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span>Width ($W$)</span>
            <strong className="text-tactical-cyan">{geometry.width_m} m</strong>
          </div>
          <input
            type="range"
            min={2.5}
            max={8.0}
            step={0.2}
            value={geometry.width_m}
            onChange={(e) => onUpdateGeometry({ width_m: parseFloat(e.target.value) })}
            className="w-full accent-tactical-cyan cursor-pointer"
          />
        </div>

        {/* Height */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span>Height ($H$)</span>
            <strong className="text-tactical-cyan">{geometry.height_m} m</strong>
          </div>
          <input
            type="range"
            min={2.2}
            max={4.0}
            step={0.1}
            value={geometry.height_m}
            onChange={(e) => onUpdateGeometry({ height_m: parseFloat(e.target.value) })}
            className="w-full accent-tactical-cyan cursor-pointer"
          />
        </div>

        {/* Roof Pitch */}
        {geometry.archetype !== 'quonset_dome' && (
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Roof Pitch (Gable Angle)</span>
              <strong className="text-slate-200">{geometry.roof_pitch_deg}°</strong>
            </div>
            <input
              type="range"
              min={0}
              max={45}
              step={5}
              value={geometry.roof_pitch_deg}
              onChange={(e) => onUpdateGeometry({ roof_pitch_deg: parseFloat(e.target.value) })}
              className="w-full accent-tactical-cyan cursor-pointer"
            />
          </div>
        )}

        {/* Window Area */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span>Solar Glazing Area</span>
            <strong className="text-amber-400">{geometry.window_area_m2} m²</strong>
          </div>
          <input
            type="range"
            min={0.5}
            max={8.0}
            step={0.2}
            value={geometry.window_area_m2}
            onChange={(e) => onUpdateGeometry({ window_area_m2: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Window Orientation */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span>Window Orientation Azimuth</span>
            <strong className="text-amber-400">
              {geometry.window_orientation_deg === 180
                ? '180° (True South - Optimal)'
                : `${geometry.window_orientation_deg}°`}
            </strong>
          </div>
          <input
            type="range"
            min={90}
            max={270}
            step={15}
            value={geometry.window_orientation_deg}
            onChange={(e) => onUpdateGeometry({ window_orientation_deg: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Trombe Wall Slider (if active) */}
        {geometry.archetype === 'trombe_wall' && (
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Trombe Thermal Mass Area</span>
              <strong className="text-purple-400">{geometry.trombe_wall_area_m2} m²</strong>
            </div>
            <input
              type="range"
              min={1.0}
              max={10.0}
              step={0.5}
              value={geometry.trombe_wall_area_m2}
              onChange={(e) => onUpdateGeometry({ trombe_wall_area_m2: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
        )}

        {/* Earth Berming Depth (if active) */}
        {geometry.archetype === 'earth_bermed' && (
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>Earth-Berm Soil Depth</span>
              <strong className="text-emerald-400">{geometry.earth_bermed_depth_m} m</strong>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={geometry.earth_bermed_depth_m}
              onChange={(e) => onUpdateGeometry({ earth_bermed_depth_m: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* 3. Military Mission Parameters */}
      <div className="space-y-2.5 font-mono text-xs pt-2 border-t border-command-700/60">
        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
          Mission Tactical Parameters
        </div>

        {/* Troop Count */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-400" /> Troop Capacity
            </span>
            <strong className="text-blue-400">
              {params.troops} Soldiers ({params.troops * 85}W Heat)
            </strong>
          </div>
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={params.troops}
            onChange={(e) => onUpdateParams({ troops: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-400 cursor-pointer"
          />
        </div>

        {/* Comfort Target Temp */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-rose-400" /> Target Comfort Temp
            </span>
            <strong className="text-rose-400">{params.target_temp_c}°C (DRDO Standard)</strong>
          </div>
          <input
            type="range"
            min={15.0}
            max={23.0}
            step={0.5}
            value={params.target_temp_c}
            onChange={(e) => onUpdateParams({ target_temp_c: parseFloat(e.target.value) })}
            className="w-full accent-rose-400 cursor-pointer"
          />
        </div>

        {/* Mission Duration */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> Campaign Duration
            </span>
            <strong className="text-emerald-400">{params.mission_duration_days} Days</strong>
          </div>
          <input
            type="range"
            min={15}
            max={180}
            step={15}
            value={params.mission_duration_days}
            onChange={(e) => onUpdateParams({ mission_duration_days: parseInt(e.target.value, 10) })}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* Infiltration ACH */}
        <div>
          <div className="flex justify-between text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-slate-300" /> Air Infiltration (ACH)
            </span>
            <strong className="text-slate-200">{params.infiltration_ach_base} ACH</strong>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.5}
            step={0.05}
            value={params.infiltration_ach_base}
            onChange={(e) => onUpdateParams({ infiltration_ach_base: parseFloat(e.target.value) })}
            className="w-full accent-slate-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
