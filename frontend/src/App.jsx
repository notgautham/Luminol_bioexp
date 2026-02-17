import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, Beaker, Wifi, WifiOff, Microscope } from 'lucide-react';
import { ControlPanel } from './components/ControlPanel';
import { QueueItem } from './components/QueueItem';

const API_URL = 'http://localhost:8000';

function App() {
    /* ─── State ─── */
    const [queue, setQueue] = useState([]);
    const [globalSettings, setGlobalSettings] = useState({ t: '', iso: '', f: '' });
    const [debugMode, setDebugMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const doneCount = queue.filter((i) => i.status === 'success').length;

    /* ─── File Handling ─── */
    const handleFiles = (files) => {
        const newItems = Array.from(files).map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending',
            progress: 0,
            result: null,
            error: null,
            preview: URL.createObjectURL(file),
            globalSettingsUsed: { ...globalSettings },
            overrides: {},
        }));
        setQueue((prev) => [...prev, ...newItems]);
    };

    const clearQueue = () => {
        queue.forEach((i) => URL.revokeObjectURL(i.preview));
        setQueue([]);
    };

    const removeItem = (id) => {
        setQueue((prev) => prev.filter((i) => i.id !== id));
    };

    const updateItemSettings = (id, newSettings) => {
        setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, overrides: newSettings } : i)));
    };

    /* ─── Processing ─── */
    const processQueue = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        const items = queue.filter((i) => i.status === 'pending');
        for (const item of items) {
            await processSingleItem(item);
        }
        setIsProcessing(false);
    };

    const retryItem = async (id) => {
        setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'pending', error: null, result: null, progress: 0 } : i)));
        if (!isProcessing) processQueue();
    };

    const processSingleItem = async (item) => {
        const update = (patch) => setQueue((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));

        update({ status: 'processing', progress: 10 });
        setTimeout(() => update({ progress: 25 }), 300);

        const formData = new FormData();
        formData.append('image', item.file);

        const settings = {
            t: item.overrides?.t || item.globalSettingsUsed?.t || globalSettings.t,
            iso: item.overrides?.iso || item.globalSettingsUsed?.iso || globalSettings.iso,
        };
        formData.append('exposure_time', settings.t || 0);
        formData.append('iso', settings.iso || 0);

        try {
            setTimeout(() => update({ progress: 55 }), 600);
            const { data } = await axios.post(`${API_URL}/analyze`, formData);
            update({ progress: 85 });
            await new Promise((r) => setTimeout(r, 200));

            if (data.status === 'success') {
                update({ status: 'success', progress: 100, result: data });
            } else {
                update({ status: 'error', progress: 100, error: data.message, result: data });
            }
        } catch (err) {
            update({ status: 'error', progress: 100, error: err.message || 'Network Error' });
        }
    };

    /* ─── Export ─── */
    const exportCSV = () => {
        if (queue.length === 0) return;
        const headers = ['Filename', 'BlackBox', 'BlueDetected', 'MaxBlueRaw', 'MaxBlueLinear', 'NormalizedInt', 'ExposureTime', 'ISO', 'Status', 'Error'];
        const rows = queue.map((item) => {
            const s = item.overrides?.t ? item.overrides : item.globalSettingsUsed;
            return [
                item.file.name,
                item.result?.is_black_box ? 'Yes' : 'No',
                item.result?.blue_detected ? 'Yes' : 'No',
                item.result?.metrics?.max_blue_raw ?? '',
                item.result?.metrics?.max_blue_linear ?? '',
                item.result?.metrics?.normalized_intensity ?? '',
                s?.t ?? '',
                s?.iso ?? '',
                item.status,
                item.error ?? '',
            ];
        });
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'luminol_results.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ─── Drag & Drop ─── */
    const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); };

    /* ─── Render ─── */
    return (
        <div className="min-h-screen flex flex-col">

            {/* ═══════ Top Navigation Bar ═══════ */}
            <nav className="flex items-center justify-between px-6 py-3 bg-surface-1 border-b border-border sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <Microscope size={16} className="text-accent-glow" />
                    </div>
                    <div>
                        <h1 className="text-[15px] font-semibold text-slate-100 leading-tight">
                            Luminol Blue Intensity Analyzer
                        </h1>
                        <p className="text-[10px] text-muted tracking-wider uppercase">
                            Local Processing · Research Edition
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium text-success bg-success-surface border border-success/15 rounded-full px-3 py-1">
                    <WifiOff size={11} />
                    Local Mode Active
                </div>
            </nav>

            {/* ═══════ Main Dashboard ═══════ */}
            <div className="flex-1 flex flex-col lg:flex-row gap-5 p-5 max-w-[1400px] mx-auto w-full">

                {/* ─── Left: Control Panel ─── */}
                <ControlPanel
                    onStart={processQueue}
                    onClear={clearQueue}
                    onExport={exportCSV}
                    globalSettings={globalSettings}
                    setGlobalSettings={setGlobalSettings}
                    debugMode={debugMode}
                    setDebugMode={setDebugMode}
                    queueLength={queue.length}
                    isProcessing={isProcessing}
                    doneCount={doneCount}
                />

                {/* ─── Right: Queue & Results ─── */}
                <main className="flex-1 min-w-0 space-y-4">

                    {/* Hidden file input */}
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                    />

                    {/* Upload Drop Zone */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
              card cursor-pointer group transition-all duration-200
              flex flex-col items-center justify-center text-center
              ${queue.length === 0 ? 'py-20' : 'py-8'}
              ${isDragOver
                                ? 'border-accent bg-accent-surface shadow-glow'
                                : 'hover:border-border-hover hover:bg-surface-2/80'
                            }
            `}
                    >
                        <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-200
              ${isDragOver
                                ? 'bg-accent/20 scale-110'
                                : 'bg-surface-3 group-hover:bg-surface-4 group-hover:scale-105'
                            }
            `}>
                            <Upload size={20} className={`transition-colors ${isDragOver ? 'text-accent-glow' : 'text-muted group-hover:text-accent-glow'}`} />
                        </div>
                        <h3 className={`text-sm font-medium mb-1 transition-colors ${isDragOver ? 'text-accent-glow' : 'text-slate-400'}`}>
                            {isDragOver ? 'Release to add images' : 'Drop experiment images here'}
                        </h3>
                        <p className="text-[11px] text-muted">
                            JPG · PNG · TIFF — Processing happens locally
                        </p>
                    </div>

                    {/* Queue Cards */}
                    {queue.length > 0 && (
                        <div className="space-y-3">
                            {/* Queue header */}
                            <div className="flex items-center justify-between px-1">
                                <h2 className="section-title">Image Queue ({queue.length})</h2>
                                <div className="flex items-center gap-3 text-[11px] text-muted">
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                                        {doneCount} done
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-muted inline-block" />
                                        {queue.filter((i) => i.status === 'pending').length} pending
                                    </span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-2.5 pb-8">
                                {queue.map((item) => (
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
        </div>
    );
}

export default App;
