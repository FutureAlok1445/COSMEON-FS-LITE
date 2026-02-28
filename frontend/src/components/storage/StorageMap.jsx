import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Download, Trash2, Power, WifiOff, File as FileIcon, HardDrive, Zap, RefreshCw } from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

export default function StorageMap() {
    const [state, setState] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const fetchState = async () => {
        try {
            const res = await fetch(`${API_URL}/fs/state`);
            if (res.ok) {
                const data = await res.json();
                setState(data);
            }
        } catch (err) {
            console.error("Failed to fetch state:", err);
        }
    };

    useEffect(() => {
        fetchState();
        const interval = setInterval(fetchState, 2000);
        return () => clearInterval(interval);
    }, []);

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
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                const errData = await res.json();
                alert(`Download failed: ${errData.detail}`);
            }
        } catch (err) {
            alert(`Download failed: ${err.message}`);
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
        <div className="w-full h-full bg-[#02040A] text-slate-300 p-8 flex gap-8 overflow-hidden font-mono text-sm relative">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[120px] mix-blend-screen"></div>
                <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[100px] mix-blend-screen"></div>
            </div>

            {/* Left Panel: Mission Control */}
            <div className="w-[350px] flex flex-col gap-6 z-10 shrink-0">
                {/* Upload Section */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                        <UploadCloud className="text-cyan-400" size={18} />
                        <h2 className="text-white font-bold tracking-widest text-xs uppercase">Orbital Uplink</h2>
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={`w-full py-8 border-2 border-dashed border-cyan-500/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-cyan-400 hover:bg-cyan-500/5 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <UploadCloud size={32} className="text-cyan-500/50" />
                        <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                            {uploading ? 'Transmitting Data...' : 'Select Payload to Upload'}
                        </span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                </div>

                {/* File Inventory */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <HardDrive className="text-blue-400" size={18} />
                            <h2 className="text-white font-bold tracking-widest text-xs uppercase">Distributed Files</h2>
                        </div>
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">{state.files.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {state.files.length === 0 ? (
                            <div className="text-center text-slate-600 text-[10px] uppercase tracking-widest py-8">
                                No files stored in mesh
                            </div>
                        ) : (
                            state.files.map(file => (
                                <div key={file.file_id} className="bg-white/5 border border-white/10 rounded-xl p-3 group hover:border-blue-500/30 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileIcon size={14} className="text-slate-400 shrink-0" />
                                            <span className="text-white font-bold text-xs truncate" title={file.filename}>{file.filename}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mb-3 text-[10px] text-slate-400">
                                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                                        <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{file.chunk_count} Chunks</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownload(file.file_id, file.filename)}
                                            className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1"
                                        >
                                            <Download size={12} /> Fetch
                                        </button>
                                        <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded p-1.5 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
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
            </div>

            {/* Right Panel: The Orbital Mesh Grid */}
            <div className="flex-1 flex flex-col z-10 w-full overflow-hidden">
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6 shrink-0">
                        <div>
                            <h2 className="text-white font-bold tracking-widest text-sm uppercase">Storage Node Topology</h2>
                            <p className="text-[10px] text-cyan-500 mt-1 uppercase tracking-widest">Live Representation of File Chunks across 3 Orbital Planes</p>
                        </div>
                        <div className="flex gap-4 items-center text-[10px] uppercase tracking-widest font-bold">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div> Data Chunk</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-purple-500 shadow-[0_0_8px_#a855f7]"></div> RS Parity</span>
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

                            return (
                                <div key={node.node_id} className={`relative rounded-2xl border transition-colors flex flex-col overflow-hidden ${isOnline ? 'bg-black/40 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]' : 'bg-red-950/20 border-red-500/30'}`}>
                                    {/* Plane Header */}
                                    <div className={`p-3 border-b flex justify-between items-center ${isOnline ? 'bg-cyan-950/30 border-cyan-500/10' : 'bg-red-900/30 border-red-500/20'}`}>
                                        <div>
                                            <p className="font-bold text-white text-sm">{node.node_id}</p>
                                            <p className={`text-[9px] uppercase tracking-widest ${isOnline ? 'text-cyan-500' : 'text-red-400'}`}>Plane {node.plane}</p>
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
                                        {!isOnline && (
                                            <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center flex-col gap-2">
                                                <WifiOff size={24} className="text-red-500 opacity-50" />
                                                <p className="text-red-400 font-bold uppercase tracking-widest text-[10px]">Node Offline</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {myChunks.length === 0 ? (
                                                <div className="w-full text-center text-[10px] text-slate-600 uppercase tracking-widest mt-10">Empty Buffer</div>
                                            ) : (
                                                myChunks.map((chunk, i) => (
                                                    <div
                                                        key={`${chunk.chunk_id}-${i}`}
                                                        className={`w-[calc(50%-4px)] p-2 rounded border flex flex-col justify-center animate-in zoom-in duration-300 ${chunk.is_parity
                                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                                            }`}
                                                        title={`Chunk of ${chunk.filename}\nSeq: ${chunk.sequence_number}`}
                                                    >
                                                        <p className="text-[9px] truncate w-full font-bold opacity-80">{chunk.filename}</p>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <p className="text-[8px] uppercase tracking-wider opacity-60">Seq {chunk.sequence_number}</p>
                                                            {chunk.is_parity && <span className="text-[8px] font-bold text-purple-400">PRTY</span>}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-black/50 p-2 text-center text-[9px] uppercase tracking-widest text-slate-500 border-t border-white/5">
                                        {(node.storage_used / 1024).toFixed(1)} KB Used
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
