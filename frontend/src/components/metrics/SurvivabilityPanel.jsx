import React, { useState, useEffect, useMemo } from 'react';
import CountUp from 'react-countup';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { RotateCcw, AlertTriangle, ShieldCheck, Activity, TerminalSquare, AlertCircle, Satellite } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);

export default function SurvivabilityPanel({ messages }) {
    const [data, setData] = useState(null);
    const [history, setHistory] = useState([]);
    const [eventFeed, setEventFeed] = useState([]);
    const [isComputing, setIsComputing] = useState(false);

    // Fetch initial state
    useEffect(() => {
        fetch(`http://${window.location.hostname}:9000/api/survivability/last`)
            .then(res => res.json())
            .then(resData => {
                if (resData && resData.survival_probability !== undefined) {
                    setData(resData);
                    setHistory([{ val: resData.survival_probability, trigger: 'BASELINE' }]);
                }
            })
            .catch(err => console.error("Failed to load survivability init:", err));
    }, []);

    // Listen to WebSocket Updates
    useEffect(() => {
        if (!messages || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        if (lastMsg.type === 'SURVIVABILITY_UPDATE') {
            const ev = lastMsg.data;

            // Re-fetch data behind the scenes
            fetch(`http://${window.location.hostname}:9000/api/survivability/last`)
                .then(res => res.json())
                .then(resData => {
                    setData(resData);
                    setHistory(prev => {
                        const newHist = [...prev, { val: resData.survival_probability, trigger: ev.trigger }];
                        return newHist.slice(-10); // Keep last 10
                    });
                });

            // Add to event feed
            setEventFeed(prev => {
                const newFeed = [{
                    id: Date.now(),
                    timestamp: new Date(ev.timestamp).toLocaleTimeString(),
                    trigger: ev.trigger,
                    oldVal: ev.previous_survival,
                    newVal: ev.new_survival,
                    delta: ev.delta,
                    direction: ev.direction
                }, ...prev];
                return newFeed.slice(0, 20); // Keep max 20
            });
        }
    }, [messages]);

    const handleManualRerun = async () => {
        setIsComputing(true);
        try {
            const res = await fetch(`http://${window.location.hostname}:9000/api/survivability/run`, {
                method: 'POST'
            });
            const resData = await res.json();
            setData(resData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsComputing(false);
        }
    };

    if (!data) {
        return (
            <div className="text-white flex items-center justify-center p-10 flex-col gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-cyan-500 animate-spin"></div>
                <div>Initializing Reliability Model...</div>
            </div>
        );
    }

    const survivalPct = data.survival_probability * 100;
    const isCritical = survivalPct < 99.0;
    const isWarn = survivalPct < 99.999 && survivalPct >= 99.0;
    const colorClass = isCritical ? 'text-[#FF2222]' : isWarn ? 'text-[#FFB300]' : 'text-[#00FF88]';
    const arcColor = isCritical ? '#FF2222' : isWarn ? '#FFB300' : '#00FF88';

    // Doughnut Chart Data
    const donutData = {
        labels: ['Node', 'Plane', 'Flare', 'Corrupt'],
        datasets: [{
            data: [
                data.failure_breakdown?.node || 0,
                data.failure_breakdown?.plane || 0,
                data.failure_breakdown?.flare || 0,
                data.failure_breakdown?.corrupt || 0
            ],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    // Sparkline Chart Data
    const sparklineData = {
        labels: history.map((_, i) => i.toString()),
        datasets: [{
            label: 'Survival %',
            data: history.map(h => h.val * 100),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f620',
            borderWidth: 2,
            pointBackgroundColor: history.map(h => {
                if (h.trigger.includes('RESTORE')) return '#00FF88';
                if (h.trigger.includes('FLARE')) return '#FF6600';
                if (h.trigger.includes('FAILURE') || h.trigger.includes('ROT')) return '#FF2222';
                return '#3b82f6';
            }),
            pointRadius: 4,
            tension: 0.3,
            fill: true
        }]
    };

    return (
        <div className="w-full h-full max-w-[1600px] flex flex-col gap-6 text-gray-200 font-sans p-2">

            {/* Split layout: Main Content (Hero + Row) vs Sidebar */}
            <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden">

                {/* Left Column */}
                <div className="flex-[3] flex flex-col gap-6 min-w-0">

                    {/* ZONE 1 - Hero Panel */}
                    <div className="bg-[#111827] border border-cyan-500/30 p-8 rounded-3xl shrink-0 flex flex-col items-center relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] group">

                        <div className="absolute top-6 left-6 flex items-center gap-2">
                            <Satellite className="text-cyan-500 animate-pulse" size={20} />
                            <span className="font-mono text-xs uppercase tracking-widest text-cyan-500">Orbital Reliability Simulator</span>
                        </div>

                        <button
                            disabled={isComputing}
                            onClick={handleManualRerun}
                            className="absolute top-5 right-6 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            <RotateCcw size={14} className={isComputing ? 'animate-spin' : ''} />
                            {isComputing ? 'Computing... 10k runs' : 'Re-Run Model'}
                        </button>

                        {/* Title and Badge Container */}
                        <div className="mt-12 mb-4 flex flex-col items-center gap-4 relative">
                            {isCritical && (
                                <span className="bg-red-600/20 text-red-500 border border-red-500/50 px-3 py-1 rounded text-sm font-bold animate-pulse inline-flex items-center gap-2">
                                    <AlertTriangle size={16} /> CRITICAL
                                </span>
                            )}
                            <h1 className={`text-5xl lg:text-7xl font-bold tracking-tight leading-none drop-shadow-[0_0_15px_currentColor] transition-all duration-500 ${colorClass}`}>
                                <CountUp
                                    end={survivalPct}
                                    decimals={5}
                                    duration={0.8}
                                    preserveValue
                                />%
                            </h1>
                        </div>

                        <p className="text-gray-400 text-sm font-light tracking-wide mb-8 uppercase">Data Survival Probability • 24-Hour Mission Window</p>

                        {/* Comparison Table Grid */}
                        <div className="grid grid-cols-2 w-full max-w-2xl border border-white/10 rounded-xl overflow-hidden bg-[#0A0E1A]">
                            <div className="p-4 border-r border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-green-500/5 z-0" />
                                <div className="relative z-10 text-center">
                                    <h3 className="text-xs text-green-400 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-2"><ShieldCheck size={14} /> RS Erasure Code</h3>
                                    <p className="text-2xl font-bold text-white my-1">{survivalPct.toFixed(5)}%</p>
                                    <p className="text-xs text-gray-500 font-mono">Failures: {data.failure_count}/{data.total_simulations}</p>
                                </div>
                            </div>
                            <div className="p-4 flex flex-col items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-red-500/5 z-0" />
                                <div className="relative z-10 text-center">
                                    <h3 className="text-xs text-red-400 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-2"><AlertTriangle size={14} /> 3× Replication Base</h3>
                                    <p className="text-2xl font-bold text-gray-300 my-1">{data.baseline_replication_survival !== undefined ? (data.baseline_replication_survival * 100).toFixed(2) : '---'}%</p>
                                    <p className="text-xs text-gray-500 font-mono">Failures: {data.baseline_failures !== undefined ? data.baseline_failures : '---'}/{data.total_simulations}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-cyan-400 text-sm font-bold tracking-widest uppercase bg-cyan-500/10 px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-cyan-500/20">
                                Risk Reduction Factor ▲ {(data.risk_reduction_factor === Infinity || data.risk_reduction_factor === undefined ? '> 1000' : data.risk_reduction_factor.toFixed(1))}×
                            </p>
                            <div className="text-[10px] text-gray-500 mt-3 font-mono">
                                Last Trigger: {history.length > 0 ? history[history.length - 1].trigger : 'NONE'} &nbsp;•&nbsp; Computed in {data.simulation_duration_ms?.toFixed(1) || '---'}ms
                            </div>
                        </div>
                    </div>

                    {/* ZONE 2 - Analytics Row */}
                    <div className="grid grid-cols-4 gap-4 flex-1 min-h-[220px]">

                        {/* Card 1: Chunk Health */}
                        <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col relative group shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                            <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-3">Chunk Health</h3>
                            <div className="flex-1 flex flex-col justify-center gap-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                        <span>Perfect (10/10)</span>
                                        <span>{((data.state_distribution?.perfect || 0) / data.total_simulations * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(data.state_distribution?.perfect || 0) / data.total_simulations * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                        <span>Degraded (K-N)</span>
                                        <span>{((data.state_distribution?.degraded || 0) / data.total_simulations * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500" style={{ width: `${(data.state_distribution?.degraded || 0) / data.total_simulations * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                        <span>Lost (&lt;K)</span>
                                        <span>{((data.state_distribution?.lost || 0) / data.total_simulations * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500" style={{ width: `${(data.state_distribution?.lost || 0) / data.total_simulations * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-[10px] text-gray-500 border-t border-white/5 pt-2 font-mono">Avg Lost: {data.avg_chunks_lost?.toFixed(2) || '---'} chunks</div>
                        </div>

                        {/* Card 2: Worst Case */}
                        <div className={`bg-[#111827] border p-5 rounded-2xl flex flex-col items-center justify-center text-center relative shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${data.worst_case_chunks_lost > (data.config.total_chunks - data.config.recovery_threshold) ? 'border-red-500/50 bg-red-500/5' : 'border-white/5'}`}>
                            <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4 absolute top-5">Worst Case</h3>

                            <div className="mt-6 font-mono">
                                <span className={`text-4xl font-bold block mb-1 ${data.worst_case_chunks_lost > (data.config.total_chunks - data.config.recovery_threshold) ? 'text-red-500' : 'text-white'}`}>
                                    {data.worst_case_chunks_lost} <span className="text-xl text-gray-500">lost</span>
                                </span>
                                <span className="text-[10px] text-gray-400 font-sans tracking-wide">in worst observed mission</span>
                            </div>

                            {data.worst_case_chunks_lost > (data.config.total_chunks - data.config.recovery_threshold) ? (
                                <p className="text-[10px] mt-4 text-red-500 bg-red-500/10 px-2 py-1 rounded inline-flex items-center gap-1 font-bold whitespace-nowrap"><AlertCircle size={10} /> Unrecoverable scenario hit</p>
                            ) : (
                                <p className="text-[10px] mt-4 text-green-500 bg-green-500/10 px-2 py-1 rounded inline-flex items-center gap-1 font-bold whitespace-nowrap"><ShieldCheck size={10} /> File remained recoverable</p>
                            )}
                        </div>

                        {/* Card 3: Risk Breakdown */}
                        <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col relative">
                            <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2">Risk Breakdown</h3>
                            <div className="flex-1 w-full flex items-center justify-center relative min-h-[100px]">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Activity size={24} className="text-gray-700 opacity-30" />
                                </div>
                                <div className="h-full max-h-[140px] aspect-square">
                                    <Doughnut data={donutData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 mx-auto">
                                <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-sm"></div>Node</div>
                                <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-purple-500 rounded-sm"></div>Plane</div>
                                <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-sm"></div>Flare</div>
                                <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div>Corrupt</div>
                            </div>
                        </div>

                        {/* Card 4: Survival History Sparkline */}
                        <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col">
                            <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2">Survival History</h3>
                            <div className="flex-1 w-full min-h-[120px] relative">
                                <Line
                                    data={sparklineData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false }, tooltip: { enabled: true } },
                                        scales: {
                                            x: { display: false },
                                            y: { display: false, min: 98, max: 100 }
                                        }
                                    }}
                                />
                            </div>
                            <div className="mt-2 text-[10px] text-center text-gray-500 font-mono">Last 10 runs</div>
                        </div>

                    </div>
                </div>

                {/* ZONE 3 - Event Feed Sidebar */}
                <div className="flex-1 min-w-[320px] bg-[#111827] border border-white/5 p-6 rounded-3xl flex flex-col shadow-2xl overflow-hidden shrink-0">
                    <div className="flex items-center gap-2 mb-6 shadow-sm pb-4 border-b border-white/5">
                        <TerminalSquare className="text-purple-400" size={18} />
                        <h2 className="text-sm text-gray-300 font-bold tracking-widest uppercase">Survivability Log</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {eventFeed.length === 0 ? (
                            <div className="text-center text-gray-600 font-mono text-sm mt-10">Awaiting system events...</div>
                        ) : (
                            eventFeed.map(ev => {
                                const isDrop = ev.direction === "DOWN";
                                const isRise = ev.direction === "UP";
                                return (
                                    <div key={ev.id} className="bg-[#0A0E1A] border border-white/5 rounded-xl p-3 shadow-inner hover:border-white/10 transition-colors animate-fade-in-down">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] text-gray-500 font-mono">{ev.timestamp}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isDrop ? 'bg-red-500/20 text-red-500' : isRise ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                                {ev.trigger}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-mono">
                                            <div className="text-gray-400 flex flex-col">
                                                <span>{(ev.oldVal * 100).toFixed(4)}% <span className="text-gray-600">→</span></span>
                                                <span className="text-gray-200">{(ev.newVal * 100).toFixed(4)}%</span>
                                            </div>
                                            <div className={`font-bold ${isDrop ? 'text-red-500' : isRise ? 'text-green-500' : 'text-gray-500'}`}>
                                                {ev.direction === 'DOWN' ? '▼' : ev.direction === 'UP' ? '▲' : ''} {(ev.delta * 100).toFixed(4)}%
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* ZONE 4 - Bottom Status Bar */}
            <div className="h-8 shrink-0 bg-cyan-900/20 border border-cyan-500/20 rounded-lg flex items-center justify-between px-6 font-mono text-[10px] text-cyan-300/70 tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <div className="flex gap-6">
                    <span>COSMEON RELIABILITY MODEL</span>
                    <span>SIMULATIONS: {data.config.num_simulations.toLocaleString()}</span>
                    <span>RS(K={data.config.recovery_threshold}, N={data.config.total_chunks})</span>
                    <span>MISSION WINDOW: {data.config.mission_hours}h</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span>ENGINE: MONTE CARLO v1.0</span>
                    <span className="text-gray-600 px-2">|</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                    <span className="text-green-400">LIVE</span>
                </div>
            </div>

        </div>
    );
}
