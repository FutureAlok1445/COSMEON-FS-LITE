import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Download, Trash2, Power, WifiOff, File as FileIcon, HardDrive, Zap, RefreshCw, Radio, Satellite } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = `http://${window.location.hostname}:9000/api`;

export default function StorageMap() {
    const [state, setState] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [harvestingStates, setHarvestingStates] = useState({}); // { fileId: statusObject }
    const [transmittingNodes, setTransmittingNodes] = useState({}); // { nodeId: timestamp }
    const [islLinks, setIslLinks] = useState([]); // ISL topology links
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const socketRef = useRef(null);

    const fetchState = async () => {
        try {
            const [stateRes, islRes] = await Promise.all([
                fetch(`${API_URL}/fs/state`),
                fetch(`${API_URL}/isl/topology`)
            ]);
            if (stateRes.ok) {
                const data = await stateRes.json();
                setState(data);
            }
            if (islRes.ok) {
                const islData = await islRes.json();
                setIslLinks(islData.links || []);
            }
        } catch (err) {
            console.error("Failed to fetch state:", err);
        }
    };

    useEffect(() => {
        fetchState();

        // Setup WebSocket for real-time harvest bursts
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.hostname}:9000/ws`);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'HARVEST_PROGRESS') {
                    // Use node_id directly from payload if available
                    const nodeId = data.payload.node_id;
                    if (nodeId) {
                        setTransmittingNodes(prev => ({ ...prev, [nodeId]: Date.now() }));
                        // Clear after 1.5s
                        setTimeout(() => {
                            setTransmittingNodes(prev => {
                                const next = { ...prev };
                                delete next[nodeId];
                                return next;
                            });
                        }, 1500);
                    }
                    // Also update harvest state immediately
                    updateHarvestStatus(data.payload.file_id);
                }
            } catch (e) {
                console.error("WS error:", e);
            }
        };

        socketRef.current = ws;

        const interval = setInterval(() => {
            fetchState();
            // Poll harvesting status if any are active
            Object.keys(harvestingStates).forEach(fileId => {
                if (harvestingStates[fileId]?.status === 'active') {
                    updateHarvestStatus(fileId);
                }
            });
        }, 2000);

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, [harvestingStates, state]);

    const updateHarvestStatus = async (fileId) => {
        try {
            const res = await fetch(`${API_URL}/harvest/status/${fileId}`);
            if (res.ok) {
                const data = await res.json();
                setHarvestingStates(prev => ({ ...prev, [fileId]: data }));
            }
        } catch (err) {
            console.error("Failed to fetch harvest status:", err);
        }
    };

    const handleHarvest = async (fileId) => {
        try {
            const res = await fetch(`${API_URL}/harvest/start/${fileId}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setHarvestingStates(prev => ({ ...prev, [fileId]: data }));
            }
        } catch (err) {
            alert(`Harvest failed: ${err.message}`);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                await fetchState();
            } else {
                const errData = await res.json();
                alert(`Upload failed: ${errData.detail}`);
            }
        } catch (err) {
            alert(`Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (fileId, filename) => {
        try {
            const res = await fetch(`${API_URL}/download/${fileId}`);
            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();
            const safeName = filename || `download-${fileId}`;

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = safeName;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            link.remove();
        } catch (err) {
            alert(`Download failed: ${err.message}`);
        }
    };

    const handleDelete = async (fileId) => {
        try {
            const res = await fetch(`${API_URL}/delete/${fileId}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchState();
            } else {
                const errData = await res.json();
                alert(`Delete failed: ${errData.detail}`);
            }
        } catch (err) {
            alert(`Delete failed: ${err.message}`);
        }
    };

    const toggleNodeStatus = async (nodeId) => {
        try {
            await fetch(`${API_URL}/node/${nodeId}/toggle`, { method: 'POST' });
            await fetchState();
        } catch (err) {
            console.error("Failed to toggle node:", err);
        }
    };

    if (!state) return (
        <div className="flex items-center justify-center h-full w-full bg-[#02040A] text-cyan-400">
            <RefreshCw className="animate-spin mr-2" /> Initializing Orbital Storage Mesh...
        </div>
    );

    return (
        <div className="w-full h-full bg-transparent text-slate-300 p-8 flex gap-8 overflow-hidden font-mono text-sm relative">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[#02060F]"></div>
                {/* Tactical Tactical Grid */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#4facfe 1px, transparent 1px), linear-gradient(90deg, #4facfe 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}
                ></div>
                <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen"></div>
            </div>

            {/* Left Panel: Mission Control */}
            <div className="w-[380px] flex flex-col gap-6 z-10 shrink-0 pointer-events-auto">
                {/* Enhanced File Inventory */}
                <div className="bg-[#0A0F1D]/60 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex-1 flex flex-col overflow-hidden relative group/inventory">
                    {/* Decorative Corner */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/10 to-transparent pointer-events-none"></div>

                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <HardDrive className="text-blue-400" size={18} />
                            </div>
                            <div>
                                <h2 className="text-white font-bold tracking-[0.15em] text-xs uppercase">Orbital Assets</h2>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Distributed File Registry</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-mono text-blue-400 font-bold">{state.files.length} ITEMS</span>
                            <div className="w-12 h-0.5 bg-blue-500/20 rounded-full mt-1">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (state.files.length / 20) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {state.files.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 py-12">
                                <FileIcon size={40} className="mb-4 text-slate-400" />
                                <div className="text-center text-slate-400 text-[10px] uppercase tracking-[0.3em]">
                                    Grid Storage Empty
                                </div>
                            </div>
                        ) : (
                            state.files.map(file => (
                                <motion.div
                                    key={file.file_id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/[0.03] border border-white/5 rounded-xl p-4 group/item hover:bg-white/[0.06] hover:border-blue-500/30 transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center border border-white/5 shrink-0 group-hover/item:bg-blue-500/20 transition-colors">
                                                <FileIcon size={16} className="text-blue-400" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <span className="text-white font-bold text-xs truncate block" title={file.filename}>{file.filename}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                                                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                                    <span className="text-[9px] text-cyan-400/80 font-bold uppercase tracking-wider">{file.chunk_count} Chunks</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {harvestingStates[file.file_id] && harvestingStates[file.file_id].status !== 'none' && (
                                        <div className="mb-4 p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                            <div className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-emerald-400 mb-1.5 font-bold">
                                                <span className="flex items-center gap-1.5">
                                                    <RefreshCw size={10} className="animate-spin" />
                                                    Reconstructing...
                                                </span>
                                                <span>{Math.round((harvestingStates[file.file_id].collected_shards.length / file.chunk_count) * 100)}%</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(harvestingStates[file.file_id].collected_shards.length / file.chunk_count) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownload(file.file_id, file.filename)}
                                            className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:border-blue-500/40 flex justify-center items-center gap-2"
                                        >
                                            <Download size={12} /> Access
                                        </button>
                                        {!harvestingStates[file.file_id] || harvestingStates[file.file_id].status === 'none' ? (
                                            <button
                                                onClick={() => handleHarvest(file.file_id)}
                                                className="bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 rounded-lg p-2 transition-all hover:border-emerald-500/30"
                                                title="Initiate Ground Harvest"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        ) : null}
                                        <button
                                            onClick={() => handleDelete(file.file_id)}
                                            className="bg-red-500/5 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-lg p-2 transition-all hover:border-red-500/30"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>


                {/* Ground Cache Stats */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                        <Zap className="text-emerald-400" size={18} />
                        <h2 className="text-white font-bold tracking-widest text-xs uppercase">LRU Ground Cache</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Hit Rate</p>
                            <p className="text-xl font-bold text-emerald-400">{state.cache?.hit_rate || 0}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Items</p>
                            <p className="text-xl font-bold text-white">{state.cache?.size || 0} / {state.cache?.max_size || 10}</p>
                        </div>
                    </div>
                </div>

                {/* ISL Link Status */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                        <Satellite className="text-amber-400" size={18} />
                        <h2 className="text-white font-bold tracking-widest text-xs uppercase">ISL Mesh Links</h2>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                        {islLinks.map((link, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white font-bold">{link.from}</span>
                                    <motion.div
                                        animate={link.active ? { opacity: [0.3, 1, 0.3] } : {}}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className={`w-6 h-[2px] rounded ${link.active ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' : 'bg-gray-700'}`}
                                    />
                                    <span className="text-white font-bold">{link.to}</span>
                                </div>
                                <span className={`uppercase tracking-widest text-[8px] font-bold ${link.active ? 'text-amber-400' : 'text-gray-600'}`}>
                                    {link.active ? 'ACTIVE' : 'DOWN'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: The Orbital Mesh Grid */}
            <div className="flex-1 flex flex-col z-10 w-full overflow-hidden">
                <div className="bg-[#0A0F1D]/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-8 shrink-0">
                        <div>
                            <div className="flex items-center gap-2">
                                <Satellite className="text-cyan-400" size={16} />
                                <h2 className="text-white font-bold tracking-[0.2em] text-sm uppercase">Distributed Storage Topology</h2>
                            </div>
                            <p className="text-[10px] text-cyan-500/60 mt-1 uppercase tracking-[0.15em]">Live synchronization across logical orbital planes</p>
                        </div>
                        <div className="flex gap-6 items-center text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400">
                            <span className="flex items-center gap-2 bg-cyan-500/5 px-2 py-1 rounded border border-cyan-500/10"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div> Data Chunk</span>
                            <span className="flex items-center gap-2 bg-purple-500/5 px-2 py-1 rounded border border-purple-500/10"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></div> RS Parity</span>
                            <span className="flex items-center gap-2 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]"></div> ISL Link</span>
                        </div>
                    </div>


                    <div className="grid grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {state.nodes.map(node => {
                            // Find all chunks currently stored in this node
                            const myChunks = [];
                            state.files.forEach(f => {
                                f.chunks.forEach(c => {
                                    if (c.node_id === node.node_id) {
                                        myChunks.push({
                                            ...c,
                                            filename: f.filename
                                        });
                                    }
                                });
                            });

                            const isOnline = node.status === 'ONLINE';
                            const isPartitioned = node.status === 'PARTITIONED';
                            const hasISL = isPartitioned && islLinks.some(l =>
                                (l.from === node.node_id || l.to === node.node_id) && l.active
                            );

                            return (
                                <div key={node.node_id} className={`relative rounded-2xl border transition-colors flex flex-col overflow-hidden ${isOnline ? 'bg-black/40 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]'
                                    : isPartitioned ? 'bg-amber-950/20 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                                        : 'bg-red-950/20 border-red-500/30'
                                    }`}>
                                    {/* Plane Header */}
                                    <div className={`p-3 border-b flex justify-between items-center ${isOnline ? 'bg-cyan-950/30 border-cyan-500/10'
                                        : isPartitioned ? 'bg-amber-900/30 border-amber-500/20'
                                            : 'bg-red-900/30 border-red-500/20'
                                        }`}>
                                        <div>
                                            <p className="font-bold text-white text-sm">{node.node_id}</p>
                                            <p className={`text-[9px] uppercase tracking-widest ${isOnline ? 'text-cyan-500'
                                                : isPartitioned ? 'text-amber-400'
                                                    : 'text-red-400'
                                                }`}>
                                                {isPartitioned ? `Plane ${node.plane} • ISL ${hasISL ? 'RELAY' : 'DOWN'}` : `Plane ${node.plane}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => toggleNodeStatus(node.node_id)}
                                            className={`p-2 rounded-lg border transition-colors ${isOnline ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-white' : 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:text-white'}`}
                                            title="Toggle Node Power (Chaos Simulation)"
                                        >
                                            {isOnline ? <Power size={14} /> : <WifiOff size={14} />}
                                        </button>
                                    </div>

                                    {/* Chunk Visualization Area */}
                                    <div className="flex-1 p-4 min-h-[250px] relative">
                                        <AnimatePresence>
                                            {!isOnline && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center flex-col gap-2"
                                                >
                                                    {/* Check if node is part of an active harvest */}
                                                    {Object.values(harvestingStates).some(m =>
                                                        m.status === 'active' &&
                                                        state.files.find(f => f.file_id === m.file_id)?.chunks.some(c => c.node_id === node.node_id && !m.collected_shards.includes(c.chunk_id))
                                                    ) ? (
                                                        <div className="relative">
                                                            <motion.div
                                                                animate={{ scale: [1, 2, 1], opacity: [0.3, 0.1, 0.3] }}
                                                                transition={{ duration: 2, repeat: Infinity }}
                                                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-emerald-500 rounded-full blur-xl"
                                                            />
                                                            <Radio size={32} className="text-emerald-400 animate-pulse relative z-10" />
                                                            <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] text-[8px] mt-2 whitespace-nowrap">Waiting for Signal...</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <WifiOff size={24} className="text-red-500 opacity-50" />
                                                            <p className="text-red-400 font-bold uppercase tracking-widest text-[10px]">Node Offline</p>
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Transmission Effect */}
                                        <AnimatePresence>
                                            {transmittingNodes[node.node_id] && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 1.2 }}
                                                    className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
                                                >
                                                    <div className="w-full h-full bg-emerald-500/10 border-2 border-emerald-500/50 rounded-2xl animate-ping" />
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                                        <Zap size={40} className="text-emerald-400 filter drop-shadow-[0_0_10px_#10b981]" />
                                                        <span className="text-emerald-400 font-bold text-[8px] uppercase tracking-widest mt-2 overflow-hidden block">Downlink Active</span>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="flex flex-wrap gap-2.5">
                                            {myChunks.length === 0 ? (
                                                <div className="w-full flex flex-col items-center justify-center py-12 opacity-20">
                                                    <HardDrive size={32} className="mb-2" />
                                                    <div className="text-[10px] uppercase tracking-[0.3em]">No Active Segments</div>
                                                </div>
                                            ) : (
                                                myChunks.map((chunk, i) => (
                                                    <motion.div
                                                        layout
                                                        key={`${chunk.chunk_id}-${i}`}
                                                        whileHover={{ scale: 1.05, translateY: -2 }}
                                                        className={`w-[calc(50%-5px)] p-2.5 rounded-lg border flex flex-col justify-center relative overflow-hidden group/chunk ${chunk.is_parity
                                                            ? 'bg-purple-500/5 border-purple-500/20 text-purple-200'
                                                            : 'bg-cyan-500/5 border-cyan-500/20 text-cyan-200'
                                                            }`}
                                                        title={`Chunk of ${chunk.filename}\nSeq: ${chunk.sequence_number}`}
                                                    >
                                                        {/* Animated highlight overlay */}
                                                        <div className={`absolute inset-0 opacity-0 group-hover/chunk:opacity-10 transition-opacity ${chunk.is_parity ? 'bg-purple-400' : 'bg-cyan-400'}`} />

                                                        <div className="flex items-center gap-1.5 mb-1.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${chunk.is_parity ? 'bg-purple-500 shadow-[0_0_6px_#a855f7]' : 'bg-cyan-500 shadow-[0_0_6px_#06b6d4]'}`} />
                                                            <p className="text-[9px] truncate w-full font-bold tracking-tight opacity-90">{chunk.filename}</p>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-white/5 rounded px-1.5 py-0.5 mt-auto">
                                                            <p className="text-[8px] uppercase tracking-[0.1em] font-mono opacity-50">IDX {chunk.sequence_number}</p>
                                                            {chunk.is_parity ? (
                                                                <span className="text-[7px] font-bold text-purple-400 bg-purple-500/10 px-1 rounded">PARITY</span>
                                                            ) : (
                                                                <span className="text-[7px] font-bold text-cyan-400 bg-cyan-500/10 px-1 rounded">DATA</span>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                        </div>

                                    </div>

                                    <div className="bg-black/50 p-2 text-center text-[9px] uppercase tracking-widest text-slate-500 border-t border-white/5 relative overflow-hidden">
                                        {(node.storage_used / 1024).toFixed(1)} KB Used
                                        {/* Activity Scanner Line */}
                                        {isOnline && (
                                            <motion.div
                                                animate={{ x: ['-100%', '100%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                className="absolute bottom-0 left-0 h-[1px] w-1/2 bg-cyan-500/50 blur-sm"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
