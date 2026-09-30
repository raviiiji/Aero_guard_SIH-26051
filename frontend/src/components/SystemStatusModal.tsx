import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  CloudSun,
  Map,
  Satellite,
  Mountain,
  Plane,
  Sparkles,
  Cpu,
  Box,
  Sliders,
  Flame,
} from 'lucide-react';
import { SubsystemStatusReport } from '../types';
import { fetchSystemStatus } from '../services/missionApi';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [statusReport, setStatusReport] = useState<SubsystemStatusReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    setLoading(true);
    fetchSystemStatus()
      .then((data) => setStatusReport(data))
      .catch((err) => console.error('Status fetch failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const servicesList = [
    { key: 'backend', name: 'FastAPI Backend Engine', icon: Server, desc: 'Uvicorn ASGI local server on port 8000' },
    { key: 'weather', name: 'Open-Meteo Live Meteorology', icon: CloudSun, desc: 'Real-time temperature, wind gusts, and 7-day forecast' },
    { key: 'maps', name: 'MapTiler Tactical Maps', icon: Map, desc: 'Satellite, terrain, and topographic raster tiles' },
    { key: 'satellite', name: 'Copernicus Sentinel Hub', icon: Satellite, desc: 'Sentinel-2 L2A multispectral Earth observation' },
    { key: 'elevation', name: 'OpenTopography / DEM', icon: Mountain, desc: 'High-altitude digital elevation model terrain ground-truth' },
    { key: 'aircraft', name: 'OpenSky Network Airspace', icon: Plane, desc: 'Live ADS-B aircraft traffic & tactical UAV telemetry' },
    { key: 'ai', name: 'OpenAI Tactical Assistant', icon: Sparkles, desc: 'GPT-4o-mini grounded in physical simulation state' },
    { key: 'ml', name: 'ML Seasonal Clustering', icon: Cpu, desc: 'K-Means & GMM high-altitude weather phase classifier' },
    { key: 'cad', name: 'Trimesh 3D CAD Parser', icon: Box, desc: 'STL/OBJ surface area & normal vector azimuth extractor' },
    { key: 'optimizer', name: 'Pareto Frontier Optimizer', icon: Sliders, desc: 'Multi-objective genetic algorithm for envelope design' },
    { key: 'simulation', name: 'Dynamic ODE Physics Engine', icon: Flame, desc: '24-hour transient heat balance differential solver' },
  ];

  const getStatusBadge = (status?: string) => {
    if (status === 'healthy' || status === 'operational') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ONLINE
        </span>
      );
    }
    if (status === 'configured') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/80 text-cyan-300 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
          CONFIGURED
        </span>
      );
    }
    if (status === 'fallback_active' || status === 'local_rules_engine') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-500/80 text-amber-300 flex items-center gap-1">
          <Info className="w-3 h-3 text-amber-400" />
          ACTIVE (FALLBACK)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 border border-slate-700 text-slate-400 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 text-slate-400" />
        OPTIONAL / UNCONFIGURED
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-[#0b1329] border border-cyan-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-950/90 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-500/50 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                Subsystems & API Integration Health Monitor
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                11 Internal & External Defense Services Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStatus}
              disabled={loading}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
              title="Refresh Health Status"
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
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {servicesList.map((srv) => {
              const currentSubStatus = statusReport?.subsystems
                ? (statusReport.subsystems as any)[srv.key]
                : undefined;

              return (
                <div
                  key={srv.key}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                        <srv.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {srv.name}
                      </span>
                    </div>
                    {getStatusBadge(currentSubStatus)}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {srv.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Quick Environment Variables Key Guide */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-cyan-400 mb-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Optional API Keys Activation (.env)</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2 font-sans">
              Real-world open APIs (Open-Meteo, OpenSky, DEM) are fully operational out of the box with zero keys required. Optional credentials can be configured anytime:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
              <div>• <strong className="text-slate-200">MAPTILER_API_KEY:</strong> MapTiler Cloud tiles</div>
              <div>• <strong className="text-slate-200">SENTINELHUB_CLIENT_ID:</strong> ESA satellite imagery</div>
              <div>• <strong className="text-slate-200">OPENTOPOGRAPHY_API_KEY:</strong> SRTM high-res DEM</div>
              <div>• <strong className="text-slate-200">OPENAI_API_KEY:</strong> GPT-4o-mini co-pilot</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl font-mono text-xs">
          <span className="text-slate-400 text-[11px]">
            DRDO SIH-26051 • High-Altitude Shelter Suite
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
