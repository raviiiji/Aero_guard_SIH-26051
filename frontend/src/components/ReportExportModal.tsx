import React from 'react';
import { FileText, X, Download, Printer, Copy, Check, ShieldAlert } from 'lucide-react';
import { SimulationResult, WeatherResponse, ShelterGeometry, SimulationParameters } from '../types';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: ShelterGeometry;
  params: SimulationParameters;
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
  latitude: number;
  longitude: number;
  elevation: number;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  geometry,
  params,
  simResult,
  weatherData,
  latitude,
  longitude,
  elevation,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !simResult) return null;

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
    link.setAttribute(
      'download',
      `DRDO_26051_AERO_SHIELD_SIM_${latitude}_${longitude}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-command-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-command-900 border border-command-700/90 rounded-xl shadow-tactical max-w-4xl w-full max-h-[92vh] flex flex-col font-mono text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-command-700/80 bg-command-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-tactical-cyan/20 border border-tactical-cyan/40 text-tactical-cyan">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                DRDO Technical Assessment Dossier & Dossier Export
              </h2>
              <p className="text-[11px] text-slate-400">
                Problem Statement ID: 26051 | Project AERO-SHIELD Area Specific Thermal Shelter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="tactical-btn-secondary text-xs py-1.5 px-3"
              title="Download 24-Hour Diurnal CSV Dataset"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Data</span>
            </button>

            <button
              onClick={handlePrint}
              className="tactical-btn-primary text-xs py-1.5 px-3"
              title="Print Official Dossier Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-command-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 flex-grow overflow-y-auto space-y-5 text-xs bg-command-950/40">
          {/* Official Letterhead */}
          <div className="border-b-2 border-command-700 pb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-black text-amber-400 uppercase tracking-wider">
                DEFENCE RESEARCH & DEVELOPMENT ORGANISATION (DRDO)
              </div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">
                DIRECTORATE OF TECHNICAL & ARCTIC SURVIVABILITY ENGINEERING
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Evaluation Report: Area-Specific Thermal Comfort Maintenance System (ID: 26051)
              </div>
            </div>

            <div className="text-right text-[10px] text-slate-400">
              <div>
                DATE: <strong className="text-slate-200">{new Date().toISOString().split('T')[0]}</strong>
              </div>
              <div>
                STATUS: <strong className="text-emerald-400">OPTIMIZED & CERTIFIED</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase text-tactical-cyan border-b border-command-800 pb-1 mb-2">
              1. Deployment Location & Regional Meteorological Profile
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-command-900/80 p-3 rounded border border-command-700/60">
              <div>
                <span className="text-slate-400">Coordinates:</span>
                <div className="font-bold text-slate-200">
                  {latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E
                </div>
              </div>
              <div>
                <span className="text-slate-400">Altitude:</span>
                <div className="font-bold text-slate-200">{elevation.toLocaleString()} m ASL</div>
              </div>
              <div>
                <span className="text-slate-400">90d Extreme Low:</span>
                <div className="font-bold text-blue-400">
                  {weatherData?.metrics_90day.extreme_min_temp_c ?? -22}°C
                </div>
              </div>
              <div>
                <span className="text-slate-400">Avg Solar Irradiance:</span>
                <div className="font-bold text-amber-400">
                  {weatherData?.metrics_90day.avg_daily_solar_kwh_m2 ?? 4.8} kWh/m²/day
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shelter Specifications & Thermal Transmittance */}
          <div>
            <h3 className="text-xs font-bold uppercase text-tactical-cyan border-b border-command-800 pb-1 mb-2">
              2. Structural Dimensions & Envelope Transmittance ($U$-Values)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-command-900/80 p-3 rounded border border-command-700/60">
              <div>
                <span className="text-slate-400">Dimensions (L×W×H):</span>
                <div className="font-bold text-slate-200">
                  {geometry.length_m}m × {geometry.width_m}m × {geometry.height_m}m
                </div>
              </div>
              <div>
                <span className="text-slate-400">Roof $U$-Value:</span>
                <div className="font-bold text-emerald-400">{u_values.roof.u_value} W/m²K</div>
              </div>
              <div>
                <span className="text-slate-400">Wall $U$-Value:</span>
                <div className="font-bold text-emerald-400">{u_values.walls.u_value} W/m²K</div>
              </div>
              <div>
                <span className="text-slate-400">Glazing $U$-Value:</span>
                <div className="font-bold text-amber-400">{u_values.glazing.u_value} W/m²K</div>
              </div>
            </div>
          </div>

          {/* Section 3: Military Logistics & Fuel Assessment */}
          <div>
            <h3 className="text-xs font-bold uppercase text-tactical-cyan border-b border-command-800 pb-1 mb-2">
              3. Strategic Fuel Logistics & Mission Impact (90-Day Campaign)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-command-900/80 p-3 rounded border border-command-700/60">
              <div>
                <span className="text-slate-400">Designed Fuel Demand:</span>
                <div className="font-bold text-amber-400 text-sm">
                  {summary.campaign_fuel_liters.toLocaleString()} Liters
                </div>
                <span className="text-[10px] text-slate-400">
                  ({summary.campaign_fuel_barrels_200l} Drums of 200L)
                </span>
              </div>
              <div>
                <span className="text-slate-400">Legacy Canvas Baseline:</span>
                <div className="font-bold text-slate-300 text-sm">
                  {summary.baseline_campaign_fuel_liters.toLocaleString()} Liters
                </div>
              </div>
              <div>
                <span className="text-slate-400">Total Fuel Saved:</span>
                <div className="font-bold text-emerald-400 text-sm">
                  {summary.fuel_saved_liters.toLocaleString()} Liters ({summary.fuel_saving_percentage}%)
                </div>
              </div>
              <div>
                <span className="text-slate-400">Logistics Transport Weight:</span>
                <div className="font-bold text-tactical-cyan text-sm">
                  {summary.total_shelter_weight_kg.toLocaleString()} kg
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Operational Recommendation */}
          <div className="p-3 bg-command-900/90 rounded border border-command-700 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-amber-400">OPERATIONAL SUMMARY & RECOMMENDATION:</strong> Deploying the
            configured {geometry.archetype.replace('_', ' ').toUpperCase()} shelter at {elevation}m ASL yields a{' '}
            <strong className="text-emerald-400">{summary.fuel_saving_percentage}% reduction</strong> in fossil
            fuel consumption over a {params.mission_duration_days}-day campaign, saving{' '}
            <strong className="text-emerald-400">{summary.fuel_saved_liters.toLocaleString()} Liters</strong> of
            Arctic diesel. The passive solar fenestration provides{' '}
            <strong className="text-amber-400">{summary.passive_solar_fraction_pct}%</strong> of the daily
            thermal requirement naturally.
          </div>
        </div>
      </div>
    </div>
  );
};
