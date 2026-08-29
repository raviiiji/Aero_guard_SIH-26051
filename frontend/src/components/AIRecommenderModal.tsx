import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  Fuel,
  TrendingDown,
  Layers,
  Award,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  OptimizationResponse,
  CandidateOptimization,
  ShelterGeometry,
  EnvelopeSection,
} from '../types';
import { runOptimization } from '../services/api';

interface AIRecommenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  troops: number;
  targetTemp: number;
  missionDuration: number;
  latitude: number;
  elevation: number;
  onApplyConfiguration: (
    geometry: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string
  ) => void;
}

export const AIRecommenderModal: React.FC<AIRecommenderModalProps> = ({
  isOpen,
  onClose,
  troops,
  targetTemp,
  missionDuration,
  latitude,
  elevation,
  onApplyConfiguration,
}) => {
  const [loading, setLoading] = useState(false);
  const [optData, setOptData] = useState<OptimizationResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOptimization | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    runOptimization(troops, targetTemp, missionDuration, latitude, elevation)
      .then((data) => {
        setOptData(data);
        setSelectedCandidate(data.recommendations.best_overall);
      })
      .catch((err) => console.error('Optimization error:', err))
      .finally(() => setLoading(false));
  }, [isOpen, troops, targetTemp, missionDuration, latitude, elevation]);

  if (!isOpen) return null;

  const handleApply = (candidate: CandidateOptimization) => {
    onApplyConfiguration(
      {
        archetype: candidate.archetype as any,
        window_area_m2: candidate.window_area_m2,
        trombe_wall_area_m2: candidate.trombe_area_m2,
        earth_bermed_depth_m: candidate.earth_bermed_depth_m,
      },
      { layers: candidate.roof_layers },
      { layers: candidate.wall_layers },
      { layers: candidate.floor_layers },
      'triple_low_e'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-command-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-command-900 border border-command-700/90 rounded-xl shadow-tactical max-w-4xl w-full max-h-[90vh] flex flex-col font-mono text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-command-700/80 bg-command-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                AERO-SHIELD AI Multi-Objective Recommender
              </h2>
              <p className="text-[11px] text-slate-400">
                Pareto Optimization balancing Fuel Logistics, Transport Payload Weight, and Thermal Comfort
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-command-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 flex-grow overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Sparkles className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <div className="text-sm font-bold text-slate-200">
                Running Multi-Objective Optimization Engine...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Simulating thermal transmittance, Sol-Air flux, and logistics payloads
              </div>
            </div>
          ) : optData ? (
            <>
              {/* Top 3 Featured Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Best Overall */}
                {optData.recommendations.best_overall && (
                  <div
                    onClick={() => setSelectedCandidate(optData.recommendations.best_overall)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      selectedCandidate?.config_id === optData.recommendations.best_overall.config_id
                        ? 'bg-command-800 border-amber-400 shadow-glow-amber/20'
                        : 'bg-command-950/70 border-command-700/70 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="tactical-badge bg-amber-400/20 text-amber-400 border border-amber-400/30">
                        <Award className="w-3 h-3 mr-1" /> BEST MILITARY VALUE
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-100">
                      {optData.recommendations.best_overall.name}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div>
                        90d Fuel:{' '}
                        <strong className="text-amber-400">
                          {optData.recommendations.best_overall.campaign_fuel_liters} L (
                          {optData.recommendations.best_overall.fuel_saving_percentage}% Saved)
                        </strong>
                      </div>
                      <div>
                        Payload:{' '}
                        <strong className="text-tactical-cyan">
                          {optData.recommendations.best_overall.total_shelter_weight_kg} kg
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Minimum Fuel */}
                {optData.recommendations.min_fuel_consumption && (
                  <div
                    onClick={() => setSelectedCandidate(optData.recommendations.min_fuel_consumption)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      selectedCandidate?.config_id === optData.recommendations.min_fuel_consumption.config_id
                        ? 'bg-command-800 border-emerald-400 shadow-glow-emerald/20'
                        : 'bg-command-950/70 border-command-700/70 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="tactical-badge bg-emerald-400/20 text-emerald-400 border border-emerald-400/30">
                        <Zap className="w-3 h-3 mr-1" /> ZERO DEFICIT / MIN FUEL
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-100">
                      {optData.recommendations.min_fuel_consumption.name}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div>
                        90d Fuel:{' '}
                        <strong className="text-emerald-400">
                          {optData.recommendations.min_fuel_consumption.campaign_fuel_liters} L (
                          {optData.recommendations.min_fuel_consumption.fuel_saving_percentage}% Saved)
                        </strong>
                      </div>
                      <div>
                        Payload:{' '}
                        <strong className="text-tactical-cyan">
                          {optData.recommendations.min_fuel_consumption.total_shelter_weight_kg} kg
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Lightweight Tactical Airlift */}
                {optData.recommendations.lightweight_airlift && (
                  <div
                    onClick={() => setSelectedCandidate(optData.recommendations.lightweight_airlift)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      selectedCandidate?.config_id === optData.recommendations.lightweight_airlift.config_id
                        ? 'bg-command-800 border-tactical-cyan shadow-glow-cyan/20'
                        : 'bg-command-950/70 border-command-700/70 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="tactical-badge bg-tactical-cyan/20 text-tactical-cyan border border-tactical-cyan/30">
                        <Layers className="w-3 h-3 mr-1" /> AIRLIFT OPTIMIZED
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-100">
                      {optData.recommendations.lightweight_airlift.name}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div>
                        Payload:{' '}
                        <strong className="text-tactical-cyan">
                          {optData.recommendations.lightweight_airlift.total_shelter_weight_kg} kg
                        </strong>
                      </div>
                      <div>
                        90d Fuel:{' '}
                        <strong className="text-amber-400">
                          {optData.recommendations.lightweight_airlift.campaign_fuel_liters} L
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Full Candidate Comparison Table */}
              <div className="border border-command-700/80 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-command-950/90 text-slate-400 border-b border-command-700">
                    <tr>
                      <th className="p-2.5">Candidate Design</th>
                      <th className="p-2.5">Archetype</th>
                      <th className="p-2.5">Wall $U$-Value</th>
                      <th className="p-2.5">90-Day Fuel</th>
                      <th className="p-2.5">Fuel Saved %</th>
                      <th className="p-2.5">Payload Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-command-800/60">
                    {optData.candidate_comparisons.map((c) => (
                      <tr
                        key={c.config_id}
                        onClick={() => setSelectedCandidate(c)}
                        className={`cursor-pointer transition-all ${
                          selectedCandidate?.config_id === c.config_id
                            ? 'bg-command-800/80 text-white font-bold'
                            : 'hover:bg-command-950/60 text-slate-300'
                        }`}
                      >
                        <td className="p-2.5 font-medium">{c.name}</td>
                        <td className="p-2.5 uppercase text-[10px] text-slate-400">
                          {c.archetype.replace('_', ' ')}
                        </td>
                        <td className="p-2.5 text-tactical-cyan">{c.u_value_wall} W/m²K</td>
                        <td className="p-2.5 text-amber-400">{c.campaign_fuel_liters} L</td>
                        <td className="p-2.5 text-emerald-400">{c.fuel_saving_percentage}%</td>
                        <td className="p-2.5 text-slate-200">{c.total_shelter_weight_kg} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected Candidate Detailed Breakdown */}
              {selectedCandidate && (
                <div className="bg-command-950/80 border border-command-700/80 rounded-lg p-3.5 flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>{selectedCandidate.name}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] max-w-xl">
                      {selectedCandidate.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleApply(selectedCandidate)}
                    className="tactical-btn-amber text-xs py-2 px-4 flex items-center gap-2 flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply This Design</span>
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
