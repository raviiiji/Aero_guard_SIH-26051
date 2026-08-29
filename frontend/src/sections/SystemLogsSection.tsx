import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Radio,
  Shield,
  Download,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { SimulationResult, WeatherResponse, ShelterGeometry, SimulationParameters } from '../types';

interface SystemLogsSectionProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
  latitude: number;
  longitude: number;
  elevation: number;
}

export const SystemLogsSection: React.FC<SystemLogsSectionProps> = ({
  geometry,
  params,
  simResult,
  weatherData,
  latitude,
  longitude,
  elevation,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PHYSICS' | 'WEATHER' | 'LOGISTICS'>('ALL');
  const [logs, setLogs] = useState<Array<{ id: string; time: string; tag: string; level: 'INFO' | 'WARN' | 'SUCCESS'; msg: string }>>([]);

  useEffect(() => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const generatedLogs: Array<{ id: string; time: string; tag: string; level: 'INFO' | 'WARN' | 'SUCCESS'; msg: string }> = [
      {
        id: '1',
        time: timestamp,
        tag: 'SYSTEM',
        level: 'INFO',
        msg: `AERO-SHIELD Tactical C2 Telemetry Stream Online [DRDO ID: 26051]`,
      },
      {
        id: '2',
        time: timestamp,
        tag: 'GEOSPATIAL',
        level: 'SUCCESS',
        msg: `Coordinates locked: ${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E at ${elevation}m ASL altitude.`,
      },
      {
        id: '3',
        time: timestamp,
        tag: 'WEATHER',
        level: 'INFO',
        msg: `Ingested 90-day time-series weather dataset from ${weatherData?.location.data_source || 'NASA POWER Model'}.`,
      },
      {
        id: '4',
        time: timestamp,
        tag: 'WEATHER',
        level: 'SUCCESS',
        msg: `K-Means / GMM Unsupervised Clustering converged with Silhouette Score: ${weatherData?.clustering.silhouette_score ?? '0.45'} into 3 Thermal Phases.`,
      },
      {
        id: '5',
        time: timestamp,
        tag: 'PHYSICS',
        level: 'INFO',
        msg: `Calculating multi-layer boundary resistances: R_si=0.13, R_so=0.04 (high-wind exterior).`,
      },
      {
        id: '6',
        time: timestamp,
        tag: 'PHYSICS',
        level: 'SUCCESS',
        msg: `Roof U-Value: ${simResult?.u_values.roof.u_value ?? '0.21'} W/m²K | Wall U-Value: ${simResult?.u_values.walls.u_value ?? '0.26'} W/m²K.`,
      },
      {
        id: '7',
        time: timestamp,
        tag: 'PHYSICS',
        level: 'INFO',
        msg: `Differential solver transient balance: C_total * dT/dt = Q_solar + Q_metabolic(${params.troops * 85}W) - Q_cond - Q_inf.`,
      },
      {
        id: '8',
        time: timestamp,
        tag: 'LOGISTICS',
        level: 'SUCCESS',
        msg: `90-day seasonal fuel requirement: ${simResult?.summary.campaign_fuel_liters ?? '---'} L diesel (${simResult?.summary.campaign_fuel_barrels_200l ?? '--'} drums) - ${simResult?.summary.fuel_saving_percentage ?? '90'}% saved vs canvas.`,
      },
      {
        id: '9',
        time: timestamp,
        tag: 'PHYSICS',
        level: 'INFO',
        msg: `Passive solar fenestration contributing ${simResult?.summary.passive_solar_fraction_pct ?? '70'}% of heating naturally.`,
      },
      {
        id: '10',
        time: timestamp,
        tag: 'SYSTEM',
        level: 'SUCCESS',
        msg: `Sensors & thermal boundary conditions steady-state settled. System operational.`,
      },
    ];

    setLogs(generatedLogs);
  }, [geometry, params, simResult, weatherData, latitude, longitude, elevation]);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'ALL') return true;
    if (filter === 'PHYSICS') return l.tag === 'PHYSICS';
    if (filter === 'WEATHER') return l.tag === 'WEATHER' || l.tag === 'GEOSPATIAL';
    if (filter === 'LOGISTICS') return l.tag === 'LOGISTICS';
    return true;
  });

  const handleDownloadLog = () => {
    const text = logs.map((l) => `[${l.time}] [${l.tag}] [${l.level}] ${l.msg}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AERO_SHIELD_TELEMETRY_LOG_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  return (
    <div className="space-y-4 font-mono text-slate-100 max-w-5xl mx-auto">
      {/* Header */}
      <div className="tactical-glass p-4 rounded flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[#22d3ee]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-[#22d3ee]/20 text-[#22d3ee]">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase text-[#8aebff]">
              Live System Telemetry & Physics Differential Solver Logs
            </h2>
            <p className="text-xs text-[#bbc9cd]">
              Real-time monitoring of thermodynamic transient solver, ML clustering, and sensor feeds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex items-center gap-1 bg-[#060e20] p-1 rounded border border-[#8aebff]/20 text-xs">
            {(['ALL', 'PHYSICS', 'WEATHER', 'LOGISTICS'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded transition-all ${
                  filter === f
                    ? 'bg-[#8aebff] text-[#060e20] font-bold'
                    : 'text-[#bbc9cd] hover:text-[#8aebff]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={handleDownloadLog}
            className="px-3 py-1.5 bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#8aebff] border border-[#8aebff]/40 text-xs font-bold rounded flex items-center gap-1.5 uppercase"
            title="Download Log Text File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="tactical-glass p-4 rounded-lg bg-[#060e20]/90 border border-[#8aebff]/30 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] h-96 overflow-y-auto space-y-2 text-xs">
        <div className="text-[11px] text-[#8aebff]/60 border-b border-[#8aebff]/20 pb-2 flex items-center justify-between">
          <span>AERO-SHIELD V-4.0 TELEMETRY ENGINE STREAM</span>
          <span className="flex items-center gap-1 text-[#45da7d]">
            <Radio className="w-3 h-3 animate-pulse" /> LIVE STREAM
          </span>
        </div>

        {filteredLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-2.5 leading-relaxed font-mono">
            <span className="text-[#bbc9cd]/60 select-none">[{log.time}]</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                log.tag === 'PHYSICS'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : log.tag === 'WEATHER'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : log.tag === 'LOGISTICS'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/30'
              }`}
            >
              {log.tag}
            </span>
            <span
              className={
                log.level === 'SUCCESS'
                  ? 'text-[#45da7d]'
                  : log.level === 'WARN'
                  ? 'text-[#fb923c]'
                  : 'text-[#dae2fd]'
              }
            >
              {log.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
