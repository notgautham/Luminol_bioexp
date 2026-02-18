import React, { useState, useCallback } from 'react';
import {
    ChevronDown, ChevronUp, Trash2, RefreshCw,
    AlertTriangle, CheckCircle2, Clock, Loader2,
    Shield, Droplets, Gauge, Activity, Eye, Zap, Info
} from 'lucide-react';

/* ─── Status Badge ─── */
function StatusBadge({ status, dirty }) {
    if (dirty)
        return <span className="badge-processing !bg-warn-surface !text-warn !border-warn/20"><Zap size={10} /> Modified</span>;
    if (status === 'pending')
        return <span className="badge-pending"><Clock size={10} /> Pending</span>;
    if (status === 'processing')
        return <span className="badge-processing"><Loader2 size={10} className="animate-spin" /> Analyzing</span>;
    if (status === 'success')
        return <span className="badge-success"><CheckCircle2 size={10} /> Complete</span>;
    if (status === 'error')
        return <span className="badge-error"><AlertTriangle size={10} /> Failed</span>;
    return null;
}

/* ─── Metric Tile ─── */
function MetricTile({ icon: Icon, label, value, accent, warn, danger, tooltip }) {
    const colorClass = danger ? 'text-danger'
        : warn ? 'text-warn'
            : accent ? 'text-accent-glow'
                : 'text-slate-100';

    const borderClass = danger ? 'border-danger/20 bg-danger-surface'
        : warn ? 'border-warn/20 bg-warn-surface'
            : accent ? 'border-accent/20 bg-accent-surface'
                : 'border-border bg-surface-1';

    return (
        <div className={`rounded-lg border p-3 ${borderClass}`} title={tooltip}>
            <div className="flex items-center gap-1.5 mb-1">
                {Icon && <Icon size={11} className="text-muted" />}
                <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">{label}</span>
            </div>
            <div className={`text-lg font-mono font-semibold ${colorClass} truncate`}>
                {value ?? '—'}
            </div>
        </div>
    );
}

/* ─── Format number ─── */
const fmt = (v, d = 4) => v != null ? Number(v).toFixed(d) : '—';
const fmtInt = (v) => v != null ? Number(v).toLocaleString() : '—';

/* ─── Queue Item Card ─── */
export function QueueItem({ item, onRemove, onRetry, debugMode, onUpdateSettings, onPreview, globalSensitivity, captureMode }) {
    const [expanded, setExpanded] = useState(false);
    const [localOverrides, setLocalOverrides] = useState(item.overrides || {});

    const isError = item.status === 'error';
    const isDone = item.status === 'success';
    const isActive = item.status === 'processing';
    const isDirty = item.dirty;
    const result = item.result;
    const metrics = result?.metrics;

    const hasSatWarning = metrics?.saturation_warning;
    const effectiveSensitivity = localOverrides.sensitivity ?? globalSensitivity ?? 50;

    const cardBorder = isDirty
        ? 'border-warn/30'
        : isError
            ? 'border-danger/30'
            : isDone
                ? 'border-border hover:border-success/20'
                : isActive
                    ? 'border-accent/30'
                    : 'border-border hover:border-border-hover';

    const handleOverrideChange = useCallback((field, value) => {
        const updated = { ...localOverrides, [field]: value };
        setLocalOverrides(updated);
        onUpdateSettings(item.id, updated);
    }, [localOverrides, item.id, onUpdateSettings]);

    const handleSensitivitySlider = useCallback((e) => {
        const val = parseInt(e.target.value);
        handleOverrideChange('sensitivity', val);
        // Trigger live preview (debounced in App)
        if (onPreview && (isDone || isError)) {
            onPreview(item.id, val);
        }
    }, [handleOverrideChange, onPreview, item.id, isDone, isError]);

    return (
        <div className={`card-hover ${cardBorder} overflow-hidden`}>

            {/* ─── Header Row ─── */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Thumbnail with overlay */}
                <div className="w-11 h-11 rounded-lg bg-surface-0 overflow-hidden flex-shrink-0 border border-border relative">
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    {isActive && (
                        <div className="absolute inset-0 bg-surface-0/70 flex items-center justify-center">
                            <Loader2 size={16} className="text-accent-glow animate-spin" />
                        </div>
                    )}
                    {isDirty && !isActive && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warn shadow-sm" />
                    )}
                </div>

                {/* Name + Badge */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-slate-200 truncate">{item.file.name}</span>
                        {hasSatWarning && isDone && (
                            <AlertTriangle size={12} className="text-warn flex-shrink-0" />
                        )}
                    </div>
                    <StatusBadge status={item.status} dirty={isDirty} />
                </div>

                {/* Inline metric preview */}
                {isDone && metrics && (
                    <div className="hidden sm:flex items-center gap-4 mr-2">
                        <div className="text-right">
                            <div className="text-[10px] text-muted uppercase tracking-wider">Rel. Intensity</div>
                            <div className="text-sm font-mono font-semibold text-accent-glow">
                                {metrics.integrated_norm != null ? fmt(metrics.integrated_norm, 2) : '—'}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-muted uppercase tracking-wider">Mean</div>
                            <div className="text-sm font-mono font-semibold text-slate-200">{fmt(metrics.mean_linear_core)}</div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(isError || isDone) && (
                        <button onClick={() => onRetry(item.id)} className="btn-icon" title="Re-run">
                            <RefreshCw size={15} />
                        </button>
                    )}
                    <button onClick={() => onRemove(item.id)} className="btn-icon hover:!text-danger" title="Remove">
                        <Trash2 size={15} />
                    </button>
                    <button onClick={() => setExpanded(!expanded)} className="btn-icon">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* ─── Progress Bar ─── */}
            {isActive && (
                <div className="px-3 pb-2">
                    <div className="progress-track">
                        <div className="progress-fill bg-accent" style={{ width: `${item.progress}%` }} />
                    </div>
                </div>
            )}

            {/* ─── Expanded Details ─── */}
            {expanded && (
                <div className="border-t border-border bg-surface-1/50 p-4 space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                        {/* Preview with overlay (2 cols) */}
                        <div className="md:col-span-2 relative rounded-lg overflow-hidden bg-surface-0 border border-border min-h-[180px] flex items-center justify-center">
                            <img src={item.preview} className="max-w-full max-h-[280px] object-contain" alt="" />

                            {/* Core mask overlay — always shown when available */}
                            {result?.overlay_png_base64 && (
                                <img
                                    src={result.overlay_png_base64}
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                    alt=""
                                />
                            )}

                            {/* Debug overlay (legacy contour JPEG) */}
                            {debugMode && result?.debug_image && !result?.overlay_png_base64 && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img src={result.debug_image} className="absolute inset-0 w-full h-full object-contain opacity-50 mix-blend-screen" alt="" />
                                    <div className="absolute bottom-2 right-2 badge-processing !text-[9px]">
                                        <Eye size={9} /> Mask Overlay
                                    </div>
                                </div>
                            )}

                            {/* Overlay label */}
                            {result?.overlay_png_base64 && (
                                <div className="absolute bottom-2 right-2 badge-processing !text-[9px] !bg-surface-0/70">
                                    <Eye size={9} /> Core Mask
                                </div>
                            )}

                            {isError && (
                                <div className="absolute inset-0 bg-surface-0/60 flex items-center justify-center">
                                    <span className="text-danger text-sm font-medium">Analysis Failed</span>
                                </div>
                            )}
                        </div>

                        {/* Metrics + Controls (3 cols) */}
                        <div className="md:col-span-3 space-y-3">

                            {/* Error message */}
                            {isError && (
                                <div className="rounded-lg border border-danger/20 bg-danger-surface p-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-danger mt-0.5 flex-shrink-0" />
                                        <div>
                                            <div className="text-sm font-medium text-danger">{item.error}</div>
                                            {result?.debug_info && (
                                                <div className="text-xs text-muted mt-1 font-mono">
                                                    Dark: {((result.debug_info.percent_near_black || 0) * 100).toFixed(1)}% · Bright: {((result.debug_info.bright_area_ratio || 0) * 100).toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Metrics Grid */}
                            {isDone && metrics && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    <MetricTile
                                        icon={Shield} label="Black Box"
                                        value={result.is_black_box ? '✓ PASS' : '✗ FAIL'}
                                        danger={!result.is_black_box}
                                    />
                                    <MetricTile
                                        icon={Droplets} label="Core Area"
                                        value={fmtInt(metrics.core_area_px) + ' px'}
                                        tooltip="Pixel count of the core region used for intensity calculations."
                                    />
                                    <MetricTile
                                        icon={Activity} label="Rel. Intensity"
                                        value={fmt(metrics.integrated_norm, 2)}
                                        accent
                                        tooltip="integrated_norm = total blue / (shutter × ISO/100). Primary comparability metric."
                                    />
                                    <MetricTile
                                        icon={Gauge} label="Mean (Core)"
                                        value={fmt(metrics.mean_linear_core)}
                                        tooltip="Mean blue channel value in linear space inside core mask."
                                    />
                                    <MetricTile
                                        icon={Gauge} label="Max (Core)"
                                        value={fmt(metrics.max_linear_core)}
                                        tooltip="Maximum blue channel in core mask."
                                    />
                                    <MetricTile
                                        icon={Activity} label="P99.5"
                                        value={fmt(metrics.p99_5_linear_core)}
                                        tooltip="99.5th percentile — robust max proxy."
                                    />
                                    <MetricTile
                                        icon={Gauge} label="Mean Norm"
                                        value={metrics.mean_norm != null ? fmt(metrics.mean_norm) : 'N/A'}
                                        tooltip="mean_linear_core / (shutter × ISO/100)"
                                    />
                                    <MetricTile
                                        icon={Activity} label="Max Norm"
                                        value={metrics.max_norm != null ? fmt(metrics.max_norm) : 'N/A'}
                                        tooltip="max_linear_core / (shutter × ISO/100)"
                                    />
                                    <MetricTile
                                        icon={AlertTriangle} label="Saturation"
                                        value={(metrics.saturation_ratio * 100).toFixed(1) + '%'}
                                        warn={metrics.saturation_warning}
                                    />
                                </div>
                            )}

                            {/* Warnings */}
                            {isDone && result?.warnings?.length > 0 && (
                                <div className="space-y-1.5">
                                    {result.warnings.map((w, i) => (
                                        <div key={i} className="rounded-lg border border-warn/20 bg-warn-surface p-2.5 flex items-center gap-2">
                                            <AlertTriangle size={13} className="text-warn flex-shrink-0" />
                                            <span className="text-xs text-warn">{w}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* JPEG caveat */}
                            {isDone && captureMode === 'jpeg' && (
                                <div className="rounded-lg border border-accent/15 bg-accent-surface p-2.5 flex items-center gap-2">
                                    <Info size={13} className="text-accent-glow flex-shrink-0" />
                                    <span className="text-[11px] text-slate-400">
                                        <strong className="text-slate-300">JPEG mode:</strong> phone ISP may apply tone mapping / HDR. For maximum comparability across captures, use RAW mode.
                                    </span>
                                </div>
                            )}

                            {/* Metric explainer */}
                            {isDone && (
                                <div className="text-[10px] text-muted leading-relaxed px-1">
                                    <strong>Rel. Intensity</strong> = total blue in core / exposure.
                                    <strong className="ml-2">Mean</strong> = per-pixel brightness.
                                    <strong className="ml-2">Integrated</strong> = total brightness (often matches perception).
                                </div>
                            )}

                            {/* Debug Info */}
                            {debugMode && result?.debug_info && (
                                <div className="rounded-lg border border-border bg-surface-0 p-2.5">
                                    <div className="text-[10px] text-muted uppercase tracking-widest mb-1">Debug</div>
                                    <div className="text-xs font-mono text-muted-dim leading-relaxed whitespace-pre-wrap">
                                        {JSON.stringify(result.debug_info, null, 2)}
                                    </div>
                                </div>
                            )}

                            {/* ─── Per-Image Overrides ─── */}
                            {(isDone || isError) && (
                                <div className="rounded-lg border border-border bg-surface-0 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-muted uppercase tracking-widest font-semibold">Override Params</span>
                                        <button
                                            onClick={() => onRetry(item.id)}
                                            className="text-[11px] text-accent hover:text-accent-glow transition-colors font-medium"
                                        >
                                            Re-calculate →
                                        </button>
                                    </div>

                                    {/* Sensitivity slider */}
                                    <div>
                                        <label className="text-[10px] text-muted uppercase tracking-widest font-semibold block mb-1">
                                            Sensitivity <span className="text-muted-dim font-normal normal-case tracking-normal">({effectiveSensitivity})</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0" max="100" step="1"
                                            className="w-full h-1.5 bg-surface-1 rounded-full appearance-none cursor-pointer
                                                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                                                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md
                                                       [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-0"
                                            value={effectiveSensitivity}
                                            onChange={handleSensitivitySlider}
                                        />
                                        <div className="flex justify-between text-[9px] text-muted mt-0.5">
                                            <span>Permissive</span><span>Strict</span>
                                        </div>
                                    </div>

                                    {/* Other overrides */}
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Shutter (s)"
                                            className="input-field !py-1.5 !text-xs"
                                            value={localOverrides.t || ''}
                                            onChange={(e) => handleOverrideChange('t', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="ISO"
                                            className="input-field !py-1.5 !text-xs"
                                            value={localOverrides.iso || ''}
                                            onChange={(e) => handleOverrideChange('iso', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
