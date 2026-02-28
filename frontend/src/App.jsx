import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import RightSidebar from './components/layout/RightSidebar';

import OrbitalMap3D from './components/orbital/OrbitalMap3D';
import ResilienceChart from './components/metrics/ResilienceChart';
import GsUplinkStatus from './components/metrics/GsUplinkStatus';
import { MissionLog } from './components/terminal/MissionLog';
import NetworkMap3D from './components/network/NetworkMap3D';
import StorageMap from './components/storage/StorageMap';
import PayloadOps from './components/payload/PayloadOps';
import ChaosOps from './components/chaos/ChaosOps';

function Dashboard() {
  const { messages, connected } = useWebSocket('ws://localhost:8000/ws');
  const [fileId, setFileId] = useState(null);
  const [currentTab, setCurrentTab] = useState('Orbital Engine');

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
    try {
      const res = await fetch(`http://localhost:8000/api/download/${uuid}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();

      // Try to extract original filename from Content-Disposition header
      let filename = `download-${uuid}`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/["']/g, '');
      }

      // Trigger actual download in the browser
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#02040A] text-gray-200 flex overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Subtle Ambient Glow Behind Main Content */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>

        <Topbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <div className="flex-1 flex px-8 pb-8 pt-4 gap-8 h-0 z-10">
          {/* Main Stage */}
          <div className="flex-1 flex flex-col min-w-0 h-full">

            {/* 3D Map Section / Main Content Area */}
            <div className={`flex-1 relative mb-6 min-h-0 ${currentTab !== 'Storage Nodes' && currentTab !== 'Payload Ops' && currentTab !== 'Chaos Ops' ? 'cursor-grab active:cursor-grabbing rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]' : 'rounded-3xl border border-white/5 overflow-hidden'}`}>

              {currentTab === 'Orbital Engine' ? (
                <>
                  {/* Glassmorphic Project Info Layer */}
                  <div className="absolute top-6 left-6 z-10 bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-md pointer-events-none">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse"></div>
                      <h2 className="text-blue-500 font-bold tracking-[0.2em] text-[10px] uppercase">FS-LITE Real-Time Simulation</h2>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">Orbital Plane Heatmaps</h1>
                    <p className="text-xs text-gray-400 leading-relaxed font-mono">
                      Global telemetry mesh active. High-fidelity orbital file system striping across active planes.
                    </p>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-6 right-6 z-10 flex items-center justify-between bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl px-5 py-4 min-w-[220px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-none">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold tracking-[0.15em] uppercase font-mono">Network Load</p>
                      <p className="text-2xl font-bold text-white leading-none mt-1.5 font-mono">
                        {connected ? '42.1 Gbps' : 'OFFLINE'}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${connected ? 'bg-blue-500/10 border-blue-500/30 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)]' : 'bg-red-500/10 border-red-500/30'}`}>
                      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-blue-400 blur-[1px] animate-pulse shadow-[0_0_10px_#60a5fa]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></div>
                    </div>
                  </div>

                  <OrbitalMap3D />
                </>
              ) : currentTab === 'Storage Nodes' ? (
                <StorageMap />
              ) : currentTab === 'Payload Ops' ? (
                <PayloadOps messages={messages} fileId={fileId} onUpload={handleUpload} onDownload={handleDownload} />
              ) : currentTab === 'Chaos Ops' ? (
                <ChaosOps messages={messages} />
              ) : (
                <NetworkMap3D />
              )}

              {/* Bottom Fade Mask for Map */}
              {currentTab !== 'Storage Nodes' && currentTab !== 'Payload Ops' && currentTab !== 'Chaos Ops' && (
                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#02040A] to-transparent pointer-events-none z-20"></div>
              )}
            </div>

            {/* Bottom Panels Layout - Hidden on full-height tabs */}
            {currentTab !== 'Storage Nodes' && currentTab !== 'Payload Ops' && currentTab !== 'Chaos Ops' && (
              <div className="h-[260px] shrink-0 grid grid-cols-12 gap-6 relative z-10 w-full overflow-x-hidden">
                <div className="col-span-4 h-full">
                  <ResilienceChart />
                </div>
                <div className="col-span-4 h-full">
                  <GsUplinkStatus />
                </div>
                <div className="col-span-4 h-full flex flex-col">
                  <MissionLog messages={messages} />
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Hidden on full-height tabs */}
          {currentTab !== 'Storage Nodes' && currentTab !== 'Payload Ops' && currentTab !== 'Chaos Ops' && (
            <div className="w-80 shrink-0 h-full overflow-y-auto bg-white/[0.01] backdrop-blur-2xl border border-white/5 rounded-3xl p-2 shadow-2xl">
              <RightSidebar
                messages={messages}
                fileId={fileId}
                onUpload={handleUpload}
                onDownload={handleDownload}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

