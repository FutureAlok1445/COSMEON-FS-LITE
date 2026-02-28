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

    // Reset state when fileId prop changes from outside
    useEffect(() => {
        if (fileId && status === 'idle') {
            setDownloadId(fileId);
        }
    }, [fileId]);

    // Listen to WebSocket messages to drive the animation sequence
    useEffect(() => {
        if (!messages || messages.length === 0) return;

        const latestMsg = messages[messages.length - 1];

        switch (latestMsg.type) {
            case 'UPLOAD_START':
                setStatus('uploading');
                setProgress(10);
                break;
            case 'CHUNKING_COMPLETE':
                setStatus('chunking');
                setProgress(30);
                // Create visual representation of chunks
                if (latestMsg.data && latestMsg.data.chunk_count) {
                    const newChunks = Array.from({ length: latestMsg.data.chunk_count }).map((_, i) => ({
                        id: `data-${i}`,
                        type: 'data',
                        status: 'pending'
                    }));
                    setChunks(newChunks);
                }
                break;
            case 'ENCODING_COMPLETE':
                setStatus('encoding');
                setProgress(50);
                // Add parity chunks
                if (latestMsg.data && latestMsg.data.total_shards) {
                    setChunks(prev => {
                        const currentCount = prev.length;
                        const parityCount = latestMsg.data.total_shards - currentCount;
                        if (parityCount > 0) {
                            const parityChunks = Array.from({ length: parityCount }).map((_, i) => ({
                                id: `parity-${i}`,
                                type: 'parity',
                                status: 'pending'
                            }));
                            return [...prev, ...parityChunks];
                        }
                        return prev;
                    });
                }
                break;
            case 'CHUNK_UPLOADED':
                // Mark specific chunk as distributed
                // We fake the mapping for visual purposes since we don't have exact index in the WS message easily
                setChunks(prev => {
                    const pendingData = prev.findIndex(c => c.status === 'pending');
                    if (pendingData !== -1) {
                        const newChunks = [...prev];
                        newChunks[pendingData] = { ...newChunks[pendingData], status: 'distributed' };
                        return newChunks;
                    }
                    return prev;
                });
                setStatus('distributing');
                setProgress(75);
                break;
            case 'UPLOAD_COMPLETE':
                setStatus('upload_complete');
                setProgress(100);
                setFile(null); // Clear the file input
                if (latestMsg.data && latestMsg.data.file_id) {
                    setDownloadId(latestMsg.data.file_id);
                }
                break;
            case 'DOWNLOAD_START':
                setStatus('downloading');
                setProgress(20);
                // Setup visual chunks coming back
                setChunks(Array.from({ length: 6 }).map((_, i) => ({
                    id: `incoming-${i}`,
                    type: i < 4 ? 'data' : 'parity',
                    status: 'incoming'
                })));
                break;
            case 'DOWNLOAD_COMPLETE':
                setStatus('download_complete');
                setProgress(100);
                setChunks([]);
                break;
            case 'UPLOAD_ERROR':
            case 'DOWNLOAD_FAILED':
                setStatus('error');
                setError(latestMsg.data?.error || latestMsg.message || 'An error occurred');
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
        setProgress(0);

        await onDownload(downloadId);
    };

    const resetState = () => {
        setStatus('idle');
        setError(null);
        setChunks([]);
        setProgress(0);
        setFile(null);
    };

    // Render helpers for the visualizer
    const renderVisualizer = () => {
        if (status === 'idle') return null;

        return (
            <div className="relative w-full h-[300px] border border-white/5 bg-white/[0.01] rounded-2xl p-6 flex items-center justify-center overflow-hidden mb-8">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center bg-repeat opacity-5"></div>

                <AnimatePresence mode="wait">
                    {/* Status: Uploading/Analyzing */}
                    {status === 'uploading' && (
                        <motion.div
                            key="uploading"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.2, opacity: 0 }}
                            className="flex flex-col items-center justify-center gap-4"
                        >
                            <div className="w-24 h-32 bg-blue-500/10 border-2 border-blue-500/50 rounded-xl flex items-center justify-center relative overflow-hidden">
                                <motion.div
                                    className="absolute inset-0 bg-blue-500/20"
                                    animate={{
                                        y: ['100%', '-100%']
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 2,
                                        ease: "linear"
                                    }}
                                />
                                <FileText className="text-blue-400 w-12 h-12 relative z-10" />
                            </div>
                            <span className="text-blue-400 font-mono tracking-widest text-xs">ANALYZING PAYLOAD...</span>
                        </motion.div>
                    )}

                    {/* Status: Chunking & Encoding */}
                    {(status === 'chunking' || status === 'encoding') && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex flex-col items-center justify-center gap-6 w-full"
                        >
                            <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg">
                                <AnimatePresence>
                                    {chunks.map((chunk, i) => (
                                        <motion.div
                                            key={chunk.id}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-[10px] font-mono font-bold
                                                ${chunk.type === 'data'
                                                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                                    : 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                                }`}
                                        >
                                            {chunk.type === 'data' ? 'D' : 'P'}-{i}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                            <span className="text-purple-400 font-mono tracking-widest text-xs animate-pulse">
                                {status === 'chunking' ? 'PARTITIONING DATA...' : 'REED-SOLOMON ENCODING...'}
                            </span>
                        </motion.div>
                    )}

                    {/* Status: Distributing */}
                    {status === 'distributing' && (
                        <motion.div
                            key="distributing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center gap-6 w-full h-full relative"
                        >
                            <Server className="text-emerald-500/30 w-32 h-32 absolute opacity-10" />
                            <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg relative z-10">
                                {chunks.map((chunk, i) => (
                                    <motion.div
                                        key={chunk.id}
                                        initial={{ y: 0, opacity: 1 }}
                                        animate={chunk.status === 'distributed' ? {
                                            y: -100 - (Math.random() * 50),
                                            x: (Math.random() - 0.5) * 200,
                                            scale: 0.5,
                                            opacity: 0
                                        } : {}}
                                        transition={{ duration: 1 }}
                                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-[8px] font-mono
                                            ${chunk.type === 'data' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-purple-500/10 border-purple-500/50 text-purple-400'}`}
                                    >
                                        TX
                                    </motion.div>
                                ))}
                            </div>
                            <span className="text-emerald-400 font-mono tracking-widest text-xs absolute bottom-4 animate-pulse">TRANSMITTING TO ORBITAL MESH...</span>
                        </motion.div>
                    )}

                    {/* Status: Downloading */}
                    {status === 'downloading' && (
                        <motion.div
                            key="downloading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center gap-6 w-full h-full relative"
                        >
                            <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg relative z-10">
                                {chunks.map((chunk, i) => (
                                    <motion.div
                                        key={chunk.id}
                                        initial={{
                                            y: -150 - (Math.random() * 50),
                                            x: (Math.random() - 0.5) * 200,
                                            scale: 0.5,
                                            opacity: 0
                                        }}
                                        animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
                                        transition={{ duration: 1.5, delay: i * 0.2 }}
                                        className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-[10px] font-mono font-bold
                                            ${chunk.type === 'data' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-purple-500/10 border-purple-500/50 text-purple-400'}`}
                                    >
                                        RX
                                    </motion.div>
                                ))}
                            </div>
                            <span className="text-amber-400 font-mono tracking-widest text-xs absolute bottom-4 animate-pulse">INTERCEPTING SHARDS FROM ORBIT...</span>
                        </motion.div>
                    )}

                    {/* Status: Upload/Download Complete */}
                    {(status === 'upload_complete' || status === 'download_complete') && (
                        <motion.div
                            key="complete"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center justify-center gap-4"
                        >
                            <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                            </div>
                            <span className="text-emerald-400 font-mono tracking-widest text-xs">
                                {status === 'upload_complete' ? 'PAYLOAD SECURED IN ORBIT' : 'RECONSTRUCTION COMPLETE'}
                            </span>
                            <button
                                onClick={resetState}
                                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-gray-400 transition-colors"
                            >
                                START NEW OPERATION
                            </button>
                        </motion.div>
                    )}

                    {/* Status: Error */}
                    {status === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center justify-center gap-4 text-center max-w-md"
                        >
                            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                                <AlertCircle className="w-12 h-12 text-red-500" />
                            </div>
                            <span className="text-red-500 font-mono tracking-widest text-[10px] uppercase">
                                OPERATION FAILED
                            </span>
                            <p className="text-red-400/80 text-xs font-mono mt-2">{error}</p>
                            <button
                                onClick={resetState}
                                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-gray-400 transition-colors"
                            >
                                DISMISS
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar">
            <div
                className="w-full max-w-5xl h-fit bg-[#05080f]/90 backdrop-blur-3xl border-l-4 border-b-4 border-l-blue-500/50 border-b-blue-500/50 border-t border-r border-t-white/10 border-r-white/10 p-10 relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-4"
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
