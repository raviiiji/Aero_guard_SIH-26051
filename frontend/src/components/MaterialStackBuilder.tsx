import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { EnvelopeSection, LayerSpec, MaterialDef, GlazingDef, SectionUValue } from '../types';

interface MaterialStackBuilderProps {
  roofEnvelope: EnvelopeSection;
  wallEnvelope: EnvelopeSection;
  floorEnvelope: EnvelopeSection;
  glazingId: string;
  materialsDB: Record<string, MaterialDef>;
  glazingDB: Record<string, GlazingDef>;
  uValues?: {
    roof: SectionUValue;
    walls: SectionUValue;
    floor: SectionUValue;
    glazing: { name: string; u_value: number; shgc: number };
  };
  onUpdateRoof: (env: EnvelopeSection) => void;
  onUpdateWall: (env: EnvelopeSection) => void;
  onUpdateFloor: (env: EnvelopeSection) => void;
  onUpdateGlazing: (glazingId: string) => void;
}

export const MaterialStackBuilder: React.FC<MaterialStackBuilderProps> = ({
  roofEnvelope,
  wallEnvelope,
  floorEnvelope,
  glazingId,
  materialsDB,
  glazingDB,
  uValues,
  onUpdateRoof,
  onUpdateWall,
  onUpdateFloor,
  onUpdateGlazing,
}) => {
  const [activeTab, setActiveTab] = useState<'wall' | 'roof' | 'floor' | 'glazing'>('wall');

  const currentEnvelope =
    activeTab === 'wall'
      ? wallEnvelope
      : activeTab === 'roof'
      ? roofEnvelope
      : floorEnvelope;

  const currentUValue =
    activeTab === 'wall'
      ? uValues?.walls
      : activeTab === 'roof'
      ? uValues?.roof
      : uValues?.floor;

  const handleLayerMaterialChange = (idx: number, newMatId: string) => {
    const newLayers = [...currentEnvelope.layers];
    newLayers[idx] = { ...newLayers[idx], material_id: newMatId };
    saveCurrentEnvelope(newLayers);
  };

  const handleLayerThicknessChange = (idx: number, newThickness: number) => {
    const newLayers = [...currentEnvelope.layers];
    newLayers[idx] = { ...newLayers[idx], thickness_mm: newThickness };
    saveCurrentEnvelope(newLayers);
  };

  const handleAddLayer = () => {
    const newLayers = [...currentEnvelope.layers, { material_id: 'puf', thickness_mm: 50 }];
    saveCurrentEnvelope(newLayers);
  };

  const handleRemoveLayer = (idx: number) => {
    if (currentEnvelope.layers.length <= 1) return;
    const newLayers = currentEnvelope.layers.filter((_, i) => i !== idx);
    saveCurrentEnvelope(newLayers);
  };

  const saveCurrentEnvelope = (newLayers: LayerSpec[]) => {
    const updated = { layers: newLayers };
    if (activeTab === 'wall') onUpdateWall(updated);
    else if (activeTab === 'roof') onUpdateRoof(updated);
    else if (activeTab === 'floor') onUpdateFloor(updated);
  };

  return (
    <div className="tactical-card p-3.5 flex flex-col h-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-command-700/60 mb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-tactical-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Envelope Multi-Layer Insulation Stack
          </h2>
        </div>
      </div>

      {/* Surface Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-command-950/80 border border-command-700/70 rounded-md text-xs mb-3">
        <button
          onClick={() => setActiveTab('wall')}
          className={`py-1.5 rounded text-center transition-all ${
            activeTab === 'wall'
              ? 'bg-tactical-cyan text-command-950 font-bold shadow-glow-cyan/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Walls
        </button>
        <button
          onClick={() => setActiveTab('roof')}
          className={`py-1.5 rounded text-center transition-all ${
            activeTab === 'roof'
              ? 'bg-tactical-cyan text-command-950 font-bold shadow-glow-cyan/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Roof
        </button>
        <button
          onClick={() => setActiveTab('floor')}
          className={`py-1.5 rounded text-center transition-all ${
            activeTab === 'floor'
              ? 'bg-tactical-cyan text-command-950 font-bold shadow-glow-cyan/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Floor
        </button>
        <button
          onClick={() => setActiveTab('glazing')}
          className={`py-1.5 rounded text-center transition-all ${
            activeTab === 'glazing'
              ? 'bg-amber-400 text-command-950 font-bold shadow-glow-amber/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Glazing
        </button>
      </div>

      {/* Surface Specific Layer Builder */}
      {activeTab !== 'glazing' ? (
        <div className="flex-grow flex flex-col justify-between space-y-3">
          {/* U-Value & Thermal Resistance Summary Card */}
          {currentUValue && (
            <div className="bg-command-950/90 border border-command-700/80 rounded-md p-2.5 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-400">Transmittance ($U$)</div>
                <div className="text-sm font-bold text-tactical-cyan">
                  {currentUValue.u_value}{' '}
                  <span className="text-[9px] text-slate-400">W/m²K</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Resistance ($R$)</div>
                <div className="text-sm font-bold text-emerald-400">
                  {currentUValue.r_value}{' '}
                  <span className="text-[9px] text-slate-400">m²K/W</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Thickness</div>
                <div className="text-sm font-bold text-amber-400">
                  {currentUValue.thickness_mm}{' '}
                  <span className="text-[9px] text-slate-400">mm</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Weight</div>
                <div className="text-sm font-bold text-slate-200">
                  {currentUValue.weight_per_m2}{' '}
                  <span className="text-[9px] text-slate-400">kg/m²</span>
                </div>
              </div>
            </div>
          )}

          {/* Layer List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {currentEnvelope.layers.map((layer, idx) => {
              const mat = materialsDB[layer.material_id] || materialsDB['puf'];
              return (
                <div
                  key={idx}
                  className="bg-command-950/60 border border-command-700/70 rounded-md p-2 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <span className="w-5 h-5 rounded bg-command-800 flex items-center justify-center text-[10px] text-tactical-cyan">
                        L{idx + 1}
                      </span>
                      <select
                        value={layer.material_id}
                        onChange={(e) => handleLayerMaterialChange(idx, e.target.value)}
                        aria-label={`Layer ${idx + 1} material`}
                        className="bg-command-900 border border-command-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-tactical-cyan font-mono"
                      >
                        {Object.entries(materialsDB).map(([id, m]) => (
                          <option key={id} value={id}>
                            {m.name} (k={m.k})
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentEnvelope.layers.length > 1 && (
                      <button
                        onClick={() => handleRemoveLayer(idx)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition-all"
                        title="Remove Layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Thickness:</span>
                    <input
                      type="range"
                      min={5}
                      max={180}
                      step={5}
                      value={layer.thickness_mm}
                      onChange={(e) => handleLayerThicknessChange(idx, parseFloat(e.target.value))}
                      className="flex-grow accent-tactical-cyan cursor-pointer"
                    />
                    <strong className="text-slate-200 w-14 text-right">
                      {layer.thickness_mm} mm
                    </strong>
                  </div>

                  {mat && (
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {mat.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Layer Button */}
          <button
            onClick={handleAddLayer}
            className="w-full py-1.5 border border-dashed border-command-600 hover:border-tactical-cyan hover:bg-tactical-cyan/10 text-tactical-cyan text-xs rounded flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Composite Layer</span>
          </button>
        </div>
      ) : (
        /* Glazing Configurator */
        <div className="space-y-2.5">
          <div className="text-xs text-slate-300 mb-1">Select High-Altitude Fenestration / Solar Glazing:</div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {Object.entries(glazingDB).map(([id, g]) => {
              const isSelected = glazingId === id;
              return (
                <button
                  key={id}
                  onClick={() => onUpdateGlazing(id)}
                  className={`w-full p-2.5 rounded-md border text-left flex flex-col gap-1 transition-all ${
                    isSelected
                      ? 'bg-command-800 border-amber-400 shadow-glow-amber/20'
                      : 'bg-command-950/70 border-command-700/70 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{g.name}</span>
                    {isSelected && (
                      <span className="text-[10px] bg-amber-400 text-command-950 px-1.5 py-0.2 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-400">
                      U-Value: <strong className="text-tactical-cyan">{g.u_value} W/m²K</strong>
                    </span>
                    <span className="text-slate-400">
                      SHGC (Solar Gain): <strong className="text-amber-400">{g.shgc}</strong>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{g.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
