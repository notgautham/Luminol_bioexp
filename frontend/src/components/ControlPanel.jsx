import React from 'react';
import { Upload, Play, Trash2, FileJson, ToggleLeft, ToggleRight, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function ControlPanel({
    onUpload,
    onStart,
    onClear,
    onExport,
    globalSettings,
    setGlobalSettings,
    debugMode,
    setDebugMode,
    queueLength,
    isProcessing,
    fileInputRef
}) {
    return (
        <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 p-4 shadow-xl">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">

                {/* Upload & Actions */}
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <Upload size={18} />
                        <span className="hidden sm:inline">Add Images</span>
                        <span className="inline sm:hidden">Add</span>
                    </button>

                    <button
                        onClick={onStart}
                        disabled={queueLength === 0 || isProcessing}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                            isProcessing
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : queueLength > 0
                                    ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        )}
                    >
                        <Play size={18} className={isProcessing ? "animate-pulse" : ""} />
                        <span>{isProcessing ? "Processing..." : "Start"}</span>
                    </button>

                    <button
                        onClick={onClear}
                        disabled={queueLength === 0 || isProcessing}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-30"
                        title="Clear Queue"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>

                {/* Global Settings */}
                <div className="flex gap-4 items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                    <div className="flex gap-3">
                        <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Exposure (s)</label>
                            <input
                                type="number"
                                value={globalSettings.t}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, t: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g. 10"
                                className="bg-transparent text-slate-200 text-sm font-mono w-20 outline-none border-b border-slate-700 focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="w-px bg-slate-800 self-stretch my-1"></div>
                        <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ISO</label>
                            <input
                                type="number"
                                value={globalSettings.iso}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, iso: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g. 800"
                                className="bg-transparent text-slate-200 text-sm font-mono w-20 outline-none border-b border-slate-700 focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="w-px bg-slate-800 self-stretch my-1"></div>
                        <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Aperture (f/)</label>
                            <input
                                type="number"
                                value={globalSettings.f || ''}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, f: parseFloat(e.target.value) || '' })}
                                placeholder="Optional"
                                className="bg-transparent text-slate-200 text-sm font-mono w-20 outline-none border-b border-slate-700 focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Toggles & Meta */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setDebugMode(!debugMode)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            debugMode
                                ? "bg-amber-950/30 border-amber-800 text-amber-500"
                                : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600"
                        )}
                    >
                        {debugMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        Debug Mode
                    </button>

                    <button
                        onClick={onExport}
                        disabled={queueLength === 0}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <FileDown size={20} />
                    </button>
                </div>

            </div>
        </div>
    );
}
