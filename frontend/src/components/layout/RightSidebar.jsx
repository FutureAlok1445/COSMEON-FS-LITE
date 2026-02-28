import React, { useState } from 'react';
import MatrixDensity from '../matrix/MatrixDensity';
import { Upload, Download, FileText, Server } from 'lucide-react';

export default function RightSidebar({ messages, fileId, onUpload, onDownload }) {
    const [file, setFile] = useState(null);
    const [downloadId, setDownloadId] = useState('');

    const handleUpload = async () => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        await onUpload(formData);
        setFile(null);
    };

    const handleDownload = async () => {
        if (!downloadId && !fileId) return;
        await onDownload(downloadId || fileId);
        setDownloadId('');
    };

    return (
        <div className="w-full h-full flex flex-col p-4 relative z-20">
            <div className="flex items-center gap-2 mb-4">
                <Server className="text-blue-500" size={14} />
                <h2 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Node Metrics</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-mono">Active Nodes</p>
                    <p className="text-xl font-mono font-bold text-white tracking-tight">1,240</p>
                </div>
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-mono">Global Cap</p>
                    <p className="text-xl font-mono font-bold text-white tracking-tight">85.4 <span className="text-sm text-gray-500">PB</span></p>
                </div>
            </div>

            <MatrixDensity messages={messages} />

            {/* Actions Area */}
            <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse border border-blue-400"></div>
                     <h2 className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">Payload Ops</h2>
                </div>

                {/* Upload Container */}
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-1 flex flex-col gap-1 hover:border-white/20 transition-colors">
                    <label className="flex items-center justify-center p-3 text-[10px] font-bold text-gray-400 tracking-widest cursor-pointer hover:text-white transition-colors border border-dashed border-white/10 rounded-lg bg-white/[0.01]">
                        {file ? <span className="text-blue-400 flex items-center gap-2 font-mono"><FileText size={14} /> {file.name}</span> : 'SELECT TARGET PAYLOAD'}
                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                    </label>
                    
                    <button
                        onClick={handleUpload}
                        disabled={!file}
                        className="w-full bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-30 disabled:border-white/10 disabled:bg-white/5 text-blue-400 font-bold py-3 pt-3.5 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all flex items-center justify-center gap-2 text-[10px] tracking-widest uppercase"
                    >
                        <Upload size={14} /> Manual Uplink
                    </button>
                </div>

                {/* Download Container */}
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-1 flex relative z-30 shadow-lg hover:border-white/20 transition-colors mt-2">
                    <input
                        type="text"
                        placeholder="UUID HASH"
                        value={downloadId || fileId || ''}
                        onChange={(e) => setDownloadId(e.target.value)}
                        className="flex-1 w-0 bg-transparent text-[11px] font-mono text-white px-3 py-2.5 outline-none placeholder:text-gray-600 tracking-wider"
                    />
                    <button
                        onClick={handleDownload}
                        disabled={!downloadId && !fileId}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 disabled:opacity-30 disabled:border-white/10 disabled:bg-white/5 text-emerald-400 px-4 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all flex items-center gap-2 shrink-0"
                    >
                        <Download size={14} /> Pull
                    </button>
                </div>
            </div>

        </div>
    );
}
