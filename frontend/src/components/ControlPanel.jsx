import React from 'react';
import { Play, Trash2, FileDown, Bug, Zap, Camera } from 'lucide-react';

export function ControlPanel({
    onStart,
    onClear,
    onExport,
    globalSettings,
    setGlobalSettings,
    captureMode,
    setCaptureMode,
    debugMode,
    setDebugMode,
    queueLength,
    isProcessing,
    doneCount,
    dirtyCount,
}) {
    return (
        <aside className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0">
            <div className="card p-5 space-y-6 sticky top-24">

                {/* ─── Capture Mode Toggle ─── */}
                <div>
                    <h2 className="section-title flex items-center gap-2 mb-3">
                        <Camera size={12} className="text-accent-glow" />
                        Capture Mode
                    </h2>
                    <div className="grid grid-cols-2 gap-1.5 bg-surface-0 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setCaptureMode('jpeg')}
                            className={`text-xs font-semibold rounded-md py-2 transition-all ${captureMode === 'jpeg'
                                    ? 'bg-accent text-white shadow-md'
                                    : 'text-muted hover:text-slate-300'
                                }`}
                        >
                            JPEG / HEIC
                        </button>
                        <button
                            onClick={() => setCaptureMode('raw')}
                            className={`text-xs font-semibold rounded-md py-2 transition-all ${captureMode === 'raw'
                                    ? 'bg-accent text-white shadow-md'
                                    : 'text-muted hover:text-slate-300'
                                }`}
                        >
                            RAW / DNG
                        </button>
                    </div>
                    <p className="text-[9px] text-muted mt-1.5">
                        {captureMode === 'jpeg'
                            ? 'sRGB → linear conversion applied. Phone ISP may affect comparability.'
                            : 'Linear decode — no gamma correction. Requires rawpy.'}
                    </p>
                </div>

                <div className="h-px bg-border" />

                {/* ─── Acquisition Parameters ─── */}
                <div>
                    <h2 className="section-title flex items-center gap-2 mb-4">
                        <Zap size={12} className="text-accent-glow" />
                        Acquisition Parameters
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="field-label">Shutter Speed (s)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.t || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, t: parseFloat(e.target.value) || '' })}
                                placeholder="0.0167 (≈1/60)"
                                step="0.001"
                            />
                            <p className="text-[9px] text-muted mt-0.5">e.g. 1/60 = 0.0167, 1/30 = 0.0333</p>
                        </div>

                        <div>
                            <label className="field-label">ISO</label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.iso || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, iso: parseFloat(e.target.value) || '' })}
                                placeholder="800"
                            />
                        </div>

                        <div>
                            <label className="field-label">Aperture f/ <span className="text-muted-dim font-normal normal-case tracking-normal">(optional)</span></label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.f || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, f: parseFloat(e.target.value) || '' })}
                                placeholder="2.8"
                                step="0.1"
                            />
                        </div>

                        <div>
                            <label className="field-label">
                                Sensitivity
                                <span className="text-muted-dim font-normal normal-case tracking-normal ml-1">({globalSettings.sensitivity ?? 50})</span>
                            </label>
                            <input
                                type="range"
                                min="0" max="100" step="1"
                                className="w-full h-1.5 bg-surface-1 rounded-full appearance-none cursor-pointer
                                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md
                                           [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-0
                                           [&::-webkit-slider-thumb]:hover:bg-accent-glow [&::-webkit-slider-thumb]:transition-colors"
                                value={globalSettings.sensitivity ?? 50}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, sensitivity: parseInt(e.target.value) })}
                            />
                            <div className="flex justify-between text-[9px] text-muted mt-1">
                                <span>Permissive</span><span>Strict</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-border" />

                {/* ─── Debug Toggle ─── */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none" htmlFor="debug-toggle">
                        <Bug size={14} />
                        Debug Mode
                    </label>
                    <button
                        id="debug-toggle"
                        role="switch"
                        aria-checked={debugMode}
                        onClick={() => setDebugMode(!debugMode)}
                        className={`relative w-10 h-[22px] rounded-full transition-colors duration-200
                            ${debugMode ? 'bg-accent' : 'bg-surface-4'}`}
                    >
                        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-md
                            transition-transform duration-200
                            ${debugMode ? 'left-[22px]' : 'left-[3px]'}`} />
                    </button>
                </div>

                <div className="h-px bg-border" />

                {/* ─── Actions ─── */}
                <div className="space-y-2.5">
                    <button
                        onClick={onStart}
                        disabled={queueLength === 0 || isProcessing}
                        className="btn-primary w-full"
                    >
                        <Play size={16} />
                        {isProcessing ? 'Processing…' : dirtyCount > 0 ? `Process ${dirtyCount} Dirty` : 'Process Queue'}
                    </button>

                    <button
                        onClick={onClear}
                        disabled={queueLength === 0 || isProcessing}
                        className="btn-secondary w-full"
                    >
                        <Trash2 size={15} />
                        Clear All
                    </button>

                    <button
                        onClick={onExport}
                        disabled={doneCount === 0}
                        className="btn-outline w-full"
                    >
                        <FileDown size={15} />
                        Export Results
                    </button>
                </div>

                {/* ─── Queue Stats ─── */}
                {queueLength > 0 && (
                    <>
                        <div className="h-px bg-border" />
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                                <div className="text-lg font-semibold text-slate-200 font-mono">{queueLength}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Total</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-accent-glow font-mono">{doneCount}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Done</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-warn font-mono">{dirtyCount}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Dirty</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-muted font-mono">{queueLength - doneCount - dirtyCount}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Pending</div>
                            </div>
                        </div>
                    </>
                )}

            </div>
        </aside>
    );
}
