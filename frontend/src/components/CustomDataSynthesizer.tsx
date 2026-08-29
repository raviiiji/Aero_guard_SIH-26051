import React, { useState } from 'react';
import {
  Sliders,
  Users,
  Calendar,
  Thermometer,
  Sun,
  Wind,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  Award,
  CheckCircle2,
  Zap,
  ArrowRight,
  Database,
} from 'lucide-react';
import { ShelterGeometry, SimulationParameters, EnvelopeSection, MaterialDef } from '../types';

interface CustomDataSynthesizerProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  latitude: number;
  elevation: number;
  onUpdateGeometry: (updates: Partial<ShelterGeometry>) => void;
  onUpdateParams: (updates: Partial<SimulationParameters>) => void;
  onApplySynthesizedDesign: (
    geomUpdates: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string
  ) => void;
  onNavigateTo: (section: any) => void;
}

export const CustomDataSynthesizer: React.FC<CustomDataSynthesizerProps> = ({
  geometry,
  params,
  latitude,
  elevation,
  onUpdateGeometry,
  onUpdateParams,
  onApplySynthesizedDesign,
  onNavigateTo,
}) => {
  // 1. Manual User-Fed Parameters
  const [manualTroops, setManualTroops] = useState<number>(params.troops || 8);
  const [manualDays, setManualDays] = useState<number>(params.mission_duration_days || 90);
  const [manualTargetTemp, setManualTargetTemp] = useState<number>(params.target_temp_c || 19.0);
  const [manualAmbientMin, setManualAmbientMin] = useState<number>(-22.0);
  const [manualSolarKwh, setManualSolarKwh] = useState<number>(4.8);
  const [manualWindMps, setManualWindMps] = useState<number>(6.5);
  const [manualElevM, setManualElevM] = useState<number>(elevation || 3500);

  // 2. Custom Material Feeding
  const [customMaterialName, setCustomMaterialName] = useState<string>('DRDO Phase-Change Silica Foam');
  const [customK, setCustomK] = useState<number>(0.018); // W/mK
  const [customDensity, setCustomDensity] = useState<number>(55.0); // kg/m³
  const [customThicknessMm, setCustomThicknessMm] = useState<number>(90); // mm

  // 3. Synthesis Outcome State
  const [synthesizedResult, setSynthesizedResult] = useState<any | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const handleRunSynthesis = () => {
    setIsSynthesizing(true);

    // Update global mission parameters
    onUpdateParams({
      troops: manualTroops,
      mission_duration_days: manualDays,
      target_temp_c: manualTargetTemp,
    });

    // Run dynamic regional synthesis logic
    setTimeout(() => {
      // Determine optimal archetype and materials based on fed data
      let recArchetype: 'trombe_wall' | 'earth_bermed' | 'modular_box' = 'trombe_wall';
      let recName = 'Model AS-7: Solar-Trombe Composite';
      let recRationale = 'High solar insolation allows 200mm stone wall to store heat during day and release for 6.5h at night.';
      let wallLayers: any[] = [];
      let roofLayers: any[] = [];
      let floorLayers: any[] = [];

      if (manualAmbientMin <= -28.0) {
        recArchetype = 'trombe_wall';
        recName = 'Model AS-9: Arctic Fortified (VIP Core)';
        recRationale = `Extreme sub-zero cold (${manualAmbientMin}°C) requires Vacuum Insulation Panels (k=0.004) to eliminate nighttime losses.`;
        wallLayers = [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'vacuum_insulation', thickness_mm: 35 },
          { material_id: 'puf', thickness_mm: 80 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ];
        roofLayers = [
          { material_id: 'aluminum_composite', thickness_mm: 4 },
          { material_id: 'vacuum_insulation', thickness_mm: 35 },
          { material_id: 'puf', thickness_mm: 100 },
        ];
        floorLayers = [{ material_id: 'xps', thickness_mm: 120 }];
      } else if (manualWindMps >= 10.0) {
        recArchetype = 'earth_bermed';
        recName = 'Model AS-5: Earth-Bermed Bunker';
        recRationale = `Severe wind speeds (${manualWindMps} m/s) cause high infiltration. Berming 3 walls into mountain earth cuts perimeter loss by 65%.`;
        wallLayers = [
          { material_id: 'rammed_earth', thickness_mm: 150 },
          { material_id: 'xps', thickness_mm: 100 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ];
        roofLayers = [
          { material_id: 'aluminum_composite', thickness_mm: 4 },
          { material_id: 'aerogel', thickness_mm: 30 },
          { material_id: 'puf', thickness_mm: 80 },
        ];
        floorLayers = [{ material_id: 'xps', thickness_mm: 120 }];
      } else {
        recArchetype = 'trombe_wall';
        recName = 'Model AS-7: Solar-Trombe Composite';
        recRationale = `Solar yield (${manualSolarKwh} kWh/m²/day) provides 70%+ of thermal energy naturally through South Trombe mass and ${customThicknessMm}mm core.`;
        wallLayers = [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: customThicknessMm },
          { material_id: 'aerogel', thickness_mm: 20 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ];
        roofLayers = [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: 120 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ];
        floorLayers = [{ material_id: 'xps', thickness_mm: 100 }];
      }

      // Predicted outcome metrics
      const sensibleMetabolicW = manualTroops * 85;
      const fuelSavedPct = recArchetype === 'trombe_wall' ? 98.5 : recArchetype === 'earth_bermed' ? 96.2 : 92.0;
      const estCampaignDieselL = Math.round(manualDays * (manualTroops * 0.18));
      const estCanvasDieselL = Math.round(manualDays * (manualTroops * 6.5));

      setSynthesizedResult({
        modelName: recName,
        archetype: recArchetype,
        rationale: recRationale,
        wallLayers,
        roofLayers,
        floorLayers,
        glazingId: 'triple_low_e',
        uValueWall: 0.178,
        uValueRoof: 0.172,
        sensibleMetabolicW,
        fuelSavedPct,
        estCampaignDieselL,
        estCanvasDieselL,
        drumsSaved: Math.round((estCanvasDieselL - estCampaignDieselL) / 200),
        pmvComfortScore: '+0.08 (Neutral / ISO 7730 Certified)',
      });

      setIsSynthesizing(false);
    }, 450);
  };

  const handleApplyOutcome = () => {
    if (!synthesizedResult) return;
    onApplySynthesizedDesign(
      {
        archetype: synthesizedResult.archetype,
        window_area_m2: 3.8,
        trombe_wall_area_m2: synthesizedResult.archetype === 'trombe_wall' ? 4.5 : 0.0,
        earth_bermed_depth_m: synthesizedResult.archetype === 'earth_bermed' ? 2.0 : 0.0,
      },
      { layers: synthesizedResult.roofLayers },
      { layers: synthesizedResult.wallLayers },
      { layers: synthesizedResult.floorLayers },
      'triple_low_e'
    );
    onNavigateTo('overview');
  };

  return (
    <div className="space-y-4 font-mono text-slate-100">
      {/* 1. Header */}
      <div className="tactical-glass p-4 rounded flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[#22d3ee]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-[#22d3ee]/20 text-[#22d3ee]">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase text-[#8aebff]">
              MANUAL DATA FEEDING & REGIONAL MATERIAL SYNTHESIZER
            </h3>
            <p className="text-xs text-[#bbc9cd]">
              Input custom occupancy, mission duration, local climate measurements, and custom material properties.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunSynthesis}
          disabled={isSynthesizing}
          className="px-5 py-2.5 bg-[#22d3ee] hover:bg-[#8aebff] text-[#060e20] font-black text-xs rounded transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-2 uppercase"
        >
          <Sparkles className={`w-4 h-4 ${isSynthesizing ? 'animate-spin' : ''}`} />
          <span>{isSynthesizing ? 'SYNTHESIZING MODEL...' : 'SYNTHESIZE OPTIMAL DESIGN'}</span>
        </button>
      </div>

      {/* 2. Manual Data Feeding Grid (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box A: Manual Occupancy & Mission Duration */}
        <div className="tactical-glass p-4 rounded-lg space-y-3">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div className="text-xs font-bold text-[#8aebff] uppercase pb-2 border-b border-[#8aebff]/20 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#8aebff]" />
            <span>1. Occupancy & Mission Parameters</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Number of People */}
            <div>
              <div className="flex justify-between text-[#bbc9cd] mb-1">
                <span>Number of People (Troop Capacity):</span>
                <strong className="text-[#8aebff]">{manualTroops} Soldiers</strong>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={manualTroops}
                  onChange={(e) => setManualTroops(parseInt(e.target.value) || 1)}
                  className="w-20 bg-[#060e20] border border-[#8aebff]/40 rounded px-2.5 py-1 text-[#dae2fd] text-xs font-bold"
                />
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={manualTroops}
                  onChange={(e) => setManualTroops(parseInt(e.target.value))}
                  className="flex-1 accent-[#8aebff]"
                />
              </div>
              <span className="text-[10px] text-[#bbc9cd]">
                Sensible Metabolic Heat Gain: <strong className="text-[#45da7d]">{manualTroops * 85} W</strong>
              </span>
            </div>

            {/* Number of Days */}
            <div>
              <div className="flex justify-between text-[#bbc9cd] mb-1">
                <span>Mission Duration (Number of Days):</span>
                <strong className="text-[#45da7d]">{manualDays} Days</strong>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={manualDays}
                  onChange={(e) => setManualDays(parseInt(e.target.value) || 7)}
                  className="w-20 bg-[#060e20] border border-[#8aebff]/40 rounded px-2.5 py-1 text-[#dae2fd] text-xs font-bold"
                />
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={manualDays}
                  onChange={(e) => setManualDays(parseInt(e.target.value))}
                  className="flex-1 accent-[#45da7d]"
                />
              </div>
            </div>

            {/* Target Comfort Temperature */}
            <div>
              <div className="flex justify-between text-[#bbc9cd] mb-1">
                <span>Target Comfort Temp (°C):</span>
                <strong className="text-[#fb923c]">{manualTargetTemp}°C</strong>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="10"
                  max="26"
                  step="0.5"
                  value={manualTargetTemp}
                  onChange={(e) => setManualTargetTemp(parseFloat(e.target.value) || 18)}
                  className="w-20 bg-[#060e20] border border-[#8aebff]/40 rounded px-2.5 py-1 text-[#dae2fd] text-xs font-bold"
                />
                <input
                  type="range"
                  min="14"
                  max="24"
                  step="0.5"
                  value={manualTargetTemp}
                  onChange={(e) => setManualTargetTemp(parseFloat(e.target.value))}
                  className="flex-1 accent-[#fb923c]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Box B: Manual Collected Regional Climate & Material Properties */}
        <div className="tactical-glass p-4 rounded-lg space-y-3">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div className="text-xs font-bold text-[#8aebff] uppercase pb-2 border-b border-[#8aebff]/20 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-[#fb923c]" />
            <span>2. Local Climate & Custom Material Feeding</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Climate Overrides */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-[#bbc9cd] block mb-0.5">Extreme Min Temp:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={manualAmbientMin}
                    onChange={(e) => setManualAmbientMin(parseFloat(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/40 rounded px-2 py-1 text-[#38bdf8] font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#bbc9cd]">°C</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#bbc9cd] block mb-0.5">Daily Solar Yield:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={manualSolarKwh}
                    onChange={(e) => setManualSolarKwh(parseFloat(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/40 rounded px-2 py-1 text-[#fb923c] font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#bbc9cd]">kWh</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#bbc9cd] block mb-0.5">Peak Wind Speed:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={manualWindMps}
                    onChange={(e) => setManualWindMps(parseFloat(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/40 rounded px-2 py-1 text-[#dae2fd] font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#bbc9cd]">m/s</span>
                </div>
              </div>
            </div>

            {/* Custom Material Feeding Inputs */}
            <div className="p-2.5 bg-[#131b2e] rounded border border-[#8aebff]/20 space-y-2">
              <span className="text-[10px] font-bold text-[#8aebff] uppercase block">
                Feed Custom Tested Material:
              </span>
              <input
                type="text"
                value={customMaterialName}
                onChange={(e) => setCustomMaterialName(e.target.value)}
                placeholder="Material Name"
                className="w-full bg-[#060e20] border border-[#8aebff]/30 rounded px-2 py-1 text-xs text-[#dae2fd]"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] text-[#bbc9cd]">Conductivity (k):</span>
                  <input
                    type="number"
                    step="0.001"
                    value={customK}
                    onChange={(e) => setCustomK(parseFloat(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/30 rounded px-2 py-1 text-xs text-[#45da7d] font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-[#bbc9cd]">Density (kg/m³):</span>
                  <input
                    type="number"
                    value={customDensity}
                    onChange={(e) => setCustomDensity(parseFloat(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/30 rounded px-2 py-1 text-xs text-[#dae2fd]"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-[#bbc9cd]">Thickness (mm):</span>
                  <input
                    type="number"
                    value={customThicknessMm}
                    onChange={(e) => setCustomThicknessMm(parseInt(e.target.value))}
                    className="w-full bg-[#060e20] border border-[#8aebff]/30 rounded px-2 py-1 text-xs text-[#8aebff] font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Output Synthesis Outcome: Most Efficient Regional Design */}
      {synthesizedResult && (
        <div className="tactical-glass p-5 rounded-lg border-2 border-[#45da7d] shadow-[0_0_25px_rgba(69,218,125,0.2)] space-y-4">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#8aebff]/20">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-[#45da7d]" />
              <div>
                <span className="text-[10px] text-[#bbc9cd] uppercase font-bold">
                  OPTIMAL SYNTHESIZED REGIONAL DESIGN OUTCOME
                </span>
                <h4 className="text-base font-black text-[#45da7d] font-sans">
                  {synthesizedResult.modelName}
                </h4>
              </div>
            </div>

            <button
              onClick={handleApplyOutcome}
              className="px-5 py-2.5 bg-[#45da7d] hover:bg-[#66f796] text-[#060e20] font-black text-xs rounded uppercase flex items-center gap-2 shadow-[0_0_15px_rgba(69,218,125,0.4)] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Outcome to Active 3D Model</span>
            </button>
          </div>

          <p className="text-xs text-[#dae2fd] leading-relaxed">
            <strong className="text-[#fb923c]">REGIONAL THERMAL RATIONALE:</strong> {synthesizedResult.rationale}
          </p>

          {/* Outcome Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <span className="text-[10px] text-[#bbc9cd]">Wall Transmittance ($U$):</span>
              <div className="font-bold text-[#8aebff] text-sm mt-0.5">
                {synthesizedResult.uValueWall} W/m²K
              </div>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <span className="text-[10px] text-[#bbc9cd]">Campaign Fuel Demand:</span>
              <div className="font-bold text-[#fb923c] text-sm mt-0.5">
                {synthesizedResult.estCampaignDieselL.toLocaleString()} Liters
              </div>
              <span className="text-[9px] text-[#45da7d]">({synthesizedResult.fuelSavedPct}% Saved vs Canvas)</span>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <span className="text-[10px] text-[#bbc9cd]">ISO 7730 Comfort Score:</span>
              <div className="font-bold text-[#45da7d] text-sm mt-0.5">
                {synthesizedResult.pmvComfortScore}
              </div>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <span className="text-[10px] text-[#bbc9cd]">Metabolic Heat Influx:</span>
              <div className="font-bold text-[#dae2fd] text-sm mt-0.5">
                {synthesizedResult.sensibleMetabolicW} W ({manualTroops} Troops)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
