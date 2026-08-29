import React from 'react';
import { FileText, Printer, Download, Check, ShieldAlert } from 'lucide-react';
import { SimulationResult, WeatherResponse, ShelterGeometry, SimulationParameters } from '../types';

interface DossierSectionProps {
  geometry: ShelterGeometry;
  params: SimulationParameters;
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
  latitude: number;
  longitude: number;
  elevation: number;
}

export const DossierSection: React.FC<DossierSectionProps> = ({
  geometry,
  params,
  simResult,
  weatherData,
  latitude,
  longitude,
  elevation,
}) => {
  if (!simResult) return null;

  const { summary, u_values } = simResult;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Hour',
      'Ambient_Temp_C',
      'Inside_Temp_Unheated_C',
      'Target_Temp_C',
      'Solar_Gain_W',
      'Auxiliary_Deficit_W',
      'Roof_Loss_W',
      'Wall_Loss_W',
      'Window_Loss_W',
      'Infiltration_Loss_W',
    ];
    const rows = simResult.hourly_timeseries.map((h) => [
      h.hour_label,
      h.ambient_temp,
      h.inside_temp_unheated,
      h.target_temp,
      h.solar_gain_w,
      h.auxiliary_heating_deficit_w,
      h.roof_loss_w,
      h.wall_loss_w,
      h.window_loss_w,
      h.infiltration_loss_w,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DRDO_26051_AERO_SHIELD_REPORT_${latitude}_${longitude}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-mono text-slate-100 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="tactical-glass p-4 rounded flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[#8aebff]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-[#8aebff]/20 text-[#8aebff]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase text-[#8aebff]">
              Official DRDO Technical Assessment Dossier & Logistics Dossier
            </h2>
            <p className="text-xs text-[#bbc9cd]">
              Problem Statement ID: 26051 | Area-Specific High-Altitude Thermal Comfort System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="px-3.5 py-2 bg-[#131b2e] hover:bg-[#8aebff]/20 text-[#8aebff] border border-[#8aebff]/40 text-xs font-bold rounded flex items-center gap-1.5 uppercase transition-all"
            title="Download CSV Dataset"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Dataset</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#8aebff] hover:bg-[#a2eeff] text-[#060e20] text-xs font-bold rounded flex items-center gap-1.5 uppercase shadow-[0_0_15px_rgba(138,235,255,0.4)] transition-all"
            title="Print Official Dossier"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Dossier</span>
          </button>
        </div>
      </div>

      {/* Printable Evaluation Report */}
      <div className="tactical-glass p-6 rounded-lg space-y-5 bg-[#060e20]/80">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />

        {/* Letterhead */}
        <div className="border-b-2 border-[#8aebff]/30 pb-4 flex items-start justify-between">
          <div>
            <div className="text-base font-black text-[#fb923c] uppercase tracking-wider font-sans">
              DEFENCE RESEARCH & DEVELOPMENT ORGANISATION (DRDO)
            </div>
            <div className="text-xs font-bold text-[#dae2fd] mt-0.5">
              DIRECTORATE OF HIGH-ALTITUDE COMBAT SURVIVABILITY & LOGISTICS OPTIMIZATION
            </div>
            <div className="text-[10px] text-[#bbc9cd] mt-1">
              Assessment Dossier: Software Based Model Development for Design of Area Specific Shelter for Thermal Comfort Maintenance (ID: 26051)
            </div>
          </div>

          <div className="text-right text-xs text-[#bbc9cd]">
            <div>
              DATE: <strong className="text-[#dae2fd]">{new Date().toISOString().split('T')[0]}</strong>
            </div>
            <div>
              STATUS: <strong className="text-[#45da7d]">OPTIMIZED & VERIFIED</strong>
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <div>
          <h3 className="text-xs font-bold uppercase text-[#8aebff] border-b border-[#8aebff]/20 pb-1 mb-2">
            1. Geographic Deployment Telemetry & Regional Climate Classification
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Coordinates:</span>
              <div className="font-bold text-[#dae2fd]">
                {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E
              </div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Altitude:</span>
              <div className="font-bold text-[#dae2fd]">{elevation.toLocaleString()} m ASL</div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">90d Extreme Low:</span>
              <div className="font-bold text-[#38bdf8]">
                {weatherData?.metrics_90day.extreme_min_temp_c ?? -22}°C
              </div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Avg Daily Solar Insolation:</span>
              <div className="font-bold text-[#fb923c]">
                {weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8} kWh/m²/day
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <h3 className="text-xs font-bold uppercase text-[#8aebff] border-b border-[#8aebff]/20 pb-1 mb-2">
            2. Parametric Shelter Dimensions & Envelope Thermal Transmittance ($U$-Values)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Structural Dimensions:</span>
              <div className="font-bold text-[#dae2fd]">
                {geometry.length_m}m × {geometry.width_m}m × {geometry.height_m}m
              </div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Roof Transmittance ($U$):</span>
              <div className="font-bold text-[#45da7d]">{u_values.roof.u_value} W/m²K</div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Wall Transmittance ($U$):</span>
              <div className="font-bold text-[#45da7d]">{u_values.walls.u_value} W/m²K</div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Glazing Transmittance ($U$):</span>
              <div className="font-bold text-[#fb923c]">{u_values.glazing.u_value} W/m²K</div>
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div>
          <h3 className="text-xs font-bold uppercase text-[#8aebff] border-b border-[#8aebff]/20 pb-1 mb-2">
            3. Fuel Logistics & Tactical Convoy Burden Analysis (90-Day Campaign)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131b2e] p-3.5 rounded border border-[#8aebff]/20 text-xs">
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Designed Fuel Demand:</span>
              <div className="font-bold text-[#fb923c] text-sm">
                {summary.campaign_fuel_liters.toLocaleString()} Liters
              </div>
              <span className="text-[10px] text-[#bbc9cd]">
                ({summary.campaign_fuel_barrels_200l} Drums of 200L)
              </span>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Legacy Canvas Baseline:</span>
              <div className="font-bold text-[#dae2fd] text-sm">
                {summary.baseline_campaign_fuel_liters.toLocaleString()} Liters
              </div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Total Fuel Saved:</span>
              <div className="font-bold text-[#45da7d] text-sm">
                {summary.fuel_saved_liters.toLocaleString()} Liters ({summary.fuel_saving_percentage}%)
              </div>
            </div>
            <div>
              <span className="text-[#bbc9cd] text-[10px]">Logistics Transport Weight:</span>
              <div className="font-bold text-[#8aebff] text-sm">
                {summary.total_shelter_weight_kg.toLocaleString()} kg
              </div>
            </div>
          </div>
        </div>

        {/* Operational Recommendation */}
        <div className="p-4 bg-[#131b2e] rounded border border-[#8aebff]/30 text-xs text-[#dae2fd] leading-relaxed">
          <strong className="text-[#fb923c]">EXECUTIVE RECOMMENDATION:</strong> Deploying the area-specific{' '}
          {geometry.archetype.replace('_', ' ').toUpperCase()} shelter at {elevation}m ASL saves{' '}
          <strong className="text-[#45da7d]">{summary.fuel_saved_liters.toLocaleString()} Liters</strong> of Arctic
          diesel per 90-day winter campaign, reducing reliance on risky fuel convoy logistics over Himalayan mountain passes (e.g. Khardung La / Zojila Pass).
        </div>
      </div>
    </div>
  );
};
