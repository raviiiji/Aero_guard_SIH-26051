import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, Box, Check, FileText } from 'lucide-react';
import { CADParseResponse, ShelterGeometry } from '../types';
import { parseCadFile } from '../services/api';

interface CADStudioSectionProps {
  onApplyCAD: (geometryUpdates: Partial<ShelterGeometry>) => void;
  onNavigateTo: (section: any) => void;
}

export const CADStudioSection: React.FC<CADStudioSectionProps> = ({
  onApplyCAD,
  onNavigateTo,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<CADParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

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
    setApplied(false);

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
    setApplied(true);
  };

  return (
    <div className="space-y-4 font-mono text-slate-100 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="tactical-glass p-4 rounded flex items-center gap-3 border-l-4 border-l-[#8aebff]">
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-br" />
        <div className="p-2.5 rounded bg-[#8aebff]/20 text-[#8aebff]">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase text-[#8aebff]">
            3D CAD Geometry Parser & Thermal Surface Segmentation Studio
          </h2>
          <p className="text-xs text-[#bbc9cd]">
            Upload `.STL` / `.OBJ` CAD model. Trimesh extracts exact enclosed volume ($V$) and decomposes face normal vectors into Roof, Wall, and South Solar Facades.
          </p>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="tactical-glass border-2 border-dashed border-[#8aebff]/30 hover:border-[#8aebff] rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
        onClick={() => document.getElementById('cad-studio-input')?.click()}
      >
        <UploadCloud className="w-12 h-12 text-[#8aebff] mb-3 animate-bounce" />
        <div className="text-sm font-bold text-[#dae2fd]">
          Drag & Drop 3D CAD Mesh File (.STL, .OBJ, .PLY, .STEP)
        </div>
        <div className="text-xs text-[#bbc9cd] mt-1">
          Automated unit detection and normal vector categorization
        </div>
        <input
          id="cad-studio-input"
          type="file"
          accept=".stl,.obj,.ply,.off,.step"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {loading && (
        <div className="tactical-glass p-6 text-center text-xs text-[#8aebff] flex items-center justify-center gap-2">
          <Box className="w-5 h-5 animate-spin" />
          <span>Parsing 3D mesh geometry, extracting vertices and computing surface areas...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#93000a]/30 border border-[#ffb4ab]/40 rounded text-xs text-[#ffb4ab]">
          {error}
        </div>
      )}

      {parsedData && (
        <div className="tactical-glass p-5 rounded-lg space-y-4">
          <div className="corner-bracket-tl" />
          <div className="corner-bracket-br" />

          <div className="flex items-center justify-between pb-3 border-b border-[#8aebff]/20">
            <div className="flex items-center gap-2 text-[#45da7d] font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>CAD Model Analysis Complete: {parsedData.filename}</span>
            </div>
            <span className="text-xs text-[#bbc9cd]">
              {parsedData.vertex_count.toLocaleString()} Vertices | {parsedData.face_count.toLocaleString()} Triangles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <div className="text-[#bbc9cd] text-[10px]">Dimensions ($L \times W \times H$)</div>
              <div className="font-bold text-[#8aebff] text-sm mt-0.5">
                {parsedData.dimensions.length_m}m × {parsedData.dimensions.width_m}m × {parsedData.dimensions.height_m}m
              </div>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <div className="text-[#bbc9cd] text-[10px]">Internal Volume ($V$)</div>
              <div className="font-bold text-[#fb923c] text-sm mt-0.5">
                {parsedData.dimensions.volume_m3} m³
              </div>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <div className="text-[#bbc9cd] text-[10px]">Roof Area ($Z &gt; 0.65$)</div>
              <div className="font-bold text-[#dae2fd] text-sm mt-0.5">
                {parsedData.surface_decomposition.roof_area_m2} m²
              </div>
            </div>

            <div className="bg-[#131b2e] p-3 rounded border border-[#8aebff]/20">
              <div className="text-[#bbc9cd] text-[10px]">South Solar Wall Area</div>
              <div className="font-bold text-[#45da7d] text-sm mt-0.5">
                {parsedData.surface_decomposition.south_facing_wall_m2} m²
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleApply}
              className="flex-1 py-3 bg-[#8aebff] hover:bg-[#a2eeff] text-[#060e20] font-bold text-xs rounded transition-all shadow-[0_0_15px_rgba(138,235,255,0.4)] flex items-center justify-center gap-2 uppercase"
            >
              <Check className="w-4 h-4" />
              <span>{applied ? 'Geometry Applied to Active Model!' : 'Apply CAD Dimensions to Active Simulation'}</span>
            </button>

            {applied && (
              <button
                onClick={() => onNavigateTo('overview')}
                className="px-4 py-3 bg-[#131b2e] hover:bg-[#8aebff]/20 border border-[#8aebff]/40 text-[#8aebff] text-xs font-bold rounded uppercase transition-all"
              >
                View in 3D Overview
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
