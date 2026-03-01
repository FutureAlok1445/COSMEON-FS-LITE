import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, AlertTriangle, ShieldAlert, Activity,
    RefreshCw, ServerCrash, ZapOff, DatabaseZap, Info, Terminal
} from 'lucide-react';

export default function ChaosOps({ messages }) {
    const [activeScenario, setActiveScenario] = useState(null);
    const [logs, setLogs] = useState([]);
    const logsEndRef = useRef(null);
    const [systemState, setSystemState] = useState({
        entropy: 1.0,
        entropyStatus: 'BALANCED',
        corruptedChunks: [],
        offlineNodes: [],
        partitionedNodes: [],
        migrations: []
    });

    const pushLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type }].slice(-50));
    };

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    useEffect(() => {
        if (!messages || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        switch (lastMsg.type) {
            case 'CHAOS_TRIGGERED':
                pushLog(lastMsg.data.message, 'warning');
                break;
            case 'NODE_OFFLINE':
                setSystemState(prev => ({
                    ...prev,
                    offlineNodes: [...new Set([...prev.offlineNodes, lastMsg.data.node_id])]
                }));
                pushLog(lastMsg.data.message, 'error');
                break;
            case 'NODE_PARTITIONED':
                setSystemState(prev => ({
                    ...prev,
                    partitionedNodes: [...new Set([...prev.partitionedNodes, lastMsg.data.node_id])]
                }));
                pushLog(lastMsg.data.message, 'warning');
                break;
            case 'CHUNK_CORRUPTED':
                setSystemState(prev => ({
                    ...prev,
                    corruptedChunks: [...prev.corruptedChunks, lastMsg.data]
                }));
                pushLog(lastMsg.data.message, 'error');
                break;
            case 'REBALANCE_START':
                pushLog(lastMsg.data.message, 'info');
                setSystemState(prev => ({ ...prev, migrations: [] }));
                break;
            case 'CHUNK_REBALANCED':
                setSystemState(prev => ({
                    ...prev,
                    migrations: [...prev.migrations, lastMsg.data]
                }));
                break;
            case 'REBALANCE_COMPLETE':
                pushLog(lastMsg.data.message, 'success');
                break;
            case 'NODE_OVERLOADED':
                pushLog(lastMsg.data.message, 'warning');
                break;
            case 'CHAOS_RESOLVED':
                setSystemState({
                    entropy: 1.0,
                    entropyStatus: 'BALANCED',
                    corruptedChunks: [],
                    offlineNodes: [],
                    partitionedNodes: [],
                    migrations: []
                });
                pushLog(lastMsg.data.message, 'success');
                setActiveScenario(null);
                break;
            case 'METRIC_UPDATE':
                if (lastMsg.data.entropy !== undefined) {
                    setSystemState(prev => ({
                        ...prev,
                        entropy: lastMsg.data.entropy,
                        entropyStatus: lastMsg.data.entropy_status || prev.entropyStatus
                    }));
                }
                break;
            default:
                break;
        }
    }, [messages]);

    const triggerChaos = async (scenario) => {
        setActiveScenario(scenario.id);
        pushLog(`Initiating Sequence: ${scenario.name.toUpperCase()}`, 'warning');

        // Slight artificial delay for dramatic effect
        await new Promise(r => setTimeout(r, 500));

        try {
            const res = await fetch(`http://${window.location.hostname}:9000/api/chaos/${scenario.id}`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to trigger chaos');
        } catch (err) {
            console.error(err);
            pushLog(`Failed to trigger ${scenario.id}: ${err.message}`, 'error');
            setActiveScenario(null);
        }
    };

    const scenarios = [
        {
            id: 'solar_flare',
            name: 'Solar Flare (Node Kill)',
            desc: 'Simulates a massive radiation burst instantly frying all nodes in Orbital Plane Beta (SAT-03, SAT-04). Tests Reed-Solomon recovery under catastrophic multi-node failure.',
            analytics: 'Monitors the system\'s ability to fetch parity chunks from Alpha and Gamma planes to reconstruct missing payloads on-the-fly when an entire orbital plane goes dark.',
            icon: Zap,
            color: 'amber'
        },
        {
            id: 'partition',
            name: 'Network Partition',
            desc: 'Simulates Earth occluding Plane Beta. Nodes are alive but unreachable from Ground Stations, forcing Delayed Tolerant Networking (DTN) queueing.',
            analytics: 'Tests the DTN bundle protocol. Nodes enter a partitioned state where writes are queued locally until line-of-sight is restored, validating edge-caching synchronization.',
            icon: ShieldAlert,
            color: 'rose'
        },
        {
            id: 'bit_rot',
            name: 'Deep Space Radiation (Bit Rot)',
            desc: 'Injects Silent Data Corruption (SEU). Flips exactly one random byte inside random chunk files on disk to test SHA-256 integrity and self-healing.',
            analytics: 'Validates zero-trust cryptography. When a corrupted chunk is read, the SHA-256 hash mismatch automatically triggers the decoder to discard it and heal via Reed-Solomon blocks.',
            icon: Activity,
            color: 'purple'
        },
        {
            id: 'imbalance',
            name: 'Entropy Collapse',
            desc: 'Instantly forces chunks onto only 2 satellites, crushing network Shannon Entropy. Triggers the automated Rebalancer to migrate chunks and equalize the load.',
            analytics: 'Tests the background Entropy Daemon. It continuously calculates the Shannon Entropy score. When it drops below 0.85, it autonomously moves files from hot nodes to cold nodes without breaking topological parity rules.',
            icon: DatabaseZap,
            color: 'blue'
        }
    ];

    const activeScenarioData = activeScenario ? scenarios.find(s => s.id === activeScenario) : null;

    return (
        <div className="w-full h-full flex items-center justify-center p-8">
            <div
                className="w-full max-w-6xl h-full max-h-[90vh] bg-[#02040a]/95 backdrop-blur-3xl border-l-4 border-b-4 border-l-red-500/50 border-b-red-500/50 border-t border-r border-t-white/10 border-r-white/10 p-8 flex flex-col rounded-none shadow-[0_20px_60px_rgba(220,38,38,0.15)] relative overflow-hidden"
                style={{ clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)' }}
            >
                {/* Background Ambience */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-end mb-6 relative z-10 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30">
                                <ServerCrash className="text-red-500" size={24} />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-wider">Chaos Operations</h1>
                        </div>
                        <p className="text-sm text-gray-400 font-mono tracking-wide max-w-2xl">
                            Controlled fault injection environment. Test resilience, Byzantine fault tolerance,
                            and automated recovery protocols under extreme deep-space hazards.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            pushLog('Initiating System Heal...', 'info');
                            fetch(`http://${window.location.hostname}:9000/api/chaos/restore`, { method: 'POST' }).catch(e => console.error(e));
                        }}
                        className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-xl font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                    >
                        <RefreshCw size={18} className="animate-spin-slow" />
                        System Heal
                    </button>
                </div>

                {/* 3-Column Layout */}
                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 relative z-10">

                    {/* Left Column - Attack Vectors */}
                    <div className="col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                        <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 px-2">
                            <Zap size={14} /> Hazard Vectors
                        </h3>
                        {scenarios.map(sc => {
                            const Icon = sc.icon;
                            const isTarget = activeScenario === sc.id;

                            const colorMap = {
                                'amber': 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500',
                                'rose': 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500',
                                'purple': 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-500',
                                'blue': 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500',
                            };

                            return (
                                <motion.div
                                    key={sc.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group focus:outline-none flex flex-col gap-3
                  ${isTarget ? 'border-white/40 bg-white/10 shadow-lg relative overflow-hidden' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}`}
                                    onClick={() => triggerChaos(sc)}
                                >
                                    {/* Active Strike Effect */}
                                    {isTarget && (
                                        <motion.div
                                            initial={{ x: '-100%' }}
                                            animate={{ x: '100%' }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
                                        />
                                    )}

                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`p-3 rounded-xl shrink-0 ${colorMap[sc.color]}`}>
                                            <Icon size={20} className={isTarget ? 'animate-pulse' : ''} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white leading-tight">{sc.name}</h3>
                                        </div>
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-xs text-gray-500 leading-relaxed font-mono line-clamp-3">
                                            {sc.desc}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Middle Column - Intelligence & Notifications */}
                    <div className="col-span-4 flex flex-col gap-4 min-h-0">

                        {/* Active Scenario Explanation Panel */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl shrink-0">
                            <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 mb-3">
                                <Info size={14} /> Mission Intelligence
                            </h3>
                            {activeScenarioData ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col gap-3"
                                >
                                    <h4 className="text-sm font-bold text-white">{activeScenarioData.name} Analysis</h4>
                                    <p className="text-xs text-gray-400 font-mono leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                                        {activeScenarioData.analytics}
                                    </p>
                                </motion.div>
                            ) : (
                                <div className="h-28 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest text-center border border-dashed border-white/5 rounded-lg bg-black/10">
                                    Awaiting Scenario Selection...
                                </div>
                            )}
                        </div>

                        {/* Dedicated Notification / Execution Feed */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-0 relative overflow-hidden">
                            {/* Decorative glow */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>

                            <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 mb-4 shrink-0">
                                <Terminal size={14} /> Execution Feed
                            </h3>

                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 relative">
                                <AnimatePresence>
                                    {logs.map((log) => (
                                        <motion.div
                                            key={log.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0 }}
                                            className={`p-3 rounded-lg border flex items-start gap-3 backdrop-blur-sm ${log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                                                log.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
                                                    log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                                                        'bg-blue-500/10 border-blue-500/20 text-blue-300'
                                                }`}
                                        >
                                            <AlertTriangle size={14} className="mt-0.5 shrink-0 opacity-70" />
                                            <p className="text-[11px] font-mono tracking-wide leading-relaxed">
                                                {log.msg}
                                            </p>
                                        </motion.div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </AnimatePresence>
                                {logs.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest">
                                        Telemetry Stream Idle
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - System Telemetry / Live Feedback */}
                    <div className="col-span-4 flex flex-col gap-4 min-h-0">

                        {/* Constellation Status Matrix */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl shrink-0">
                            <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                                <Activity size={14} /> Constellation Matrix
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4, 5, 6].map(num => {
                                    const nodeId = `SAT-0${num}`;
                                    const isOffline = systemState.offlineNodes.includes(nodeId);
                                    const isPartitioned = systemState.partitionedNodes.includes(nodeId);

                                    let stateColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                                    let stateText = 'ONLINE';
                                    let animClass = '';

                                    if (isOffline) {
                                        stateColor = 'bg-red-500/20 border-red-500/40 text-red-500 bg-red-900/20';
                                        stateText = 'DESTROYED';
                                        animClass = 'animate-pulse';
                                    } else if (isPartitioned) {
                                        stateColor = 'bg-amber-500/20 border-amber-500/40 text-amber-500';
                                        stateText = 'PARTITIONED';
                                    }

                                    return (
                                        <div key={nodeId} className={`p-2.5 rounded-lg border flex flex-col gap-1 ${stateColor} ${animClass} transition-colors duration-500`}>
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold font-mono text-xs">{nodeId}</span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-red-500' : isPartitioned ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                            </div>
                                            <span className="text-[9px] tracking-wider opacity-80">{stateText}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Entropy & Migrations Widget */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-0">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2">
                                    <RefreshCw size={14} /> Rebalancer Core
                                </h3>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${systemState.entropyStatus === 'BALANCED' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30 animate-pulse'
                                    }`}>
                                    {systemState.entropyStatus}
                                </span>
                            </div>

                            <div className="mb-4 shrink-0 bg-black/20 p-4 rounded-xl border border-white/5">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs text-gray-400 font-mono">Shannon Entropy</span>
                                    <span className="text-xl font-bold text-white font-mono">{systemState.entropy.toFixed(3)}</span>
                                </div>
                                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, systemState.entropy * 100)}%` }}
                                        className={`h-full rounded-full transition-all duration-300 ${systemState.entropyStatus === 'BALANCED' ? 'bg-gradient-to-r from-blue-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-black/20 p-3 relative flex flex-col">
                                {systemState.migrations.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest text-center">
                                        Constellation Stable<br />No Migrations Active
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                        <AnimatePresence>
                                            {systemState.migrations.map((m, i) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={i}
                                                    className="text-[10px] font-mono text-blue-300 flex justify-between items-center border-b border-white/[0.02] pb-1.5 mt-1 shrink-0"
                                                >
                                                    <span className="truncate w-16 opacity-70">shard_{m.chunk_id.substring(0, 6)}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-400">{m.from}</span>
                                                        <span className="text-gray-500">→</span>
                                                        <span className="text-emerald-400">{m.to}</span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
