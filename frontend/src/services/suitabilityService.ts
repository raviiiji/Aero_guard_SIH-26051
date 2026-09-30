/**
 * Site suitability rating for the shelter siting decision.
 *
 * This is a TRANSPARENT RULES ENGINE, not a model and not a certification. Every
 * factor below is scored from a value that `analyzeLocation` already read from a
 * real endpoint, and the factor that produced each penalty is returned so the UI
 * can show its working. Weights and thresholds are declared here as constants
 * and can be read by anyone reviewing the code.
 *
 * Honesty rules enforced by this module:
 *   - A factor whose input is `unavailable` is SKIPPED, never guessed at.
 *   - The score is normalised against the factors that could actually be
 *     evaluated, so a missing field lowers coverage rather than silently
 *     dragging the score down or silently inflating it.
 *   - The result is always tagged CALCULATED and never presented as certified.
 */
import { LocationAnalysis, SuitabilityRating } from '../types';

/** Relative influence of each factor on siting suitability. Sums to 100. */
const WEIGHTS = {
  thermal: 35,
  wind: 20,
  solar: 20,
  terrain: 15,
  altitude: 10,
} as const;

type FactorKey = keyof typeof WEIGHTS;

const FACTOR_META: Record<FactorKey, { label: string; unit: string }> = {
  thermal: { label: 'Thermal load', unit: '°C' },
  wind: { label: 'Wind exposure', unit: 'm/s' },
  solar: { label: 'Solar resource', unit: 'W/m²' },
  terrain: { label: 'Terrain flatness', unit: 'm relief' },
  altitude: { label: 'Altitude', unit: 'm ASL' },
};

interface ScoreInput {
  key: FactorKey;
  /** Measured value, or null when the field was unavailable. */
  value: number | null;
  /** 0 (worst) .. 100 (best) for this value. */
  score: number;
  /** Short human explanation shown next to the score. */
  note: string;
}

/** Piecewise-linear interpolation between (x, y) stops, clamped at the ends. */
function lerpStops(x: number, stops: Array<[number, number]>): number {
  if (x <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (x >= x0 && x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/** Below this much weighted input the rating is provisional, not a verdict. */
const LOW_CONFIDENCE_COVERAGE = 50;

export function assessSuitability(analysis: LocationAnalysis): SuitabilityRating {
  const inputs: ScoreInput[] = [];

  // --- Thermal: the closer to comfort, the better. Below -20 C the auxiliary
  //     heater has to carry the shelter, which is the real siting penalty. ---
  const temp = analysis.temperature.value;
  inputs.push({
    key: 'thermal',
    value: temp,
    score: temp === null ? 0 : lerpStops(temp, [[-30, 5], [-20, 20], [-10, 55], [0, 80], [10, 100], [25, 100], [35, 70]]),
    note:
      temp === null
        ? 'Temperature unavailable — factor skipped'
        : temp <= -20
          ? 'Extreme cold: auxiliary heating carries the shelter'
          : temp <= -10
            ? 'Severe cold: continuous heating load expected'
            : temp <= 5
              ? 'Cold: seasonal heating load'
              : 'Mild ambient: low heating demand',
  });

  // --- Wind: gusts drive infiltration, which is the real infiltration cost. ---
  const gust = analysis.wind_gusts_mps.value ?? analysis.wind_speed_mps.value;
  inputs.push({
    key: 'wind',
    value: gust,
    score:
      gust === null
        ? 0
        : lerpStops(gust, [[0, 100], [5, 90], [10, 65], [15, 40], [25, 15], [40, 5]]),
    note:
      gust === null
        ? 'Wind unavailable — factor skipped'
        : gust >= 15
          ? 'Severe gusts: high infiltration pressure'
          : gust >= 10
            ? 'Strong wind: envelope sealing is critical'
            : 'Sheltered: low infiltration risk',
  });

  // --- Solar: drives the passive Trombe gain and the PV array yield. ---
  const solar = analysis.solar_radiation_w_m2.value;
  inputs.push({
    key: 'solar',
    value: solar,
    score: solar === null ? 0 : lerpStops(solar, [[0, 10], [100, 30], [300, 60], [600, 90], [900, 100]]),
    note:
      solar === null
        ? 'Solar resource unavailable — factor skipped'
        : solar >= 600
          ? 'Strong insolation: favourable for Trombe gain and PV'
          : solar >= 300
            ? 'Moderate insolation: useful passive gain'
            : 'Low insolation: limited passive and PV yield',
  });

  // --- Terrain: relief across the surveyed plot. Level ground is cheaper. ---
  const relief = analysis.terrain?.relief_m ?? null;
  inputs.push({
    key: 'terrain',
    value: relief,
    score: relief === null ? 0 : lerpStops(relief, [[0, 100], [5, 95], [15, 75], [35, 45], [80, 15]]),
    note:
      relief === null
        ? 'DEM terrain unavailable — factor skipped'
        : relief <= 5
          ? 'Level plot: minimal earthworks'
          : relief <= 15
            ? 'Gentle grade: modest cut and fill'
            : 'Broken ground: significant earthworks required',
  });

  // --- Altitude: the mission is high-altitude, so very low sites are a poor
  //     fit for a high-altitude shelter even if they are warm and calm. ---
  const elev = analysis.elevation.value;
  inputs.push({
    key: 'altitude',
    value: elev,
    score: elev === null ? 0 : lerpStops(elev, [[0, 15], [500, 35], [1500, 60], [3000, 90], [4000, 100], [5200, 80]]),
    note:
      elev === null
        ? 'Elevation unavailable — factor skipped'
        : elev >= 3000
          ? 'High-altitude band: matches the shelter mission envelope'
          : elev >= 1500
            ? 'Mid-altitude band'
            : 'Low elevation: outside the high-altitude mission envelope',
  });

  const scored = inputs.filter((i) => i.value !== null && Number.isFinite(i.value));
  const totalWeight = scored.reduce((a, i) => a + WEIGHTS[i.key], 0);

  // With no usable input at all there is no honest score to show.
  if (totalWeight === 0) {
    return {
      rating: 'UNKNOWN',
      score: null,
      coverage_pct: 0,
      low_confidence: true,
      factors: inputs.map((i) => ({
        key: i.key,
        label: FACTOR_META[i.key].label,
        value: null,
        unit: FACTOR_META[i.key].unit,
        score: null,
        weight: WEIGHTS[i.key],
        available: false,
        note: i.note,
      })),
      basis: 'No analysed field was available to score — nothing is assumed.',
      origin: 'unavailable',
    };
  }

  const weighted = scored.reduce((a, i) => a + i.score * WEIGHTS[i.key], 0);
  const score = Math.round(weighted / totalWeight);

  const rating: SuitabilityRating['rating'] =
    score >= 75 ? 'EXCELLENT' : score >= 55 ? 'FAVOURABLE' : score >= 35 ? 'MARGINAL' : 'POOR';

  const coverage = Math.round(totalWeight);
  // A rating computed from a thin slice of the input must not read as a verdict,
  // however high it scores. The score is still reported — it is real — but it is
  // flagged so the UI can present it as provisional.
  const lowConfidence = coverage < LOW_CONFIDENCE_COVERAGE;

  return {
    rating,
    score,
    coverage_pct: coverage,
    low_confidence: lowConfidence,
    factors: inputs.map((i) => ({
      key: i.key,
      label: FACTOR_META[i.key].label,
      value: i.value,
      unit: FACTOR_META[i.key].unit,
      score: i.value === null ? null : Math.round(i.score),
      weight: WEIGHTS[i.key],
      available: i.value !== null,
      note: i.note,
    })),
    basis:
      'Weighted rules engine over the analysed elevation, temperature, wind gust, solar ' +
      'resource and DEM relief. Not a certified geotechnical or structural assessment.' +
      (lowConfidence
        ? ` Only ${coverage}% of the criteria could be evaluated, so this rating is provisional.`
        : ''),
    origin: 'calculated',
  };
}
