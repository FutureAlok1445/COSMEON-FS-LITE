import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import GlobeViewer from '../components/tracking/GlobeViewer';
import TelemetryPanel from '../components/tracking/TelemetryPanel';
import { propagateTLE, getOrbitPath } from '../utils/tleUtils';
import { ArrowLeft, Globe, Share2, Activity, Zap, Satellite, AlertTriangle } from 'lucide-react';

const GROUND_STATIONS = [
    { name: 'NASA WHITE SANDS', lat: 32.5007, lng: -106.6086, color: '#00FFC8' },
    { name: 'ESA KOUROU', lat: 5.2394, lng: -52.7674, color: '#00FFC8' },
    { name: 'ISRO BYALALU', lat: 12.9156, lng: 77.3468, color: '#00FFC8' },
    { name: 'USSPACECOM THULE', lat: 76.5312, lng: -68.7031, color: '#00FFC8' }
];

const PRESET_SATELLITES = [
    { name: 'ISS (ZARYA)', noradId: 25544 },
    { name: 'SPACE STATION', noradId: 48274 },
    { name: 'HUBBLE', noradId: 20580 },
    { name: 'NOAA 19', noradId: 33591 },
    { name: 'LANDSAT 9', noradId: 49260 },
    { name: 'STARLINK-31627', noradId: 58826 },
];

export default function SatelliteTrackerPage({ nodes, messages, onBack }) {
    const [selectedSatellite, setSelectedSatellite] = useState(PRESET_SATELLITES[0]);
    const [allTle, setAllTle] = useState({}); // { noradId: [name, l1, l2] }
    const [allPositions, setAllPositions] = useState({}); // { noradId: { lat, lng, alt, vel, time, name } }
    const [allOrbitPaths, setAllOrbitPaths] = useState({}); // { noradId: [points] }
    const [showAll, setShowAll] = useState(false);
    const [dtnEvents, setDtnEvents] = useState([]);
    const [loading, setLoading] = useState(true);


    // 1. Fetch TLE data and Historical Events
    useEffect(() => {
        async function fetchInitialData() {
            setLoading(true);
            try {
                // Fetch TLE
                const tleRes = await fetch(`http://localhost:8000/api/tle`);
                const tleData = await tleRes.text();
                const lines = tleData.split('\n');
                const newAllTle = {};
                const newAllPaths = {};

                PRESET_SATELLITES.forEach(sat => {
                    const line2Regex = new RegExp(`^2\\s+${sat.noradId}\\s+`);
                    let satTle = null;
                    for (let i = 0; i < lines.length; i++) {
                        if (line2Regex.test(lines[i].trim())) {
                            if (i >= 2) {
                                satTle = [lines[i - 2].trim(), lines[i - 1].trim(), lines[i].trim()];
                                break;
                            }
                        }
                    }
                    if (!satTle) {
                        satTle = [sat.name, "1 25544U 98067A   24061.50000000  .00016717  00000-0  10270-3 0  9999", "2 25544  51.6410 208.9163 0006317  86.9689 273.1587 15.4930914445467"];
                    }
                    newAllTle[sat.noradId] = satTle;
                    newAllPaths[sat.noradId] = getOrbitPath(satTle[1], satTle[2]);
                });
                setAllTle(newAllTle);
                setAllOrbitPaths(newAllPaths);

                // Fetch DTN History
                const eventRes = await fetch(`http://localhost:8000/api/dtn/events?limit=30`);
                if (eventRes.ok) {
                    const eventData = await eventRes.json();
                    const initialEvents = eventData.map(e => ({
                        id: `hist-${e.id}`,
                        time: new Date(e.timestamp).toLocaleTimeString(),
                        type: e.type,
                        message: e.message,
                        nodeId: e.metadata?.node_id
                    })).reverse();
                    setDtnEvents(initialEvents);
                }

            } catch (err) {
                console.error("Failed to fetch initial data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (Object.keys(allTle).length === 0) return;

        const interval = setInterval(() => {
            const newPositions = {};
            Object.entries(allTle).forEach(([noradId, tleData]) => {
                const pos = propagateTLE(tleData[1], tleData[2]);
                if (pos) {
                    const satName = PRESET_SATELLITES.find(s => s.noradId === parseInt(noradId))?.name || 'UNKNOWN';
                    newPositions[noradId] = { ...pos, name: satName };
                }
            });
            setAllPositions(newPositions);
        }, 1000);

        return () => clearInterval(interval);
    }, [allTle]);

    // 3. Handle DTN Events from the passed prop messages
    useEffect(() => {
        if (!messages || !messages.length) return;
        const lastMsg = messages[messages.length - 1];

        const dtnTypes = ['DTN_QUEUED', 'DTN_FLUSH_START', 'DTN_BUNDLE_DELIVERED', 'DTN_FLUSH_COMPLETE', 'NODE_ONLINE', 'NODE_OFFLINE', 'NODE_PARTITIONED', 'CHAOS_TRIGGERED'];
        if (dtnTypes.includes(lastMsg.type) || lastMsg.event) {
            const eventType = lastMsg.type || lastMsg.event;
            const payload = lastMsg.data || lastMsg;

            setDtnEvents(prev => [{
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                type: eventType,
                message: payload.message || `${eventType} on ${payload.node_id || 'system'}`,
                nodeId: payload.node_id
            }, ...prev].slice(0, 50));
        }
    }, [messages]);

    const handleToggleNode = async (nodeId) => {
        try {
            await fetch(`http://localhost:8000/api/node/${nodeId}/toggle`, { method: 'POST' });
        } catch (err) {
            console.error("Failed to toggle node", err);
        }
    };

    return (
        <div className="h-screen w-screen bg-[#02040A] text-gray-200 overflow-hidden font-sans relative flex flex-col p-6 animate-in fade-in duration-500">

            {/* Background Ambient Glow */}
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-cyan-600/5 blur-[150px] rounded-full pointer-events-none z-0"></div>

            {/* Header Navigation */}
            <div className="relative z-10 flex justify-between items-center mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Return to Dashboard</span>
                </button>

                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <Globe size={16} />
                        <h1 className="text-xs font-mono tracking-[0.3em] uppercase font-bold">Orbital Intelligence Network</h1>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest uppercase">Live Tracking & DTN Store-Forward Protocol</div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-cyan-400 font-bold tracking-widest">{selectedSatellite.name}</span>
                        <span className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Syncing Live Telemetry</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Satellite size={20} />
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex-1 flex gap-6 relative z-10 overflow-hidden">

                {/* 3D Viewport */}
                <div className="flex-[7] relative bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden group">

                    {/* HUD Overlays */}
                    <div className="absolute top-6 left-6 z-10 pointer-events-none">
                        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                            <span className="text-[10px] font-mono tracking-widest text-white uppercase">Live Orbital Track</span>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 z-10 pointer-events-none">
                        <div className="text-right font-mono">
                            <div className="text-[10px] text-gray-400 tracking-widest">PROPAGATION_ENGINE: SGP4</div>
                            <div className="text-[10px] text-gray-400 tracking-widest mt-1">EPOCH_SYNC: {new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-6 z-10 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                        <div className="grid grid-cols-2 gap-4 text-[9px] font-mono text-gray-400">
                            <div>RENDER: GL_CORE_3.0</div>
                            <div>FPS: 60.00</div>
                            <div>LOD: HIGH_FIDELITY</div>
                            <div>SHADING: PHONG_DYNAMICS</div>
                        </div>
                    </div>

                    <Canvas gl={{ antialias: true, alpha: true }}>
                        <Suspense fallback={null}>
                            <GlobeViewer
                                satellites={showAll
                                    ? PRESET_SATELLITES.map(s => {
                                        const nodeId = `SAT-${String(s.noradId).slice(-2)}`;
                                        const nodeData = nodes.find(n => n.node_id === nodeId);
                                        return {
                                            ...s,
                                            currentPos: allPositions[s.noradId],
                                            orbitPath: allOrbitPaths[s.noradId],
                                            isPrimary: s.noradId === selectedSatellite.noradId,
                                            queueDepth: nodeData?.dtn_queue_depth || 0,
                                            isOnline: nodeData?.status === 'ONLINE'
                                        };
                                    })
                                    : [{
                                        ...selectedSatellite,
                                        currentPos: allPositions[selectedSatellite.noradId],
                                        orbitPath: allOrbitPaths[selectedSatellite.noradId],
                                        isPrimary: true,
                                        queueDepth: nodes.find(n => n.node_id.includes(String(selectedSatellite.noradId).slice(-2)))?.dtn_queue_depth || 0,
                                        isOnline: nodes.find(n => n.node_id.includes(String(selectedSatellite.noradId).slice(-2)))?.status === 'ONLINE'
                                    }]
                                }
                                groundStations={GROUND_STATIONS}
                            />
                        </Suspense>
                    </Canvas>

                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-20">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                                <div className="text-cyan-500 font-mono text-sm tracking-[0.2em] animate-pulse">ESTABLISHING SATELLITE UPLINK...</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Telemetry */}
                <div className="flex-[2.5] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                    <TelemetryPanel
                        telemetry={allPositions[selectedSatellite.noradId]}
                        selectedSatellite={selectedSatellite}
                        onSatelliteChange={setSelectedSatellite}
                        satellites={PRESET_SATELLITES}
                        nodes={nodes}
                        showAll={showAll}
                        onToggleShowAll={() => setShowAll(!showAll)}
                        dtnEvents={dtnEvents}
                        onToggleNode={handleToggleNode}
                    />
                </div>
            </div>

            {/* Footer System Status */}
            <div className="relative z-10 h-8 flex items-center justify-between mt-4 px-2 font-mono text-[9px] text-gray-500 uppercase tracking-widest border-t border-white/5 pt-4">
                <div className="flex gap-4">
                    <span>System: Stable</span>
                    <span className="text-cyan-500/50">|</span>
                    <span>Uptime: 99.99%</span>
                    <span className="text-cyan-500/50">|</span>
                    <span>Latency: 42ms</span>
                </div>
                <div className="flex gap-4">
                    <span>CelesTrak API: Connected</span>
                    <span className="text-cyan-500/50">|</span>
                    <span>DTN Protocol: v7.0.2</span>
                </div>
            </div>
        </div>
    );
}
