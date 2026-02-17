import React from 'react';
import { Play, Trash2, FileDown, Bug, Zap } from 'lucide-react';

export function ControlPanel({
    onStart,
    onClear,
    onExport,
    globalSettings,
    setGlobalSettings,
    debugMode,
    setDebugMode,
    queueLength,
    isProcessing,
    doneCount,
}) {
    return (
        <aside className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0">
            <div className="card p-5 space-y-6 sticky top-24">

                {/* Section: Acquisition Parameters */}
                <div>
                    <h2 className="section-title flex items-center gap-2 mb-4">
                        <Zap size={12} className="text-accent-glow" />
                        Acquisition Parameters
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="field-label">Exposure Time (s)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.t || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, t: parseFloat(e.target.value) || '' })}
                                placeholder="e.g. 10"
                                step="0.1"
                            />
                        </div>

                        <div>
                            <label className="field-label">ISO</label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.iso || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, iso: parseFloat(e.target.value) || '' })}
                                placeholder="e.g. 800"
                            />
                        </div>

                        <div>
                            <label className="field-label">Aperture f/ <span className="text-muted-dim font-normal normal-case tracking-normal">(optional)</span></label>
                            <input
                                type="number"
                                className="input-field"
                                value={globalSettings.f || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, f: parseFloat(e.target.value) || '' })}
                                placeholder="e.g. 2.8"
                                step="0.1"
                            />
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Debug Toggle */}
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
                        className={`
              relative w-10 h-[22px] rounded-full transition-colors duration-200
              ${debugMode ? 'bg-accent' : 'bg-surface-4'}
            `}
                    >
                        <span className={`
              absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-md
              transition-transform duration-200
              ${debugMode ? 'left-[22px]' : 'left-[3px]'}
            `} />
                    </button>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Actions */}
                <div className="space-y-2.5">
                    <button
                        onClick={onStart}
                        disabled={queueLength === 0 || isProcessing}
                        className="btn-primary w-full"
                    >
                        <Play size={16} />
                        {isProcessing ? 'Processing…' : 'Process Queue'}
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

                {/* Queue Stats */}
                {queueLength > 0 && (
                    <>
                        <div className="h-px bg-border" />
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <div className="text-lg font-semibold text-slate-200 font-mono">{queueLength}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Total</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-accent-glow font-mono">{doneCount}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Done</div>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-warn font-mono">{queueLength - doneCount}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Pending</div>
                            </div>
                        </div>
                    </>
                )}

            </div>
        </aside>
    );
}
