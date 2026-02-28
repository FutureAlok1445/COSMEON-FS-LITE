import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, Server, HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PayloadOps({ messages, onUpload, onDownload, fileId }) {
    const [file, setFile] = useState(null);
    const [downloadId, setDownloadId] = useState('');

    // Status state: 'idle', 'uploading', 'chunking', 'encoding', 'distributing', 'upload_complete', 'downloading', 'download_complete', 'error'
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [chunks, setChunks] = useState([]);
    const [error, setError] = useState(null);

    const [logs, setLogs] = useState([]);

    // Reset state when fileId prop changes from outside
    useEffect(() => {
        if (fileId && status === 'idle') {
            setDownloadId(fileId);
        }
    }, [fileId]);

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric", fractionalSecondDigits: 2 });
        setLogs(prev => [...prev, { time, msg, type }].slice(-20));
    };

    // Listen to WebSocket messages to drive the animation sequence
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        const latestMsg = messages[messages.length - 1];

        switch (latestMsg.type) {
            case 'UPLOAD_START':
                setStatus('uploading');
                setProgress(10);
                addLog(`UPLINK INITIATED: ${latestMsg.data.filename} (${(latestMsg.data.size / 1024).toFixed(2)} KB)`, 'info');
                break;
            case 'CHUNKING_COMPLETE':
                setStatus('chunking');
                setProgress(30);
                addLog(`PARTITIONING: Splitting into ${latestMsg.data.chunk_count} geometric shards`, 'warning');
                if (latestMsg.data && latestMsg.data.chunk_count) {
                    const newChunks = Array.from({ length: latestMsg.data.chunk_count }).map((_, i) => ({
                        id: `data-${i}`,
                        type: 'data',
                        status: 'pending',
                        target: null
                    }));
                    setChunks(newChunks);
                }
                break;
            case 'ENCODING_COMPLETE':
                setStatus('encoding');
                setProgress(50);
                addLog(`REED-SOLOMON: Generating parity. Total shards: ${latestMsg.data.total_shards}`, 'purple');
                if (latestMsg.data && latestMsg.data.total_shards) {
                    setChunks(prev => {
                        const currentCount = prev.length;
                        const parityCount = latestMsg.data.total_shards - currentCount;
                        if (parityCount > 0) {
                            const parityChunks = Array.from({ length: parityCount }).map((_, i) => ({
                                id: `parity-${i}`,
                                type: 'parity',
                                status: 'pending',
                                target: null
                            }));
                            return [...prev, ...parityChunks];
                        }
                        return prev;
                    });
                }
                break;
            case 'CHUNK_UPLOADED':
                setStatus('distributing');
                setProgress(75);
                addLog(`ROUTING: Shard secured on ${latestMsg.data.node_id} (Plane ${latestMsg.data.plane})`, 'success');
                setChunks(prev => {
                    const pendingIdx = prev.findIndex(c => c.status === 'pending');
                    if (pendingIdx !== -1) {
                        const newChunks = [...prev];
                        newChunks[pendingIdx] = {
                            ...newChunks[pendingIdx],
                            status: 'distributed',
                            target: latestMsg.data.node_id,
                            plane: latestMsg.data.plane
                        };
                        return newChunks;
                    }
                    return prev;
                });
                break;
            case 'DTN_QUEUED':
                addLog(`DTN SPOOLED: Target offline. Queued for ${latestMsg.data.node_id}`, 'warning');
                setChunks(prev => {
                    const pendingIdx = prev.findIndex(c => c.status === 'pending');
                    if (pendingIdx !== -1) {
                        const newChunks = [...prev];
                        newChunks[pendingIdx] = {
                            ...newChunks[pendingIdx],
                            status: 'queued',
                            target: latestMsg.data.node_id,
                            plane: latestMsg.data.plane
                        };
                        return newChunks;
                    }
                    return prev;
                });
                break;
            case 'UPLOAD_COMPLETE':
                setStatus('upload_complete');
                setProgress(100);
                addLog(`UPLINK COMPLETE: Global distribution verified. UUID: ${latestMsg.data.file_id.split('-')[0]}...`, 'success');
                setFile(null);
                if (latestMsg.data && latestMsg.data.file_id) {
                    setDownloadId(latestMsg.data.file_id);
                }
                break;
            case 'DOWNLOAD_START':
                setStatus('downloading');
                setProgress(20);
                setLogs([]);
                addLog(`DOWNLINK INITIATED: Locating ${latestMsg.data.filename}`, 'info');
                setChunks(Array.from({ length: 6 }).map((_, i) => ({
                    id: `incoming-${i}`,
                    type: i < 4 ? 'data' : 'parity',
                    status: 'incoming'
                })));
                break;
            case 'DOWNLOAD_COMPLETE':
                setStatus('download_complete');
                setProgress(100);
                addLog(`RECONSTRUCTION: Decoded via RS. Latency: ${latestMsg.data.latency}ms`, 'success');
                if (latestMsg.data.rs_recovery > 0) {
                    addLog(`PARITY USED: ${latestMsg.data.rs_recovery} missing shards recovered mathematically.`, 'warning');
                }
                setChunks([]);
                break;
            case 'UPLOAD_ERROR':
            case 'DOWNLOAD_FAILED':
                setStatus('error');
                setError(latestMsg.data?.error || latestMsg.message || 'An error occurred');
                addLog(`CRITICAL FAILURE: ${error}`, 'error');
                setProgress(0);
                break;
            default:
                break;
        }
    }, [messages]);

    const handleUploadClick = async () => {
        if (!file) return;
        setStatus('idle');
        setError(null);
        setChunks([]);
        setLogs([]);
        setProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        await onUpload(formData);
    };

    const handleDownloadClick = async () => {
        if (!downloadId) return;
        setStatus('idle');
        setError(null);
        setChunks([]);
        setLogs([]);
        setProgress(0);

        await onDownload(downloadId);
    };

    const resetState = () => {
        setStatus('idle');
        setError(null);
        setChunks([]);
        setLogs([]);
        setProgress(0);
        setFile(null);
    };

    // Render helpers for the visualizer
    const renderVisualizer = () => {
        if (status === 'idle') return null;

        return (
            <div className="w-full h-[400px] border border-white/10 bg-[#02040A] rounded-2xl flex overflow-hidden mb-8 shadow-inner relative">

                {/* Visualizer Panel (Left 70%) */}
                <div className="flex-1 relative border-r border-white/5 bg-[url('/grid.svg')] bg-center bg-repeat overflow-hidden flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-blue-900/10 mix-blend-screen pointer-events-none"></div>

                    <AnimatePresence mode="wait">
                        {status === 'uploading' && (
                            <motion.div key="uploading" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="flex flex-col items-center justify-center gap-4">
                                <div className="w-24 h-32 bg-blue-500/10 border-2 border-blue-500/50 rounded-xl flex items-center justify-center relative overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                    <motion.div className="absolute inset-0 bg-blue-500/20" animate={{ y: ['100%', '-100%'] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} />
                                    <FileText className="text-blue-400 w-12 h-12 relative z-10" />
                                </div>
                                <span className="text-blue-400 font-mono tracking-widest text-xs animate-pulse font-bold">SHA-256 INTEGRITY SCAN...</span>
                            </motion.div>
                        )}

                        {(status === 'chunking' || status === 'encoding') && (
                            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center justify-center gap-8 w-full z-10">
                                <div className="flex flex-wrap items-center justify-center gap-4 max-w-2xl px-10">
                                    <AnimatePresence>
                                        {chunks.map((chunk, i) => (
                                            <motion.div
                                                key={chunk.id}
                                                initial={{ scale: 0, opacity: 0, y: 50 }}
                                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.1, type: "spring" }}
                                                className={`w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center font-mono relative overflow-hidden
                                                    ${chunk.type === 'data'
                                                        ? 'bg-blue-950/80 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                                        : 'bg-purple-950/80 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                                                    }`}
                                            >
                                                <span className="text-xs font-bold">{chunk.type === 'data' ? 'DATA' : 'PARITY'}</span>
                                                <span className="text-[10px] opacity-70">BLK-{i}</span>
                                                <motion.div className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-50"
                                                    animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-white font-mono tracking-widest text-sm font-bold mb-1">
                                        {status === 'chunking' ? 'BLOCK PARTITIONING' : 'CALCULATING GALOIS FIELDS'}
                                    </span>
                                    <span className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">RS(4,2) Erasure Coding</span>
                                </div>
                            </motion.div>
                        )}

                        {status === 'distributing' && (
                            <motion.div key="distributing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full relative z-10 items-center justify-center px-12">
                                <Server className="text-emerald-500/20 w-[400px] h-[400px] absolute opacity-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-8 w-full max-w-3xl">
                                    {chunks.map((chunk, i) => (
                                        <div key={chunk.id} className="flex flex-col items-center justify-center relative">
                                            {/* Simulated Trajectory Path (Dashed Line) */}
                                            {chunk.status !== 'pending' && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 40, opacity: 1 }}
                                                    className={`absolute bottom-full w-px mb-2 ${chunk.status === 'queued' ? 'border-l-2 border-dashed border-yellow-500/50' : 'border-l Math border-dashed border-emerald-500/50'}`}
                                                ></motion.div>
                                            )}

                                            <motion.div
                                                initial={{ scale: 1, opacity: 1 }}
                                                animate={chunk.status !== 'pending' ? {
                                                    y: -80,
                                                    scale: 0.6,
                                                    opacity: window.innerWidth > 0 ? 1 : 0 // force rerender hack
                                                } : {}}
                                                transition={{ duration: 0.8, type: "spring" }}
                                                className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center font-mono relative z-20
                                                    ${chunk.type === 'data' ? 'bg-blue-900/80 border-blue-500 text-blue-300' : 'bg-purple-900/80 border-purple-500 text-purple-300'}
                                                    ${chunk.status === 'queued' ? '!bg-yellow-900/80 !border-yellow-500 !text-yellow-300' : ''}
                                                `}
                                            >
                                                <span className="text-[10px] font-bold">{chunk.type === 'data' ? 'D' : 'P'}-{i}</span>
                                                <Upload size={10} className="mt-1 opacity-50" />
                                            </motion.div>

                                            {/* Target Node Plate (Appears when distributed) */}
                                            {chunk.target && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -90 }}
                                                    transition={{ delay: 0.2 }}
                                                    className={`absolute z-10 bg-black/80 border whitespace-nowrap px-3 py-1.5 rounded-md flex flex-col items-center shadow-xl
                                                        ${chunk.status === 'queued' ? 'border-yellow-500/30' : 'border-emerald-500/30'}
                                                    `}
                                                >
                                                    <span className={`text-[9px] font-bold ${chunk.status === 'queued' ? 'text-yellow-400' : 'text-emerald-400'}`}>{chunk.target}</span>
                                                    <span className="text-[7px] text-slate-400 uppercase tracking-widest">{chunk.plane} {chunk.status === 'queued' ? '(DTN SPOOL)' : ''}</span>
                                                </motion.div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <span className="absolute bottom-6 text-emerald-400 font-mono tracking-widest text-xs animate-pulse bg-black/60 px-4 py-2 rounded-full border border-emerald-500/30 backdrop-blur-md">
                                    TRANSMITTING TO ORBITAL MESH
                                </span>
                            </motion.div>
                        )}

                        {status === 'downloading' && (
                            <motion.div key="downloading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-6 w-full h-full relative z-10">
                                <div className="flex flex-wrap items-center justify-center gap-6 max-w-2xl">
                                    {chunks.map((chunk, i) => (
                                        <motion.div
                                            key={chunk.id}
                                            initial={{ y: -200, scale: 0.2, opacity: 0 }}
                                            animate={{ y: 0, scale: 1, opacity: 1 }}
                                            transition={{ duration: 1.2, delay: i * 0.15, type: "spring" }}
                                            className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center font-mono font-bold shadow-lg
                                                ${chunk.type === 'data' ? 'bg-cyan-900/80 border-cyan-500 text-cyan-300' : 'bg-fuchsia-900/80 border-fuchsia-500 text-fuchsia-300'}`}
                                        >
                                            <span className="text-xs">{chunk.type === 'data' ? 'D' : 'P'}-{i}</span>
                                            <Download size={12} className="mt-1 opacity-70" />
                                        </motion.div>
                                    ))}
                                </div>
                                <span className="text-amber-400 font-mono tracking-[0.3em] text-[10px] absolute bottom-8 animate-pulse border border-amber-500/30 px-4 py-2 rounded-full bg-amber-950/30">
                                    INTERCEPTING FRAGMENTS FROM ORBIT
                                </span>
                            </motion.div>
                        )}

                        {(status === 'upload_complete' || status === 'download_complete') && (
                            <motion.div key="complete" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center gap-6 z-10">
                                <div className="w-28 h-28 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)] relative">
                                    <motion.div className="absolute inset-0 rounded-full border border-emerald-400" animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
                                    <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-emerald-400 font-mono tracking-widest text-sm font-bold mb-1">
                                        {status === 'upload_complete' ? 'PAYLOAD SECURED IN ORBIT' : 'RECONSTRUCTION SUCCESSFUL'}
                                    </h3>
                                    {status === 'upload_complete' && (
                                        <p className="text-slate-400 font-mono text-[10px]">UUID: {downloadId}</p>
                                    )}
                                </div>
                                <button onClick={resetState} className="mt-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest font-mono text-white transition-colors duration-300">
                                    START NEW OPERATION
                                </button>
                            </motion.div>
                        )}

                        {status === 'error' && (
                            <motion.div key="error" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center gap-4 text-center max-w-md z-10">
                                <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                                    <AlertCircle className="w-12 h-12 text-red-500" />
                                </div>
                                <span className="text-red-500 font-bold font-mono tracking-widest text-sm uppercase">OPERATION FAILED</span>
                                <p className="text-red-300/80 text-xs font-mono bg-red-950/50 p-3 rounded-lg border border-red-500/20">{error}</p>
                                <button onClick={resetState} className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono text-gray-300 transition-colors">
                                    ACKNOWLEDGE
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Telemetry Details Panel (Right 30%) */}
                <div className="w-[30%] bg-black/40 border-l border-white/5 flex flex-col">
                    <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
                            <Server size={12} className="text-blue-500" /> Live Operation Telemetry
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
                                <Loader2 size={16} className="animate-spin text-slate-500" />
                                <span className="text-[9px] font-mono tracking-widest uppercase text-slate-500">Awaiting Operation...</span>
                            </div>
                        ) : (
                            logs.map((log, idx) => {
                                let textColor = 'text-slate-300';
                                if (log.type === 'success') textColor = 'text-emerald-400';
                                if (log.type === 'warning') textColor = 'text-amber-400';
                                if (log.type === 'error') textColor = 'text-red-400';
                                if (log.type === 'purple') textColor = 'text-purple-400';

                                return (
                                    <div key={idx} className="flex gap-2 text-[10px] font-mono animate-in slide-in-from-right-2 duration-300">
                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                        <span className={`${textColor} break-words`}>{log.msg}</span>
                                    </div>
                                );
                            })
                        )}
                        <div className="h-4"></div> {/* Bottom padding element */}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar">
            <div
                className="w-full max-w-6xl h-fit bg-[#05080f]/95 backdrop-blur-3xl border-l-4 border-b-4 border-l-blue-500/50 border-b-blue-500/50 border-t border-r border-t-white/10 border-r-white/10 p-10 relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-4"
                style={{ clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)' }}
            >
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[100px] -z-10 pointer-events-none rounded-full"></div>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <HardDrive className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-wide">Payload Operations</h1>
                        <p className="text-sm text-gray-400 font-mono">End-to-end orbital file system interface</p>
                    </div>
                </div>

                {/* Main Visualizer Area */}
                {renderVisualizer()}

                {/* Controls Area: Only show if idle or complete (so they don't jump around) */}
                {(status === 'idle' || status === 'upload_complete' || status === 'download_complete') && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="grid grid-cols-2 gap-8"
                    >

                        {/* UPLINK SECTION */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>

                            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 tracking-widest uppercase">
                                <Upload className="text-blue-500" size={16} /> Data Uplink
                            </h2>
                            <p className="text-xs text-gray-400 mb-6 min-h-[40px]">
                                Securely upload a file. It will be automatically chunked, RS-encoded, and distributed across the orbital mesh.
                            </p>

                            <div className="space-y-4">
                                <label className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed border-white/10 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] hover:border-blue-500/50 cursor-pointer transition-all">
                                    <FileText className="text-gray-500 mb-2" size={24} />
                                    <span className="text-xs font-mono text-gray-400">
                                        {file ? <span className="text-blue-400">{file.name}</span> : 'SELECT TARGET PAYLOAD'}
                                    </span>
                                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                                </label>

                                <button
                                    onClick={handleUploadClick}
                                    disabled={!file || status !== 'idle'}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-blue-900 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase"
                                >
                                    {status === 'idle' ? 'Initiate Uplink' : <Loader2 className="animate-spin" size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* DOWNLINK SECTION */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>

                            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 tracking-widest uppercase">
                                <Download className="text-emerald-500" size={16} /> Data Downlink
                            </h2>
                            <p className="text-xs text-gray-400 mb-6 min-h-[40px]">
                                Reconstruct a file from orbital shards using its unique UUID. Automatically handles node failures and parity recovery.
                            </p>

                            <div className="space-y-4 h-full flex flex-col">
                                <div className="flex items-center bg-[#05080f] border border-white/10 rounded-xl p-2 focus-within:border-emerald-500/50 transition-colors h-32 justify-center">
                                    <input
                                        type="text"
                                        placeholder="ENTER PAYLOAD UUID_HASH"
                                        value={downloadId}
                                        onChange={(e) => setDownloadId(e.target.value)}
                                        className="w-full bg-transparent text-center font-mono text-emerald-400 text-sm outline-none placeholder:text-gray-700 tracking-widest uppercase"
                                    />
                                </div>

                                <button
                                    onClick={handleDownloadClick}
                                    disabled={!downloadId || status !== 'idle'}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-emerald-900 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase mt-auto"
                                >
                                    {status === 'idle' ? 'Initiate Downlink' : <Loader2 className="animate-spin" size={16} />}
                                </button>
                            </div>
                        </div>

                    </motion.div>
                )}
            </div>
        </div>
    );
}
