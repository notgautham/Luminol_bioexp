import React, { useState } from 'react';
import { Trash2, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Helper for warnings
const getWarnings = (result) => {
    const warnings = [];
    if (!result) return warnings;
    if (result.metrics?.saturation_warning) warnings.push({ type: 'saturation', msg: 'Saturation Detected' });
    if (!result.is_black_box) warnings.push({ type: 'blackbox', msg: 'Poor Conditions' });
    return warnings;
};

export function QueueItem({ item, onRemove, onRetry, debugMode, onUpdateSettings }) {
    const [expanded, setExpanded] = useState(false);
    const [overrideSettings, setOverrideSettings] = useState(item.overrides || {});

    // Use simulated internal stats if processing not complete, else use result
    const progressColor = item.status === 'error' ? 'bg-red-500' : item.status === 'success' ? 'bg-green-500' : 'bg-blue-500';

    const warnings = getWarnings(item.result);
    const hasWarning = warnings.length > 0;

    const handleSettingChange = (field, value) => {
        const newSettings = { ...overrideSettings, [field]: value };
        setOverrideSettings(newSettings);
        // Propagate up if this item is done, to re-calc normalization immediately? 
        // For now just save state. Real re-calc would need backend call or client-side math if raw is available.
        // We will assume Re-run is needed for full re-calc if backend does normalization.
        // Actually, optimization: if we have raw metrics, we can re-calc normalized locally!
        // Let's rely on Re-run for simplicity ensuring consistency.
        onUpdateSettings(item.id, newSettings);
    };

    return (
        <div className={cn(
            "bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300",
            expanded ? "border-blue-800 shadow-lg shadow-blue-900/10" : "border-slate-800 hover:border-slate-700"
        )}>
            {/* Header / Summary Row */}
            <div className="flex items-center p-3 gap-4 cursor-pointer hover:bg-slate-800/30 transition-colors" onClick={() => setExpanded(!expanded)}>
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded bg-black overflow-hidden flex-shrink-0 relative">
                    <img src={item.preview} alt="thumb" className="w-full h-full object-cover" />
                    {item.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <RefreshCw size={16} className="text-blue-400 animate-spin" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-200 truncate">{item.file.name}</h3>
                        {hasWarning && item.status === 'success' && (
                            <AlertTriangle size={14} className="text-yellow-500" title="Warnings detected" />
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                        <StatusBadge status={item.status} error={item.error} />
                        {item.status === 'success' && (
                            <span className="text-slate-500">• Max: {item.result.metrics?.max_blue_raw?.toFixed(0)}</span>
                        )}
                    </div>
                </div>

                {/* Progress Bars for active items */}
                {item.status === 'processing' && (
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${item.progress}%` }}></div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {item.status === 'error' || item.status === 'success' ? (
                        <button onClick={() => onRetry(item.id)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg" title="Re-run">
                            <RefreshCw size={18} />
                        </button>
                    ) : null}
                    <button onClick={() => onRemove(item.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg" title="Remove">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={() => setExpanded(!expanded)} className="p-2 text-slate-500 hover:text-slate-300 rounded-lg">
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {/* Progress Line (bottom of header) */}
            {item.status === 'processing' && (
                <div className="h-0.5 bg-slate-800 w-full">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                </div>
            )}


            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-slate-800 bg-slate-950/30 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* 1. Large Preview */}
                        <div className="relative group rounded-lg overflow-hidden border border-slate-800 bg-black min-h-[200px] flex items-center justify-center">
                            <img src={item.preview} className="max-w-full max-h-[300px] object-contain" />
                            {/* Debug Overlay */}
                            {debugMode && item.result?.debug_image && (
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center pointer-events-none">
                                    <img src={item.result.debug_image} className="absolute inset-0 w-full h-full object-contain opacity-60 mix-blend-screen" />
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-green-400 px-2 py-0.5 rounded border border-green-900/50">MASK OVERLAY</div>
                                </div>
                            )}
                            {item.status === 'error' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-red-400 text-sm font-medium">
                                    Analysis Failed
                                </div>
                            )}
                        </div>

                        {/* 2. Metrics & Data */}
                        <div className="col-span-2 space-y-4">

                            {/* Overrides */}
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex gap-4 items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase">Input Params</span>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        placeholder="Time"
                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-xs text-slate-300"
                                        value={overrideSettings.t || item.globalSettingsUsed?.t || ''}
                                        onChange={(e) => handleSettingChange('t', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="ISO"
                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-xs text-slate-300"
                                        value={overrideSettings.iso || item.globalSettingsUsed?.iso || ''}
                                        onChange={(e) => handleSettingChange('iso', e.target.value)}
                                    />
                                </div>
                                <button
                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline ml-auto"
                                    onClick={() => onRetry(item.id)}
                                >
                                    Re-calculate
                                </button>
                            </div>

                            {/* Metrics Grid */}
                            {item.status === 'success' && item.result && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <MetricTile label="Black Box" val={item.result.is_black_box ? "PASS" : "FAIL"} status={item.result.is_black_box ? "good" : "bad"} />
                                    <MetricTile label="Blue Glow" val={item.result.blue_detected ? "FOUND" : "NONE"} status={item.result.blue_detected ? "good" : "bad"} />
                                    <MetricTile label="Max Raw" val={item.result.metrics.max_blue_raw?.toFixed(0)} />
                                    <MetricTile label="Normalized" val={item.result.metrics.normalized_intensity?.toFixed(2)} active />
                                </div>
                            )}

                            {/* Detailed Logs/Errors */}
                            {(item.status === 'error' || warnings.length > 0) && (
                                <div className="bg-slate-900 p-3 rounded border border-slate-800 text-xs font-mono">
                                    {item.status === 'error' && (
                                        <div className="text-red-400 mb-2">Error: {item.error}</div>
                                    )}
                                    {warnings.map((w, idx) => (
                                        <div key={idx} className="text-yellow-500 flex items-center gap-2">
                                            <AlertTriangle size={12} /> {w.msg}
                                        </div>
                                    ))}
                                    {debugMode && item.result?.debug_info && (
                                        <div className="mt-2 pt-2 border-t border-slate-800 text-slate-500">
                                            {JSON.stringify(item.result.debug_info)}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status, error }) {
    if (status === 'pending') return <span className="text-slate-500 flex items-center gap-1"><Clock size={12} /> Pending</span>;
    if (status === 'processing') return <span className="text-blue-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Analyzing...</span>;
    if (status === 'success') return <span className="text-green-500 flex items-center gap-1"><CheckCircle size={12} /> Complete</span>;
    if (status === 'error') return <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> Failed</span>;
    return null;
}

function MetricTile({ label, val, status, active }) {
    const isGood = status === 'good';
    const isBad = status === 'bad';
    return (
        <div className={cn(
            "p-3 rounded-lg border flex flex-col justify-center",
            active ? "bg-blue-950/20 border-blue-500/30" : "bg-slate-900 border-slate-800",
            isBad ? "border-red-900/50 bg-red-950/10" : ""
        )}>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</span>
            <span className={cn(
                "text-xl font-mono font-medium",
                active ? "text-blue-400" : "text-slate-300",
                isGood ? "text-green-400" : "",
                isBad ? "text-red-400" : ""
            )}>{val}</span>
        </div>
    )
}
