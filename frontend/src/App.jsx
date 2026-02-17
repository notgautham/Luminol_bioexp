import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload } from 'lucide-react';
import { ControlPanel } from './components/ControlPanel';
import { QueueItem } from './components/QueueItem';

const API_URL = "http://localhost:8000";

function App() {
    // State
    const [queue, setQueue] = useState([]);
    const [globalSettings, setGlobalSettings] = useState({ t: 10, iso: 800, f: '' });
    const [debugMode, setDebugMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    // Handlers
    const handleFiles = (files) => {
        const newItems = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending',
            progress: 0,
            result: null,
            error: null,
            preview: URL.createObjectURL(file),
            globalSettingsUsed: { ...globalSettings },
            overrides: {}
        }));
        setQueue(prev => [...prev, ...newItems]);
    };

    const clearQueue = () => {
        // Revoke URLs to avoid memory leaks
        queue.forEach(i => URL.revokeObjectURL(i.preview));
        setQueue([]);
    };

    const removeItem = (id) => {
        setQueue(prev => prev.filter(i => i.id !== id));
    };

    const updateItemSettings = (id, newSettings) => {
        setQueue(prev => prev.map(i => i.id === id ? { ...i, overrides: newSettings } : i));
    };

    const processQueue = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        // Find pending items
        const pendingItems = queue.filter(i => i.status === 'pending' || i.status === 'error'); // Re-run errors too if explicit? No, only explicit retry.
        // Actually, "Start" usually means start pending.
        // Let's filter for 'pending'.
        const itemsToProcess = queue.filter(i => i.status === 'pending');

        for (const item of itemsToProcess) {
            await processSingleItem(item);
        }
        setIsProcessing(false);
    };

    const retryItem = async (id) => {
        const item = queue.find(i => i.id === id);
        if (!item) return;

        // Reset status
        setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'pending', error: null, result: null, progress: 0 } : i));

        // Process immediately
        // Note: This effectively pauses the main queue loop if it's running, or runs parallel if we didn't lock.
        // For simplicity in this "local only" single-thead feel, let's just mark pending and trigger queue if not running.
        if (!isProcessing) {
            processQueue(); // Will pick it up
        }
    };

    // Effect to trigger processing if we just added a retry item and backend is idle?
    // Better: Just make retryItem call processSingleItem directly, but lock global processing.
    // Ideally we use a proper queue manager effect. For now, manual trigger is safer.
    // Let's change retryItem to just set to pending, and user hits Start, OR we call processQueue.
    // Refined: retryItem sets to pending and calls processQueue() which checks isProcessing.

    const processSingleItem = async (item) => {
        // Update status to processing
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 10 } : i));

        // Simulate progress steps for UX
        const updateProgress = (val) => {
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: val } : i));
        };

        setTimeout(() => updateProgress(30), 400); // 30% - pre-processing

        const formData = new FormData();
        formData.append('image', item.file);

        // Determine settings: Override > Item Snapshot > Current Global
        // Actually, when item added, it snapshot global. Override overrides that.
        const settingsToUse = {
            t: item.overrides?.t || item.globalSettingsUsed?.t || globalSettings.t,
            iso: item.overrides?.iso || item.globalSettingsUsed?.iso || globalSettings.iso
        };

        formData.append('exposure_time', settingsToUse.t);
        formData.append('iso', settingsToUse.iso);

        try {
            // 60% - Analysis start
            setTimeout(() => updateProgress(60), 800);

            const response = await axios.post(`${API_URL}/analyze`, formData);
            const data = response.data;

            updateProgress(90); // Formatting result

            // Small delay to show 100%
            await new Promise(r => setTimeout(r, 200));

            if (data.status === 'success') {
                setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', progress: 100, result: data } : i));
            } else {
                setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', progress: 100, error: data.message, result: data } : i));
            }
        } catch (err) {
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', progress: 100, error: err.message || "Network Error" } : i));
        }
    };

    const exportCSV = () => {
        if (queue.length === 0) return;
        const headers = ["Filename", "BlackBox", "BlueDetected", "MaxBlueRaw", "NormalizedInt", "ExposureTime", "ISO", "Status", "Error"];
        const rows = queue.map(item => {
            const settings = item.overrides?.t ? item.overrides : item.globalSettingsUsed;
            return [
                item.file.name,
                item.result?.is_black_box ? "Yes" : "No",
                item.result?.blue_detected ? "Yes" : "No",
                item.result?.metrics?.max_blue_raw || "",
                item.result?.metrics?.normalized_intensity || "",
                item.result?.metrics?.exposure_time_used || settings?.t,
                item.result?.metrics?.iso_used || settings?.iso,
                item.status,
                item.error || ""
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "luminol_analysis_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">

            {/* 1. Header & Controls */}
            <div className="flex flex-col">
                <header className="bg-slate-950 border-b border-slate-900 px-6 py-4 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                            Luminol Analysis
                        </h1>
                        <p className="text-xs text-slate-600 font-medium tracking-wide">LOCAL BIO-LUMINESCENCE QUANTIFICATION</p>
                    </div>
                    <div className="text-[10px] text-slate-700 font-mono hidden sm:block">
                        v1.0.0 • Local Processing
                    </div>
                </header>

                <ControlPanel
                    onUpload={handleFiles}
                    onStart={processQueue}
                    onClear={clearQueue}
                    onExport={exportCSV}
                    globalSettings={globalSettings}
                    setGlobalSettings={setGlobalSettings}
                    debugMode={debugMode}
                    setDebugMode={setDebugMode}
                    queueLength={queue.length}
                    isProcessing={isProcessing}
                    fileInputRef={fileInputRef}
                />
            </div>

            {/* 2. Main Content Area */}
            <main className="max-w-5xl mx-auto p-6 md:p-8">

                <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => handleFiles(e.target.files)}
                />

                {/* Empty State / Drop Zone */}
                {queue.length === 0 ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            handleFiles(e.dataTransfer.files);
                        }}
                        className="border-2 border-dashed border-slate-800 rounded-2xl h-[60vh] flex flex-col items-center justify-center text-center hover:border-blue-500/30 hover:bg-slate-900/40 transition-all cursor-pointer group"
                    >
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/50 group-hover:scale-105 transition-transform">
                            <Upload className="text-slate-600 group-hover:text-blue-400 w-8 h-8 transition-colors" />
                        </div>
                        <h3 className="text-2xl font-light text-slate-400">Drop experiment images here</h3>
                        <p className="text-slate-600 mt-2">Supports JPG, PNG, TIFF</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Queue ({queue.length})</h2>
                            <div className="text-xs text-slate-600">
                                {queue.filter(i => i.status === 'success').length} Done • {queue.filter(i => i.status === 'pending').length} Pending
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pb-20">
                            {queue.map(item => (
                                <QueueItem
                                    key={item.id}
                                    item={item}
                                    onRemove={removeItem}
                                    onRetry={retryItem}
                                    onUpdateSettings={updateItemSettings}
                                    debugMode={debugMode}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
