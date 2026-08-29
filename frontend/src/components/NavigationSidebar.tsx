import React from 'react';
import {
  LayoutDashboard,
  Sliders,
  LineChart,
  Sparkles,
  Box,
  Terminal,
  FileText,
  Shield,
  RefreshCw,
  Radio,
  Compass,
  Upload,
} from 'lucide-react';
import { DefenseStation } from '../types';

export type NavSection =
  | 'overview'
  | 'data_import'
  | 'shelter_blueprint'
  | 'mission_config'
  | 'thermal_analytics'
  | 'ai_optimizer'
  | 'cad_studio'
  | 'system_logs'
  | 'dossier';

interface NavigationSidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onForceRefresh: () => void;
  isSimulating: boolean;
  fuelSavedPct: number;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeSection,
  onSelectSection,
  onForceRefresh,
  isSimulating,
  fuelSavedPct,
}) => {
  const navItems = [
    {
      id: 'overview' as NavSection,
      label: 'Strategic Overview',
      icon: LayoutDashboard,
      badge: 'C2 VIEW',
    },
    {
      id: 'data_import' as NavSection,
      label: 'Data Feeder',
      icon: Upload,
      badge: 'CSV IMPORT',
    },
    {
      id: 'shelter_blueprint' as NavSection,
      label: 'Exact Shelter Blueprint',
      icon: Compass,
      badge: 'RECOMMENDED CAD',
    },
    {
      id: 'mission_config' as NavSection,
      label: 'Mission Config',
      icon: Sliders,
      badge: 'GEO & STACK',
    },
    {
      id: 'thermal_analytics' as NavSection,
      label: 'Thermal Analytics',
      icon: LineChart,
      badge: '24H / 90D',
    },
    {
      id: 'ai_optimizer' as NavSection,
      label: 'AI Optimizer',
      icon: Sparkles,
      badge: 'PARETO',
    },
    {
      id: 'cad_studio' as NavSection,
      label: 'CAD Geometry Studio',
      icon: Box,
      badge: 'STL/OBJ',
    },
    {
      id: 'system_logs' as NavSection,
      label: 'System Logs',
      icon: Terminal,
      badge: 'TELEMETRY',
    },
    {
      id: 'dossier' as NavSection,
      label: 'DRDO Dossier',
      icon: FileText,
      badge: 'REPORT',
    },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#060e20]/95 backdrop-blur-xl border-r border-[#8aebff]/20 shadow-[0_0_20px_rgba(47,217,244,0.1)] flex flex-col justify-between py-5 z-50 font-mono">
      {/* 1. Header & Brand */}
      <div>
        <div className="px-5 flex items-center gap-3.5 mb-6">
          <div className="relative flex items-center justify-center w-11 h-11 rounded bg-gradient-to-br from-[#005763] to-[#22d3ee]/30 border border-[#8aebff]/40 shadow-[0_0_12px_rgba(47,217,244,0.3)]">
            <Shield className="w-6 h-6 text-[#8aebff]" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8aebff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8aebff]"></span>
            </span>
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-[#8aebff] uppercase font-sans">
              AERO-SHIELD
            </h1>
            <p className="text-[10px] font-bold text-[#8aebff]/70 tracking-widest uppercase">
              DRDO ID: 26051
            </p>
          </div>
        </div>

        {/* Status Chip */}
        <div className="mx-4 mb-4 p-2 bg-[#131b2e] border border-[#8aebff]/20 rounded text-[11px] flex items-center justify-between text-[#bbc9cd]">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-[#66f796] animate-pulse" />
            <span className="text-[#dae2fd] font-bold">SYSTEM ACTIVE</span>
          </span>
          {fuelSavedPct > 0 && (
            <span className="text-[#66f796] font-bold">
              {fuelSavedPct}% SAVED
            </span>
          )}
        </div>

        {/* 2. Navigation Links */}
        <nav className="px-3 flex flex-col gap-1.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded text-xs font-bold tracking-wide transition-all ${
                  isActive
                    ? 'text-[#060e20] bg-[#8aebff] shadow-[0_0_15px_rgba(138,235,255,0.4)] font-black'
                    : 'text-[#bbc9cd] hover:bg-[#8aebff]/10 hover:text-[#8aebff]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#060e20]' : 'text-[#8aebff]'}`} />
                  <span className="font-sans uppercase text-[11px]">{item.label}</span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? 'bg-[#060e20]/20 text-[#060e20]' : 'bg-[#131b2e] text-[#8aebff]/60 border border-[#8aebff]/20'
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Footer CTA & Info */}
      <div className="px-4 space-y-3">
        <button
          onClick={onForceRefresh}
          disabled={isSimulating}
          className="w-full py-2.5 border border-[#8aebff] text-[#8aebff] font-mono text-[11px] font-bold uppercase bg-[#8aebff]/10 hover:bg-[#8aebff]/30 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(138,235,255,0.15)] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'RE-COMPUTING...' : 'FORCE REFRESH'}</span>
        </button>

        <div className="border-t border-[#8aebff]/20 pt-3 flex flex-col gap-1.5 text-[11px] text-[#bbc9cd]">
          <div className="flex items-center justify-between text-[10px] text-[#bbc9cd]/60">
            <span>HIGH-ALTITUDE THERMAL C2</span>
            <span>V-4.0 ALPHA</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
