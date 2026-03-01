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

    return (
        <div className="w-full h-full flex justify-between items-center px-8 sm:px-16 relative pointer-events-none z-10">

            {/* LEFT PANEL: UPLINK */}
            <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-[400px] pointer-events-auto"
            >
                <div className="bg-[#05080f]/90 backdrop-blur-3xl border-l-4 border-l-blue-500/50 border border-white/10 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Upload className="text-blue-400" size={16} />
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-widest uppercase">
                            Data Uplink
                        </h2>
                    </div>

                    <p className="text-xs text-gray-400 mb-6 hidden sm:block">
                        Securely uplink a payload. It will be chunked, RS-encoded, and beamed to the orbital mesh in real-time.
                    </p>

                    <div className="space-y-4">
                        <label className="flex flex-col items-center justify-center h-28 w-full border-2 border-dashed border-white/10 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] hover:border-blue-500/50 cursor-pointer transition-all">
                            <FileText className="text-gray-500 mb-2" size={20} />
                            <span className="text-xs font-mono text-gray-400 text-center px-4 truncate w-full">
                                {file ? <span className="text-blue-400">{file.name}</span> : 'SELECT TARGET PAYLOAD'}
                            </span>
                            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                        </label>

                        <button
                            onClick={handleUploadClick}
                            disabled={!file || (status !== 'idle' && status !== 'upload_complete' && status !== 'download_complete' && status !== 'error')}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-blue-900 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase"
                        >
                            {(status !== 'idle' && status !== 'upload_complete' && status !== 'download_complete' && status !== 'error' && !downloadId) ? <Loader2 className="animate-spin" size={16} /> : 'Initiate Uplink'}
                        </button>
                    </div>
                </div>

                {/* Uplink Progress & Live Telemetry HUD */}
                <AnimatePresence>
                    {(status !== 'idle' && status !== 'error') && !downloadId && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mt-6 bg-[#05080f]/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-5 shadow-lg"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-blue-400 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">
                                    {status.replace('_', ' ')}
                                </span>
                                <span className="text-blue-200 font-mono text-[10px]">{progress}%</span>
                            </div>
                            <div className="w-full bg-blue-900/30 rounded-full h-1.5 mb-4 overflow-hidden">
                                <motion.div className="bg-blue-500 h-1.5" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                            </div>

                            {/* Mini Logs */}
                            <div className="space-y-1.5 h-24 overflow-y-auto custom-scrollbar">
                                {logs.slice(-4).map((log, idx) => {
                                    let textColor = 'text-slate-300';
                                    if (log.type === 'success') textColor = 'text-emerald-400';
                                    if (log.type === 'warning') textColor = 'text-amber-400';
                                    if (log.type === 'purple') textColor = 'text-purple-400';
                                    return (
                                        <div key={idx} className="text-[9px] font-mono leading-tight">
                                            <span className="text-slate-600">[{log.time}]</span> <span className={textColor}>{log.msg}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {status === 'upload_complete' && (
                                <button onClick={resetState} className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold tracking-widest font-mono text-white transition-colors">
                                    ACKNOWLEDGE
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* RIGHT PANEL: DOWNLINK */}
            <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                className="w-full max-w-[400px] pointer-events-auto flex flex-col items-end"
            >
                <div className="bg-[#05080f]/90 backdrop-blur-3xl border-r-4 border-r-emerald-500/50 border border-white/10 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-emerald-500/30 transition-all w-full">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>

                    <div className="flex items-center justify-end gap-3 mb-6">
                        <h2 className="text-lg font-bold text-white tracking-widest uppercase text-right">
                            Data Downlink
                        </h2>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <Download className="text-emerald-400" size={16} />
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-6 hidden sm:block text-right">
                        Provide a UUID to intercept fragmented shards from orbit and reconstruct the payload locally.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-center bg-[#05080f] border border-white/10 rounded-xl p-2 focus-within:border-emerald-500/50 transition-colors h-28 justify-center">
                            <input
                                type="text"
                                placeholder="ENTER PAYLOAD UUID"
                                value={downloadId}
                                onChange={(e) => setDownloadId(e.target.value)}
                                className="w-full bg-transparent text-center font-mono text-emerald-400 text-sm outline-none placeholder:text-gray-700 tracking-widest uppercase"
                            />
                        </div>

                        <button
                            onClick={handleDownloadClick}
                            disabled={!downloadId || (status !== 'idle' && status !== 'upload_complete' && status !== 'download_complete' && status !== 'error')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-emerald-900 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase"
                        >
                            {(status !== 'idle' && status !== 'upload_complete' && status !== 'download_complete' && status !== 'error' && downloadId) ? <Loader2 className="animate-spin" size={16} /> : 'Initiate Downlink'}
                        </button>
                    </div>
                </div>

                {/* Downlink Progress & Live Telemetry HUD */}
                <AnimatePresence>
                    {(status !== 'idle' && status !== 'error') && downloadId && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mt-6 bg-[#05080f]/80 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-5 shadow-lg w-full"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-emerald-400 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">
                                    {status.replace('_', ' ')}
                                </span>
                                <span className="text-emerald-200 font-mono text-[10px]">{progress}%</span>
                            </div>
                            <div className="w-full bg-emerald-900/30 rounded-full h-1.5 mb-4 overflow-hidden">
                                <motion.div className="bg-emerald-500 h-1.5" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                            </div>

                            {/* Mini Logs */}
                            <div className="space-y-1.5 h-24 overflow-y-auto custom-scrollbar">
                                {logs.slice(-4).map((log, idx) => {
                                    let textColor = 'text-slate-300';
                                    if (log.type === 'success') textColor = 'text-emerald-400';
                                    if (log.type === 'warning') textColor = 'text-amber-400';
                                    if (log.type === 'info') textColor = 'text-cyan-400';
                                    return (
                                        <div key={idx} className="text-[9px] font-mono leading-tight">
                                            <span className="text-slate-600">[{log.time}]</span> <span className={textColor}>{log.msg}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {status === 'download_complete' && (
                                <button onClick={resetState} className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold tracking-widest font-mono text-white transition-colors">
                                    ACKNOWLEDGE
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

            </motion.div>

            {/* Error Modal Overlay */}
            <AnimatePresence>
                {status === 'error' && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#05080f]/95 backdrop-blur-3xl border border-red-500/50 rounded-3xl p-8 shadow-[0_0_100px_rgba(239,68,68,0.4)] z-50 pointer-events-auto text-center w-full max-w-sm flex flex-col items-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-red-500 font-bold tracking-widest uppercase mb-2">Operation Failed</h2>
                        <p className="text-red-200/80 text-xs font-mono mb-6 bg-red-950/30 p-4 rounded-xl border border-red-500/20">{error}</p>
                        <button onClick={resetState} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold tracking-widest uppercase text-red-400 transition-colors">
                            Dismiss Alert
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
