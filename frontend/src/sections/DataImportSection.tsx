import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Thermometer,
  Sun,
  Wind,
  Droplets,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Table,
  Clock,
} from 'lucide-react';
import {
  importCsvWeather,
  importCsvMaterials,
  WeatherCsvImportResult,
  MaterialCsvImportResult,
} from '../services/api';

interface DataImportSectionProps {
  onWeatherImported: (hourlyWeather: WeatherCsvImportResult['hourly_weather']) => void;
  onMaterialsImported: (materials: MaterialCsvImportResult['materials']) => void;
  onNavigateTo: (section: any) => void;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

const WEATHER_CSV_TEMPLATE = `hour,ambient_temp,solar_ghi,wind_speed,relative_humidity
0,-18.5,0,3.2,28
1,-19.1,0,3.0,29
2,-19.8,0,2.8,29
3,-20.4,0,2.6,30
4,-21.0,0,2.5,30
5,-21.5,0,2.5,31
6,-22.0,0,2.7,31
7,-20.8,95,3.0,30
8,-18.2,310,3.5,29
9,-14.5,540,4.2,28
10,-10.8,720,5.0,27
11,-7.2,870,5.8,26
12,-4.5,920,6.5,25
13,-4.0,880,7.0,25
14,-4.2,790,7.5,25
15,-5.8,640,7.8,26
16,-8.5,440,7.5,26
17,-11.2,200,7.0,27
18,-13.8,15,6.5,28
19,-15.5,0,5.8,28
20,-16.8,0,5.0,29
21,-17.5,0,4.2,29
22,-18.0,0,3.8,29
23,-18.3,0,3.5,28`;

const MATERIALS_CSV_TEMPLATE = `name,k,density,cp,thickness_mm,cost_per_m2_100mm,category
DRDO Phase-Change Silica Foam,0.018,55,1400,90,3200,insulation
Aerogel-PUF Composite,0.020,48,1200,80,4100,insulation
High-Density Mineral Wool,0.036,120,840,100,1600,insulation
Geopolymer Cement Board,0.38,1800,900,20,2800,structural
Recycled Denim Insulation,0.040,30,1300,75,900,insulation`;

export const DataImportSection: React.FC<DataImportSectionProps> = ({
  onWeatherImported,
  onMaterialsImported,
  onNavigateTo,
}) => {
  // --- Weather CSV state ---
  const [wxState, setWxState] = useState<UploadState>('idle');
  const [wxResult, setWxResult] = useState<WeatherCsvImportResult | null>(null);
  const [wxError, setWxError] = useState<string>('');
  const [wxFileName, setWxFileName] = useState<string>('');
  const wxInputRef = useRef<HTMLInputElement>(null);

  // --- Materials CSV state ---
  const [matState, setMatState] = useState<UploadState>('idle');
  const [matResult, setMatResult] = useState<MaterialCsvImportResult | null>(null);
  const [matError, setMatError] = useState<string>('');
  const [matFileName, setMatFileName] = useState<string>('');
  const matInputRef = useRef<HTMLInputElement>(null);

  // ---- Weather CSV handlers ----
  const handleWeatherFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setWxError('Only .csv files accepted.');
      setWxState('error');
      return;
    }
    setWxFileName(file.name);
    setWxState('uploading');
    setWxError('');
    try {
      const result = await importCsvWeather(file);
      setWxResult(result);
      setWxState('success');
      onWeatherImported(result.hourly_weather);
    } catch (e: any) {
      setWxError(e.message || 'Upload failed');
      setWxState('error');
    }
  }, [onWeatherImported]);

  const handleWeatherDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setWxState('idle');
    const f = e.dataTransfer.files[0];
    if (f) handleWeatherFile(f);
  }, [handleWeatherFile]);

  // ---- Materials CSV handlers ----
  const handleMaterialsFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setMatError('Only .csv files accepted.');
      setMatState('error');
      return;
    }
    setMatFileName(file.name);
    setMatState('uploading');
    setMatError('');
    try {
      const result = await importCsvMaterials(file);
      setMatResult(result);
      setMatState('success');
      onMaterialsImported(result.materials);
    } catch (e: any) {
      setMatError(e.message || 'Upload failed');
      setMatState('error');
    }
  }, [onMaterialsImported]);

  const handleMaterialsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setMatState('idle');
    const f = e.dataTransfer.files[0];
    if (f) handleMaterialsFile(f);
  }, [handleMaterialsFile]);

  // ---- Download template helpers ----
  const downloadTemplate = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 font-mono text-slate-100 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="tactical-glass p-4 rounded-lg border-l-4 border-l-[#22d3ee]">
        <div className="corner-bracket-tl" /><div className="corner-bracket-br" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#8aebff] font-sans uppercase tracking-wide">
              Collected Data & Material Properties Feeder
            </h2>
            <p className="text-xs text-[#bbc9cd] mt-0.5">
              DRDO ID 26051 — "Simple feeding of collected data and material properties in developed model"
            </p>
          </div>
          <div className="flex gap-2">
            {(wxState === 'success' || matState === 'success') && (
              <button
                onClick={() => onNavigateTo('mission_config')}
                className="px-4 py-2 bg-[#45da7d] hover:bg-[#66f796] text-[#060e20] font-black text-xs rounded flex items-center gap-2 uppercase shadow-[0_0_12px_rgba(69,218,125,0.4)] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run Simulation with Imported Data
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Two upload columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ══ COLUMN 1: Weather / Climate CSV ══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#8aebff] uppercase flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-[#fb923c]" />
              1. Field-Measured Climate / Weather Data
            </h3>
            <button
              onClick={() => downloadTemplate(WEATHER_CSV_TEMPLATE, 'ladakh_weather_template.csv')}
              className="flex items-center gap-1.5 text-[10px] text-[#22d3ee] hover:text-[#8aebff] font-bold uppercase transition-all"
            >
              <Download className="w-3 h-3" /> Download Template
            </button>
          </div>

          {/* Required columns legend */}
          <div className="bg-[#060e20] border border-[#8aebff]/20 rounded-lg p-3 text-[11px] space-y-1.5">
            <div className="text-[#8aebff] font-bold uppercase mb-1">Required CSV Columns:</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#bbc9cd]">
              <span><strong className="text-[#22d3ee]">hour</strong> — 0 to 23 (24 rows)</span>
              <span><strong className="text-[#22d3ee]">ambient_temp</strong> — °C</span>
              <span><strong className="text-[#22d3ee]">solar_ghi</strong> — W/m² (0 at night)</span>
              <span><strong className="text-[#22d3ee]">wind_speed</strong> — m/s</span>
              <span className="text-[#859397]">relative_humidity — % (optional)</span>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleWeatherDrop}
            onDragOver={(e) => { e.preventDefault(); setWxState('dragging'); }}
            onDragLeave={() => setWxState(wxState === 'dragging' ? 'idle' : wxState)}
            onClick={() => wxInputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              wxState === 'dragging'  ? 'border-[#22d3ee] bg-[#22d3ee]/10' :
              wxState === 'success'   ? 'border-[#45da7d] bg-[#45da7d]/5' :
              wxState === 'error'     ? 'border-[#fb923c] bg-[#fb923c]/5' :
              wxState === 'uploading' ? 'border-[#8aebff]/60 bg-[#8aebff]/5' :
              'border-[#8aebff]/30 hover:border-[#22d3ee] hover:bg-[#22d3ee]/5'
            }`}
          >
            <input
              ref={wxInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleWeatherFile(f); }}
            />

            {wxState === 'uploading' && (
              <RefreshCw className="w-10 h-10 text-[#8aebff] animate-spin" />
            )}
            {wxState === 'success' && (
              <CheckCircle2 className="w-10 h-10 text-[#45da7d]" />
            )}
            {wxState === 'error' && (
              <AlertCircle className="w-10 h-10 text-[#fb923c]" />
            )}
            {(wxState === 'idle' || wxState === 'dragging') && (
              <Upload className={`w-10 h-10 ${wxState === 'dragging' ? 'text-[#22d3ee]' : 'text-[#8aebff]/60'}`} />
            )}

            <div className="text-center">
              {wxState === 'uploading' && <p className="text-[#8aebff] text-sm font-bold">Parsing CSV data…</p>}
              {wxState === 'success' && (
                <>
                  <p className="text-[#45da7d] text-sm font-bold">{wxFileName}</p>
                  <p className="text-[#bbc9cd] text-xs mt-1">{wxResult?.rows_parsed} hourly rows imported ✓</p>
                </>
              )}
              {wxState === 'error' && (
                <>
                  <p className="text-[#fb923c] text-sm font-bold">Import Failed</p>
                  <p className="text-[#bbc9cd] text-xs mt-1 max-w-xs">{wxError}</p>
                </>
              )}
              {(wxState === 'idle' || wxState === 'dragging') && (
                <>
                  <p className="text-[#dae2fd] text-sm font-bold">
                    {wxState === 'dragging' ? 'Drop to Import' : 'Drag & Drop Climate CSV'}
                  </p>
                  <p className="text-[#bbc9cd] text-xs mt-1">or click to browse — 24-hour hourly measurements</p>
                </>
              )}
            </div>

            {wxState !== 'idle' && (
              <button
                onClick={(e) => { e.stopPropagation(); setWxState('idle'); setWxResult(null); setWxError(''); }}
                className="absolute top-2 right-2 text-[#bbc9cd] hover:text-[#8aebff]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Parsed Climate Summary Stats */}
          {wxResult && wxState === 'success' && (
            <div className="bg-[#060e20] border border-[#45da7d]/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#45da7d] uppercase pb-1 border-b border-[#45da7d]/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Imported Climate Data Summary
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/15">
                  <div className="text-[#bbc9cd] text-[10px] flex items-center gap-1"><Thermometer className="w-3 h-3 text-[#38bdf8]" /> Temperature Range</div>
                  <div className="font-bold text-[#38bdf8] mt-0.5">{wxResult.summary.min_temp_c}°C to {wxResult.summary.max_temp_c}°C</div>
                  <div className="text-[10px] text-[#859397]">Avg: {wxResult.summary.avg_temp_c}°C</div>
                </div>
                <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/15">
                  <div className="text-[#bbc9cd] text-[10px] flex items-center gap-1"><Sun className="w-3 h-3 text-[#fb923c]" /> Solar Irradiance</div>
                  <div className="font-bold text-[#fb923c] mt-0.5">Peak: {wxResult.summary.peak_solar_w_m2} W/m²</div>
                  <div className="text-[10px] text-[#859397]">Daily GHI: {wxResult.summary.daily_ghi_kwh_m2} kWh/m²</div>
                </div>
                <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/15">
                  <div className="text-[#bbc9cd] text-[10px] flex items-center gap-1"><Wind className="w-3 h-3 text-[#dae2fd]" /> Wind Speed</div>
                  <div className="font-bold text-[#dae2fd] mt-0.5">Max: {wxResult.summary.max_wind_mps} m/s</div>
                  <div className="text-[10px] text-[#859397]">Avg: {wxResult.summary.avg_wind_mps} m/s</div>
                </div>
                <div className="bg-[#131b2e] p-2.5 rounded border border-[#8aebff]/15">
                  <div className="text-[#bbc9cd] text-[10px] flex items-center gap-1"><Clock className="w-3 h-3 text-[#8aebff]" /> Data Rows</div>
                  <div className="font-bold text-[#45da7d] mt-0.5">{wxResult.rows_parsed} / 24 Hours</div>
                  <div className="text-[10px] text-[#859397]">Full diurnal cycle ✓</div>
                </div>
              </div>

              {/* Preview table: first 6 hours */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead className="text-[#bbc9cd] border-b border-[#8aebff]/20">
                    <tr>
                      <th className="py-1 pr-3">Hour</th>
                      <th className="py-1 pr-3">T_amb (°C)</th>
                      <th className="py-1 pr-3">GHI (W/m²)</th>
                      <th className="py-1">Wind (m/s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#131b2e]">
                    {wxResult.hourly_weather.slice(0, 6).map((row) => (
                      <tr key={row.hour} className="text-[#dae2fd]">
                        <td className="py-0.5 pr-3 font-mono">{String(row.hour).padStart(2,'0')}:00</td>
                        <td className="py-0.5 pr-3 font-bold text-[#38bdf8]">{row.ambient_temp}°C</td>
                        <td className="py-0.5 pr-3 text-[#fb923c]">{row.solar_ghi}</td>
                        <td className="py-0.5">{row.wind_speed}</td>
                      </tr>
                    ))}
                    <tr className="text-[#859397]">
                      <td colSpan={4} className="py-0.5 italic">… {wxResult.rows_parsed - 6} more rows</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ══ COLUMN 2: Material Properties CSV ══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#8aebff] uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#22d3ee]" />
              2. Laboratory Material Properties
            </h3>
            <button
              onClick={() => downloadTemplate(MATERIALS_CSV_TEMPLATE, 'custom_materials_template.csv')}
              className="flex items-center gap-1.5 text-[10px] text-[#22d3ee] hover:text-[#8aebff] font-bold uppercase transition-all"
            >
              <Download className="w-3 h-3" /> Download Template
            </button>
          </div>

          {/* Required columns legend */}
          <div className="bg-[#060e20] border border-[#8aebff]/20 rounded-lg p-3 text-[11px] space-y-1.5">
            <div className="text-[#8aebff] font-bold uppercase mb-1">Required CSV Columns:</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#bbc9cd]">
              <span><strong className="text-[#22d3ee]">name</strong> — Material identifier</span>
              <span><strong className="text-[#22d3ee]">k</strong> — Conductivity (W/mK)</span>
              <span><strong className="text-[#22d3ee]">density</strong> — kg/m³</span>
              <span className="text-[#859397]">cp — Specific heat J/kgK (opt.)</span>
              <span className="text-[#859397]">thickness_mm — Default (opt.)</span>
              <span className="text-[#859397]">category — insulation/structural (opt.)</span>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleMaterialsDrop}
            onDragOver={(e) => { e.preventDefault(); setMatState('dragging'); }}
            onDragLeave={() => setMatState(matState === 'dragging' ? 'idle' : matState)}
            onClick={() => matInputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              matState === 'dragging'  ? 'border-[#22d3ee] bg-[#22d3ee]/10' :
              matState === 'success'   ? 'border-[#45da7d] bg-[#45da7d]/5' :
              matState === 'error'     ? 'border-[#fb923c] bg-[#fb923c]/5' :
              matState === 'uploading' ? 'border-[#8aebff]/60 bg-[#8aebff]/5' :
              'border-[#8aebff]/30 hover:border-[#22d3ee] hover:bg-[#22d3ee]/5'
            }`}
          >
            <input
              ref={matInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMaterialsFile(f); }}
            />

            {matState === 'uploading' && <RefreshCw className="w-10 h-10 text-[#8aebff] animate-spin" />}
            {matState === 'success'  && <CheckCircle2 className="w-10 h-10 text-[#45da7d]" />}
            {matState === 'error'    && <AlertCircle className="w-10 h-10 text-[#fb923c]" />}
            {(matState === 'idle' || matState === 'dragging') && (
              <Layers className={`w-10 h-10 ${matState === 'dragging' ? 'text-[#22d3ee]' : 'text-[#8aebff]/60'}`} />
            )}

            <div className="text-center">
              {matState === 'uploading' && <p className="text-[#8aebff] text-sm font-bold">Parsing materials…</p>}
              {matState === 'success' && (
                <>
                  <p className="text-[#45da7d] text-sm font-bold">{matFileName}</p>
                  <p className="text-[#bbc9cd] text-xs mt-1">{matResult?.materials_imported} material(s) imported ✓</p>
                </>
              )}
              {matState === 'error' && (
                <>
                  <p className="text-[#fb923c] text-sm font-bold">Import Failed</p>
                  <p className="text-[#bbc9cd] text-xs mt-1 max-w-xs">{matError}</p>
                </>
              )}
              {(matState === 'idle' || matState === 'dragging') && (
                <>
                  <p className="text-[#dae2fd] text-sm font-bold">
                    {matState === 'dragging' ? 'Drop to Import' : 'Drag & Drop Materials CSV'}
                  </p>
                  <p className="text-[#bbc9cd] text-xs mt-1">or click to browse — lab-measured properties</p>
                </>
              )}
            </div>

            {matState !== 'idle' && (
              <button
                onClick={(e) => { e.stopPropagation(); setMatState('idle'); setMatResult(null); setMatError(''); }}
                className="absolute top-2 right-2 text-[#bbc9cd] hover:text-[#8aebff]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Parsed Materials Table */}
          {matResult && matState === 'success' && (
            <div className="bg-[#060e20] border border-[#45da7d]/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#45da7d] uppercase pb-1 border-b border-[#45da7d]/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {matResult.materials_imported} Custom Material(s) Ready for Use
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead className="text-[#bbc9cd] border-b border-[#8aebff]/20">
                    <tr>
                      <th className="py-1 pr-3">Name</th>
                      <th className="py-1 pr-3">k (W/mK)</th>
                      <th className="py-1 pr-3">ρ (kg/m³)</th>
                      <th className="py-1 pr-3">Thickness</th>
                      <th className="py-1">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#131b2e]">
                    {Object.entries(matResult.materials).map(([id, mat]) => (
                      <tr key={id} className="text-[#dae2fd] hover:bg-[#131b2e]/60">
                        <td className="py-1 pr-3 font-bold text-[#8aebff]">{mat.name}</td>
                        <td className="py-1 pr-3 font-mono text-[#45da7d]">{mat.k}</td>
                        <td className="py-1 pr-3 font-mono">{mat.density}</td>
                        <td className="py-1 pr-3 text-[#fb923c]">{mat.default_thickness_mm} mm</td>
                        <td className="py-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30">
                            {mat.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#45da7d]">
                ✓ These materials are now available in the Envelope Stack Builder under Mission Config.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: How to use imported data ── */}
      <div className="tactical-glass p-4 rounded-lg space-y-3">
        <div className="corner-bracket-tl" /><div className="corner-bracket-br" />
        <h3 className="text-xs font-bold text-[#8aebff] uppercase">How Imported Data Flows into the Simulation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#bbc9cd]">
          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/15 flex items-start gap-2">
            <span className="text-lg font-black text-[#22d3ee] leading-none">1</span>
            <div>
              <div className="font-bold text-[#dae2fd] mb-0.5">Upload Climate CSV</div>
              <div>Your 24-hour hourly measurements (temp, solar, wind) replace the Open-Meteo API weather. Your <em>real field data</em> drives the transient heat balance solver.</div>
            </div>
          </div>
          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/15 flex items-start gap-2">
            <span className="text-lg font-black text-[#22d3ee] leading-none">2</span>
            <div>
              <div className="font-bold text-[#dae2fd] mb-0.5">Upload Materials CSV</div>
              <div>Your lab-measured k, ρ, Cp values are loaded into the material database. You can then assign them layer-by-layer in the Envelope Stack Builder to compute exact U-values.</div>
            </div>
          </div>
          <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/15 flex items-start gap-2">
            <span className="text-lg font-black text-[#22d3ee] leading-none">3</span>
            <div>
              <div className="font-bold text-[#dae2fd] mb-0.5">Run & Get Outcome</div>
              <div>Click "Run Simulation" → the engine uses <em>your data</em> to predict inside temperature, solar gain, heat flows, and identifies the most efficient material combination.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
