import React, { useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Mountain, ShieldCheck, X } from 'lucide-react';
import { SuitabilityRating } from '../types';

export interface RelocateTarget {
  latitude: number;
  longitude: number;
  elevation: number;
  /** True when the DEM value has actually been resolved. */
  elevationKnown: boolean;
  name: string;
}

export interface RelocateConfirmDialogProps {
  open: boolean;
  target: RelocateTarget | null;
  /** Where the shelter is now, so the change is stated as a delta. */
  current: { latitude: number; longitude: number; name: string } | null;
  /** Straight-line distance from the current site, in km. */
  distanceKm: number | null;
  suitability: SuitabilityRating | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const fmt = (v: number, digits: number, pos: string, neg: string) =>
  `${Math.abs(v).toFixed(digits)}° ${v >= 0 ? pos : neg}`;

const RATING_TONE: Record<string, string> = {
  EXCELLENT: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/50',
  FAVOURABLE: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/50',
  MARGINAL: 'text-amber-300 border-amber-500/50 bg-amber-950/50',
  POOR: 'text-red-300 border-red-500/50 bg-red-950/50',
  UNKNOWN: 'text-slate-400 border-slate-700 bg-slate-900',
};

/**
 * Gate for the relocation flow. Nothing moves until this is confirmed, which is
 * what makes ANALYZE LOCATION and RELOCATE SHELTER meaningful steps rather than
 * something that already happened when the map was clicked.
 */
export const RelocateConfirmDialog: React.FC<RelocateConfirmDialogProps> = ({
  open,
  target,
  current,
  distanceKm,
  suitability,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the safe action on open, and close on Escape.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open || !target) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-command-950/85 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relocate-title"
    >
      <div className="w-full max-w-md bg-command-900 border border-amber-600/50 rounded-xl shadow-tactical font-mono">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-command-700/80 bg-command-950/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="relocate-title"
                className="text-xs font-bold uppercase tracking-wider text-amber-200"
              >
                Confirm Shelter Relocation
              </h2>
              <p className="text-[10px] text-slate-400">
                The existing twin is moved, not duplicated
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel relocation"
            className="text-slate-500 hover:text-slate-300 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* From -> to */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[9px] font-bold text-slate-500 mb-1">CURRENT SITE</div>
              {current ? (
                <>
                  <div className="text-[11px] font-bold text-slate-200 truncate">{current.name}</div>
                  <div className="text-[10px] text-cyan-400 tabular-nums mt-0.5">
                    {fmt(current.latitude, 4, 'N', 'S')}
                  </div>
                  <div className="text-[10px] text-cyan-400 tabular-nums">
                    {fmt(current.longitude, 4, 'E', 'W')}
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-slate-500">Not deployed</div>
              )}
            </div>

            <div className="bg-amber-950/30 border border-amber-700/50 rounded-lg p-2.5">
              <div className="text-[9px] font-bold text-amber-500/80 mb-1">NEW SITE</div>
              <div className="text-[11px] font-bold text-amber-200 truncate">{target.name}</div>
              <div className="text-[10px] text-amber-300 tabular-nums mt-0.5">
                {fmt(target.latitude, 4, 'N', 'S')}
              </div>
              <div className="text-[10px] text-amber-300 tabular-nums">
                {fmt(target.longitude, 4, 'E', 'W')}
              </div>
            </div>
          </div>

          {/* Facts */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3 h-3" /> Relocation distance
              </span>
              <span className="font-bold text-cyan-300 tabular-nums">
                {distanceKm === null ? 'Same position' : `${distanceKm.toFixed(1)} km`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Mountain className="w-3 h-3" /> DEM elevation at new site
              </span>
              <span className="font-bold text-cyan-300 tabular-nums">
                {target.elevationKnown
                  ? `${Math.round(target.elevation).toLocaleString()} m ASL`
                  : 'Resolved on deploy'}
              </span>
            </div>
            {suitability && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400">Site suitability</span>
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold text-[10px] ${
                    RATING_TONE[suitability.rating] ?? RATING_TONE.UNKNOWN
                  }`}
                >
                  {suitability.score === null
                    ? suitability.rating
                    : `${suitability.rating} · ${suitability.score}/100`}
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Relocating re-anchors the existing shelter twin: the marker, the 3D shelter, the DEM
            terrain and all telemetry move to the new coordinates. Shelter ID, fuel load, battery
            state and generator status are preserved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-command-700/80 bg-command-950/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {busy ? 'RELOCATING…' : 'CONFIRM RELOCATION'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelocateConfirmDialog;
