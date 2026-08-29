import React from 'react';
import {
  MapPin,
  Mountain,
  Flame,
  ThermometerSnowflake,
  Sun,
} from 'lucide-react';
import { DefenseStation, WeatherResponse } from '../types';
import { NavSection } from './NavigationSidebar';

interface TopAppBarProps {
  activeSection: NavSection;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  latitude: number;
  longitude: number;
  elevation: number;
  weatherData: WeatherResponse | null;
  onSelectStation: (station: DefenseStation) => void;
  onEmergencyBoost: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  activeSection,
  currentStation,
  stations,
  latitude,
  longitude,
  elevation,
  weatherData,
  onSelectStation,
  onEmergencyBoost,
}) => {
  const getSectionTitle = (sec: NavSection) => {
    switch (sec) {
      case 'overview':
        return 'Strategic Command & 3D Telemetry Overview';
      case 'shelter_blueprint':
        return 'Exact Recommended Shelter CAD Blueprint & Schematics';
      case 'mission_config':
        return 'Mission Parameters & Envelope Stack Config';
      case 'thermal_analytics':
        return '24-Hour Diurnal Thermal Curves & ML Clusters';
      case 'ai_optimizer':
        return 'AI Multi-Objective Pareto Optimization Studio';
      case 'cad_studio':
        return '3D CAD Geometry Ingestion & Facet Decomposition';
      case 'system_logs':
        return 'Real-Time Physics Engine & Sensor Telemetry Logs';
      case 'dossier':
        return 'Official DRDO Assessment Dossier & Technical Report';
      default:
        return 'AERO-SHIELD Command Center';
    }
  };

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#060e20]/90 backdrop-blur-md border-b border-[#8aebff]/20 flex items-center justify-between px-6 font-mono">
      {/* Left: Section Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-[#8aebff] font-sans tracking-wide">
            AERO-SHIELD C2
          </span>
          <span className="text-[#8aebff]/40">/</span>
          <span className="text-xs font-bold text-[#dae2fd] uppercase tracking-wider hidden sm:inline">
            {getSectionTitle(activeSection)}
          </span>
        </div>
      </div>

      {/* Center / Right Telemetry & Actions */}
      <div className="flex items-center gap-4">
        {/* Defense Post Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#131b2e] border border-[#8aebff]/30 rounded px-2.5 py-1 text-xs text-[#dae2fd]">
          <MapPin className="w-3.5 h-3.5 text-[#fb923c]" />
          <select
            value={currentStation?.id || 'custom'}
            onChange={(e) => {
              const found = stations.find((s) => s.id === e.target.value);
              if (found) onSelectStation(found);
            }}
            aria-label="Deployment Sector"
            className="bg-transparent text-[#dae2fd] focus:outline-none cursor-pointer font-bold pr-1 text-xs"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id} className="bg-[#0b1326] text-[#dae2fd]">
                {st.name}
              </option>
            ))}
            <option value="custom" className="bg-[#0b1326] text-[#dae2fd]">
              Custom Coordinate Pin
            </option>
          </select>
        </div>

        {/* Live Elevation & Coordinates */}
        <div className="hidden xl:flex items-center gap-3 border-l border-[#8aebff]/20 pl-3 text-xs text-[#bbc9cd]">
          <span className="flex items-center gap-1 text-[#8aebff]">
            <Mountain className="w-3.5 h-3.5" />
            <strong className="text-[#dae2fd]">{elevation.toLocaleString()} m</strong>
          </span>
          <span>
            LAT: <strong className="text-[#dae2fd]">{latitude.toFixed(2)}°N</strong>
          </span>
          <span>
            LNG: <strong className="text-[#dae2fd]">{longitude.toFixed(2)}°E</strong>
          </span>
        </div>

        {/* Weather Quick Snapshot */}
        {weatherData && (
          <div className="hidden lg:flex items-center gap-3 border-l border-[#8aebff]/20 pl-3 text-xs">
            <span className="flex items-center gap-1 text-[#38bdf8]">
              <ThermometerSnowflake className="w-3.5 h-3.5" />
              <strong>{weatherData.metrics_90day.extreme_min_temp_c}°C</strong>
            </span>
            <span className="flex items-center gap-1 text-[#fb923c]">
              <Sun className="w-3.5 h-3.5" />
              <strong>{weatherData.metrics_90day.avg_daily_solar_kwh_m2} kWh/m²</strong>
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 border-l border-[#8aebff]/20 pl-3">
          <button
            onClick={onEmergencyBoost}
            className="p-1.5 text-[#fb923c] hover:bg-[#fb923c]/20 rounded border border-[#fb923c]/40 transition-all flex items-center gap-1 text-xs font-bold"
            title="Trigger Emergency Auxiliary Bukhari Thermal Boost"
          >
            <Flame className="w-3.5 h-3.5 text-[#fb923c] animate-pulse" />
            <span className="hidden sm:inline text-[11px]">THERMAL BOOST</span>
          </button>
        </div>
      </div>
    </header>
  );
};
