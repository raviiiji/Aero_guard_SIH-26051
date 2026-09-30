import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Mountain,
  Flame,
  ThermometerSnowflake,
  Sun,
  Search,
  Sparkles,
  ShieldCheck,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { DefenseStation, WeatherResponse, LocationSearchResult } from '../types';
import { NavSection } from './NavigationSidebar';
import { searchLocationsApi } from '../services/locationApi';

interface TopAppBarProps {
  activeSection: NavSection;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  latitude: number;
  longitude: number;
  elevation: number;
  weatherData: WeatherResponse | null;
  onSelectStation: (station: DefenseStation) => void;
  onSelectCustomLocation: (lat: number, lng: number, name?: string, elev?: number) => void;
  onEmergencyBoost: () => void;
  onOpenStatusModal: () => void;
  onToggleAIAssistant: () => void;
  onOpenMissionModal: () => void;
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
  onSelectCustomLocation,
  onEmergencyBoost,
  onOpenStatusModal,
  onToggleAIAssistant,
  onOpenMissionModal,
}) => {
  // Location Search State (Open-Meteo Geocoding)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchLocationsApi(searchQuery, 8)
        .then((res) => {
          setSearchResults(res);
          setShowDropdown(true);
        })
        .catch((err) => console.error('Geocoding search failed:', err))
        .finally(() => setIsSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (item: LocationSearchResult) => {
    setShowDropdown(false);
    setSearchQuery(item.name);
    onSelectCustomLocation(item.latitude, item.longitude, item.name, item.elevation);
  };

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
      case 'shelter_twin':
        return 'Live Shelter Digital Twin · Map, 3D Shelter & Telemetry';
      case 'dossier':
        return 'Technical Assessment & Shelter Digital Twin Dossier';
      default:
        return 'AERO-SHIELD Command Center';
    }
  };

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#060e20]/95 backdrop-blur-md border-b border-[#8aebff]/20 flex items-center justify-between px-4 sm:px-6 font-mono">
      {/* Left: Section Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-[#8aebff] font-sans tracking-wide">
            AERO-SHIELD
          </span>
          <span className="text-[#8aebff]/40">/</span>
          <span className="text-xs font-bold text-[#dae2fd] uppercase tracking-wider hidden lg:inline">
            {getSectionTitle(activeSection)}
          </span>
        </div>
      </div>

      {/* Center: Open-Meteo Location Geocoding Search Bar */}
      <div ref={searchRef} className="relative hidden md:block w-64 lg:w-72">
        <div className="flex items-center bg-[#131b2e] border border-[#8aebff]/30 focus-within:border-cyan-400 rounded-lg px-2.5 py-1 text-xs transition-all">
          <Search className="w-3.5 h-3.5 text-cyan-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            placeholder="Search city, base, airport..."
            className="w-full bg-transparent text-[#dae2fd] placeholder-slate-500 focus:outline-none text-[11px] font-mono"
          />
          {isSearching && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
          {searchQuery && !isSearching && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 w-full mt-1.5 bg-[#0b1329] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectResult(item)}
                className="w-full text-left px-3 py-2 hover:bg-cyan-950/60 border-b border-slate-800/60 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.is_defense_station && (
                      <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-600/50">
                        MILITARY BASE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {item.region ? `${item.region}, ` : ''}{item.country}
                  </div>
                </div>
                <div className="text-right text-[10px] text-cyan-400 font-mono">
                  {item.elevation > 0 ? `${Math.round(item.elevation)}m` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions, Station Selector & Modals */}
      <div className="flex items-center gap-2.5">
        {/* Preset Military Stations Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#131b2e] border border-[#8aebff]/30 rounded px-2.5 py-1 text-xs text-[#dae2fd]">
          <MapPin className="w-3.5 h-3.5 text-[#fb923c]" />
          <select
            value={currentStation?.id || 'custom'}
            onChange={(e) => {
              const found = stations.find((s) => s.id === e.target.value);
              if (found) onSelectStation(found);
            }}
            aria-label="Deployment Sector"
            className="bg-transparent text-[#dae2fd] focus:outline-none cursor-pointer font-bold pr-1 text-xs max-w-[130px] truncate"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id} className="bg-[#0b1326] text-[#dae2fd]">
                {st.name}
              </option>
            ))}
            <option value="custom" className="bg-[#0b1326] text-[#dae2fd]">
              Custom Coordinate
            </option>
          </select>
        </div>

        {/* Unified Mission Audit Button */}
        <button
          onClick={onOpenMissionModal}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all shadow-sm"
          title="Run Unified Environmental & Airspace Mission Assessment"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline text-[11px]">MISSION AUDIT</span>
        </button>

        {/* Tactical AI Co-Pilot Toggle */}
        <button
          onClick={onToggleAIAssistant}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 text-blue-300 text-xs font-bold transition-all"
          title="Open AERO-GUARD Tactical AI Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline text-[11px]">AI CO-PILOT</span>
        </button>

        {/* Subsystem Health Indicator */}
        <button
          onClick={onOpenStatusModal}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all"
          title="Subsystem & API Status (11 Services)"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline text-[11px] text-emerald-300">11/11</span>
        </button>

        {/* Emergency Bukhari Thermal Boost */}
        <button
          onClick={onEmergencyBoost}
          className="p-1.5 text-[#fb923c] hover:bg-[#fb923c]/20 rounded border border-[#fb923c]/40 transition-all flex items-center gap-1 text-xs font-bold"
          title="Trigger Emergency Auxiliary Bukhari Thermal Boost"
        >
          <Flame className="w-3.5 h-3.5 text-[#fb923c] animate-pulse" />
          <span className="hidden lg:inline text-[11px]">BOOST</span>
        </button>
      </div>
    </header>
  );
};
