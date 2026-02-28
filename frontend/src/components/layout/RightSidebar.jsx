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

        </div>
    );
}
