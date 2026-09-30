import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  RefreshCw,
  Mountain,
  Sun,
  Wind,
  Fuel,
  Plane,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { UnifiedMissionReport } from '../types';
import { runUnifiedMissionAnalysis } from '../services/missionApi';

interface UnifiedMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  locationName: string;
  troops: number;
  targetTempC: number;
  missionDurationDays: number;
  archetype: string;
}

export const UnifiedMissionModal: React.FC<UnifiedMissionModalProps> = ({
  isOpen,
  onClose,
  latitude,
  longitude,
  locationName,
  troops,
  targetTempC,
  missionDurationDays,
  archetype,
}) => {
  const [report, setReport] = useState<UnifiedMissionReport | null>(null);
  const [loading, setLoading] = useState(false);

  const executeAnalysis = () => {
    setLoading(true);
    runUnifiedMissionAnalysis(
      latitude,
      longitude,
      locationName,
      troops,
      targetTempC,
      missionDurationDays,
      archetype
    )
      .then((data) => setReport(data))
      .catch((err) => console.error('Unified mission analysis error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      executeAnalysis();
    }
  }, [isOpen, latitude, longitude]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/90 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 flex items-center justify-center border border-cyan-500/50 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                Unified Multi-Domain Mission Analysis Report
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Location: {locationName} ({latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={executeAnalysis}
              disabled={loading}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
              title="Re-run Mission Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-cyan-400 font-mono text-xs">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>Orchestrating Weather, Airspace, DEM Elevation, and ODE Physics...</span>
            </div>
          )}

          {!loading && report && (
            <>
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <Mountain className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Ground Elevation</div>
                    <div className="text-sm font-bold text-cyan-300">
                      {report.location.elevation_m}m ASL
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <Wind className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Live Wind Speed</div>
                    <div className="text-sm font-bold text-blue-300">
                      {report.environmental_telemetry.wind_speed_mps} m/s
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <Plane className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Airspace Radar</div>
                    <div className="text-sm font-bold text-emerald-300">
                      {report.airspace_security.tracked_contacts} Tracked
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <Fuel className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">Campaign Logistics</div>
                    <div className="text-sm font-bold text-amber-300">
                      {report.thermal_logistics.campaign_fuel_barrels} Fuel Barrel
                    </div>
                  </div>
                </div>
              </div>

              {/* Thermal Logistics Key Stats */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Fuel Savings vs Baseline</div>
                  <div className="text-lg font-bold text-emerald-400">
                    +{report.thermal_logistics.fuel_saving_percentage}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Daily Fuel Consumption</div>
                  <div className="text-sm font-bold text-slate-200">
                    {report.thermal_logistics.daily_fuel_liters} L/day
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Passive Solar Yield</div>
                  <div className="text-sm font-bold text-amber-300">
                    {report.thermal_logistics.passive_solar_fraction}% Solar
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Deployed Troops</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {troops} Personnel
                  </div>
                </div>
              </div>

              {/* Anomaly Checklist */}
              {report.thermal_logistics.anomalies.length > 0 && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 font-mono">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Operational Environmental Hazards Flagged</span>
                  </div>
                  {report.thermal_logistics.anomalies.map((anom, i) => (
                    <div key={i} className="text-[11px] text-red-200 font-sans pl-5">
                      • {anom.message}
                    </div>
                  ))}
                </div>
              )}

              {/* AI Executive Brief */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 font-mono">
                  <Sparkles className="w-4 h-4" />
                  <span>Tactical AI Mission Assessment & Executive Brief</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {report.ai_executive_brief}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl font-mono text-xs">
          <span className="text-slate-400 text-[11px]">
            Certified by AERO-SHIELD DRDO SIH-26051 Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
