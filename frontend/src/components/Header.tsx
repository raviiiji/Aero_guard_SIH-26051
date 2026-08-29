import React from 'react';
import {
  ShieldAlert,
  MapPin,
  Mountain,
  Sparkles,
  UploadCloud,
  FileText,
  Radio,
  Zap,
} from 'lucide-react';
import { DefenseStation } from '../types';

interface HeaderProps {
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  latitude: number;
  longitude: number;
  elevation: number;
  onSelectStation: (station: DefenseStation) => void;
  onOpenOptimizer: () => void;
  onOpenCADUploader: () => void;
  onOpenReport: () => void;
  isSimulating: boolean;
  fuelSavedPct: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentStation,
  stations,
  latitude,
  longitude,
  elevation,
  onSelectStation,
  onOpenOptimizer,
  onOpenCADUploader,
  onOpenReport,
  isSimulating,
  fuelSavedPct,
}) => {
  return (
    <header className="bg-command-900/95 border-b border-command-700/80 px-4 py-2.5 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left Branding */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 via-command-800 to-tactical-cyan/40 border border-tactical-cyan/60 shadow-glow-cyan/20">
            <ShieldAlert className="w-5 h-5 text-tactical-cyan animate-pulse-subtle" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tactical-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tactical-cyan"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-slate-100 uppercase font-mono">
                AERO-SHIELD
              </h1>
              <span className="tactical-badge bg-tactical-cyan/15 text-tactical-cyan border border-tactical-cyan/30">
                DRDO ID: 26051
              </span>
              <span className="tactical-badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hidden sm:inline-flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-tight hidden md:block">
              Autonomous Environment & Regional Optimization for High-Altitude Shelters (Ladakh Defense Sector)
            </p>
          </div>
        </div>

        {/* Center: Deployment Station Quick Switcher & Telemetry */}
        <div className="flex items-center gap-2 bg-command-950/80 border border-command-700/60 rounded-md px-3 py-1.5 font-mono text-xs">
          <div className="flex items-center gap-1 text-amber-400">
            <MapPin className="w-3.5 h-3.5" />
            <select
              value={currentStation?.id || 'custom'}
              onChange={(e) => {
                const found = stations.find((s) => s.id === e.target.value);
                if (found) onSelectStation(found);
              }}
              aria-label="Deployment Sector"
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-bold pr-2"
            >
              {stations.map((st) => (
                <option key={st.id} value={st.id} className="bg-command-900 text-slate-200">
                  {st.name}
                </option>
              ))}
              <option value="custom" className="bg-command-900 text-slate-200">
                Custom Coordinates Pin
              </option>
            </select>
          </div>

          <div className="hidden lg:flex items-center gap-3 border-l border-command-700/60 pl-3 text-slate-400">
            <span>
              LAT: <strong className="text-slate-200">{latitude.toFixed(2)}°N</strong>
            </span>
            <span>
              LNG: <strong className="text-slate-200">{longitude.toFixed(2)}°E</strong>
            </span>
            <span className="flex items-center gap-1 text-tactical-cyan">
              <Mountain className="w-3 h-3" />
              <strong>{elevation.toLocaleString()} m</strong>
            </span>
          </div>

          {fuelSavedPct > 0 && (
            <div className="hidden xl:flex items-center gap-1 border-l border-command-700/60 pl-3 text-emerald-400 font-bold">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>{fuelSavedPct}% FUEL SAVED</span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* AI Optimizer Button */}
          <button
            onClick={onOpenOptimizer}
            className="tactical-btn-amber text-xs py-1.5 px-3"
            title="Open AI Multi-Objective Optimizer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Optimizer</span>
          </button>

          {/* CAD Upload Button */}
          <button
            onClick={onOpenCADUploader}
            className="tactical-btn-secondary text-xs py-1.5 px-3"
            title="Upload Custom CAD Mesh (STL/OBJ)"
          >
            <UploadCloud className="w-3.5 h-3.5 text-tactical-cyan" />
            <span className="hidden sm:inline">CAD Import</span>
          </button>

          {/* Dossier Report Export Button */}
          <button
            onClick={onOpenReport}
            className="tactical-btn-primary text-xs py-1.5 px-3"
            title="Download DRDO Assessment Dossier"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Dossier</span>
          </button>
        </div>
      </div>
    </header>
  );
};
