import React, { useRef } from 'react';
import { X, Download, TrendingUp } from 'lucide-react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

export function GraphModal({ queue, onClose }) {
    const chartRef = useRef(null);

    // Filter queue to only items that have succeeded and have an h2o2 value
    const dataPoints = queue
        .filter(item => item.status === 'success' && item.h2o2 !== '' && item.h2o2 != null)
        .map(item => ({
            x: parseFloat(item.h2o2),
            y: item.result?.metrics?.integrated_norm || 0,
            label: item.file.name
        }));

    const chartData = {
        datasets: [
            {
                label: 'Relative Intensity vs H₂O₂',
                data: dataPoints,
                backgroundColor: 'rgba(99, 102, 241, 1)', // accent-glow color
                borderColor: 'rgba(99, 102, 241, 0.5)',
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: true, // connects the points in queue order
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const point = dataPoints[context.dataIndex];
                        return `${point.label}: ${point.y.toFixed(2)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: {
                    display: true,
                    text: 'H₂O₂ Concentration',
                    color: '#94a3b8',
                    font: { size: 12, weight: 'bold' }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: { color: '#94a3b8' }
            },
            y: {
                title: {
                    display: true,
                    text: 'Relative Intensity',
                    color: '#94a3b8',
                    font: { size: 12, weight: 'bold' }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: { color: '#94a3b8' }
            }
        }
    };

    const handleDownload = () => {
        if (!chartRef.current) return;
        // chart.js toBase64Image returns a PNG data URI
        const url = chartRef.current.toBase64Image();
        const a = document.createElement('a');
        a.href = url;
        a.download = 'luminol_graph.png';
        a.click();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-1 border border-border rounded-xl shadow-glow w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent-glow">
                            <TrendingUp size={16} />
                        </div>
                        <h2 className="text-sm font-semibold text-slate-100">Relative Intensity Curve</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownload} className="btn-outline !py-1.5 !px-3 !text-xs flex items-center gap-1.5">
                            <Download size={14} />
                            Download PNG
                        </button>
                        <button onClick={onClose} className="p-2 text-muted hover:text-slate-200 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col h-[70vh] min-h-[400px]">
                    {dataPoints.length > 0 ? (
                        <div className="w-full flex-1 relative">
                            <Scatter ref={chartRef} data={chartData} options={options} />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted">
                            <TrendingUp size={32} className="mb-3 opacity-20" />
                            <p className="text-sm font-medium">Not enough data to graph.</p>
                            <p className="text-xs mt-1 text-center max-w-sm">
                                Please ensure images have finished processing successfully and you have entered an H₂O₂ concentration for each.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
