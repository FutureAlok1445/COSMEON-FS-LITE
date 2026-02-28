import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import HUDDock from './components/layout/HUDDock';
import GlobalMetrics from './components/layout/GlobalMetrics';
import RightSidebar from './components/layout/RightSidebar';
import CinematicBoot from './components/layout/CinematicBoot';

import OrbitalMap3D from './components/orbital/OrbitalMap3D';
import ResilienceChart from './components/metrics/ResilienceChart';
import GsUplinkStatus from './components/metrics/GsUplinkStatus';
import { MissionLog } from './components/terminal/MissionLog';
import MissionTerminal from './components/terminal/MissionTerminal';
import NetworkMap3D from './components/network/NetworkMap3D';
import StorageMap from './components/storage/StorageMap';
import PayloadOps from './components/payload/PayloadOps';
import ChaosOps from './components/chaos/ChaosOps';

function Dashboard() {
  const { messages, connected } = useWebSocket('ws://localhost:8000/ws');
  const [fileId, setFileId] = useState(null);
  const [currentTab, setCurrentTab] = useState('Payload Ops');
  const [booting, setBooting] = useState(true);

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
      let filename = `download-${uuid}`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/["']/g, '');
      }

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

  if (booting) {
    return <CinematicBoot onComplete={() => setBooting(false)} />;
  }

  // Determine which background map to show
  const isNetworkMap = currentTab === 'Network Topology'; // Fallback if name changes
  // Storage Nodes, Payload, Chaos, Orbital Engine can all share the OrbitalMap3D background

  return (
    <div className="h-screen w-screen bg-[#02040A] text-gray-200 overflow-hidden font-sans relative">
      <div className="fixed inset-0 z-0 pointer-events-auto">
        {isNetworkMap ? <NetworkMap3D messages={messages} /> : <OrbitalMap3D />}
      </div>

      {/* Subtle Ambient Glow Behind Main Content */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* New Floating Dock Navigation */}
      <HUDDock currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* 2. Glass UI Layer Stack overlay */}
      <div className="relative z-10 flex h-full w-full pointer-events-none p-6 pb-28">

        {/* Central Grid overlay */}
        <div className="flex-1 flex px-4 sm:px-8 pb-4 sm:pb-8 pt-4 gap-8 h-full relative">

          {/* Main Stage Overlays */}
          <div className="flex-1 flex flex-col min-w-0 h-full relative">

            {/* Top Section - Floating Info Widgets / Modals */}
            <div className="flex-1 relative min-h-0 pointer-events-none">
              {currentTab === 'Orbital Engine' && (
                <>
                  <div className="absolute top-0 left-0 z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-md pointer-events-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse"></div>
                      <h2 className="text-blue-500 font-bold tracking-[0.2em] text-[10px] uppercase">FS-LITE Real-Time Simulation</h2>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">Orbital Plane Heatmaps</h1>
                    <p className="text-xs text-gray-400 leading-relaxed font-mono">
                      Global telemetry mesh active. High-fidelity orbital file system striping across active planes.
                    </p>
                  </div>

                  <GlobalMetrics connected={connected} />
                </>
              )}

              {/* Modals for non-map features */}
              {currentTab === 'Storage Nodes' && (
                <div className="absolute inset-0 z-20 pointer-events-auto flex items-center justify-center">
                  <div className="w-full h-full">
                    <StorageMap />
                  </div>
                </div>
              )}
              {currentTab === 'Payload Ops' && (
                <div className="absolute inset-0 z-20 pointer-events-auto flex items-center justify-center">
                  <div className="w-full max-w-6xl h-full pb-10">
                    <PayloadOps messages={messages} fileId={fileId} onUpload={handleUpload} onDownload={handleDownload} />
                  </div>
                </div>
              )}

              {currentTab === 'Chaos Ops' && (
                <div className="absolute inset-0 z-20 pointer-events-auto">
                  <ChaosOps messages={messages} />
                </div>
              )}
            </div>

            {/* Bottom Panels Layout - Overlaying the map */}
            {currentTab === 'Orbital Engine' && (
              <div className="h-[260px] min-h-[260px] max-h-[260px] shrink-0 grid grid-cols-12 gap-6 relative z-10 w-full overflow-hidden pointer-events-auto mt-6">
                <div className="col-span-4 h-full min-h-0">
                  <ResilienceChart />
                </div>
                <div className="col-span-4 h-full min-h-0">
                  <MissionTerminal currentTab={currentTab} messages={messages} />
                </div>
                <div className="col-span-4 h-full min-h-0 flex flex-col">
                  <MissionLog messages={messages} />
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Overlay */}
          {currentTab === 'Orbital Engine' && (
            <div className="w-80 shrink-0 h-full overflow-y-auto bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-2 shadow-2xl pointer-events-auto">
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

