import React, { useState } from 'react';
import {
    ChevronDown, ChevronUp, Trash2, RefreshCw,
    AlertTriangle, CheckCircle2, Clock, Loader2,
    Shield, Droplets, Gauge, Activity, Eye
} from 'lucide-react';

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
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
function MetricTile({ icon: Icon, label, value, accent, warn, danger }) {
    const colorClass = danger
        ? 'text-danger'
        : warn
            ? 'text-warn'
            : accent
                ? 'text-accent-glow'
                : 'text-slate-100';

    const borderClass = danger
        ? 'border-danger/20 bg-danger-surface'
        : warn
            ? 'border-warn/20 bg-warn-surface'
            : accent
                ? 'border-accent/20 bg-accent-surface'
                : 'border-border bg-surface-1';

    return (
        <div className={`rounded-lg border p-3 ${borderClass}`}>
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

/* ─── Queue Item Card ─── */
export function QueueItem({ item, onRemove, onRetry, debugMode, onUpdateSettings }) {
    const [expanded, setExpanded] = useState(false);
    const [localOverrides, setLocalOverrides] = useState(item.overrides || {});

    const isError = item.status === 'error';
    const isDone = item.status === 'success';
    const isActive = item.status === 'processing';
    const result = item.result;
    const metrics = result?.metrics;

    const hasSaturationWarning = metrics?.saturation_warning;

    const cardBorder = isError
        ? 'border-danger/30'
        : isDone
            ? 'border-border hover:border-success/20'
            : isActive
                ? 'border-accent/30'
                : 'border-border hover:border-border-hover';

    const handleOverrideChange = (field, value) => {
        const updated = { ...localOverrides, [field]: value };
        setLocalOverrides(updated);
        onUpdateSettings(item.id, updated);
    };

    return (
        <div className={`card-hover ${cardBorder} overflow-hidden`}>

            {/* ─── Header Row ─── */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Thumbnail */}
                <div className="w-11 h-11 rounded-lg bg-surface-0 overflow-hidden flex-shrink-0 border border-border relative">
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    {isActive && (
                        <div className="absolute inset-0 bg-surface-0/70 flex items-center justify-center">
                            <Loader2 size={16} className="text-accent-glow animate-spin" />
                        </div>
                    )}
                </div>

                {/* Name + Badge */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-slate-200 truncate">{item.file.name}</span>
                        {hasSaturationWarning && isDone && (
                            <AlertTriangle size={12} className="text-warn flex-shrink-0" />
                        )}
                    </div>
                    <StatusBadge status={item.status} />
                </div>

                {/* Inline metric preview */}
                {isDone && metrics && (
                    <div className="hidden sm:flex items-center gap-4 mr-2">
                        <div className="text-right">
                            <div className="text-[10px] text-muted uppercase tracking-wider">Raw</div>
                            <div className="text-sm font-mono font-semibold text-slate-200">{metrics.max_blue_raw?.toFixed(0)}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-muted uppercase tracking-wider">Norm</div>
                            <div className="text-sm font-mono font-semibold text-accent-glow">
                                {metrics.normalized_intensity != null ? metrics.normalized_intensity.toFixed(4) : '—'}
                            </div>
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
                        <div
                            className="progress-fill bg-accent"
                            style={{ width: `${item.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ─── Expanded Details ─── */}
            {expanded && (
                <div className="border-t border-border bg-surface-1/50 p-4 space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                        {/* Preview (2 cols) */}
                        <div className="md:col-span-2 relative rounded-lg overflow-hidden bg-surface-0 border border-border min-h-[180px] flex items-center justify-center">
                            <img src={item.preview} className="max-w-full max-h-[280px] object-contain" alt="" />
                            {debugMode && result?.debug_image && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img src={result.debug_image} className="absolute inset-0 w-full h-full object-contain opacity-50 mix-blend-screen" alt="" />
                                    <div className="absolute bottom-2 right-2 badge-processing !text-[9px]">
                                        <Eye size={9} /> Mask Overlay
                                    </div>
                                </div>
                            )}
                            {isError && (
                                <div className="absolute inset-0 bg-surface-0/60 flex items-center justify-center">
                                    <span className="text-danger text-sm font-medium">Analysis Failed</span>
                                </div>
                            )}
                        </div>

                        {/* Metrics (3 cols) */}
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
                                                    Dark: {(result.debug_info.percent_near_black * 100).toFixed(1)}% · Bright: {(result.debug_info.bright_area_ratio * 100).toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Metrics Grid */}
                            {isDone && metrics && (
                                <div className="grid grid-cols-2 gap-2">
                                    <MetricTile
                                        icon={Shield} label="Black Box"
                                        value={result.is_black_box ? '✓ PASS' : '✗ FAIL'}
                                        danger={!result.is_black_box}
                                    />
                                    <MetricTile
                                        icon={Droplets} label="Blue Glow"
                                        value={result.blue_detected ? '✓ FOUND' : '✗ NONE'}
                                        danger={!result.blue_detected}
                                    />
                                    <MetricTile
                                        icon={Gauge} label="Max Raw"
                                        value={metrics.max_blue_raw?.toFixed(0)}
                                    />
                                    <MetricTile
                                        icon={Activity} label="Normalized"
                                        value={metrics.normalized_intensity != null ? metrics.normalized_intensity.toFixed(4) : 'N/A'}
                                        accent
                                    />
                                </div>
                            )}

                            {/* Warnings */}
                            {isDone && hasSaturationWarning && (
                                <div className="rounded-lg border border-warn/20 bg-warn-surface p-2.5 flex items-center gap-2">
                                    <AlertTriangle size={13} className="text-warn flex-shrink-0" />
                                    <span className="text-xs text-warn">Saturation detected — intensity may be underestimated ({(metrics.saturation_ratio * 100).toFixed(1)}% clipped)</span>
                                </div>
                            )}

                            {/* Debug Info */}
                            {debugMode && result?.debug_info && (
                                <div className="rounded-lg border border-border bg-surface-0 p-2.5">
                                    <div className="text-[10px] text-muted uppercase tracking-widest mb-1">Debug</div>
                                    <div className="text-xs font-mono text-muted-dim leading-relaxed">
                                        {JSON.stringify(result.debug_info, null, 2)}
                                    </div>
                                </div>
                            )}

                            {/* Per-Image Overrides */}
                            {(isDone || isError) && (
                                <div className="rounded-lg border border-border bg-surface-0 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-muted uppercase tracking-widest font-semibold">Override Params</span>
                                        <button
                                            onClick={() => onRetry(item.id)}
                                            className="text-[11px] text-accent hover:text-accent-glow transition-colors font-medium"
                                        >
                                            Re-calculate →
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Time (s)"
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
