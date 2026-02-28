import React, { useState } from 'react';
import MatrixDensity from '../matrix/MatrixDensity';
import { Upload, Download, FileText } from 'lucide-react';

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
        <div className="w-80 h-full flex flex-col pl-6">
            <h2 className="text-xs font-bold text-gray-500 tracking-widest mb-4">NODE METRICS</h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 shadow-lg">
                    <p className="text-[10px] text-gray-400 mb-1">Active Nodes</p>
                    <p className="text-xl font-bold text-white">1,240</p>
                </div>
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 shadow-lg">
                    <p className="text-[10px] text-gray-400 mb-1">Total Capacity</p>
                    <p className="text-xl font-bold text-white">85.4 PB</p>
                </div>
            </div>

            <MatrixDensity messages={messages} />

            {/* Upload/Download Controls styled like the big blue button area */}
            <div className="mt-6 flex flex-col gap-3">
                {/* Upload Container */}
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-3">
                    <label className="flex items-center justify-between text-xs font-bold text-gray-400 tracking-widest cursor-pointer hover:text-white transition-colors">
                        {file ? <span className="text-blue-400 flex items-center gap-1"><FileText size={14} /> {file.name}</span> : 'SELECT PAYLOAD FOR UPLINK'}
                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                    </label>
                </div>
                <button
                    onClick={handleUpload}
                    disabled={!file}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2"
                >
                    <Upload size={18} /> TRIGGER MANUAL UPLINK
                </button>

                {/* Download Container */}
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-1 flex mt-2">
                    <input
                        type="text"
                        placeholder="UUID"
                        value={downloadId || fileId || ''}
                        onChange={(e) => setDownloadId(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-gray-300 px-3 outline-none"
                    />
                    <button
                        onClick={handleDownload}
                        disabled={!downloadId && !fileId}
                        className="bg-[#10b981] hover:bg-emerald-400 disabled:opacity-50 text-black px-4 py-2 rounded-lg font-bold text-xs"
                    >
                        <Download size={14} /> DOWNLINK
                    </button>
                </div>
            </div>

        </div>
    );
}
