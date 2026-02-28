import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import RightSidebar from './components/layout/RightSidebar';

import OrbitalMap3D from './components/orbital/OrbitalMap3D';
import ResilienceChart from './components/metrics/ResilienceChart';
import GsUplinkStatus from './components/metrics/GsUplinkStatus';
import { ChaosPanel } from './components/chaos/ChaosPanel';
import { MissionLog } from './components/terminal/MissionLog';

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
    <div className="h-screen w-screen bg-[#020617] text-gray-200 flex overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />

        <div className="flex-1 flex p-6 gap-6 h-0">
          {/* Main Stage */}
          <div className="flex-1 flex flex-col min-w-0 h-full">

            {/* 3D Map Section */}
            <div className="flex-1 relative pb-6 min-h-0 cursor-grab active:cursor-grabbing">
              <div className="absolute top-0 left-0 z-10">
                <h2 className="text-blue-500 font-bold tracking-[0.2em] text-[10px] uppercase">FS-LITE Real-Time Simulation</h2>
                <h1 className="text-3xl font-bold text-white mt-1">Orbital Plane Heatmaps</h1>
                <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed">
                  Global telemetry mesh for high-fidelity orbital file system striping across active planes.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="absolute top-0 right-0 z-10 flex items-center justify-between bg-[#111827]/80 backdrop-blur border border-[#1e293b] rounded-xl px-4 py-3 min-w-[200px] shadow-2xl">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Network Load</p>
                  <p className="text-xl font-bold text-white leading-none mt-1">
                    {connected ? '42.1 Gbps' : 'OFFLINE'}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connected ? 'bg-blue-600 shadow-[0_0_15px_#2563eb]' : 'bg-red-600'}`}>
                  <div className={`w-3 h-3 rounded-full ${connected ? 'bg-white blur-[1px] animate-pulse' : 'bg-white'}`}></div>
                </div>
              </div>

              <OrbitalMap3D />
            </div>

            {/* Bottom Panels Layout */}
            <div className="h-[250px] shrink-0 grid grid-cols-12 gap-6 relative z-10 w-full overflow-x-hidden">
              <div className="col-span-3 h-full">
                <ResilienceChart />
              </div>
              <div className="col-span-3 h-full">
                <GsUplinkStatus />
              </div>
              <div className="col-span-3 h-full">
                <ChaosPanel />
              </div>
              <div className="col-span-3 h-full flex flex-col">
                <MissionLog messages={messages} />
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 shrink-0 border-l border-[#1e293b] h-full overflow-y-auto">
            <RightSidebar
              messages={messages}
              fileId={fileId}
              onUpload={handleUpload}
              onDownload={handleDownload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
