import React, { useState } from 'react';
import { UploadCloud, DownloadCloud } from 'lucide-react';

export function FilePanel({ onUpload, onDownload, fileId }) {
    const [file, setFile] = useState(null);
    const [downloadId, setDownloadId] = useState('');

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        await onUpload(formData);
    };

    const handleDownload = async (e) => {
        e.preventDefault();
        if (!downloadId && !fileId) return;
        await onDownload(downloadId || fileId);
    };

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-300 font-bold mb-4 border-b border-gray-800 pb-2">DATA UPLINK / DOWNLINK</div>

            <div className="grid grid-cols-2 gap-6">
                <form onSubmit={handleUpload} className="space-y-3 p-3 bg-gray-800/30 rounded border border-dashed border-gray-700">
                    <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-900 file:text-blue-200 hover:file:bg-blue-800"
                    />
                    <button type="submit" disabled={!file} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2 rounded text-sm transition-colors">
                        <UploadCloud size={16} /> UPLINK FILE
                    </button>
                </form>

                <form onSubmit={handleDownload} className="space-y-3 p-3 bg-gray-800/30 rounded border border-dashed border-gray-700">
                    <input
                        type="text"
                        placeholder="File UUID"
                        value={downloadId || fileId || ''}
                        onChange={(e) => setDownloadId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:border-cyan-500 outline-none"
                    />
                    <button type="submit" disabled={!downloadId && !fileId} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white p-2 rounded text-sm transition-colors">
                        <DownloadCloud size={16} /> RECONSTRUCT & DOWNLINK
                    </button>
                </form>
            </div>
        </div>
    );
}
