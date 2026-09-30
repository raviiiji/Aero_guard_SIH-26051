import React from 'react';
import {
  AlertTriangle,
  Mountain,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  CloudRain,
  Snowflake,
  Sun,
  Gauge,
  Cloud,
  MapPin,
  Layers,
  Leaf,
  Clock,
} from 'lucide-react';
import { AnalyzedField, FieldOrigin, LocationAnalysis, SuitabilityRating } from '../types';

const ORIGIN_STYLE: Record<FieldOrigin, { label: string; cls: string }> = {
  live: { label: 'LIVE API', cls: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' },
  derived: { label: 'DERIVED', cls: 'bg-slate-800/80 border-slate-600/60 text-slate-300' },
  simulated: { label: 'SIMULATED', cls: 'bg-amber-950/70 border-amber-500/40 text-amber-300' },
  unavailable: { label: 'UNAVAILABLE', cls: 'bg-slate-900 border-slate-800 text-slate-600' },
};

/**
 * A single analysed value. Unavailable values render as an explicit dash, and
 * the source endpoint is always reachable so no figure is anonymous.
 */
const Row: React.FC<{
  icon: React.ReactNode;
  label: string;
  field: AnalyzedField<number>;
  format: (v: number) => string;
}> = ({ icon, label, field, format }) => {
  const style = ORIGIN_STYLE[field.origin];
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex items-center gap-1.5 text-[10px] text-slate-400 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[11px] font-bold text-slate-100 tabular-nums">
          {field.value !== null ? (
            <>
              {format(field.value)}
              {field.unit ? <span className="text-slate-500 font-normal"> {field.unit}</span> : null}
            </>
          ) : (
            <span className="text-slate-600">Unavailable</span>
          )}
        </span>
        <span
          title={field.source}
          className={`px-1 py-0.5 rounded border text-[8px] font-bold tracking-wide ${style.cls}`}
        >
          {style.label}
        </span>
      </span>
    </div>
  );
};

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function compassPoint(deg: number): string {
  return COMPASS_POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

interface LocationAnalysisPanelProps {
  analysis: LocationAnalysis;
  /** Transparent rules-engine rating for the siting decision. */
  suitability?: SuitabilityRating | null;
}

const SUITABILITY_TONE: Record<string, { text: string; ring: string; bar: string }> = {
  EXCELLENT: { text: 'text-emerald-300', ring: 'border-emerald-500/50', bar: 'bg-emerald-400' },
  FAVOURABLE: { text: 'text-cyan-300', ring: 'border-cyan-500/50', bar: 'bg-cyan-400' },
  MARGINAL: { text: 'text-amber-300', ring: 'border-amber-500/50', bar: 'bg-amber-400' },
  POOR: { text: 'text-red-300', ring: 'border-red-500/50', bar: 'bg-red-400' },
  UNKNOWN: { text: 'text-slate-400', ring: 'border-slate-700', bar: 'bg-slate-600' },
};

/**
 * The siting rating with its working exposed. Each factor shows the measured
 * value that produced its score, and a factor that could not be evaluated is
 * shown as unavailable rather than quietly dropped.
 */
const SuitabilityCard: React.FC<{ rating: SuitabilityRating }> = ({ rating }) => {
  const tone = SUITABILITY_TONE[rating.rating] ?? SUITABILITY_TONE.UNKNOWN;
  return (
    <div className={`px-3 py-2.5 rounded-lg border bg-slate-900/50 ${tone.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
          <Gauge className="w-3 h-3" /> SITE SUITABILITY
        </span>
        <span
          title={rating.basis}
          className="px-1 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-400 text-[8px] font-bold"
        >
          CALCULATED
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-lg font-black tracking-wide ${tone.text}`}>{rating.rating}</span>
        {rating.score !== null && (
          <span className="text-[11px] text-slate-400 tabular-nums">{rating.score}/100</span>
        )}
        <span className="ml-auto text-[9px] text-slate-600">
          {rating.coverage_pct}% of criteria evaluated
        </span>
      </div>

      {/* A thin slice of the weighted input must not read as a verdict. */}
      {rating.low_confidence && (
        <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 rounded border border-amber-600/50 bg-amber-950/30 text-[9px] text-amber-300 leading-tight">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
          <span>
            PROVISIONAL — most criteria could not be evaluated, so this rating is not a verdict.
          </span>
        </div>
      )}

      {rating.score !== null && (
        <div className="h-1 mt-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full ${tone.bar}`} style={{ width: `${rating.score}%` }} />
        </div>
      )}

      <div className="mt-2 space-y-1 border-t border-slate-800/70 pt-1.5">
        {rating.factors.map((f) => (
          <div key={f.key} className="flex items-start justify-between gap-2 text-[10px]">
            <span className="text-slate-400 flex-shrink-0">
              {f.label}
              <span className="text-slate-600"> · w{f.weight}</span>
            </span>
            <span className="text-right min-w-0">
              {f.available ? (
                <>
                  <span className="text-slate-200 tabular-nums">
                    {f.value!.toFixed(f.key === 'terrain' ? 0 : 1)} {f.unit}
                  </span>
                  <span className={`ml-1.5 tabular-nums ${tone.text}`}>{f.score}/100</span>
                </>
              ) : (
                <span className="text-slate-600">Unavailable</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[8px] text-slate-600 mt-1.5 leading-tight">{rating.basis}</p>
    </div>
  );
};

export const LocationAnalysisPanel: React.FC<LocationAnalysisPanelProps> = ({
  analysis,
  suitability,
}) => {
  const t = analysis.terrain;
  const climate = analysis.climate;
  const climateStyle = ORIGIN_STYLE[climate.origin];

  return (
    <div className="space-y-2.5 font-mono">
      {/* Identity */}
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-800 bg-slate-900/70">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            {analysis.name}
          </div>
          <div className="text-[11px] text-cyan-300 mt-0.5">
            {Math.abs(analysis.latitude).toFixed(4)}° {analysis.latitude >= 0 ? 'N' : 'S'}
            <span className="text-slate-500"> | </span>
            {Math.abs(analysis.longitude).toFixed(4)}° {analysis.longitude >= 0 ? 'E' : 'W'}
          </div>
        </div>
        {analysis.is_simulated && (
          <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/60 text-amber-300 text-[9px] font-bold flex-shrink-0">
            CONTAINS SIMULATED
          </span>
        )}
      </div>

      {/* Elevation */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Mountain className="w-3 h-3" /> ELEVATION / DEM
          </span>
          <span
            title={analysis.elevation.source}
            className={`px-1 py-0.5 rounded border text-[8px] font-bold ${ORIGIN_STYLE[analysis.elevation.origin].cls}`}
          >
            {ORIGIN_STYLE[analysis.elevation.origin].label}
          </span>
        </div>
        <div className="text-xl font-black text-cyan-300 mt-0.5 tabular-nums">
          {analysis.elevation.value !== null ? (
            <>
              {Math.round(analysis.elevation.value).toLocaleString()}
              <span className="text-[11px] text-slate-400 font-normal"> m ASL</span>
            </>
          ) : (
            <span className="text-base text-slate-600 font-normal">Unavailable</span>
          )}
        </div>
        <p className="text-[9px] text-slate-500 leading-tight mt-0.5">{analysis.elevation.source}</p>
      </div>

      {/* Atmosphere */}
      <div className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 divide-y divide-slate-800/60">
        <div className="flex items-center justify-between pb-1 mb-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400">
            <Thermometer className="w-3 h-3" /> ATMOSPHERE
          </span>
          <span
            title={analysis.temperature.source}
            className={`px-1 py-0.5 rounded border text-[8px] font-bold ${ORIGIN_STYLE[analysis.temperature.origin].cls}`}
          >
            {ORIGIN_STYLE[analysis.temperature.origin].label}
          </span>
        </div>
        <Row icon={<Thermometer className="w-3 h-3" />} label="Temperature" field={analysis.temperature} format={(v) => v.toFixed(1)} />
        <Row icon={<Thermometer className="w-3 h-3" />} label="Feels like" field={analysis.apparent_temperature} format={(v) => v.toFixed(1)} />
        <Row icon={<Droplets className="w-3 h-3" />} label="Humidity" field={analysis.humidity} format={(v) => v.toFixed(0)} />
        <Row icon={<Wind className="w-3 h-3" />} label="Wind speed" field={analysis.wind_speed_mps} format={(v) => v.toFixed(1)} />
        <Row icon={<Wind className="w-3 h-3" />} label="Wind gusts" field={analysis.wind_gusts_mps} format={(v) => v.toFixed(1)} />
        <Row
          icon={<Compass className="w-3 h-3" />}
          label="Wind direction"
          field={analysis.wind_direction_deg}
          format={(v) => `${compassPoint(v)} ${v.toFixed(0)}°`}
        />
        <Row icon={<Gauge className="w-3 h-3" />} label="Pressure" field={analysis.pressure_hpa} format={(v) => v.toFixed(0)} />
        <Row icon={<CloudRain className="w-3 h-3" />} label="Precipitation" field={analysis.precipitation_mm} format={(v) => v.toFixed(1)} />
        <Row icon={<Snowflake className="w-3 h-3" />} label="Snowfall" field={analysis.snowfall_cm} format={(v) => v.toFixed(1)} />
        <Row icon={<Cloud className="w-3 h-3" />} label="Cloud cover" field={analysis.cloud_cover_pct} format={(v) => v.toFixed(0)} />
        <Row icon={<Sun className="w-3 h-3" />} label="Solar radiation" field={analysis.solar_radiation_w_m2} format={(v) => v.toFixed(0)} />
      </div>

      {/* Terrain + climate */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
            <Layers className="w-3 h-3" /> TERRAIN
          </div>
          {t ? (
            <>
              <div className="text-[11px] font-bold text-slate-100 tabular-nums">
                {t.relief_m.toFixed(0)} m relief
              </div>
              <div className="text-[9px] text-slate-500 tabular-nums">
                {t.min_elevation_m.toFixed(0)}–{t.max_elevation_m.toFixed(0)} m over {t.span_m} m
              </div>
              <div className="text-[9px] text-slate-600">{t.total_samples} DEM samples</div>
            </>
          ) : (
            <div className="text-[10px] text-slate-600">Unavailable</div>
          )}
          <span
            title={t?.source}
            className={`inline-block mt-1 px-1 py-0.5 rounded border text-[8px] font-bold ${ORIGIN_STYLE[t?.origin ?? 'unavailable'].cls}`}
          >
            {ORIGIN_STYLE[t?.origin ?? 'unavailable'].label}
          </span>
        </div>

        <div className="px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
            <Leaf className="w-3 h-3" /> CLIMATE
          </div>
          <div className="text-[11px] font-bold text-slate-100">
            {climate.label ?? <span className="text-slate-600">Unavailable</span>}
          </div>
          {climate.station_name && (
            <div className="text-[9px] text-slate-500 truncate">{climate.station_name}</div>
          )}
          {climate.distance_km !== null && (
            <div className="text-[9px] text-slate-600">{climate.distance_km} km away</div>
          )}
          <span
            title={climate.source}
            className={`inline-block mt-1 px-1 py-0.5 rounded border text-[8px] font-bold ${climateStyle.cls}`}
          >
            {climateStyle.label}
          </span>
        </div>
      </div>

      {/* Suitability / status */}
      {suitability && <SuitabilityCard rating={suitability} />}

      {/* Condition + timestamp */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 text-[10px]">
        <span className="text-slate-400">Condition</span>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-100 font-bold truncate">{analysis.condition.value ?? 'Unavailable'}</span>
          <span
            title={analysis.condition.source}
            className={`px-1 py-0.5 rounded border text-[8px] font-bold tracking-wide flex-shrink-0 ${ORIGIN_STYLE[analysis.condition.origin].cls}`}
          >
            {ORIGIN_STYLE[analysis.condition.origin].label}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 text-[10px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3 h-3" /> Last updated
        </span>
        <span className="text-slate-200 tabular-nums">
          {analysis.observed_at ? `${analysis.observed_at} (source)` : '—'} ·{' '}
          {new Date(analysis.analysed_at).toLocaleTimeString()} (local)
        </span>
      </div>
    </div>
  );
};
