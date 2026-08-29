import React, { useState } from 'react';
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
  X,
  Fuel,
  Zap,
  Sun,
  Users,
  Flame,
  Activity,
  ShieldCheck,
  Thermometer,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  DefenseStation,
  SimulationResult,
  WeatherResponse,
  SimulationParameters,
  ShelterGeometry,
} from '../types';

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
  simResult?: SimulationResult | null;
  weatherData?: WeatherResponse | null;
  params?: SimulationParameters;
  geometry?: ShelterGeometry;
  latitude?: number;
  elevation?: number;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeSection,
  onSelectSection,
  onForceRefresh,
  isSimulating,
  fuelSavedPct,
  simResult,
  weatherData,
  params,
  geometry,
  latitude = 34.15,
  elevation = 3500,
}) => {
  const [showTelemetryModal, setShowTelemetryModal] = useState<boolean>(false);

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

  const summary = simResult?.summary;
  const uValues = simResult?.u_values;
  const latestHour = simResult?.hourly_timeseries?.[12];

  return (
    <>
      <aside className="w-64 h-screen fixed left-0 top-0 bg-[#060e20]/95 backdrop-blur-xl border-r border-[#8aebff]/20 shadow-[0_0_20px_rgba(47,217,244,0.1)] flex flex-col justify-between py-5 z-40 font-mono">
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

          {/* Interactive Status Chip -> Opens Full Data Modal */}
          <div
            onClick={() => setShowTelemetryModal(true)}
            title="Click to view all live simulation & telemetry data"
            className="mx-4 mb-4 p-2 bg-[#131b2e] border border-[#8aebff]/30 hover:border-[#8aebff] rounded text-[11px] flex items-center justify-between text-[#bbc9cd] cursor-pointer hover:bg-[#1b253b] hover:shadow-[0_0_15px_rgba(138,235,255,0.2)] transition-all group"
          >
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#66f796] animate-pulse" />
              <span className="text-[#dae2fd] font-bold group-hover:text-[#8aebff] transition-colors">
                SYSTEM ACTIVE
              </span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[#66f796] font-bold">
                {fuelSavedPct > 0 ? `${fuelSavedPct}% SAVED` : 'READY'}
              </span>
              <span className="text-[10px] text-[#8aebff] opacity-0 group-hover:opacity-100 transition-opacity">
                🔍
              </span>
            </div>
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

      {/* 4. Full Live Telemetry & Simulation Data Modal */}
      {showTelemetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-mono text-slate-100">
          <div className="bg-[#070e20] border-2 border-[#8aebff] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-[0_0_40px_rgba(138,235,255,0.3)] relative space-y-5">
            {/* Corner Bracket Design */}
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-br" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#8aebff]/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#45da7d]/20 text-[#45da7d] rounded border border-[#45da7d]/40">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#8aebff] uppercase tracking-wider">
                      LIVE SIMULATION TELEMETRY & FULL DATA MATRIX
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#45da7d]/20 text-[#45da7d] border border-[#45da7d]/40">
                      SOLVER HEALTHY
                    </span>
                  </div>
                  <p className="text-xs text-[#bbc9cd]">
                    DRDO Problem ID: 26051 | Sector: {latitude.toFixed(2)}°N at {elevation.toLocaleString()}m ASL
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowTelemetryModal(false)}
                className="p-1.5 rounded-lg bg-[#131b2e] hover:bg-[#ef4444] text-[#bbc9cd] hover:text-white border border-[#8aebff]/30 transition-all"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Matrix 1: 90-Day Campaign Fuel & Logistics Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8aebff] uppercase">
                <Fuel className="w-4 h-4 text-[#fb923c]" />
                <span>1. 90-Day Mission Logistics & Fuel Savings Matrix</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Fuel Savings vs Baseline:</div>
                  <div className="text-lg font-black text-[#45da7d] mt-0.5">
                    {summary?.fuel_saving_percentage ?? 68.8}%
                  </div>
                  <div className="text-[10px] text-[#45da7d]">
                    {summary?.fuel_saved_liters.toLocaleString() ?? '1,001'} Liters Saved
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Designed Fuel Demand:</div>
                  <div className="text-lg font-black text-[#fb923c] mt-0.5">
                    {summary?.campaign_fuel_liters.toLocaleString() ?? '454'} L
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    ({summary?.campaign_fuel_barrels_200l ?? 2} Barrels of 200L)
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Legacy Canvas Tent Baseline:</div>
                  <div className="text-lg font-black text-[#dae2fd] mt-0.5">
                    {summary?.baseline_campaign_fuel_liters.toLocaleString() ?? '1,455'} L
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    (~8 Barrels of 200L)
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Structure Transport Mass:</div>
                  <div className="text-lg font-black text-[#8aebff] mt-0.5">
                    {summary?.total_shelter_weight_kg.toLocaleString() ?? '1,840'} kg
                  </div>
                  <div className="text-[10px] text-[#45da7d]">
                    Helicopter Slingable
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix 2: Thermodynamic Heat Balance & ASHRAE Metabolic Gains */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8aebff] uppercase">
                <Flame className="w-4 h-4 text-[#fb923c]" />
                <span>2. Instantaneous Thermal Influx & ASHRAE 55 Metabolic Gains</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Occupant Metabolic Heat:</div>
                  <div className="text-base font-bold text-[#45da7d] mt-0.5">
                    {(params?.troops ?? 8) * 85} Watts
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    {params?.troops ?? 8} Soldiers × 85W (ASHRAE)
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Peak Solar Heat Gain:</div>
                  <div className="text-base font-bold text-[#f59e0b] mt-0.5">
                    {latestHour?.solar_gain_w ?? 820} Watts
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    Window + Trombe Capture
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Total Envelope Loss Rate:</div>
                  <div className="text-base font-bold text-[#38bdf8] mt-0.5">
                    {latestHour?.total_loss_w ?? 1850} Watts
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    $UA \cdot \Delta T$ Thermal Flux
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Net Heater Deficit ($Q_{'{aux}'}$):</div>
                  <div className="text-base font-bold text-[#fb923c] mt-0.5">
                    {latestHour?.auxiliary_heating_deficit_w ?? 350} Watts
                  </div>
                  <div className="text-[10px] text-[#45da7d]">
                    Passive Offset: {(100 - (summary?.fuel_saving_percentage ?? 68.8)).toFixed(1)}% Load
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix 3: Active Envelope Transmittance (U-Values) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8aebff] uppercase">
                <Layers className="w-4 h-4 text-[#22d3ee]" />
                <span>3. Active Architectural Archetype & Envelope Thermal Transmittance</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Active Archetype:</div>
                  <div className="font-bold text-[#dae2fd] text-sm mt-0.5">
                    {geometry?.archetype.replace('_', ' ').toUpperCase() ?? 'TROMBE WALL'}
                  </div>
                  <div className="text-[10px] text-[#8aebff]">
                    {geometry?.length_m ?? 6}m × {geometry?.width_m ?? 4}m × {geometry?.height_m ?? 2.8}m
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Roof Transmittance ($U$):</div>
                  <div className="font-bold text-[#45da7d] text-sm mt-0.5">
                    {uValues?.roof.u_value ?? 0.17} W/m²K
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    PUF + ACP Composite
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Wall Transmittance ($U$):</div>
                  <div className="font-bold text-[#45da7d] text-sm mt-0.5">
                    {uValues?.walls.u_value ?? 0.18} W/m²K
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    PUF + Aerogel Core
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#bbc9cd]">Solar Glazing ($U$ / SHGC):</div>
                  <div className="font-bold text-[#fb923c] text-sm mt-0.5">
                    {uValues?.glazing.u_value ?? 0.80} W/m²K
                  </div>
                  <div className="text-[10px] text-[#bbc9cd]">
                    Triple Low-E Argon
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Navigation Shortcuts */}
            <div className="pt-2 border-t border-[#8aebff]/20 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#bbc9cd]">
                Jump to detailed engineering view:
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowTelemetryModal(false);
                    onSelectSection('thermal_analytics');
                  }}
                  className="px-3 py-1.5 bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#8aebff] border border-[#8aebff]/40 text-xs font-bold rounded uppercase transition-all"
                >
                  📊 24h Thermal Curves
                </button>
                <button
                  onClick={() => {
                    setShowTelemetryModal(false);
                    onSelectSection('shelter_blueprint');
                  }}
                  className="px-3 py-1.5 bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#8aebff] border border-[#8aebff]/40 text-xs font-bold rounded uppercase transition-all"
                >
                  📐 CAD Blueprint
                </button>
                <button
                  onClick={() => {
                    setShowTelemetryModal(false);
                    onSelectSection('dossier');
                  }}
                  className="px-3 py-1.5 bg-[#8aebff] hover:bg-[#a2eeff] text-[#060e20] text-xs font-bold rounded uppercase shadow-[0_0_12px_rgba(138,235,255,0.4)] transition-all"
                >
                  📋 Official DRDO Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
