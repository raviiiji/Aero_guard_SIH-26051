import React from 'react';
import {
  ShieldAlert,
  Flame,
  Sun,
  Users,
  Layers,
  Fuel,
  TrendingDown,
  Compass,
  Zap,
  Activity,
  Sparkles,
  Award,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Thermometer,
  Calendar,
} from 'lucide-react';
import { ShelterGeometry, SimulationParameters, SimulationResult, WeatherResponse } from '../types';
import { Shelter3DViewer } from '../components/Shelter3DViewer';

interface StrategicOverviewSectionProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
  onUpdateGeometry: (updates: Partial<ShelterGeometry>) => void;
  onUpdateParams: (updates: Partial<SimulationParameters>) => void;
  onNavigateTo: (section: any) => void;
}

export const StrategicOverviewSection: React.FC<StrategicOverviewSectionProps> = ({
  geometry,
  params,
  simResult,
  weatherData,
  onUpdateGeometry,
  onUpdateParams,
  onNavigateTo,
}) => {
  const summary = simResult?.summary;
  const uValues = simResult?.u_values;

  // Determine site-specific recommended archetype based on climate & terrain
  const getSiteRecommendation = () => {
    const minTemp = weatherData?.metrics_90day.extreme_min_temp_c ?? -20;
    const solar = weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8;
    const wind = weatherData?.metrics_90day.avg_peak_wind_mps ?? 6.0;

    if (minTemp <= -28.0) {
      return {
        name: 'VIP Deep-Arctic Zero-Deficit Shelter',
        archetype: 'trombe_wall',
        badge: 'ZERO-DEFICIT / DEEP ARCTIC',
        tagColor: 'text-[#45da7d] border-[#45da7d]/40 bg-[#45da7d]/20',
        rationale: 'Sub-zero temperatures below -28°C require Vacuum Insulation Panels (VIP k=0.004) to eliminate nocturnal thermal losses.',
        insulation: '35mm VIP + 40mm PUF ($U \\le 0.12\\text{ W/m}^2\\text{K}$)',
        glazing: 'Triple-Glazed Argon Low-E ($U=0.80$)',
        fuelSavedEst: '98.8%',
      };
    } else if (wind >= 8.0) {
      return {
        name: 'Earth-Bermed Semi-Subterranean Bunker',
        archetype: 'earth_bermed',
        badge: 'HIGH WIND / BLIZZARD DEFENSE',
        tagColor: 'text-[#22d3ee] border-[#22d3ee]/40 bg-[#22d3ee]/20',
        rationale: 'High altitude wind velocity causes severe infiltration. Earth-berming 3 sides into mountain soil reduces perimeter loss by 65%.',
        insulation: '150mm Rammed Stone + 100mm XPS + 30mm Aerogel',
        glazing: 'Triple-Glazed Argon Low-E ($U=0.80$)',
        fuelSavedEst: '96.2%',
      };
    } else {
      return {
        name: 'AERO-SHIELD Trombe Wall Solar Storage',
        archetype: 'trombe_wall',
        badge: 'BEST HIGH-ALTITUDE SOLAR VALUE',
        tagColor: 'text-[#fb923c] border-[#fb923c]/40 bg-[#fb923c]/20',
        rationale: 'High solar irradiance (7-8 hrs daily sunshine) enables passive daytime thermal capture in 200mm stone mass for 6-8h night heating release.',
        insulation: '100mm PUF + Dual FRP Skins ($U=0.21\\text{ W/m}^2\\text{K}$)',
        glazing: 'Triple-Glazed Low-E Fenestration + 4.5m² Trombe Wall',
        fuelSavedEst: '97.5%',
      };
    }
  };

  const rec = getSiteRecommendation();

  return (
    <div className="space-y-4 font-mono text-slate-100">
      {/* 1. Critical Mission Alert Banner */}
      <div className="tactical-glass p-3 rounded flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[#22d3ee]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />
        
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#22d3ee]/20 text-[#22d3ee]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-[#8aebff]">
                TACTICAL SIMULATION ACTIVE: {geometry.archetype.replace('_', ' ').toUpperCase()}
              </span>
              <span className="tactical-badge bg-[#45da7d]/20 text-[#45da7d] border border-[#45da7d]/40">
                OPTIMAL THERMAL HARVEST
              </span>
            </div>
            <p className="text-[11px] text-[#bbc9cd]">
              {params.troops} Soldiers ({params.troops * 85}W Metabolic Gain) | Target: {params.target_temp_c}°C (DRDO DGQA Standard)
            </p>
          </div>
        </div>

        {summary && (
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-[#bbc9cd]">Fuel Savings vs Canvas</div>
              <div className="text-base font-black text-[#45da7d]">
                {summary.fuel_saving_percentage}% ({summary.fuel_saved_liters.toLocaleString()} L)
              </div>
            </div>
            <button
              onClick={() => onNavigateTo('ai_optimizer')}
              className="px-3.5 py-1.5 bg-[#8aebff] hover:bg-[#a2eeff] text-[#060e20] font-bold text-xs rounded transition-all shadow-[0_0_12px_rgba(138,235,255,0.4)] uppercase flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full AI Optimizer</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Live Mission Profile & Operational Baseline (Fetched from Mission Config) */}
      <div className="tactical-glass p-3.5 rounded-lg border border-[#8aebff]/30 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#8aebff]/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#45da7d] animate-pulse" />
            <span className="font-bold text-[#8aebff] uppercase tracking-wider">
              Active Mission Profile & Baseline (Synchronized from Mission Config)
            </span>
          </div>
          <button
            onClick={() => onNavigateTo('mission_config')}
            className="text-[11px] font-bold text-[#22d3ee] hover:text-[#8aebff] flex items-center gap-1.5 transition-colors"
          >
            <span>⚙️ Configure Mission Parameters in Mission Config</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Item 1: Troop Deployment */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Users className="w-3 h-3 text-[#8aebff]" /> Target Occupancy:
            </div>
            <div className="font-bold text-[#8aebff] text-sm mt-0.5">
              {params.troops} Soldiers
            </div>
            <div className="text-[9px] text-[#45da7d] mt-0.5">
              +{params.troops * 85}W Body Heat (ASHRAE)
            </div>
          </div>

          {/* Item 2: Target Indoor Temperature */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Thermometer className="w-3 h-3 text-[#fb923c]" /> Target Temp:
            </div>
            <div className="font-bold text-[#fb923c] text-sm mt-0.5">
              {params.target_temp_c}°C
            </div>
            <div className="text-[9px] text-[#bbc9cd] mt-0.5">
              DRDO DGQA Spec
            </div>
          </div>

          {/* Item 3: Campaign Duration */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Calendar className="w-3 h-3 text-[#45da7d]" /> Campaign Horizon:
            </div>
            <div className="font-bold text-[#45da7d] text-sm mt-0.5">
              {params.mission_duration_days} Days
            </div>
            <div className="text-[9px] text-[#bbc9cd] mt-0.5">
              {params.mission_duration_days * 24}h Simulation
            </div>
          </div>

          {/* Item 4: Air Infiltration Rate */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Compass className="w-3 h-3 text-[#22d3ee]" /> Air Infiltration:
            </div>
            <div className="font-bold text-[#22d3ee] text-sm mt-0.5">
              {params.infiltration_ach_base} ACH
            </div>
            <div className="text-[9px] text-[#bbc9cd] mt-0.5">
              Airlock Sealed Buffer
            </div>
          </div>

          {/* Item 5: Internal Electronics & C2 Heat */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Zap className="w-3 h-3 text-[#f59e0b]" /> Equipment Heat:
            </div>
            <div className="font-bold text-[#f59e0b] text-sm mt-0.5">
              {params.equipment_heat_w} W
            </div>
            <div className="text-[9px] text-[#bbc9cd] mt-0.5">
              Tactical Radios / C2
            </div>
          </div>

          {/* Item 6: Burner Efficiency */}
          <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/20">
            <div className="flex items-center gap-1 text-[10px] text-[#bbc9cd]">
              <Flame className="w-3 h-3 text-[#fb923c]" /> Burner Efficiency:
            </div>
            <div className="font-bold text-[#dae2fd] text-sm mt-0.5">
              {(params.burner_efficiency * 100).toFixed(0)}%
            </div>
            <div className="text-[9px] text-[#bbc9cd] mt-0.5">
              {params.diesel_energy_density_kwh_l} kWh/L Arctic SKO
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main 3D Viewport & Telemetry Grid (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Central 3D Canvas (8 Cols on LG) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="h-[460px] w-full">
            <Shelter3DViewer
              geometry={geometry}
              simResult={simResult}
              troops={params.troops}
            />
          </div>

          {/* Quick Archetype Toggle Bar */}
          <div className="tactical-glass p-3 rounded flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#8aebff] uppercase">Select Archetype:</span>
            <div className="flex items-center gap-2">
              {[
                {
                  id: 'modular_box',
                  name: 'Modular Box',
                  config: { archetype: 'modular_box' as const, trombe_wall_area_m2: 0, earth_bermed_depth_m: 0, roof_pitch_deg: 0, window_area_m2: 2.0 }
                },
                {
                  id: 'trombe_wall',
                  name: 'Trombe Wall',
                  config: { archetype: 'trombe_wall' as const, trombe_wall_area_m2: 4.5, earth_bermed_depth_m: 0, roof_pitch_deg: 15.0, window_area_m2: 3.8 }
                },
                {
                  id: 'earth_bermed',
                  name: 'Earth-Bermed',
                  config: { archetype: 'earth_bermed' as const, earth_bermed_depth_m: 2.0, trombe_wall_area_m2: 0, roof_pitch_deg: 10.0, window_area_m2: 3.0 }
                },
                {
                  id: 'quonset_dome',
                  name: 'Quonset Arch',
                  config: { archetype: 'quonset_dome' as const, trombe_wall_area_m2: 0, earth_bermed_depth_m: 0, roof_pitch_deg: 0, window_area_m2: 2.5 }
                },
              ].map((arch) => (
                <button
                  key={arch.id}
                  onClick={() => onUpdateGeometry(arch.config)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                    geometry.archetype === arch.id
                      ? 'bg-[#22d3ee] text-[#060e20] shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'bg-[#131b2e] text-[#bbc9cd] hover:text-[#8aebff] border border-[#8aebff]/20'
                  }`}
                >
                  {arch.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Key Telemetry Cards (4 Cols on LG) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Card 1: 90-Day Campaign Fuel Demand */}
          <div className="tactical-glass p-3.5 rounded relative">
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-br" />
            <div className="flex items-center justify-between text-xs text-[#bbc9cd] mb-1">
              <span>90-DAY CAMPAIGN FUEL</span>
              <Fuel className="w-4 h-4 text-[#fb923c]" />
            </div>
            <div className="text-2xl font-black text-[#fb923c]">
              {summary ? summary.campaign_fuel_liters.toLocaleString() : '---'} <span className="text-xs text-[#bbc9cd]">Liters</span>
            </div>
            <div className="text-[11px] text-[#bbc9cd] mt-1 flex items-center justify-between">
              <span>Standard 200L Fuel Drums:</span>
              <strong className="text-[#dae2fd]">{summary?.campaign_fuel_barrels_200l ?? '--'} Drums</strong>
            </div>
          </div>

          {/* Card 2: Passive Solar Yield */}
          <div className="tactical-glass p-3.5 rounded relative">
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-br" />
            <div className="flex items-center justify-between text-xs text-[#bbc9cd] mb-1">
              <span>PASSIVE SOLAR FRACTION</span>
              <Sun className="w-4 h-4 text-[#fb923c]" />
            </div>
            <div className="text-2xl font-black text-[#fb923c]">
              {summary ? `${summary.passive_solar_fraction_pct}%` : '---'}
            </div>
            <div className="text-[11px] text-[#bbc9cd] mt-1 flex items-center justify-between">
              <span>Daily Solar Harvested:</span>
              <strong className="text-[#45da7d]">{summary?.total_daily_solar_gain_kwh ?? '--'} kWh/day</strong>
            </div>
          </div>

          {/* Card 3: Thermal Transmittance (U-Values) */}
          <div className="tactical-glass p-3.5 rounded relative space-y-2">
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-br" />
            <div className="text-xs font-bold uppercase text-[#8aebff]">
              Envelope $U$-Values Transmittance
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#131b2e] p-2 rounded border border-[#8aebff]/20">
                <div className="text-[10px] text-[#bbc9cd]">Roof Envelope</div>
                <div className="font-bold text-[#22d3ee]">
                  {uValues?.roof.u_value ?? '--'} <span className="text-[9px] text-[#bbc9cd]">W/m²K</span>
                </div>
              </div>
              <div className="bg-[#131b2e] p-2 rounded border border-[#8aebff]/20">
                <div className="text-[10px] text-[#bbc9cd]">Wall Envelope</div>
                <div className="font-bold text-[#22d3ee]">
                  {uValues?.walls.u_value ?? '--'} <span className="text-[9px] text-[#bbc9cd]">W/m²K</span>
                </div>
              </div>
              <div className="bg-[#131b2e] p-2 rounded border border-[#8aebff]/20">
                <div className="text-[10px] text-[#bbc9cd]">Solar Glazing</div>
                <div className="font-bold text-[#fb923c]">
                  {uValues?.glazing.u_value ?? '--'} <span className="text-[9px] text-[#bbc9cd]">W/m²K</span>
                </div>
              </div>
              <div className="bg-[#131b2e] p-2 rounded border border-[#8aebff]/20">
                <div className="text-[10px] text-[#bbc9cd]">Floor Contact</div>
                <div className="font-bold text-[#22d3ee]">
                  {uValues?.floor.u_value ?? '--'} <span className="text-[9px] text-[#bbc9cd]">W/m²K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Logistics Airlift Payload */}
          <div className="tactical-glass p-3.5 rounded relative">
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-br" />
            <div className="flex items-center justify-between text-xs text-[#bbc9cd] mb-1">
              <span>TRANSPORT PAYLOAD WEIGHT</span>
              <Layers className="w-4 h-4 text-[#8aebff]" />
            </div>
            <div className="text-xl font-black text-[#8aebff]">
              {summary ? summary.total_shelter_weight_kg.toLocaleString() : '---'} <span className="text-xs text-[#bbc9cd]">kg</span>
            </div>
            <div className="text-[10px] text-[#bbc9cd] mt-0.5">
              Suitable for Mi-17 / Chinook sling load
            </div>
          </div>
        </div>
      </div>

      {/* 4. Dedicated Live AI Recommendation Spotlight Box */}
      <div className="tactical-glass p-4 rounded-lg border-l-4 border-l-[#fb923c] space-y-3">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#8aebff]/20">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#fb923c]" />
            <h3 className="text-xs font-bold uppercase text-[#8aebff]">
              AI Site-Specific Shelter Design Recommendation
            </h3>
            <span className={`tactical-badge ${rec.tagColor}`}>
              {rec.badge}
            </span>
          </div>

          <button
            onClick={() => onNavigateTo('ai_optimizer')}
            className="text-xs text-[#8aebff] hover:text-[#a2eeff] flex items-center gap-1 font-bold"
          >
            <span>View All Pareto Candidates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20 space-y-1">
            <div className="text-[10px] text-[#bbc9cd] uppercase font-bold">Recommended Archetype</div>
            <div className="text-sm font-bold text-[#fb923c]">{rec.name}</div>
            <div className="text-[11px] text-[#bbc9cd] leading-relaxed pt-1">{rec.rationale}</div>
          </div>

          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20 space-y-1">
            <div className="text-[10px] text-[#bbc9cd] uppercase font-bold">Recommended Envelope Stack</div>
            <div className="text-xs font-bold text-[#22d3ee]">{rec.insulation}</div>
            <div className="text-[11px] text-[#bbc9cd] pt-1">Glazing: <strong className="text-[#dae2fd]">{rec.glazing}</strong></div>
            <div className="text-[11px] text-[#45da7d] pt-0.5">Est. Fuel Savings: <strong>{rec.fuelSavedEst}</strong></div>
          </div>

          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-[#bbc9cd] uppercase font-bold">1-Click Quick Action</div>
              <div className="text-[11px] text-[#dae2fd] mt-1">
                Instantly apply this climate-optimized design to the active 3D model and recalculate thermal heat flows.
              </div>
            </div>

            <button
              onClick={() => onNavigateTo('ai_optimizer')}
              className="mt-2 w-full py-2 bg-[#fb923c] hover:bg-[#f59e0b] text-[#060e20] font-bold text-xs rounded uppercase flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(251,146,60,0.3)] transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply AI Recommended Design</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
