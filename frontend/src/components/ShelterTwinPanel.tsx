import React from 'react';
import {
  Fuel,
  Zap,
  Battery,
  Sun,
  Wind,
  Thermometer,
  Users,
  Signal,
  Radio,
  Cpu,
  MapPin,
  Mountain,
  Droplets,
  ShieldCheck,
  AlertTriangle,
  Play,
  Square,
  Plug,
  Cloud,
  Compass,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  ShelterTwin,
  ShelterPartId,
  FuelStatus,
  PowerSource,
  OperationalStatus,
} from '../types';
import { SHELTER_PARTS } from '../services/shelterApi';

/** Data provenance badge. Nothing is presented as LIVE unless it came from an API. */
const Provenance: React.FC<{ kind: 'live' | 'derived' | 'simulated'; label?: string }> = ({
  kind,
  label,
}) => {
  const map = {
    live: 'LIVE API',
    derived: 'BACKEND',
    simulated: 'SIMULATED',
  } as const;
  const cls = {
    live: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    derived: 'bg-slate-800/80 border-slate-600/50 text-slate-300',
    simulated: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
  } as const;
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold font-mono tracking-wide ${cls[kind]}`}
    >
      {label ?? map[kind]}
    </span>
  );
};

const fuelColor: Record<FuelStatus, string> = {
  NORMAL: 'text-emerald-400',
  LOW: 'text-yellow-400',
  CRITICAL: 'text-orange-400',
  EMPTY: 'text-red-400',
};

const powerColor: Record<PowerSource, string> = {
  GRID: 'text-sky-400',
  GENERATOR: 'text-amber-400',
  SOLAR: 'text-yellow-300',
  BATTERY: 'text-emerald-400',
  NONE: 'text-red-400',
};

const statusColor: Record<OperationalStatus, string> = {
  NOMINAL: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
  DEGRADED: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
  OFFLINE: 'bg-red-950/60 border-red-500/40 text-red-300',
};

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

interface ShelterTwinPanelProps {
  twin: ShelterTwin;
  selectedPart: ShelterPartId | null;
  onSelectPart: (part: ShelterPartId | null) => void;
  onCommand: (
    action: 'start_generator' | 'stop_generator' | 'toggle_grid' | 'refuel',
    liters?: number
  ) => void;
  busy?: boolean;
  lastCommand?: { accepted: boolean; message: string } | null;
  onRefresh?: () => void;
}

export const ShelterTwinPanel: React.FC<ShelterTwinPanelProps> = ({
  twin,
  selectedPart,
  onSelectPart,
  onCommand,
  busy = false,
  lastCommand = null,
  onRefresh,
}) => {
  const { fuel, generator, power, battery, solar, telemetry, environment, location } = twin;
  const genRunning = generator.status === 'RUNNING';
  const simFields = new Set(twin.simulated_fields);

  return (
    <div className="flex flex-col h-full min-h-0 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center border border-cyan-500/50 text-cyan-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-100 tracking-wide truncate">
              {twin.name}
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              {twin.id} &middot; {twin.archetype.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${statusColor[twin.operational_status]}`}
          >
            {twin.operational_status}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={busy}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
              title="Refresh twin telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="p-3.5 space-y-3 overflow-y-auto min-h-0">
        {/* Location anchor */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> GEOGRAPHIC ANCHOR
            </span>
            <Provenance kind="live" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-slate-400">Latitude</div>
            <div className="text-slate-200 text-right">
              {location.latitude.toFixed(5)}&deg;N
            </div>
            <div className="text-slate-400">Longitude</div>
            <div className="text-slate-200 text-right">
              {location.longitude.toFixed(5)}&deg;E
            </div>
            <div className="text-slate-400">Elevation</div>
            <div className="text-slate-200 text-right flex items-center justify-end gap-1">
              <Mountain className="w-3 h-3 text-slate-500" />
              {location.elevation_m.toFixed(0)} m
            </div>
            <div className="text-slate-400">Heading</div>
            <div className="text-slate-200 text-right flex items-center justify-end gap-1">
              <Compass className="w-3 h-3 text-slate-500" />
              {location.heading_deg.toFixed(0)}&deg;
            </div>
          </div>
          <p className="text-[9px] text-slate-500 leading-tight">{location.elevation_source}</p>
        </section>

        {/* Energy: fuel / generator / battery / solar */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
          <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> ENERGY &amp; POWER
          </span>

          {/* Fuel */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-slate-500" /> Fuel Tank
              </span>
              <span className={fuelColor[fuel.status]}>
                {fuel.fuel_level_l.toFixed(0)} / {fuel.fuel_capacity_l.toFixed(0)} L &middot;{' '}
                <strong>{fuel.status}</strong>
              </span>
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
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>
                Burn rate {fuel.consumption_rate_lph.toFixed(2)} L/h
              </span>
              <span>
                {fuel.remaining_runtime_hours !== null
                  ? `Runtime ~${fuel.remaining_runtime_hours.toFixed(0)} h`
                  : 'Generator off'}
              </span>
            </div>
            <div className="flex justify-end">
              <Provenance kind="derived" label="PHYSICS MODEL" />
            </div>
          </div>

          {/* Generator */}
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/70">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500" /> Generator
            </span>
            <span className={genRunning ? 'text-amber-400' : 'text-slate-400'}>
              {generator.status} &middot; rated {generator.rated_load_w.toFixed(0)} W
              {generator.stop_reason ? ` (${generator.stop_reason})` : ''}
            </span>
          </div>

          {/* Power source */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Plug className="w-3.5 h-3.5 text-slate-500" /> Active Source
            </span>
            <span className={powerColor[power.source]}>
              <strong>{power.source}</strong> &middot; load {power.load_w.toFixed(0)} W
            </span>
          </div>
          <div className="text-[9px] text-slate-500 -mt-1.5">
            Grid {power.grid_connected ? 'CONNECTED' : 'OFFLINE'} &middot; available:{' '}
            {power.available_sources.join(', ') || 'none'}
          </div>

          {/* Battery */}
          <div className="space-y-1 pt-1 border-t border-slate-800/70">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-slate-500" /> Battery Bank
              </span>
              <span className="text-slate-200">
                {battery.battery_level_kwh.toFixed(2)} / {battery.battery_capacity_kwh.toFixed(1)} kWh
                {battery.charging ? ' (CHARGING)' : ''}
              </span>
            </div>
            <Bar pct={battery.battery_pct} className={battery.charging ? 'bg-sky-400' : 'bg-emerald-500'} />
          </div>

          {/* Solar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-slate-500" /> Solar Array
              </span>
              <span className="text-slate-200">
                {solar.input_w.toFixed(0)} W / {solar.capacity_kw.toFixed(1)} kW
                {solar.generating ? '' : ' (night / low irradiance)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500">
              <span>Irradiance {environment.solar_radiation_w_m2.toFixed(0)} W/m&sup2;</span>
              <Provenance
                kind={environment.is_simulated ? 'simulated' : 'live'}
                label={environment.is_simulated ? 'ESTIMATED' : 'OPEN-METEO'}
              />
            </div>
          </div>
        </section>

        {/* Environment telemetry */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5" /> ENVIRONMENT
            </span>
            <Provenance
              kind={environment.is_simulated ? 'simulated' : 'live'}
              label={environment.is_simulated ? 'FALLBACK' : 'LIVE'}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> Outside
            </div>
            <div className="text-slate-200 text-right">
              {telemetry.outside_temperature_c !== null
                ? `${telemetry.outside_temperature_c.toFixed(1)} &deg;C`
                : '--'}
            </div>
            <div className="text-slate-400 flex items-center gap-1">
              <Wind className="w-3 h-3" /> Wind
            </div>
            <div className="text-slate-200 text-right">
              {telemetry.wind_speed_mps !== null ? `${telemetry.wind_speed_mps.toFixed(1)} m/s` : '--'}
            </div>
            <div className="text-slate-400">Humidity</div>
            <div className="text-slate-200 text-right">
              {telemetry.relative_humidity_pct !== null
                ? `${telemetry.relative_humidity_pct.toFixed(0)} %`
                : '--'}
            </div>
            <div className="text-slate-400">Pressure</div>
            <div className="text-slate-200 text-right">
              {telemetry.pressure_hpa !== null ? `${telemetry.pressure_hpa.toFixed(0)} hPa` : '--'}
            </div>
            <div className="text-slate-400">Visibility</div>
            <div className="text-slate-200 text-right">
              {telemetry.visibility_m !== null
                ? `${(telemetry.visibility_m / 1000).toFixed(1)} km`
                : '--'}
            </div>
            <div className="text-slate-400">Condition</div>
            <div className="text-slate-200 text-right truncate">{telemetry.condition ?? '--'}</div>
          </div>
          <p className="text-[9px] text-slate-500 leading-tight">{environment.source}</p>
        </section>

        {/* Internal / derived systems */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> INTERNAL SYSTEMS
          </span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="text-slate-400">Inside temp</div>
            <div className="text-slate-200 text-right">
              {telemetry.inside_temperature_c !== null
                ? `${telemetry.inside_temperature_c.toFixed(1)} &deg;C`
                : '--'}
            </div>
            <div className="text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> Occupancy
            </div>
            <div className="text-slate-200 text-right">
              {telemetry.occupancy} / {telemetry.occupancy_capacity}
            </div>
            <div className="text-slate-400 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Water
            </div>
            <div className="text-slate-200 text-right">{telemetry.water_availability_l} L</div>
            <div className="text-slate-400">Air quality</div>
            <div className="text-slate-200 text-right">{telemetry.air_quality}</div>
            <div className="text-slate-400 flex items-center gap-1">
              <Radio className="w-3 h-3" /> Comms
            </div>
            <div className="text-slate-200 text-right flex items-center justify-end gap-1">
              <Signal className="w-3 h-3 text-slate-500" />
              {telemetry.communication.signal_pct}%
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
            <span className="text-[9px] text-slate-500">
              Derived from live weather, occupancy and mass balance.
            </span>
            <Provenance
              kind={simFields.has('inside_temperature_c') ? 'simulated' : 'derived'}
              label="BACKEND"
            />
          </div>
        </section>

        {/* Subsystem selection (mirrors 3D click targets) */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> SUBSYSTEMS
            <span className="text-slate-500 font-normal normal-case">
              (click in 3D or below)
            </span>
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(SHELTER_PARTS) as ShelterPartId[]).map((id) => {
              const meta = SHELTER_PARTS[id];
              const active = selectedPart === id;
              return (
                <button
                  key={id}
                  onClick={() => onSelectPart(active ? null : id)}
                  className={`text-left px-2 py-1.5 rounded-lg border transition-colors ${
                    active
                      ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-200'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="text-[10px] font-bold">{meta.label}</div>
                  <div className="text-[9px] text-slate-500 leading-tight mt-0.5">
                    {meta.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Command feedback */}
        {lastCommand && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded-xl border text-[11px] leading-relaxed ${
              lastCommand.accepted
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-red-950/40 border-red-500/30 text-red-200'
            }`}
          >
            {lastCommand.accepted ? (
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            )}
            <span>{lastCommand.message}</span>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="px-3.5 py-3 border-t border-slate-800 bg-slate-950/50 flex-shrink-0 space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onCommand(genRunning ? 'stop_generator' : 'start_generator')}
            disabled={busy}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${
              genRunning
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            {genRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {genRunning ? 'STOP GEN' : 'START GEN'}
          </button>
          <button
            onClick={() => onCommand('refuel', 250)}
            disabled={busy || fuel.fuel_pct >= 99.9}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900 transition-colors disabled:opacity-40"
            title="Add 250 L to the bulk diesel tank"
          >
            <Fuel className="w-3.5 h-3.5" />
            REFUEL 250 L
          </button>
          <button
            onClick={() => onCommand('toggle_grid')}
            disabled={busy}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${
              power.grid_connected
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            {power.grid_connected ? 'DROP GRID' : 'GRID'}
          </button>
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-500">
          <span>
            Updated {new Date(twin.last_updated).toLocaleTimeString()} &middot; {twin.is_simulated ? 'CONTAINS SIMULATED DATA' : 'ALL FIGURES LIVE'}
          </span>
          {twin.is_simulated && <Provenance kind="simulated" />}
        </div>
      </div>
    </div>
  );
};
