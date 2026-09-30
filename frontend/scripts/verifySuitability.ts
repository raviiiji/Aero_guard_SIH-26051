import { assessSuitability } from '../src/services/suitabilityService';
import type { LocationAnalysis } from '../src/types';

const f = (v: number | null) =>
  v === null
    ? { value: null, origin: 'unavailable' as const, source: 'test' }
    : { value: v, origin: 'live' as const, source: 'test' };

const base: LocationAnalysis = {
  latitude: 34.15, longitude: 77.58, name: 'test',
  elevation: f(3414), temperature: f(6.7), apparent_temperature: f(4.0),
  humidity: f(41), wind_speed_mps: f(0.36), wind_gusts_mps: f(1.2),
  wind_direction_deg: f(16), precipitation_mm: f(0), snowfall_cm: f(0),
  cloud_cover_pct: f(0), pressure_hpa: f(430), solar_radiation_w_m2: f(801),
  condition: { value: 'clear', origin: 'live', source: 'test' },
  terrain: { min_elevation_m: 3410, max_elevation_m: 3425, relief_m: 15,
             total_samples: 25, span_m: 200, origin: 'live', source: 'test' },
  climate: { label: 'Cold Arid', station_name: 'Leh', distance_km: 0.4, origin: 'derived', source: 'test' },
  observed_at: null, analysed_at: new Date().toISOString(), is_simulated: false,
};

const show = (label: string, a: LocationAnalysis) => {
  const r = assessSuitability(a);
  console.log(`\n${label}`);
  console.log(`  ${r.rating} ${r.score}/100  coverage=${r.coverage_pct}%  origin=${r.origin}  low_confidence=${r.low_confidence}`);
  for (const x of r.factors) {
    console.log(`   - ${x.label.padEnd(16)} ${x.available ? String(x.score).padStart(3) : ' n/a'}  ${x.note}`);
  }
};

show('Leh 3414m, 6.7C, 801W/m2, 15m relief  (expected EXCELLENT/FAVOURABLE)', base);

show('New Delhi 214m, 25C, 0W/m2 night, flat  (expected MARGINAL: low altitude + no solar)',
  { ...base, elevation: f(214), temperature: f(25), solar_radiation_w_m2: f(0), wind_gusts_mps: f(3),
    terrain: { ...base.terrain!, min_elevation_m: 213, max_elevation_m: 223, relief_m: 10 } });

show('Siachen 4600m, -28C, 40m/s gusts, 60m relief  (MARGINAL is defensible: superb solar + ideal altitude offset the cold)',
  { ...base, elevation: f(4600), temperature: f(-28), wind_gusts_mps: f(40),
    terrain: { ...base.terrain!, min_elevation_m: 4540, max_elevation_m: 4600, relief_m: 60 } });

show('Every field unavailable  (expected UNKNOWN, score null — must not invent)',
  { ...base, elevation: f(null), temperature: f(null), wind_gusts_mps: f(null),
    wind_speed_mps: f(null), solar_radiation_w_m2: f(null), terrain: null });

show('Partial: only elevation known  (expected normalised over available weight only)',
  { ...base, elevation: f(3500), temperature: f(null), wind_gusts_mps: f(null),
    wind_speed_mps: f(null), solar_radiation_w_m2: f(null), terrain: null });
