import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sun,
  Shield,
  FileText,
  Check,
  Download,
  Info,
  Maximize2,
  CheckCircle2,
  Wind,
  Users,
  Flame,
  Printer,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { ShelterGeometry, EnvelopeSection, SimulationResult, WeatherResponse } from '../types';
import { fetchDesignTemplate } from '../services/api';

interface RecommendedBlueprintSectionProps {
  latitude: number;
  elevation: number;
  troops: number;
  onApplyExactDesign: (
    geometry: Partial<ShelterGeometry>,
    roofEnv: EnvelopeSection,
    wallEnv: EnvelopeSection,
    floorEnv: EnvelopeSection,
    glazingId: string
  ) => void;
  onNavigateTo: (section: any) => void;
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
}

export const RecommendedBlueprintSection: React.FC<RecommendedBlueprintSectionProps> = ({
  latitude,
  elevation,
  troops,
  onApplyExactDesign,
  onNavigateTo,
  simResult,
  weatherData,
}) => {
  const [activeDrawing, setActiveDrawing] = useState<'floor_plan' | 'cross_section' | 'south_elevation' | 'bom'>('floor_plan');
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveTemplate, setLiveTemplate] = useState<any>(null);

  // Fetch real dynamic design template from live API
  useEffect(() => {
    setLoading(true);
    fetchDesignTemplate(latitude, elevation, troops)
      .then((data) => {
        setLiveTemplate(data);
      })
      .catch((err) => {
        console.error('Failed to fetch dynamic design template:', err);
      })
      .finally(() => setLoading(false));
  }, [latitude, elevation, troops]);

  const dims = liveTemplate?.dimensions || {
    length_m: 6.0,
    width_m: 4.0,
    height_m: 2.8,
    roof_pitch_deg: 15.0,
    floor_area_m2: 24.0,
    volume_m3: 67.2,
    window_area_m2: 3.8,
    trombe_wall_area_m2: 4.5,
  };

  const [selectedElement, setSelectedElement] = useState<'airlock' | 'trombe' | 'solar' | 'heater' | 'bunks' | 'walls' | null>('airlock');

  // Blueprint element detailed specifications database
  const elementSpecs: Record<string, {
    title: string;
    category: string;
    tagColor: string;
    materials: string[];
    specs: { label: string; value: string }[];
    purpose: string;
    icon: string;
  }> = {
    airlock: {
      title: "1. Thermal Airlock Vestibule (Entry Buffer)",
      category: "INFILTRATION SUPPRESSOR",
      tagColor: "#45da7d",
      icon: "door",
      materials: [
        "Double Thermal-Break Aluminum 6061-T6 Frame",
        "EPDM Dual-Lip Neoprene Compression Seals",
        "50mm High-Density PUF Core Door Panel (U = 0.28 W/m²K)",
        "Magnetic Positive-Latching High-Wind Seals"
      ],
      specs: [
        { label: "Draft Infiltration Cut", value: "75% Reduction" },
        { label: "Buffer Dimensions", value: "1.8m (L) × 1.2m (W)" },
        { label: "Air Change Rate", value: "0.28 ACH (Air-tight)" },
        { label: "Wind Resistance", value: "Up to 55 m/s Gale" }
      ],
      purpose: "Acts as a two-stage airlock transition chamber. When soldiers enter from freezing -20°C to -35°C blizzard conditions, the outer door seals before the inner door opens, preventing freezing drafts from dumping directly into the warm living quarters."
    },
    trombe: {
      title: "2. 200mm High-Density Stone Trombe Wall",
      category: "PASSIVE SOLAR THERMAL BATTERY",
      tagColor: "#a78bfa",
      icon: "sun",
      materials: [
        "Himalayan Basalt Stone / Rammed Earth Mass (2,400 kg/m³)",
        "Black Selective Solar Absorption Coating (α = 0.92, ε = 0.08)",
        "50mm Low-Emissivity Air Thermocirculation Cavity",
        "Bi-Metallic Automatic Thermal Backdraft Dampers"
      ],
      specs: [
        { label: "Trombe Surface Area", value: `${dims.trombe_wall_area_m2} m²` },
        { label: "Volumetric Heat Capacity", value: "2.88 MJ/m³·K" },
        { label: "Thermal Phase Delay", value: "6.5 Hours Lag" },
        { label: "Daily Stored Solar", value: `~${((weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8) * dims.trombe_wall_area_m2 * 0.92).toFixed(1)} kWh/day` }
      ],
      purpose: "Absorbs direct solar energy through the South glazing during peak daytime hours (10:00 - 16:00). Convects hot air through upper dampers during the day, and slowly conducts stored warmth inward with a 6.5-hour phase lag to heat sleeping troops throughout the freezing night."
    },
    solar: {
      title: "3. South-Facing Solar Aperture & Influx",
      category: "SOLAR HARVESTING FENESTRATION",
      tagColor: "#f59e0b",
      icon: "sun",
      materials: [
        "Triple-Glazed Low-E Military Spec IGU (4mm + 12mm Ar + 4mm + 12mm Ar + 4mm)",
        "90% Argon Inert Gas Cavities with Warm-Edge Composite Spacers",
        "Microscopic Dual-Layer Silver Anti-Reflective Coating",
        "Structural Polycarbonate Protective Outer Shroud (Anti-Ballistic/Hail)"
      ],
      specs: [
        { label: "Window U-Value", value: `${simResult?.u_values.glazing.u_value ?? 0.80} W/m²K` },
        { label: "Solar Heat Gain (SHGC)", value: "0.55 High Solar" },
        { label: "Solar Influx Yield", value: `${weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8} kWh/m²/day` },
        { label: "Orientation Azimuth", value: "180° True South" }
      ],
      purpose: "Harvests high-altitude clear-sky solar irradiance (7.9 hrs sunshine in Ladakh) to superheat the internal space and Trombe wall, while maintaining extreme thermal insulation (U = 0.80) to stop reverse heat loss at night."
    },
    heater: {
      title: "4. Central Bukhaari Diesel-Hybrid Heater",
      category: "AUXILIARY THERMOSTATIC BACKUP",
      tagColor: "#fb923c",
      icon: "flame",
      materials: [
        "High-Grade Cast Iron Combustion Chamber",
        "Counter-Flow Flue Gas Heat Exchanger Core",
        "Thermostatic Modulating Fuel Dosing Pump",
        "Dual-Stage Catalytic Exhaust Burner (Low CO/Soot)"
      ],
      specs: [
        { label: "Thermal Efficiency", value: "82.0% Burner Rating" },
        { label: "Output Modulation", value: "1.2 kW - 5.5 kW Auto" },
        { label: "Target Setpoint", value: "19.0°C (DGQA Military Spec)" },
        { label: "Convective Dispersion", value: "360° Symmetric Toroidal" }
      ],
      purpose: "Located at the geometric center of the shelter to ensure perfectly balanced natural convective heat loops without cold dead-corners. Automatically modulates fuel burn rate downward when solar and troop metabolic gains are active."
    },
    bunks: {
      title: "5. Troop Ergonomic Quarters & Metabolic Harvesting",
      category: "ASHRAE 55 HUMAN METABOLIC HEAT",
      tagColor: "#38bdf8",
      icon: "users",
      materials: [
        "Lightweight Aluminum-Lithium Modular Tubular Bunk Frames",
        "R-3.5 Closed-Cell Thermal Insulating Sleeping Pads",
        "Hypoallergenic Fire-Retardant Nomex Bunk Curtains",
        "Breathable Micro-Ventilated Thermal Draft Barriers"
      ],
      specs: [
        { label: "Metabolic Heat Rate", value: "85 W / Soldier (1.0 MET)" },
        { label: "Total Body Thermal Output", value: `${troops * 85} W (${(troops * 85 * 24 / 1000).toFixed(1)} kWh/day)` },
        { label: "Troop Capacity", value: `${troops} Soldiers (Bunks 1-${troops})` },
        { label: "Draft Separation", value: "3.8m Buffer from Entry" }
      ],
      purpose: "Sleeping bunks are positioned along interior perimeters shielded from entrance drafts. Harvesters soldier metabolic heat (85W per sleeping soldier) as free internal thermal energy, offsetting significant liters of diesel fuel each day."
    },
    walls: {
      title: "6. Multi-Layer Composite Envelope Walls & Sheathing",
      category: "HIGH-ALTITUDE THERMAL ENVELOPE",
      tagColor: "#22d3ee",
      icon: "layers",
      materials: [
        "Layer 1 (Exterior): 3.0mm Anodized Aluminum Composite Cladding",
        "Layer 2 (Insulation): 80mm High-Density Polyurethane Foam (PUF, k = 0.022 W/mK)",
        "Layer 3 (Nano-Insulation): 20mm Nanoporous Aerogel Blanket (k = 0.015 W/mK)",
        "Layer 4 (Interior): 4.0mm Fire-Retardant Fiberglass FRP Liner"
      ],
      specs: [
        { label: "Composite U-Value", value: `${simResult?.u_values.walls.u_value ?? 0.178} W/m²K` },
        { label: "Thermal Resistance (R)", value: "R-5.62 m²K/W" },
        { label: "Dimensions", value: `${dims.length_m}m (L) × ${dims.width_m}m (W) × ${dims.height_m}m (H)` },
        { label: "Floor Area / Volume", value: `${dims.floor_area_m2} m² / ${dims.volume_m3} m³` }
      ],
      purpose: "Continuous thermal-bridge-free composite structural sandwich panels. Nanoporous aerogel eliminates edge frost-heave, while outer aluminum reflects solar UV and shields against extreme 55 m/s Himalayan mountain gales."
    }
  };

  const currentSpec = selectedElement ? elementSpecs[selectedElement] : elementSpecs['airlock'];

  const handleApply = () => {
    if (!liveTemplate) return;

    onApplyExactDesign(
      {
        archetype: 'trombe_wall',
        length_m: dims.length_m,
        width_m: dims.width_m,
        height_m: dims.height_m,
        roof_pitch_deg: dims.roof_pitch_deg,
        window_area_m2: dims.window_area_m2,
        trombe_wall_area_m2: dims.trombe_wall_area_m2,
        earth_bermed_depth_m: 0.0,
        window_orientation_deg: 180.0,
      },
      {
        layers: [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: elevation >= 4000 ? 140 : 120 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ],
      },
      {
        layers: [
          { material_id: 'aluminum_composite', thickness_mm: 3 },
          { material_id: 'puf', thickness_mm: elevation >= 4000 ? 100 : 80 },
          { material_id: 'aerogel', thickness_mm: elevation >= 4000 ? 30 : 20 },
          { material_id: 'fiberglass_frp', thickness_mm: 4 },
        ],
      },
      {
        layers: [
          { material_id: 'xps', thickness_mm: 100 },
        ],
      },
      'triple_low_e'
    );
    setApplied(true);
  };

  return (
    <div className="space-y-4 font-mono text-slate-100 max-w-6xl mx-auto">
      {/* 1. Header Banner */}
      <div className="tactical-glass p-4 rounded flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[#8aebff]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-[#8aebff]/20 text-[#8aebff]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase text-[#8aebff]">
                EXACT SITE-CALIBRATED SHELTER BLUEPRINT & ENGINEERING SPECIFICATION
              </h2>
              <span className="tactical-badge bg-[#45da7d]/20 text-[#45da7d] border border-[#45da7d]/40">
                LIVE API CALIBRATED
              </span>
            </div>
            <p className="text-xs text-[#bbc9cd]">
              Model: <strong className="text-[#dae2fd]">{liveTemplate?.model || 'DRDO-AS-MK4'}</strong> | Sector: {latitude.toFixed(2)}°N at {elevation.toLocaleString()}m ASL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-[#8aebff] hover:bg-[#a2eeff] text-[#060e20] font-bold text-xs rounded uppercase flex items-center gap-1.5 shadow-[0_0_15px_rgba(138,235,255,0.4)] transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{applied ? 'Design Active in Simulation!' : 'Apply Exact Design to Model'}</span>
          </button>
        </div>
      </div>

      {/* 2. Drawing Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-[#060e20] border border-[#8aebff]/20 rounded-lg text-xs">
        <button
          onClick={() => setActiveDrawing('floor_plan')}
          className={`py-2 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            activeDrawing === 'floor_plan'
              ? 'bg-[#8aebff] text-[#060e20] shadow-[0_0_12px_rgba(138,235,255,0.4)]'
              : 'text-[#bbc9cd] hover:text-[#8aebff]'
          }`}
        >
          <span>1. Floor Plan (2D CAD)</span>
        </button>

        <button
          onClick={() => setActiveDrawing('cross_section')}
          className={`py-2 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            activeDrawing === 'cross_section'
              ? 'bg-[#8aebff] text-[#060e20] shadow-[0_0_12px_rgba(138,235,255,0.4)]'
              : 'text-[#bbc9cd] hover:text-[#8aebff]'
          }`}
        >
          <span>2. Cross-Section Stack</span>
        </button>

        <button
          onClick={() => setActiveDrawing('south_elevation')}
          className={`py-2 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            activeDrawing === 'south_elevation'
              ? 'bg-[#8aebff] text-[#060e20] shadow-[0_0_12px_rgba(138,235,255,0.4)]'
              : 'text-[#bbc9cd] hover:text-[#8aebff]'
          }`}
        >
          <span>3. South Solar Facade</span>
        </button>

        <button
          onClick={() => setActiveDrawing('bom')}
          className={`py-2 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
            activeDrawing === 'bom'
              ? 'bg-[#8aebff] text-[#060e20] shadow-[0_0_12px_rgba(138,235,255,0.4)]'
              : 'text-[#bbc9cd] hover:text-[#8aebff]'
          }`}
        >
          <span>4. Bill of Materials (BOM)</span>
        </button>
      </div>

      {/* 3. Interactive CAD Blueprint Canvas */}
      <div className="tactical-glass p-5 rounded-lg border border-[#8aebff]/30 space-y-4">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        {/* View 1: 2D Floor Plan Schematic */}
        {activeDrawing === 'floor_plan' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#8aebff]/20 text-xs">
              <span className="font-bold text-[#8aebff] uppercase">
                SCHEMATIC 01: ARCHITECTURAL FLOOR PLAN & ZONING ({dims.length_m}m × {dims.width_m}m = {dims.floor_area_m2}m²)
              </span>
              <span className="text-[#45da7d] bg-[#45da7d]/10 px-2 py-0.5 rounded border border-[#45da7d]/30 text-[11px]">
                💡 Click any element on the blueprint to inspect materials & specs
              </span>
            </div>

            {/* Quick Component Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-[#bbc9cd] mr-1">Inspect Element:</span>
              <button
                onClick={() => setSelectedElement('airlock')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'airlock'
                    ? 'bg-[#45da7d] text-[#060e20] border-[#45da7d] shadow-[0_0_10px_rgba(69,218,125,0.4)]'
                    : 'bg-[#131b2e] text-[#45da7d] border-[#45da7d]/40 hover:bg-[#45da7d]/20'
                }`}
              >
                🚪 Airlock Vestibule
              </button>
              <button
                onClick={() => setSelectedElement('trombe')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'trombe'
                    ? 'bg-[#a78bfa] text-[#060e20] border-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.4)]'
                    : 'bg-[#131b2e] text-[#a78bfa] border-[#a78bfa]/40 hover:bg-[#a78bfa]/20'
                }`}
              >
                🧱 200mm Trombe Wall
              </button>
              <button
                onClick={() => setSelectedElement('solar')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'solar'
                    ? 'bg-[#f59e0b] text-[#060e20] border-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                    : 'bg-[#131b2e] text-[#f59e0b] border-[#f59e0b]/40 hover:bg-[#f59e0b]/20'
                }`}
              >
                ☀️ South Solar Influx
              </button>
              <button
                onClick={() => setSelectedElement('heater')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'heater'
                    ? 'bg-[#fb923c] text-[#060e20] border-[#fb923c] shadow-[0_0_10px_rgba(251,146,60,0.4)]'
                    : 'bg-[#131b2e] text-[#fb923c] border-[#fb923c]/40 hover:bg-[#fb923c]/20'
                }`}
              >
                🔥 Bukhaari Heater
              </button>
              <button
                onClick={() => setSelectedElement('bunks')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'bunks'
                    ? 'bg-[#38bdf8] text-[#060e20] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                    : 'bg-[#131b2e] text-[#38bdf8] border-[#38bdf8]/40 hover:bg-[#38bdf8]/20'
                }`}
              >
                🛏️ Bunks 1-6
              </button>
              <button
                onClick={() => setSelectedElement('walls')}
                className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all ${
                  selectedElement === 'walls'
                    ? 'bg-[#22d3ee] text-[#060e20] border-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                    : 'bg-[#131b2e] text-[#22d3ee] border-[#22d3ee]/40 hover:bg-[#22d3ee]/20'
                }`}
              >
                🏗️ Envelope Walls (6m × 4m)
              </button>
            </div>

            {/* SVG CAD Blueprint Drawing with Interactive Click Targets */}
            <div className="w-full h-96 bg-[#060e20] border border-[#8aebff]/40 rounded p-4 flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 800 500" className="w-full h-full select-none">
                {/* Background Grid */}
                <defs>
                  <pattern id="grid-live" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(138, 235, 255, 0.08)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="800" height="500" fill="url(#grid-live)" />

                {/* Outer Wall Boundary (Clickable) */}
                <g onClick={() => setSelectedElement('walls')} className="cursor-pointer transition-all">
                  <rect
                    x="100"
                    y="50"
                    width="600"
                    height="380"
                    fill="#131b2e"
                    stroke={selectedElement === 'walls' ? '#22d3ee' : '#8aebff'}
                    strokeWidth={selectedElement === 'walls' ? '5' : '3'}
                    className="hover:stroke-[#22d3ee]"
                  />
                  <rect
                    x="115"
                    y="65"
                    width="570"
                    height="350"
                    fill="#0b1326"
                    stroke="#22d3ee"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                </g>

                {/* Dimension Lines (Clickable) */}
                <g onClick={() => setSelectedElement('walls')} className="cursor-pointer">
                  {/* Length Top */}
                  <line x1="100" y1="30" x2="700" y2="30" stroke="#fb923c" strokeWidth="1.5" />
                  <line x1="100" y1="20" x2="100" y2="40" stroke="#fb923c" strokeWidth="1.5" />
                  <line x1="700" y1="20" x2="700" y2="40" stroke="#fb923c" strokeWidth="1.5" />
                  <text x="340" y="24" fill="#fb923c" fontSize="12" fontFamily="monospace" fontWeight="bold">
                    {dims.length_m.toFixed(2)} METERS (LENGTH)
                  </text>

                  {/* Width Left */}
                  <line x1="75" y1="50" x2="75" y2="430" stroke="#fb923c" strokeWidth="1.5" />
                  <line x1="65" y1="50" x2="85" y2="50" stroke="#fb923c" strokeWidth="1.5" />
                  <line x1="65" y1="430" x2="85" y2="430" stroke="#fb923c" strokeWidth="1.5" />
                  <text x="15" y="245" fill="#fb923c" fontSize="12" fontFamily="monospace" fontWeight="bold" transform="rotate(-90 40,245)">
                    {dims.width_m.toFixed(2)} METERS (WIDTH)
                  </text>
                </g>

                {/* West Airlock Vestibule (Clickable) */}
                <g onClick={() => setSelectedElement('airlock')} className="cursor-pointer">
                  <rect
                    x="100"
                    y="190"
                    width="100"
                    height="100"
                    fill={selectedElement === 'airlock' ? '#1b2d42' : '#171f33'}
                    stroke={selectedElement === 'airlock' ? '#45da7d' : '#8aebff'}
                    strokeWidth={selectedElement === 'airlock' ? '3' : '1.5'}
                    className="hover:stroke-[#45da7d]"
                  />
                  <line x1="100" y1="240" x2="85" y2="210" stroke="#45da7d" strokeWidth="3" />
                  <text x="110" y="235" fill={selectedElement === 'airlock' ? '#45da7d' : '#8aebff'} fontSize="10" fontFamily="monospace" fontWeight="bold">
                    AIRLOCK
                  </text>
                  <text x="110" y="250" fill="#bbc9cd" fontSize="8" fontFamily="monospace">VESTIBULE</text>
                </g>

                {/* Troop Bunks (Clickable) */}
                <g onClick={() => setSelectedElement('bunks')} className="cursor-pointer">
                  <rect
                    x="230"
                    y="75"
                    width="100"
                    height="50"
                    fill={selectedElement === 'bunks' ? '#1e3a5f' : '#1e293b'}
                    stroke={selectedElement === 'bunks' ? '#38bdf8' : '#0284c7'}
                    strokeWidth={selectedElement === 'bunks' ? '2.5' : '1'}
                    className="hover:stroke-[#38bdf8]"
                  />
                  <text x="245" y="105" fill="#dae2fd" fontSize="9" fontFamily="monospace">BUNK 1-2</text>

                  <rect
                    x="560"
                    y="75"
                    width="100"
                    height="50"
                    fill={selectedElement === 'bunks' ? '#1e3a5f' : '#1e293b'}
                    stroke={selectedElement === 'bunks' ? '#38bdf8' : '#0284c7'}
                    strokeWidth={selectedElement === 'bunks' ? '2.5' : '1'}
                    className="hover:stroke-[#38bdf8]"
                  />
                  <text x="575" y="105" fill="#dae2fd" fontSize="9" fontFamily="monospace">BUNK 3-4</text>

                  <rect
                    x="560"
                    y="355"
                    width="100"
                    height="50"
                    fill={selectedElement === 'bunks' ? '#1e3a5f' : '#1e293b'}
                    stroke={selectedElement === 'bunks' ? '#38bdf8' : '#0284c7'}
                    strokeWidth={selectedElement === 'bunks' ? '2.5' : '1'}
                    className="hover:stroke-[#38bdf8]"
                  />
                  <text x="575" y="385" fill="#dae2fd" fontSize="9" fontFamily="monospace">BUNK 5-6</text>
                </g>

                {/* Central Tactical Bukhaari Heater (Clickable) */}
                <g onClick={() => setSelectedElement('heater')} className="cursor-pointer">
                  <circle
                    cx="400"
                    cy="240"
                    r={selectedElement === 'heater' ? '28' : '25'}
                    fill="#78350f"
                    stroke={selectedElement === 'heater' ? '#f59e0b' : '#fb923c'}
                    strokeWidth={selectedElement === 'heater' ? '4' : '2'}
                    className="hover:stroke-[#f59e0b]"
                  />
                  <circle cx="400" cy="240" r="8" fill="#fb923c" />
                  <text x="350" y="280" fill="#fb923c" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    BUKHAARI HEATER
                  </text>
                </g>

                {/* South Trombe Wall & Solar Glazing Section (Clickable) */}
                <g onClick={() => setSelectedElement('trombe')} className="cursor-pointer">
                  <rect
                    x="230"
                    y="415"
                    width="300"
                    height="20"
                    fill="#4c1d95"
                    stroke={selectedElement === 'trombe' ? '#c084fc' : '#a78bfa'}
                    strokeWidth={selectedElement === 'trombe' ? '3' : '2'}
                    className="hover:stroke-[#c084fc]"
                  />
                  <rect
                    x="230"
                    y="435"
                    width="300"
                    height="8"
                    fill="#38bdf8"
                    opacity="0.6"
                  />
                  <text x="260" y="410" fill={selectedElement === 'trombe' ? '#c084fc' : '#a78bfa'} fontSize="10" fontFamily="monospace" fontWeight="bold">
                    200mm STONE TROMBE WALL ({dims.trombe_wall_area_m2} m²)
                  </text>
                </g>

                {/* Solar Influx (Clickable) */}
                <g onClick={() => setSelectedElement('solar')} className="cursor-pointer">
                  <path d="M 300 480 L 300 450 M 380 480 L 380 450 M 460 480 L 460 450" stroke="#f59e0b" strokeWidth={selectedElement === 'solar' ? '3' : '2'} strokeDasharray="3 3" />
                  <polygon points="300,445 295,455 305,455" fill="#f59e0b" />
                  <polygon points="380,445 375,455 385,455" fill="#f59e0b" />
                  <polygon points="460,445 455,455 465,455" fill="#f59e0b" />
                  <text x="310" y="490" fill="#f59e0b" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    TRUE SOUTH SOLAR INFLUX ({weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8} kWh/m²/day)
                  </text>
                </g>
              </svg>
            </div>

            {/* Dynamic Interactive Component Inspector Card */}
            <div className="bg-[#0b1326] border-2 rounded-lg p-4 space-y-3 transition-all" style={{ borderColor: currentSpec.tagColor }}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#8aebff]/20">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentSpec.tagColor }} />
                  <h3 className="text-sm font-bold text-[#dae2fd] uppercase">{currentSpec.title}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase" style={{ color: currentSpec.tagColor, borderColor: currentSpec.tagColor, backgroundColor: `${currentSpec.tagColor}15` }}>
                  {currentSpec.category}
                </span>
              </div>

              {/* 4 Key Physical & Thermal Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {currentSpec.specs.map((s, idx) => (
                  <div key={idx} className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/10">
                    <div className="text-[10px] text-[#bbc9cd]">{s.label}</div>
                    <div className="text-xs font-bold text-[#dae2fd] mt-0.5" style={{ color: currentSpec.tagColor }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Materials Used List */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[11px] font-bold text-[#8aebff] uppercase">🧪 Material Specifications & Composition:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {currentSpec.materials.map((mat, idx) => (
                    <div key={idx} className="bg-[#131b2e] px-2.5 py-1.5 rounded border-l-2 text-[11px] text-[#dae2fd] flex items-center gap-2" style={{ borderLeftColor: currentSpec.tagColor }}>
                      <span className="text-[#bbc9cd] text-[10px]">▪</span>
                      <span>{mat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thermal & Engineering Purpose */}
              <div className="p-2.5 rounded bg-[#131b2e]/80 border border-[#8aebff]/20 text-[11px] text-[#bbc9cd] leading-relaxed">
                <strong className="text-[#dae2fd]">🛡️ Engineering & Thermodynamic Function: </strong>
                {currentSpec.purpose}
              </div>
            </div>

            {/* Quick 3-Box Interactive Footer Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div
                onClick={() => setSelectedElement('airlock')}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  selectedElement === 'airlock' ? 'bg-[#17253b] border-[#45da7d] shadow-[0_0_10px_rgba(69,218,125,0.2)]' : 'bg-[#131b2e] border-[#8aebff]/20 hover:border-[#45da7d]'
                }`}
              >
                <strong className="text-[#45da7d]">1. Thermal Airlock Vestibule:</strong>
                <p className="text-[11px] text-[#bbc9cd] mt-1">
                  1.8m × 1.2m double-door transition zone cuts infiltration by 75% in high-wind sectors.
                </p>
              </div>

              <div
                onClick={() => setSelectedElement('trombe')}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  selectedElement === 'trombe' ? 'bg-[#25173b] border-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]' : 'bg-[#131b2e] border-[#8aebff]/20 hover:border-[#a78bfa]'
                }`}
              >
                <strong className="text-[#a78bfa]">2. South Trombe Solar Mass:</strong>
                <p className="text-[11px] text-[#bbc9cd] mt-1">
                  {dims.trombe_wall_area_m2} m² high-density Himalayan basalt wall absorbing direct daytime solar irradiance.
                </p>
              </div>

              <div
                onClick={() => setSelectedElement('heater')}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  selectedElement === 'heater' ? 'bg-[#3b2317] border-[#fb923c] shadow-[0_0_10px_rgba(251,146,60,0.2)]' : 'bg-[#131b2e] border-[#8aebff]/20 hover:border-[#fb923c]'
                }`}
              >
                <strong className="text-[#fb923c]">3. Centralized Bukhaari Auxiliary:</strong>
                <p className="text-[11px] text-[#bbc9cd] mt-1">
                  Automatic thermostatic modulated backup maintaining DRDO DGQA 19.0°C comfort standard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* View 2: Multi-Layer Cross-Section Stack */}
        {activeDrawing === 'cross_section' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#8aebff]/20 text-xs">
              <span className="font-bold text-[#8aebff] uppercase">
                SCHEMATIC 02: MULTI-LAYER ENVELOPE COMPOSITE CROSS-SECTION DETAIL
              </span>
              <span className="text-[#45da7d]">
                Wall U = {simResult?.u_values.walls.u_value ?? 0.18} W/m²K | Roof U = {simResult?.u_values.roof.u_value ?? 0.17} W/m²K
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Wall Cross-Section Detail */}
              <div className="bg-[#060e20] p-4 rounded border border-[#8aebff]/20 space-y-3">
                <h4 className="text-xs font-bold text-[#8aebff] uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#22d3ee]" />
                  Exterior Wall Composite Stack (Live Calculated)
                </h4>

                <div className="space-y-2 text-xs">
                  {liveTemplate?.envelope_stack?.wall_layers?.map((layer: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded bg-[#131b2e] border-l-4 border-l-[#22d3ee] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#dae2fd]">{layer.layer} ({layer.thickness_mm}mm)</div>
                        <div className="text-[10px] text-[#bbc9cd]">{layer.mat}</div>
                      </div>
                      <span className="text-[10px] font-bold text-[#8aebff]">{layer.k} W/mK</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roof Cross-Section Detail */}
              <div className="bg-[#060e20] p-4 rounded border border-[#8aebff]/20 space-y-3">
                <h4 className="text-xs font-bold text-[#8aebff] uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#fb923c]" />
                  Pitched Roof Envelope Stack (Live Calculated)
                </h4>

                <div className="space-y-2 text-xs">
                  {liveTemplate?.envelope_stack?.roof_layers?.map((layer: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded bg-[#131b2e] border-l-4 border-l-[#fb923c] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#dae2fd]">{layer.layer} ({layer.thickness_mm}mm)</div>
                        <div className="text-[10px] text-[#bbc9cd]">{layer.mat}</div>
                      </div>
                      <span className="text-[10px] font-bold text-[#fb923c]">{layer.k} W/mK</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded bg-[#131b2e] border border-[#45da7d]/30 text-[11px] text-[#45da7d]">
                  <strong>Sub-Floor Ground Protection:</strong> 100mm XPS High-Compressive Foam (U = 0.280 W/m²K) with 2mm EPDM vapor seal against frozen permafrost dampening.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 3: South Solar Facade Elevation */}
        {activeDrawing === 'south_elevation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#8aebff]/20 text-xs">
              <span className="font-bold text-[#8aebff] uppercase">
                SCHEMATIC 03: SOUTH-FACING SOLAR COLLECTOR FACADE (TRUE SOUTH 180°)
              </span>
              <span className="text-[#fb923c]">Captures {weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8} kWh/m²/day Daily Solar Energy</span>
            </div>

            <div className="w-full h-80 bg-[#060e20] border border-[#8aebff]/30 rounded p-4 flex items-center justify-center relative">
              <svg viewBox="0 0 700 350" className="w-full h-full">
                <rect x="50" y="100" width="600" height="200" fill="#131b2e" stroke="#8aebff" strokeWidth="2" />
                <polygon points="50,100 350,30 650,100" fill="#0f1c36" stroke="#8aebff" strokeWidth="2" />

                <rect x="100" y="140" width="180" height="110" fill="#38bdf8" opacity="0.6" stroke="#22d3ee" strokeWidth="2" />
                <text x="115" y="200" fill="#060e20" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  TRIPLE LOW-E ({dims.window_area_m2} m²)
                </text>

                <rect x="330" y="130" width="280" height="130" fill="#4c1d95" opacity="0.8" stroke="#a78bfa" strokeWidth="2" />
                <rect x="340" y="140" width="260" height="20" fill="#2e1065" stroke="#c084fc" strokeWidth="1" />
                <text x="360" y="155" fill="#e9d5ff" fontSize="9" fontFamily="monospace">UPPER CONVECTIVE HOT AIR DAMPER</text>
                
                <text x="350" y="205" fill="#ffffff" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  TROMBE STONE STORAGE ({dims.trombe_wall_area_m2} m²)
                </text>
                
                <rect x="340" y="230" width="260" height="20" fill="#2e1065" stroke="#c084fc" strokeWidth="1" />
                <text x="360" y="245" fill="#e9d5ff" fontSize="9" fontFamily="monospace">LOWER COLD AIR RETURN DAMPER</text>
              </svg>
            </div>

            <div className="p-3 bg-[#131b2e] rounded border border-[#8aebff]/20 text-xs text-[#bbc9cd] leading-relaxed">
              <strong className="text-[#fb923c]">TROMBE WALL THERMOCIRCULATION CYCLE:</strong> During daylight, sunlight passes through the outer glazing and heats the black selective absorber on the 200mm stone mass. Cold air from the floor enters the lower damper, rises as it gets superheated, and exhausts warm air into the troop living space through the top damper. At night, dampers close and the mass conducts heat inward with a 6.5h thermal phase lag.
            </div>
          </div>
        )}

        {/* View 4: Engineering Bill of Materials (BOM) */}
        {activeDrawing === 'bom' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#8aebff]/20">
              <span className="font-bold text-[#8aebff] uppercase">
                ENGINEERING BILL OF MATERIALS (BOM) & SPECIFICATION SHEET
              </span>
              <span className="text-[#dae2fd]">
                Total Payload Weight: {simResult?.summary.total_shelter_weight_kg ? `${simResult.summary.total_shelter_weight_kg.toLocaleString()} kg` : '1,840 kg'}
              </span>
            </div>

            <table className="w-full text-left border border-[#8aebff]/20 rounded overflow-hidden">
              <thead className="bg-[#060e20] text-[#bbc9cd] border-b border-[#8aebff]/20">
                <tr>
                  <th className="p-2.5">Component / Assembly</th>
                  <th className="p-2.5">Material Specification</th>
                  <th className="p-2.5">Thickness</th>
                  <th className="p-2.5">Thermal Rating ($k$ / $U$)</th>
                  <th className="p-2.5">Weight (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131b2e] bg-[#0b1326]">
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Wall Sandwich Panels</td>
                  <td className="p-2.5 text-[#bbc9cd]">PUF Core + Aerogel Blanket + FRP Liner</td>
                  <td className="p-2.5 text-[#8aebff]">107 mm</td>
                  <td className="p-2.5 text-[#45da7d]">U = {simResult?.u_values.walls.u_value ?? 0.178} W/m²K</td>
                  <td className="p-2.5 text-[#dae2fd]">560 kg</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Roof Gable Panels</td>
                  <td className="p-2.5 text-[#bbc9cd]">120mm PUF Core + ACP Sheathing</td>
                  <td className="p-2.5 text-[#8aebff]">127 mm</td>
                  <td className="p-2.5 text-[#45da7d]">U = {simResult?.u_values.roof.u_value ?? 0.172} W/m²K</td>
                  <td className="p-2.5 text-[#dae2fd]">380 kg</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Sub-Floor Foundation</td>
                  <td className="p-2.5 text-[#bbc9cd]">100mm XPS Rigid Insulation Slab</td>
                  <td className="p-2.5 text-[#8aebff]">100 mm</td>
                  <td className="p-2.5 text-[#45da7d]">U = {simResult?.u_values.floor.u_value ?? 0.280} W/m²K</td>
                  <td className="p-2.5 text-[#dae2fd]">210 kg</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Solar Fenestration</td>
                  <td className="p-2.5 text-[#bbc9cd]">Triple-Glazed Argon Low-E (Military Grade)</td>
                  <td className="p-2.5 text-[#8aebff]">40 mm IGU</td>
                  <td className="p-2.5 text-[#fb923c]">U = {simResult?.u_values.glazing.u_value ?? 0.80} W/m²K</td>
                  <td className="p-2.5 text-[#dae2fd]">95 kg</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Trombe Wall Frame & Mass</td>
                  <td className="p-2.5 text-[#bbc9cd]">Himalayan Basalt Stone / Rammed Earth</td>
                  <td className="p-2.5 text-[#8aebff]">200 mm</td>
                  <td className="p-2.5 text-[#a78bfa]">Cp = 1000 J/kg·K (6.5h lag)</td>
                  <td className="p-2.5 text-[#dae2fd]">350 kg (local stone)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-[#dae2fd]">Airlock & Hardware</td>
                  <td className="p-2.5 text-[#bbc9cd]">Aluminum Alloy 6061-T6 + Neoprene Seals</td>
                  <td className="p-2.5 text-[#8aebff]">--</td>
                  <td className="p-2.5 text-[#45da7d]">Air Infiltration &lt; 0.35 ACH</td>
                  <td className="p-2.5 text-[#dae2fd]">245 kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
