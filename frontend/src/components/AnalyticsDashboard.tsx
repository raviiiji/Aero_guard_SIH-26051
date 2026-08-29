import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Activity,
  Fuel,
  TrendingDown,
  Sun,
  ShieldAlert,
  Flame,
  Zap,
  BarChart3,
  Layers,
  ThermometerSnowflake,
} from 'lucide-react';
import { SimulationResult, WeatherResponse, WeatherCluster } from '../types';

interface AnalyticsDashboardProps {
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
  onSelectClusterDiurnal?: (cluster: WeatherCluster) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  simResult,
  weatherData,
  onSelectClusterDiurnal,
}) => {
  const [chartMode, setChartMode] = useState<'temp' | 'power' | 'all'>('all');

  if (!simResult) {
    return (
      <div className="tactical-card p-6 flex flex-col items-center justify-center text-center text-slate-400 font-mono">
        <Activity className="w-8 h-8 text-tactical-cyan animate-pulse mb-2" />
        <div className="text-sm font-bold text-slate-200">AERO-SHIELD Physics Engine Simulating...</div>
        <div className="text-xs">Computing 24-hour transient heat flux and logistics deficit</div>
      </div>
    );
  }

  const { summary, loss_breakdown_pct, hourly_timeseries } = simResult;
  const clusters = weatherData?.clustering.clusters || [];

  return (
    <div className="tactical-card p-3.5 flex flex-col gap-4 font-mono">
      {/* 1. Military Logistics KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {/* Campaign Fuel */}
        <div className="bg-command-950/90 border border-command-700/80 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>90-Day Fuel</span>
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black text-amber-400 mt-1">
            {summary.campaign_fuel_liters.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-400">Liters</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {summary.campaign_fuel_barrels_200l} Drums (200L)
          </div>
        </div>

        {/* Fuel Saved % */}
        <div className="bg-command-950/90 border border-emerald-500/40 rounded-md p-2.5 flex flex-col justify-between shadow-glow-emerald/10">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>Fuel Saved vs Legacy</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400 mt-1">
            {summary.fuel_saving_percentage}%
          </div>
          <div className="text-[10px] text-emerald-300/80 mt-0.5">
            -{summary.fuel_saved_liters.toLocaleString()} L saved
          </div>
        </div>

        {/* Passive Solar Fraction */}
        <div className="bg-command-950/90 border border-amber-500/40 rounded-md p-2.5 flex flex-col justify-between shadow-glow-amber/10">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>Passive Solar Yield</span>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black text-amber-400 mt-1">
            {summary.passive_solar_fraction_pct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {summary.total_daily_solar_gain_kwh} kWh/day free sun
          </div>
        </div>

        {/* Daily Energy Deficit */}
        <div className="bg-command-950/90 border border-command-700/80 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>Daily Heating Deficit</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-black text-rose-400 mt-1">
            {summary.daily_deficit_kwh}{' '}
            <span className="text-[10px] font-normal text-slate-400">kWh/day</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {summary.daily_fuel_liters} L diesel/day
          </div>
        </div>

        {/* Shelter Logistics Weight */}
        <div className="bg-command-950/90 border border-command-700/80 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>Transport Weight</span>
            <Layers className="w-3.5 h-3.5 text-tactical-cyan" />
          </div>
          <div className="text-lg font-black text-tactical-cyan mt-1">
            {summary.total_shelter_weight_kg.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-400">kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Helicopter / Truck Payload</div>
        </div>

        {/* CO2 Emissions Saved */}
        <div className="bg-command-950/90 border border-command-700/80 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>CO₂ Prevented</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400 mt-1">
            {summary.co2_emissions_saved_kg.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-400">kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Clean Arctic Footprint</div>
        </div>
      </div>

      {/* 2. Recharts 24-Hour Diurnal Multi-Series Chart */}
      <div className="bg-command-950/80 border border-command-700/80 rounded-lg p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-tactical-cyan" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              24-Hour Diurnal Thermal Balance & Solar Gain Curve
            </h3>
          </div>

          {/* Chart Filter Tabs */}
          <div className="flex items-center gap-1 bg-command-900 border border-command-700 rounded p-0.5 text-[10px]">
            <button
              onClick={() => setChartMode('all')}
              className={`px-2 py-0.5 rounded transition-all ${
                chartMode === 'all' ? 'bg-tactical-cyan text-command-950 font-bold' : 'text-slate-400'
              }`}
            >
              Full Profile
            </button>
            <button
              onClick={() => setChartMode('temp')}
              className={`px-2 py-0.5 rounded transition-all ${
                chartMode === 'temp' ? 'bg-blue-500 text-white font-bold' : 'text-slate-400'
              }`}
            >
              Temperature Only
            </button>
            <button
              onClick={() => setChartMode('power')}
              className={`px-2 py-0.5 rounded transition-all ${
                chartMode === 'power' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400'
              }`}
            >
              Heat Loss / Deficit
            </button>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourly_timeseries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour_label" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis
                yAxisId="temp"
                stroke="#38bdf8"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                domain={['dataMin - 3', 'dataMax + 3']}
                unit="°C"
              />
              <YAxis
                yAxisId="power"
                orientation="right"
                stroke="#f59e0b"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                unit="W"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b1324',
                  borderColor: '#254687',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

              {/* Temperature Series */}
              {(chartMode === 'all' || chartMode === 'temp') && (
                <>
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="ambient_temp"
                    name="Ambient Outdoor Temp (°C)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="inside_temp_unheated"
                    name="Unheated Inside Temp (°C)"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="target_temp"
                    name="Target Comfort Temp (19°C)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                </>
              )}

              {/* Power / Flux Series */}
              {(chartMode === 'all' || chartMode === 'power') && (
                <>
                  <Line
                    yAxisId="power"
                    type="monotone"
                    dataKey="solar_gain_w"
                    name="Solar Heat Influx (W)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="power"
                    type="monotone"
                    dataKey="internal_gain_w"
                    name="Troop Metabolic Heat (85W/Soldier ASHRAE)"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                  <Line
                    yAxisId="power"
                    type="monotone"
                    dataKey="total_loss_w"
                    name="Total Heat Loss (W)"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    yAxisId="power"
                    type="monotone"
                    dataKey="auxiliary_heating_deficit_w"
                    name="Auxiliary Heater Deficit (W)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Bottom Grid: Heat Loss Breakdown & ML Weather Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Heat Loss Breakdown by Surface */}
        <div className="bg-command-950/80 border border-command-700/80 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase text-slate-200 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Thermal Loss Breakdown by Surface
            </h4>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Walls */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Exterior Walls</span>
                <strong className="text-slate-200">{loss_breakdown_pct.walls}%</strong>
              </div>
              <div className="h-2 w-full bg-command-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-tactical-cyan rounded-full transition-all duration-500"
                  style={{ width: `${loss_breakdown_pct.walls}%` }}
                />
              </div>
            </div>

            {/* Roof */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Roof Envelope</span>
                <strong className="text-slate-200">{loss_breakdown_pct.roof}%</strong>
              </div>
              <div className="h-2 w-full bg-command-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${loss_breakdown_pct.roof}%` }}
                />
              </div>
            </div>

            {/* Windows */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Windows & Glazing</span>
                <strong className="text-slate-200">{loss_breakdown_pct.windows}%</strong>
              </div>
              <div className="h-2 w-full bg-command-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 rounded-full transition-all duration-500"
                  style={{ width: `${loss_breakdown_pct.windows}%` }}
                />
              </div>
            </div>

            {/* Infiltration */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Infiltration / Cold Air Drafts</span>
                <strong className="text-slate-200">{loss_breakdown_pct.infiltration}%</strong>
              </div>
              <div className="h-2 w-full bg-command-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full transition-all duration-500"
                  style={{ width: `${loss_breakdown_pct.infiltration}%` }}
                />
              </div>
            </div>

            {/* Floor */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Sub-Floor Ground Contact</span>
                <strong className="text-slate-200">{loss_breakdown_pct.floor}%</strong>
              </div>
              <div className="h-2 w-full bg-command-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${loss_breakdown_pct.floor}%` }}
                />
              </div>
            </div>
          </div>

          {/* ASHRAE Standard 55 & Metabolic Heat Box */}
          <div className="mt-3 p-2.5 bg-[#060e20] border border-emerald-500/30 rounded-md space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-emerald-400 font-bold uppercase text-[10px]">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                ASHRAE Standard 55 & Troop Metabolic Heat
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20 text-[9px]">
                85W / SOLDIER (1.0 MET)
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[10px]">
              Per global <strong className="text-emerald-300">ASHRAE 55 & ISO 8996</strong> standards, each resting soldier generates <strong className="text-emerald-300">85 Watts</strong> of metabolic heat. 
              Inside the insulated shelter envelope, troops act as an internal <strong className="text-emerald-300">{summary.total_daily_metabolic_gain_kwh ? (summary.total_daily_metabolic_gain_kwh * 1000 / 24).toFixed(0) : '680'}W heater</strong> ({summary.total_daily_metabolic_gain_kwh || '16.3'} kWh/day), significantly reducing the diesel needed to maintain comfortable indoor temperatures.
            </p>
          </div>
        </div>

        {/* 90-Day Seasonal ML Weather Clusters */}
        <div className="bg-command-950/80 border border-command-700/80 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase text-slate-200 flex items-center gap-1.5">
              <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-400" />
              90-Day ML Weather Clustering (K-Means / GMM)
            </h4>
            <span className="text-[10px] text-slate-400">3 Thermal Operational Phases</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {clusters.map((c) => (
              <div
                key={c.cluster_id}
                onClick={() => onSelectClusterDiurnal && onSelectClusterDiurnal(c)}
                className="bg-command-900/90 border border-command-700/60 hover:border-slate-400 rounded p-2 text-xs flex flex-col gap-1 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.color_hex }}
                    />
                    <strong className="text-slate-200">{c.phase_name}</strong>
                  </div>
                  <span className="tactical-badge bg-command-800 text-slate-300">
                    {c.weight_pct}% of Campaign ({c.day_count} days)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-400 mt-0.5">
                  <div>
                    Min Temp: <strong className="text-blue-400">{c.centroid.min_temp_c}°C</strong>
                  </div>
                  <div>
                    Solar:{' '}
                    <strong className="text-amber-400">{c.centroid.solar_kwh_m2_day} kWh/m²</strong>
                  </div>
                  <div>
                    Wind: <strong className="text-slate-200">{c.centroid.mean_wind_mps} m/s</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
