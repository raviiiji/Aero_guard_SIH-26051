import React from 'react';
import {
  Cpu,
  Fuel,
  Battery,
  Sun,
  Box,
  DoorOpen,
  Wind,
  Signal,
  Layers,
  Play,
  Square,
  Plug,
  Droplet,
  X,
  Gauge,
  Thermometer,
  Users,
} from 'lucide-react';
import { ShelterPartId, ShelterTwin } from '../types';
import { SHELTER_PARTS } from '../services/shelterApi';

const PART_ICONS: Record<ShelterPartId, React.ElementType> = {
  shelter_shell: Box,
  glazing: Layers,
  entrance: DoorOpen,
  generator: Cpu,
  fuel_tank: Fuel,
  battery: Battery,
  solar_array: Sun,
  ventilation: Wind,
  comms: Signal,
};

interface PartRow {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'plain';
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * Contextual readout for the shelter component the user clicked in the 3D
 * scene. Every value comes from the deployed twin, so the panel can never
 * contradict ShelterTwinPanel or the backend simulation.
 */
interface ShelterComponentPanelProps {
  part: ShelterPartId;
  twin: ShelterTwin | null;
  busy?: boolean;
  onCommand: (action: 'start_generator' | 'stop_generator' | 'toggle_grid' | 'refuel', liters?: number) => void;
  onClose: () => void;
}

export const ShelterComponentPanel: React.FC<ShelterComponentPanelProps> = ({
  part,
  twin,
  busy = false,
  onCommand,
  onClose,
}) => {
  const meta = SHELTER_PARTS[part];
  const Icon = PART_ICONS[part];
  const rows: PartRow[] = [];

  if (!twin) {
    return (
      <div className="px-3 py-6 text-[11px] text-slate-500 font-mono text-center">
        Deploy the shelter to inspect {meta.label.toLowerCase()}.
      </div>
    );
  }

  const { fuel, generator, power, battery, solar, telemetry, environment, location } = twin;
  const genRunning = generator.status === 'RUNNING';

  switch (part) {
    case 'generator':
      rows.push(
        { label: 'Status', value: generator.status, tone: genRunning ? 'warn' : 'plain' },
        { label: 'Rated load', value: `${generator.rated_load_w.toFixed(0)} W` },
        { label: 'Fuel consumption', value: `${fuel.consumption_rate_lph.toFixed(2)} L/h`, tone: fuel.consumption_rate_lph > 0 ? 'warn' : 'plain' },
        {
          label: 'Runtime',
          value: fuel.remaining_runtime_hours !== null ? `${fuel.remaining_runtime_hours.toFixed(1)} h` : '—',
        },
        { label: 'Power source', value: power.source },
        { label: 'Shelter load', value: `${power.load_w.toFixed(0)} W` }
      );
      if (generator.stop_reason) rows.push({ label: 'Stop reason', value: generator.stop_reason, tone: 'warn' });
      break;
    case 'fuel_tank':
      rows.push(
        { label: 'Capacity', value: `${fuel.fuel_capacity_l.toFixed(0)} L` },
        { label: 'Current', value: `${fuel.fuel_level_l.toFixed(1)} L` },
        { label: 'Level', value: `${fuel.fuel_pct.toFixed(1)} %` },
        { label: 'Status', value: fuel.status, tone: fuel.status === 'NORMAL' ? 'ok' : fuel.status === 'EMPTY' ? 'bad' : 'warn' },
        { label: 'Consumption', value: `${fuel.consumption_rate_lph.toFixed(2)} L/h` },
        {
          label: 'Est. runtime',
          value: fuel.remaining_runtime_hours !== null ? `${fuel.remaining_runtime_hours.toFixed(1)} h` : 'Idle',
        }
      );
      break;
    case 'battery':
      rows.push(
        { label: 'Charge', value: `${battery.battery_level_kwh.toFixed(2)} / ${battery.battery_capacity_kwh.toFixed(1)} kWh` },
        { label: 'State of charge', value: `${battery.battery_pct.toFixed(1)} %`, tone: battery.battery_pct < 15 ? 'bad' : 'ok' },
        { label: 'Charging', value: battery.charging ? 'YES' : 'NO', tone: battery.charging ? 'ok' : 'plain' },
        { label: 'Charge control', value: battery.charging_enabled ? 'ENABLED' : 'DISABLED' },
        { label: 'Active source', value: power.source }
      );
      break;
    case 'solar_array':
      rows.push(
        { label: 'Array rating', value: `${solar.capacity_kw.toFixed(1)} kW` },
        { label: 'Input', value: `${solar.input_w.toFixed(0)} W`, tone: solar.generating ? 'ok' : 'plain' },
        { label: 'State', value: solar.generating ? 'GENERATING' : 'IDLE (low irradiance)' },
        { label: 'Irradiance', value: `${environment.solar_radiation_w_m2.toFixed(0)} W/m²` },
        { label: 'Data source', value: environment.is_simulated ? 'SIMULATED FALLBACK' : environment.source }
      );
      break;
    case 'shelter_shell':
      rows.push(
        { label: 'Identification', value: twin.id },
        { label: 'Archetype', value: twin.archetype.replace(/_/g, ' ') },
        { label: 'Anchor', value: `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°` },
        { label: 'Ground elevation', value: `${location.elevation_m.toFixed(0)} m ASL` },
        { label: 'Outside', value: telemetry.outside_temperature_c !== null ? `${telemetry.outside_temperature_c.toFixed(1)} °C` : 'Unavailable' },
        { label: 'Inside (modelled)', value: telemetry.inside_temperature_c !== null ? `${telemetry.inside_temperature_c.toFixed(1)} °C` : 'Unavailable' },
        { label: 'Status', value: twin.operational_status, tone: twin.operational_status === 'NOMINAL' ? 'ok' : 'warn' }
      );
      break;
    case 'glazing':
      rows.push(
        { label: 'Aperture', value: 'South-facing solar glazing / Trombe wall' },
        { label: 'Incident irradiance', value: `${environment.solar_radiation_w_m2.toFixed(0)} W/m²` },
        { label: 'Cloud cover', value: telemetry.condition ?? '—' },
        { label: 'Heading', value: `${location.heading_deg.toFixed(0)}° (true south at 180°)` }
      );
      break;
    case 'entrance':
      rows.push(
        { label: 'Type', value: 'Thermal airlock vestibule' },
        { label: 'Outside', value: telemetry.outside_temperature_c !== null ? `${telemetry.outside_temperature_c.toFixed(1)} °C` : 'Unavailable' },
        { label: 'Inside', value: telemetry.inside_temperature_c !== null ? `${telemetry.inside_temperature_c.toFixed(1)} °C` : 'Unavailable' },
        { label: 'ΔT across door', value: telemetry.inside_temperature_c !== null && telemetry.outside_temperature_c !== null ? `${(telemetry.inside_temperature_c - telemetry.outside_temperature_c).toFixed(1)} K` : '—' }
      );
      break;
    case 'ventilation':
      rows.push(
        { label: 'Humidity', value: telemetry.relative_humidity_pct !== null ? `${telemetry.relative_humidity_pct.toFixed(0)} %` : 'Unavailable' },
        { label: 'Wind (drives infiltration)', value: telemetry.wind_speed_mps !== null ? `${telemetry.wind_speed_mps.toFixed(1)} m/s` : 'Unavailable' },
        { label: 'Pressure', value: telemetry.pressure_hpa !== null ? `${telemetry.pressure_hpa.toFixed(0)} hPa` : 'Unavailable' },
        { label: 'Air quality', value: telemetry.air_quality }
      );
      break;
    case 'comms':
      rows.push(
        { label: 'Status', value: telemetry.communication.status, tone: telemetry.communication.status === 'ONLINE' ? 'ok' : 'warn' },
        { label: 'Link', value: telemetry.communication.link },
        { label: 'Signal', value: `${telemetry.communication.signal_pct} %` },
        { label: 'Provenance', value: telemetry.communication.is_simulated ? 'SIMULATED' : 'LIVE' },
        { label: 'Occupancy', value: `${telemetry.occupancy} / ${telemetry.occupancy_capacity}` }
      );
      break;
  }

  const toneCls: Record<NonNullable<PartRow['tone']>, string> = {
    ok: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-red-300',
    plain: 'text-slate-200',
  };

  return (
    <div className="space-y-2.5 font-mono">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-cyan-100 uppercase tracking-wide truncate">
              {meta.label}
            </div>
            <div className="text-[9px] text-slate-400 leading-tight">{meta.description}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close component panel"
          className="text-slate-500 hover:text-slate-200 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contextual readout */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 py-1">
            <span className="text-[10px] text-slate-400">{r.label}</span>
            <span className={`text-[11px] font-bold text-right truncate ${toneCls[r.tone ?? 'plain']}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Part-specific bars */}
      {part === 'fuel_tank' && (
        <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 space-y-1">
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>Tank level</span>
            <span>{fuel.fuel_pct.toFixed(1)} %</span>
          </div>
          <Bar
            pct={fuel.fuel_pct}
            className={
              fuel.status === 'NORMAL'
                ? 'bg-emerald-500'
                : fuel.status === 'LOW'
                  ? 'bg-yellow-400'
                  : fuel.status === 'CRITICAL'
                    ? 'bg-orange-500'
                    : 'bg-red-500'
            }
          />
        </div>
      )}
      {part === 'battery' && (
        <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 space-y-1">
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>State of charge</span>
            <span>{battery.battery_pct.toFixed(1)} %</span>
          </div>
          <Bar pct={battery.battery_pct} className={battery.charging ? 'bg-sky-400' : 'bg-emerald-500'} />
        </div>
      )}

      {/* Controls available on this component */}
      {(part === 'generator' || part === 'fuel_tank') && (
        <div className="space-y-1.5">
          <button
            onClick={() => onCommand(genRunning ? 'stop_generator' : 'start_generator')}
            disabled={busy}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${
              genRunning
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            {genRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {genRunning ? 'STOP GENERATOR' : 'START GENERATOR'}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            {[100, 250].map((l) => (
              <button
                key={l}
                onClick={() => onCommand('refuel', l)}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900 text-[10px] font-bold transition-colors disabled:opacity-50"
              >
                <Droplet className="w-3 h-3" /> REFUEL {l} L
              </button>
            ))}
          </div>
        </div>
      )}
      {part === 'battery' && (
        <button
          onClick={() => onCommand('toggle_grid')}
          disabled={busy}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${
            power.grid_connected
              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          {power.grid_connected ? 'DISCONNECT GRID' : 'CONNECT GRID'}
        </button>
      )}

      {/* Context strip shared by all parts */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-[9px] text-slate-500">
        <span className="flex items-center gap-1">
          <Gauge className="w-2.5 h-2.5" /> {twin.operational_status}
        </span>
        <span className="flex items-center gap-1">
          <Thermometer className="w-2.5 h-2.5" />
          {telemetry.outside_temperature_c !== null ? `${telemetry.outside_temperature_c.toFixed(0)} °C` : '—'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-2.5 h-2.5" /> {telemetry.occupancy}/{telemetry.occupancy_capacity}
        </span>
        <span>{twin.is_simulated ? 'SIMULATED DATA' : 'LIVE DATA'}</span>
      </div>
    </div>
  );
};
