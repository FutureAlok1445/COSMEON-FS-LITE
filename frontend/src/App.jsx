import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MissionLog } from './components/terminal/MissionLog';
import { ChaosPanel } from './components/chaos/ChaosPanel';
import { FilePanel } from './components/FilePanel';
import { Network, Database, Shield } from 'lucide-react';

function Dashboard() {
  const { messages, connected } = useWebSocket('ws://localhost:8000/ws');
  const [fileId, setFileId] = useState(null);

  const handleUpload = async (formData) => {
    try {
      const res = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.file_id) setFileId(data.file_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (uuid) => {
    window.open(`http://localhost:8000/api/download/${uuid}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-200 p-6 flex flex-col font-sans">
      <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-widest text-cyan-400">COSMEON <span className="text-white">FS-LITE</span></h1>
          <p className="text-gray-500 text-sm italic tracking-widest mt-1">"Divide to Survive. Combine to Thrive."</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-mono">{connected ? 'ORBITAL MESH SYNCED' : 'AWAITING TELEMETRY'}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-4 py-2 rounded-lg text-cyan-400">
            <Shield size={16} /> <span className="text-xs font-bold text-gray-300">RS(4,2) ARMED</span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-6 h-full">
        {/* Top Left: Orbital Constellation (Hero) */}
        <div className="col-span-8 row-span-4 bg-gray-900 border border-gray-800 rounded-xl p-4 relative overflow-hidden flex flex-col justify-center items-center h-[500px]">
          <div className="absolute top-4 left-4 text-gray-400 font-bold tracking-wider flex items-center gap-2 z-10"><Network size={18} /> ORBITAL TOPOLOGY AWARENESS</div>
          {/* Custom SVG CSS Orbits */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Earth */}
            <div className="absolute w-32 h-32 bg-blue-900/40 rounded-full border-4 border-blue-600/50 shadow-[0_0_50px_rgba(37,99,235,0.5)] z-10 flex items-center justify-center font-bold text-blue-200 backdrop-blur-sm">EARTH</div>

            {/* Plane Alpha */}
            <div className="absolute w-[300px] h-[300px] border border-cyan-500/30 rounded-full animate-[spin_20s_linear_infinite]" />
            <div className="absolute w-4 h-4 bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-full z-20 translate-x-[150px]" style={{ animation: 'spin 20s linear infinite reverse' }} />
            <div className="absolute w-4 h-4 bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-full z-20 -translate-x-[150px]" style={{ animation: 'spin 20s linear infinite reverse' }} />

            {/* Plane Beta */}
            <div className="absolute w-[450px] h-[450px] border border-purple-500/30 rounded-full animate-[spin_35s_linear_infinite_reverse]" />
            <div className="absolute w-4 h-4 bg-purple-400 shadow-[0_0_15px_#c084fc] rounded-full z-20 translate-y-[225px]" style={{ animation: 'spin 35s linear infinite' }} />
            <div className="absolute w-4 h-4 bg-purple-400 shadow-[0_0_15px_#c084fc] rounded-full z-20 -translate-y-[225px]" style={{ animation: 'spin 35s linear infinite' }} />

            {/* Plane Gamma */}
            <div className="absolute w-[600px] h-[200px] border border-green-500/30 rounded-full animate-[spin_15s_linear_infinite]" />
            <div className="absolute w-4 h-4 bg-green-400 shadow-[0_0_15px_#4ade80] rounded-full z-20 translate-x-[300px]" style={{ animation: 'spin 15s linear infinite reverse' }} />
            <div className="absolute w-4 h-4 bg-green-400 shadow-[0_0_15px_#4ade80] rounded-full z-20 -translate-x-[300px]" style={{ animation: 'spin 15s linear infinite reverse' }} />
          </div>
        </div>

        {/* Top Right: Metrics / Matrix / Upload */}
        <div className="col-span-4 row-span-4 flex flex-col gap-6 h-[500px]">
          <FilePanel onUpload={handleUpload} onDownload={handleDownload} fileId={fileId} />

          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col overflow-hidden">
            <div className="text-gray-400 font-bold tracking-wider flex items-center gap-2 mb-4 border-b border-gray-800 pb-2"><Database size={18} /> EFFICIENCY METRICS</div>
            {/* Mock Recharts layout using divs for speed */}
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="bg-gray-800/50 rounded flex flex-col items-center justify-center p-2 border border-blue-500/20">
                <span className="text-3xl font-mono text-blue-400">1.5x</span>
                <span className="text-xs text-gray-500 uppercase">Storage Overhead</span>
                <span className="text-[10px] text-green-400">-50% vs Replication</span>
              </div>
              <div className="bg-gray-800/50 rounded flex flex-col items-center justify-center p-2 border border-purple-500/20">
                <span className="text-3xl font-mono text-purple-400">10<sup>14</sup></span>
                <span className="text-xs text-gray-500 uppercase">MTTDL (Hours)</span>
                <span className="text-[10px] text-green-400">+1,000,000x Factor</span>
              </div>
              <div className="bg-gray-800/50 rounded flex flex-col items-center justify-center p-2 border border-cyan-500/20">
                <span className="text-3xl font-mono text-cyan-400 text-center">37ms</span>
                <span className="text-xs text-gray-500 uppercase text-center">RS Recovery Time</span>
                <span className="text-[10px] text-yellow-400">Max Acceptable: 50ms</span>
              </div>
              <div className="bg-gray-800/50 rounded flex flex-col items-center justify-center p-2 border border-green-500/20">
                <span className="text-3xl font-mono text-green-400">100%</span>
                <span className="text-xs text-gray-500 uppercase text-center">Integrity Verification</span>
                <span className="text-[10px] text-green-400">Multi-Level SHA-256</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Left: Chaos Panel */}
        <div className="col-span-4 row-span-2 h-[280px]">
          <ChaosPanel />
        </div>

        {/* Bottom Right: Mission Log */}
        <div className="col-span-8 row-span-2 h-[280px]">
          <MissionLog messages={messages} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
