import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Ruler, Layers, Sun, Flame, Battery, Zap, Info } from 'lucide-react';
import { ConfigValueKind, DesignLayer, RecommendedConfiguration } from '../types';

const KIND_STYLE: Record<ConfigValueKind, { label: string; cls: string; help: string }> = {
  measured: {
    label: 'MEASURED',
    cls: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
    help: 'Read directly from a live external API at the analysed coordinates.',
  },
  calculated: {
    label: 'CALCULATED',
    cls: 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300',
    help: 'Produced by the backend thermodynamic model (/api/simulate) on real inputs.',
  },
  recommended: {
    label: 'RECOMMENDED',
    cls: 'bg-violet-950/60 border-violet-500/40 text-violet-300',
    help: 'Rule-engine recommendation from /api/design-template. Not a certified engineering design.',
  },
  asset: {
    label: 'ASSET RATING',
    cls: 'bg-slate-800/80 border-slate-600/60 text-slate-300',
    help: 'Fixed rating declared by the deployed shelter twin, not derived from this site.',
  },
};

const Kind: React.FC<{ kind: ConfigValueKind }> = ({ kind }) => {
  const s = KIND_STYLE[kind];
  return (
    <span title={s.help} className={`px-1 py-0.5 rounded border text-[8px] font-bold tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
};

/** Label + value + provenance. Unavailable values are shown, never invented. */
const Item: React.FC<{
  label: string;
  value: number | null;
  kind: ConfigValueKind;
  unit?: string;
  digits?: number;
}> = ({ label, value, kind, unit, digits = 1 }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-[10px] text-slate-400 truncate">{label}</span>
    <span className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-[11px] font-bold text-slate-100 tabular-nums">
        {value !== null && Number.isFinite(value) ? (
          <>
            {value.toFixed(digits)}
            {unit ? <span className="text-slate-500 font-normal"> {unit}</span> : null}
          </>
        ) : (
          <span className="text-slate-600">Unavailable</span>
        )}
      </span>
      <Kind kind={kind} />
    </span>
  </div>
);

const StackList: React.FC<{ title: string; layers: DesignLayer[]; kind: ConfigValueKind }> = ({
  title,
  layers,
  kind,
}) => {
  const [open, setOpen] = useState(false);
  const insul = layers.filter((l) => (l.k ?? 1) < 0.1);
  const totalInsulMm = insul.reduce((a, l) => a + (l.thickness_mm ?? 0), 0);
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {title}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-300 tabular-nums">
            {totalInsulMm > 0 ? `${totalInsulMm} mm insulation` : `${layers.length} layers`}
          </span>
          <Kind kind={kind} />
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2 space-y-1 border-t border-slate-800/70 pt-1.5">
          {layers.map((l, i) => (
            <div key={`${l.layer}-${i}`} className="flex items-start justify-between gap-2 text-[10px]">
              <span className="text-slate-400">
                <span className="text-slate-500">{i + 1}.</span> {l.layer}
              </span>
              <span className="text-slate-200 text-right flex-shrink-0">
                {l.thickness_mm} mm · {l.mat}
                <span className="text-slate-500"> (k={l.k})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface LocationConfigPanelProps {
  config: RecommendedConfiguration | null;
  loading?: boolean;
}

export const LocationConfigPanel: React.FC<LocationConfigPanelProps> = ({ config, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-6 text-[11px] text-cyan-300 font-mono justify-center">
        <Zap className="w-3.5 h-3.5 animate-pulse" /> Deriving configuration from site data…
      </div>
    );
  }
  if (!config) {
    return (
      <div className="px-3 py-6 text-[11px] text-slate-500 font-mono text-center">
        Analyze a location to generate its recommended configuration.
      </div>
    );
  }

  const t = config.template;
  const th = config.thermal;
  const d = t?.dimensions;

  return (
    <div className="space-y-2.5 font-mono">
      {/* Provenance legend */}
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-900/50 text-[9px] text-slate-400 leading-relaxed">
        <Info className="w-3 h-3 flex-shrink-0 mt-px text-cyan-500" />
        <span>
          Every figure below is tagged. <Kind kind="measured" /> comes from a live API,{' '}
          <Kind kind="calculated" /> from the backend solver, <Kind kind="recommended" /> from the
          site rules engine, <Kind kind="asset" /> from a fixed installed rating. This is a design
          demonstrator, not a certified structural or thermal assessment.
        </span>
      </div>

      {/* Site inputs */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
          <Info className="w-3 h-3" /> SITE INPUTS
        </div>
        <Item label="Latitude" value={config.inputs.latitude} kind="measured" unit="°N" digits={4} />
        <Item label="Elevation" value={config.inputs.elevation_m} kind="measured" unit="m" digits={0} />
        <Item label="Ambient temperature" value={config.inputs.ambient_temp_c} kind="measured" unit="°C" />
        <Item label="Wind speed" value={config.inputs.wind_speed_mps} kind="measured" unit="m/s" />
        <Item label="Solar irradiance" value={config.inputs.solar_w_m2} kind="measured" unit="W/m²" digits={0} />
        <Item label="Occupancy" value={config.inputs.troops} kind="measured" unit="troops" digits={0} />
        {config.capacity_designation && (
          <div className="mt-1 text-[9px] text-violet-300 border-t border-slate-800/70 pt-1">
            Rules engine selected: {config.capacity_designation}
          </div>
        )}
      </div>

      {/* Structural */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
          <Ruler className="w-3 h-3" /> STRUCTURAL DIMENSIONS
        </div>
        {d ? (
          <>
            <div className="py-1 text-[10px] text-slate-400 flex items-center justify-between gap-2">
              <span>Model designation</span>
              <span className="text-[11px] font-bold text-violet-200 text-right truncate">{t?.model}</span>
            </div>
            <Item label="Floor area" value={d.floor_area_m2} kind="recommended" unit="m²" />
            <Item label="Enclosed volume" value={d.volume_m3} kind="recommended" unit="m³" />
            <Item label="Roof pitch" value={d.roof_pitch_deg} kind="recommended" unit="°" />
            <Item label="Capacity" value={config.inputs.troops} kind="measured" unit="troops" digits={0} />
          </>
        ) : (
          <div className="text-[10px] text-slate-600">Design template unavailable for this site.</div>
        )}
      </div>

      {/* Envelope / insulation */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1.5 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> ENVELOPE &amp; INSULATION
        </div>
        {t ? (
          <div className="space-y-1.5">
            <StackList title="Roof stack" layers={t.envelope_stack.roof_layers} kind="recommended" />
            <StackList title="Wall stack" layers={t.envelope_stack.wall_layers} kind="recommended" />
            <StackList title="Floor stack" layers={t.envelope_stack.floor_layers} kind="recommended" />
          </div>
        ) : (
          <div className="text-[10px] text-slate-600">Envelope stacks unavailable.</div>
        )}
      </div>

      {/* Thermal */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
          <Flame className="w-3 h-3" /> THERMAL PERFORMANCE
        </div>
        <Item label="Roof U-value" value={th.roof_u} kind="calculated" unit="W/m²K" digits={3} />
        <Item label="Wall U-value" value={th.wall_u} kind="calculated" unit="W/m²K" digits={3} />
        <Item label="Floor U-value" value={th.floor_u} kind="calculated" unit="W/m²K" digits={3} />
        <Item label="Glazing U-value" value={th.glazing_u} kind="calculated" unit="W/m²K" digits={3} />
        <Item label="Glazing SHGC" value={th.glazing_shgc} kind="calculated" digits={2} />
        <Item label="Peak heating deficit" value={th.peak_heating_deficit_w} kind="calculated" unit="W" digits={0} />
      </div>

      {/* Passive gain */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
          <Sun className="w-3 h-3" /> PASSIVE SOLAR &amp; THERMAL MASS
        </div>
        <Item label="Trombe wall area" value={t?.dimensions.trombe_wall_area_m2 ?? null} kind="recommended" unit="m²" />
        <Item label="Solar aperture area" value={t?.dimensions.window_area_m2 ?? null} kind="recommended" unit="m²" />
        <Item label="Facade azimuth" value={t?.dimensions.window_orientation_deg ?? null} kind="recommended" unit="°" digits={0} />
        <Item label="Incident irradiance" value={th.incident_solar_w_m2} kind="measured" unit="W/m²" digits={0} />
        {t && (
          <div className="text-[9px] text-slate-500 mt-1 leading-tight">
            Trombe mass: {t.trombe_wall.material} · α={t.trombe_wall.absorptance} · ε=
            {t.trombe_wall.emittance} · {t.trombe_wall.thermal_lag_hours} h phase lag
          </div>
        )}
        {t && (
          <div className="text-[9px] text-slate-500 leading-tight">
            Entry: {t.vestibule.dimensions} · {t.vestibule.infiltration_reduction_pct}% infiltration
            reduction (rule-engine figure, not a measured result)
          </div>
        )}
      </div>

      {/* Energy assets */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="text-[10px] font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
          <Battery className="w-3 h-3" /> ENERGY &amp; FUEL RESERVE
        </div>
        <Item label="Solar capacity" value={config.assets.solar_capacity_kw} kind="asset" unit="kW" digits={2} />
        <Item label="Battery capacity" value={config.assets.battery_capacity_kwh} kind="asset" unit="kWh" digits={2} />
        <Item label="Fuel tank capacity" value={config.assets.fuel_capacity_l} kind="asset" unit="L" digits={0} />
        <Item label="Daily fuel demand" value={config.fuel.daily_liters} kind="calculated" unit="L" />
        <Item label="Campaign fuel reserve" value={config.fuel.campaign_liters} kind="calculated" unit="L" digits={0} />
        <Item label="Campaign reserve" value={config.fuel.campaign_barrels_200l} kind="calculated" unit="× 200 L" digits={1} />
        <Item label="Saving vs baseline" value={config.fuel.saving_pct} kind="calculated" unit="%" />
      </div>

      <div className="text-[9px] text-slate-600 text-center">
        Derived {new Date(config.analysed_at).toLocaleTimeString()} · /api/design-template + /api/simulate
      </div>
    </div>
  );
};
