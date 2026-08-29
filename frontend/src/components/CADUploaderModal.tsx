import React, { useState } from 'react';
import { UploadCloud, X, Check, Box, FileText, CheckCircle2 } from 'lucide-react';
import { CADParseResponse, ShelterGeometry } from '../types';
import { parseCadFile } from '../services/api';

interface CADUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCAD: (geometryUpdates: Partial<ShelterGeometry>) => void;
}

export const CADUploaderModal: React.FC<CADUploaderModalProps> = ({
  isOpen,
  onClose,
  onApplyCAD,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<CADParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setLoading(true);

    try {
      const data = await parseCadFile(uploadedFile);
      setParsedData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse CAD file. Ensure it is a valid .STL, .OBJ, or .PLY file.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!parsedData) return;
    onApplyCAD({
      archetype: 'custom_cad',
      length_m: parsedData.recommended_simulation_inputs.length_m,
      width_m: parsedData.recommended_simulation_inputs.width_m,
      height_m: parsedData.recommended_simulation_inputs.height_m,
      window_area_m2: parsedData.recommended_simulation_inputs.window_area_m2,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-command-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-command-900 border border-command-700/90 rounded-xl shadow-tactical max-w-2xl w-full flex flex-col font-mono text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-command-700/80 bg-command-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-tactical-cyan/20 border border-tactical-cyan/40 text-tactical-cyan">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                3D CAD Geometry Parser & Ingestion
              </h2>
              <p className="text-[11px] text-slate-400">
                Upload .STL / .OBJ / .STEP mesh to extract volume and segment roof vs wall thermal facets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-command-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-command-700 hover:border-tactical-cyan/70 bg-command-950/60 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
            onClick={() => document.getElementById('cad-file-input')?.click()}
          >
            <UploadCloud className="w-10 h-10 text-tactical-cyan mb-2 animate-bounce" />
            <div className="text-xs font-bold text-slate-200">
              Drag & Drop 3D CAD mesh file here, or click to browse
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Supports .STL, .OBJ, .PLY, .OFF format (Auto-scales units to meters)
            </div>
            <input
              id="cad-file-input"
              type="file"
              accept=".stl,.obj,.ply,.off,.step"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {loading && (
            <div className="text-center py-4 text-xs text-tactical-cyan flex items-center justify-center gap-2">
              <Box className="w-4 h-4 animate-spin" />
              <span>Parsing mesh geometry and calculating normal vector facets via Trimesh...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
              {error}
            </div>
          )}

          {parsedData && (
            <div className="bg-command-950/90 border border-command-700/80 rounded-lg p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-command-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CAD Model Successfully Decomposed</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {parsedData.vertex_count.toLocaleString()} Vertices | {parsedData.face_count.toLocaleString()} Triangles
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-command-900 p-2 rounded">
                  <div className="text-slate-400">Length × Width × Height</div>
                  <div className="font-bold text-tactical-cyan">
                    {parsedData.dimensions.length_m}m × {parsedData.dimensions.width_m}m × {parsedData.dimensions.height_m}m
                  </div>
                </div>

                <div className="bg-command-900 p-2 rounded">
                  <div className="text-slate-400">Internal Enclosed Volume</div>
                  <div className="font-bold text-amber-400">
                    {parsedData.dimensions.volume_m3} m³
                  </div>
                </div>

                <div className="bg-command-900 p-2 rounded">
                  <div className="text-slate-400">Roof Area (Z &gt; 0.65)</div>
                  <div className="font-bold text-slate-200">
                    {parsedData.surface_decomposition.roof_area_m2} m²
                  </div>
                </div>

                <div className="bg-command-900 p-2 rounded">
                  <div className="text-slate-400">South-Facing Wall Area</div>
                  <div className="font-bold text-emerald-400">
                    {parsedData.surface_decomposition.south_facing_wall_m2} m²
                  </div>
                </div>
              </div>

              <button
                onClick={handleApply}
                className="tactical-btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 mt-2"
              >
                <Check className="w-4 h-4" />
                <span>Apply Extracted Geometry to Active Simulation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
