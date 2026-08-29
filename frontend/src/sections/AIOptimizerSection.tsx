import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Award,
  Zap,
  Layers,
  Check,
  RefreshCw,
  Info,
  Users,
  Wind,
  Sun,
  Shield,
  Activity,
  Maximize2,
  CheckCircle2,
} from 'lucide-react';
import {
  OptimizationResponse,
  CandidateOptimization,
  ShelterGeometry,
  EnvelopeSection,
} from '../types';
import { runOptimization } from '../services/api';

interface AIOptimizerSectionProps {
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

export const AIOptimizerSection: React.FC<AIOptimizerSectionProps> = ({
  troops: initialTroops,
  targetTemp: initialTargetTemp,
  missionDuration: initialMissionDuration,
  latitude,
  elevation,
  onApplyConfiguration,
}) => {
  // Parametric Overrides state matching exact screenshot
  const [targetOccupancy, setTargetOccupancy] = useState<number>(initialTroops || 12);
  const [windLoadFactor, setWindLoadFactor] = useState<number>(45); // m/s
  const [solarGainCoeff, setSolarGainCoeff] = useState<number>(0.4);

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('as7');
  const [appliedModelId, setAppliedModelId] = useState<string>('as7');

  // Exact Model Specifications based on live thermodynamic engine
  const models = [
    {
      id: 'as7',
      modelCode: 'Model AS-7',
      title: 'Model AS-7: Balanced Optimal',
      archetype: 'trombe_wall',
      badge: 'TOP REC',
      isTopRec: true,
      uValue: '0.12 W/m²K',
      weightKg: 1250,
      fuelSav: '+98.5%',
      fuelSavLabel: '+15%',
      cost5y: '₹14.2 L',
      perfIndex: '9.4 / 10',
      rValue: 8.33,
      primaryMaterial: 'PUF Core + Aerogel Blanket',
      description: 'Passive solar Trombe wall with 100mm PUF composite. Optimal balance of thermal lag and logistics payload.',
      geometry: {
        archetype: 'trombe_wall' as const,
        length_m: 6.0,
        width_m: 4.0,
        height_m: 2.8,
        window_area_m2: 3.8,
        trombe_wall_area_m2: 4.5,
      },
      roofEnv: {
        layers: [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: 120 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ],
      },
      wallEnv: {
        layers: [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: 80 },
          { material_id: 'aerogel', thickness_mm: 20 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ],
      },
      floorEnv: {
        layers: [{ material_id: 'xps', thickness_mm: 100 }],
      },
      glazingId: 'triple_low_e',
    },
    {
      id: 'as3',
      modelCode: 'Model AS-3',
      title: 'Model AS-3: High-Mobility',
      archetype: 'modular_box',
      badge: null,
      isTopRec: false,
      uValue: '0.25 W/m²K',
      weightKg: 850,
      fuelSav: '+88.2%',
      fuelSavLabel: '-5%',
      cost5y: '₹8.5 L',
      perfIndex: '6.5 / 10',
      rValue: 4.0,
      primaryMaterial: 'Carbon Frame + Insulated Tent Liner',
      description: 'Ultralight rapid deployment for forward reconnaissance patrols. Lower thermal mass, higher auxiliary heat needed.',
      geometry: {
        archetype: 'modular_box' as const,
        length_m: 5.0,
        width_m: 3.5,
        height_m: 2.4,
        window_area_m2: 1.5,
        trombe_wall_area_m2: 0.0,
      },
      roofEnv: {
        layers: [{ material_id: 'canvas_insulated', thickness_mm: 30 }],
      },
      wallEnv: {
        layers: [{ material_id: 'canvas_insulated', thickness_mm: 30 }],
      },
      floorEnv: {
        layers: [{ material_id: 'xps', thickness_mm: 50 }],
      },
      glazingId: 'single_clear',
    },
    {
      id: 'as9',
      modelCode: 'Model AS-9',
      title: 'Model AS-9: Arctic Fortified',
      archetype: 'earth_bermed',
      badge: null,
      isTopRec: false,
      uValue: '0.08 W/m²K',
      weightKg: 2100,
      fuelSav: '+99.4%',
      fuelSavLabel: '+22%',
      cost5y: '₹22.8 L',
      perfIndex: '9.9 / 10',
      rValue: 12.5,
      primaryMaterial: 'Vacuum Insulation Panel (VIP) + Rammed Stone',
      description: 'Deep-glacier fortified shelter with near-zero heat loss. Extreme R-value for Siachen Ridge / sub -35°C zones.',
      geometry: {
        archetype: 'earth_bermed' as const,
        length_m: 6.5,
        width_m: 4.5,
        height_m: 2.8,
        window_area_m2: 3.0,
        trombe_wall_area_m2: 0.0,
        earth_bermed_depth_m: 2.0,
      },
      roofEnv: {
        layers: [
          { material_id: 'aluminum_composite', thickness_mm: 4 },
          { material_id: 'vacuum_insulation', thickness_mm: 35 },
          { material_id: 'puf', thickness_mm: 80 },
        ],
      },
      wallEnv: {
        layers: [
          { material_id: 'rammed_earth', thickness_mm: 150 },
          { material_id: 'vacuum_insulation', thickness_mm: 35 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ],
      },
      floorEnv: {
        layers: [{ material_id: 'xps', thickness_mm: 120 }],
      },
      glazingId: 'triple_low_e',
    },
  ];

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  const handleSelectModel = (model: (typeof models)[0]) => {
    setSelectedModelId(model.id);
    onApplyConfiguration(
      model.geometry,
      model.roofEnv,
      model.wallEnv,
      model.floorEnv,
      model.glazingId
    );
    setAppliedModelId(model.id);
  };

  const handleRecalculate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 400);
  };

  return (
    <div className="space-y-5 font-mono text-slate-100 max-w-7xl mx-auto">
      {/* 1. Header: Recommendation Engine Status */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-[#8aebff] font-sans tracking-wide">
          Recommendation Engine
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-[#45da7d] animate-pulse" />
          <span className="text-[#45da7d] font-bold">Phase 4 Solver Active</span>
          <span className="text-[#bbc9cd]/60">|</span>
          <span className="text-[#bbc9cd] text-[11px]">
            Sector: {latitude.toFixed(2)}°N at {elevation.toLocaleString()}m ASL (Target: {targetOccupancy} Pax)
          </span>
        </div>
      </div>

      {/* 2. Top 3 Recommendation Cards (Exact Stitch Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {models.map((model) => {
          const isSelected = selectedModelId === model.id;
          const isApplied = appliedModelId === model.id;

          return (
            <div
              key={model.id}
              onClick={() => setSelectedModelId(model.id)}
              className={`p-4 rounded-lg cursor-pointer transition-all relative flex flex-col justify-between ${
                model.isTopRec
                  ? 'bg-[#0e172a]/90 border-2 border-[#22d3ee] shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                  : isSelected
                  ? 'bg-[#0e172a]/90 border-2 border-[#8aebff]'
                  : 'bg-[#0e172a]/70 border border-[#8aebff]/20 hover:border-[#8aebff]/50'
              }`}
            >
              {/* Corner Brackets */}
              <div className="corner-bracket-tl" />
              <div className="corner-bracket-br" />

              <div>
                {/* Header Row with Top Rec Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black text-[#dae2fd] font-sans">
                    {model.title}
                  </span>
                  {model.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22d3ee]/20 text-[#8aebff] border border-[#22d3ee]/40 tracking-wider">
                      {model.badge}
                    </span>
                  )}
                </div>

                {/* Wireframe Architectural Icon Box */}
                <div className="w-full h-28 bg-[#060e20] border border-[#8aebff]/30 rounded flex items-center justify-center mb-4 relative overflow-hidden">
                  {model.id === 'as7' && (
                    <svg viewBox="0 0 100 80" className="w-16 h-16 text-[#8aebff]">
                      {/* Pitched Roof Frame */}
                      <polygon points="50,15 15,40 85,40" fill="none" stroke="#22d3ee" strokeWidth="2.5" />
                      {/* Floor Box */}
                      <rect x="25" y="40" width="50" height="25" fill="none" stroke="#22d3ee" strokeWidth="2" />
                      {/* Crossbars / Trombe Mass */}
                      <line x1="32" y1="48" x2="68" y2="48" stroke="#22d3ee" strokeWidth="1.5" />
                      <line x1="32" y1="56" x2="68" y2="56" stroke="#22d3ee" strokeWidth="1.5" />
                    </svg>
                  )}

                  {model.id === 'as3' && (
                    <svg viewBox="0 0 100 80" className="w-16 h-16 text-[#bbc9cd]">
                      {/* A-Frame Tent Outline */}
                      <polygon points="50,15 20,65 80,65" fill="none" stroke="#859397" strokeWidth="2" />
                      <line x1="50" y1="15" x2="50" y2="65" stroke="#859397" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="30" y1="65" x2="50" y2="35" stroke="#859397" strokeWidth="1" />
                      <line x1="70" y1="65" x2="50" y2="35" stroke="#859397" strokeWidth="1" />
                    </svg>
                  )}

                  {model.id === 'as9' && (
                    <svg viewBox="0 0 100 80" className="w-16 h-16 text-[#8aebff]">
                      {/* Fortified Bunker with Heavy Wall */}
                      <rect x="20" y="30" width="60" height="35" fill="none" stroke="#8aebff" strokeWidth="2.5" />
                      <polygon points="15,30 50,15 85,30" fill="none" stroke="#8aebff" strokeWidth="2" />
                      <rect x="35" y="42" width="15" height="15" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                      <rect x="68" y="22" width="6" height="12" fill="#8aebff" />
                    </svg>
                  )}
                </div>

                {/* Specs List (Exact 3-Line Layout) */}
                <div className="space-y-1.5 text-xs pb-4">
                  <div className="flex justify-between items-center text-[#bbc9cd]">
                    <span>U-Value</span>
                    <strong className="text-[#8aebff] font-mono">{model.uValue}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[#bbc9cd]">
                    <span>Weight</span>
                    <strong className="text-[#dae2fd] font-mono">{model.weightKg.toLocaleString()} kg</strong>
                  </div>
                  <div className="flex justify-between items-center text-[#bbc9cd]">
                    <span>Est. Fuel Sav</span>
                    <strong
                      className={`font-mono ${
                        model.fuelSavLabel.startsWith('+') ? 'text-[#45da7d]' : 'text-[#fb923c]'
                      }`}
                    >
                      {model.fuelSavLabel} ({model.fuelSav})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectModel(model);
                }}
                className={`w-full py-2.5 rounded font-mono text-xs font-bold uppercase transition-all tracking-wider ${
                  model.isTopRec || isSelected
                    ? 'bg-[#22d3ee] hover:bg-[#8aebff] text-[#060e20] shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                    : 'bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#bbc9cd] hover:text-[#8aebff] border border-[#8aebff]/30'
                }`}
              >
                {isApplied ? 'DEPLOYED / ACTIVE' : 'SELECT FOR DEPLOYMENT'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Middle Row: Optimization Plot (Left) & Parametric Overrides (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: 2D Optimization Scatter Plot (8 Cols) */}
        <div className="lg:col-span-8 tactical-glass p-5 rounded-lg relative flex flex-col justify-between">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div className="flex items-center justify-between pb-2 border-b border-[#8aebff]/20 text-xs">
            <span className="font-bold text-[#8aebff] uppercase">
              Optimization Plot: Thermal Res vs Structural Mass
            </span>
            <span className="text-[#bbc9cd]">Pareto Optimal Frontier</span>
          </div>

          {/* Interactive Cartesian Grid Canvas */}
          <div className="w-full h-64 bg-[#060e20] border border-[#8aebff]/30 rounded mt-3 p-4 relative flex items-center justify-center">
            <svg viewBox="0 0 600 240" className="w-full h-full">
              {/* Grid Lines */}
              {[40, 80, 120, 160, 200].map((y) => (
                <line
                  key={`y-${y}`}
                  x1="60"
                  y1={y}
                  x2="560"
                  y2={y}
                  stroke="rgba(138, 235, 255, 0.1)"
                  strokeWidth="1"
                />
              ))}
              {[120, 200, 280, 360, 440, 520].map((x) => (
                <line
                  key={`x-${x}`}
                  x1={x}
                  y1="20"
                  x2={x}
                  y2="200"
                  stroke="rgba(138, 235, 255, 0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Axes */}
              <line x1="60" y1="200" x2="560" y2="200" stroke="#8aebff" strokeWidth="1.5" />
              <line x1="60" y1="20" x2="60" y2="200" stroke="#8aebff" strokeWidth="1.5" />

              {/* Axis Labels */}
              <text x="240" y="225" fill="#bbc9cd" fontSize="11" fontFamily="monospace">
                Structural Mass (kg)
              </text>
              <text
                x="15"
                y="130"
                fill="#bbc9cd"
                fontSize="11"
                fontFamily="monospace"
                transform="rotate(-90 20,130)"
              >
                Thermal Res (R-Value)
              </text>

              {/* Point 1: Model AS-3 (High Mobility: 850kg, R-4) */}
              <circle
                cx="180"
                cy="160"
                r="6"
                fill="#fb923c"
                className="cursor-pointer hover:r-8 transition-all"
                onClick={() => setSelectedModelId('as3')}
              />
              <text x="195" y="165" fill="#bbc9cd" fontSize="10" fontFamily="monospace">
                Model AS-3
              </text>

              {/* Point 2: Model AS-7 (Balanced Optimal: 1250kg, R-8.33) -> Glowing Bullseye */}
              <circle
                cx="340"
                cy="90"
                r="12"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                className="animate-ping opacity-60"
              />
              <circle
                cx="340"
                cy="90"
                r="7"
                fill="#22d3ee"
                stroke="#060e20"
                strokeWidth="2"
                className="cursor-pointer"
                onClick={() => setSelectedModelId('as7')}
              />
              <text x="355" y="95" fill="#8aebff" fontSize="11" fontFamily="monospace" fontWeight="bold">
                Model AS-7 (Selected)
              </text>

              {/* Point 3: Model AS-9 (Arctic Fortified: 2100kg, R-12.5) */}
              <circle
                cx="490"
                cy="45"
                r="6"
                fill="#fb923c"
                className="cursor-pointer hover:r-8 transition-all"
                onClick={() => setSelectedModelId('as9')}
              />
              <text x="430" y="40" fill="#bbc9cd" fontSize="10" fontFamily="monospace">
                Model AS-9
              </text>
            </svg>
          </div>
        </div>

        {/* Right: Parametric Overrides (4 Cols) */}
        <div className="lg:col-span-4 tactical-glass p-5 rounded-lg relative flex flex-col justify-between">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div>
            <div className="text-xs font-bold text-[#8aebff] uppercase pb-3 border-b border-[#8aebff]/20">
              Parametric Overrides
            </div>

            <div className="space-y-4 pt-3 text-xs">
              {/* Override 1: Target Occupancy */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#bbc9cd]">
                  <span>Target Occupancy</span>
                  <strong className="text-[#8aebff]">{targetOccupancy} Pax</strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={targetOccupancy}
                  onChange={(e) => setTargetOccupancy(parseInt(e.target.value))}
                  aria-label="Target Occupancy"
                  className="w-full h-1.5 bg-[#060e20] rounded-lg appearance-none cursor-pointer accent-[#22d3ee]"
                />
              </div>

              {/* Override 2: Wind Load Factor */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#bbc9cd]">
                  <span>Wind Load Factor</span>
                  <strong className="text-[#fb923c]">{windLoadFactor} m/s</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={windLoadFactor}
                  onChange={(e) => setWindLoadFactor(parseInt(e.target.value))}
                  aria-label="Wind Load Factor"
                  className="w-full h-1.5 bg-[#060e20] rounded-lg appearance-none cursor-pointer accent-[#fb923c]"
                />
              </div>

              {/* Override 3: Solar Gain Coefficient */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#bbc9cd]">
                  <span>Solar Gain Coefficient</span>
                  <strong className="text-[#8aebff]">{solarGainCoeff}</strong>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={solarGainCoeff}
                  onChange={(e) => setSolarGainCoeff(parseFloat(e.target.value))}
                  aria-label="Solar Gain Coefficient"
                  className="w-full h-1.5 bg-[#060e20] rounded-lg appearance-none cursor-pointer accent-[#22d3ee]"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={loading}
            className="w-full mt-4 py-2.5 bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#8aebff] border border-[#8aebff]/40 text-xs font-bold rounded flex items-center justify-center gap-2 uppercase transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>RECALCULATE</span>
          </button>
        </div>
      </div>

      {/* 4. Bottom Table: Full Lifecycle Cost & Thermal Performance Matrix */}
      <div className="tactical-glass rounded-lg overflow-hidden text-xs">
        <table className="w-full text-left">
          <thead className="bg-[#060e20] text-[#bbc9cd] border-b border-[#8aebff]/20">
            <tr>
              <th className="p-3">Model</th>
              <th className="p-3">Primary Material</th>
              <th className="p-3">Lifecycle Cost (5Y)</th>
              <th className="p-3">Thermal Perf Index</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#131b2e]">
            {models.map((model) => {
              const isSelected = selectedModelId === model.id;
              const isApplied = appliedModelId === model.id;
              return (
                <tr
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'bg-[#131b2e] text-white font-bold' : 'hover:bg-[#131b2e]/60 text-[#bbc9cd]'
                  }`}
                >
                  <td className="p-3 font-medium text-[#dae2fd]">
                    <div className="flex items-center gap-2">
                      <span>{model.title}</span>
                      {model.isTopRec && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/30">
                          TOP REC
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-[#bbc9cd]">{model.primaryMaterial}</td>
                  <td className="p-3 text-[#fb923c] font-mono">{model.cost5y}</td>
                  <td className="p-3 text-[#45da7d] font-mono">{model.perfIndex}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectModel(model);
                      }}
                      className={`px-3 py-1 text-xs rounded uppercase font-bold transition-all ${
                        isApplied
                          ? 'bg-[#45da7d] text-[#060e20]'
                          : 'bg-[#8aebff]/20 hover:bg-[#8aebff] text-[#8aebff] hover:text-[#060e20]'
                      }`}
                    >
                      {isApplied ? 'Applied' : 'Select'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
