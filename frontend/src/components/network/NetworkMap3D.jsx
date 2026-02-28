import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { Activity, ShieldCheck, Zap, Search, X, Globe } from 'lucide-react';

// --- Constants & Config ---
const EARTH_RADIUS_KM = 6371;
const SCALE_FACTOR = 1 / 1000; // 1 Three.js unit = 1000km

// Simple Earth Sphere
function Earth() {
    return (
        <mesh>
            <sphereGeometry args={[EARTH_RADIUS_KM * SCALE_FACTOR, 64, 64]} />
            <meshStandardMaterial
                color="#0a192f"
                emissive="#020c1b"
                roughness={0.7}
                metalness={0.1}
                wireframe={true}
                transparent={true}
                opacity={0.3}
            />
        </mesh>
    );
}

// Glowing Atmosphere
function Atmosphere() {
    return (
        <mesh>
            <sphereGeometry args={[(EARTH_RADIUS_KM + 100) * SCALE_FACTOR, 64, 64]} />
            <meshBasicMaterial
                color="#3b82f6"
                transparent={true}
                opacity={0.1}
                side={THREE.BackSide}
            />
        </mesh>
    );
}

// Real-Time Satellite Swarm using InstancedMesh
function SatelliteSwarm({ satrecs, onSelect }) {
    const meshRef = useRef();

    // Create a dummy Object3D to help calculate matrix transformations
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(() => {
        if (!meshRef.current || satrecs.length === 0) return;

        const now = new Date();
        const gmst = satellite.gstime(now);

        satrecs.forEach((satrec, i) => {
            const positionAndVelocity = satellite.propagate(satrec, now);
            const positionEci = positionAndVelocity.position;

            if (positionEci && typeof positionEci !== 'boolean') {
                const x = positionEci.x * SCALE_FACTOR;
                const y = positionEci.z * SCALE_FACTOR;
                const z = -positionEci.y * SCALE_FACTOR;

                dummy.position.set(x, y, z);
                dummy.lookAt(0, 0, 0); // Point towards earth
                dummy.updateMatrix();

                meshRef.current.setMatrixAt(i, dummy.matrix);
            }
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (satrecs.length === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[null, null, satrecs.length]}
            onPointerDown={(e) => {
                e.stopPropagation();
                if (e.instanceId !== undefined && onSelect) {
                    onSelect(satrecs[e.instanceId]);
                }
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                document.body.style.cursor = 'default';
            }}
        >
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshBasicMaterial color="#06b6d4" />
        </instancedMesh>
    );
}

export default function NetworkMap3D() {
    const [satrecs, setSatrecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSat, setSelectedSat] = useState(null);
    const [liveSatData, setLiveSatData] = useState(null);

    const [analytics, setAnalytics] = useState({
        leo: 0,
        meo: 0,
        geo: 0
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        async function fetchTLEs() {
            try {
                // Fetch Starlink TLEs via our local backend proxy to bypass CelesTrak CORS blocks
                const response = await fetch('http://localhost:8000/api/tle');

                if (!response.ok) throw new Error('Failed to fetch TLE data via backend proxy');

                const text = await response.text();

                // Parse the TLE text. Format is 3 lines per sat:
                // Name
                // Line 1
                // Line 2
                const lines = text.split('\n').filter(l => l.trim().length > 0);
                const parsedSats = [];

                let stats = { leo: 0, meo: 0, geo: 0 };

                for (let i = 0; i < lines.length; i += 3) {
                    if (lines[i] && lines[i + 1] && lines[i + 2]) {
                        const satName = lines[i].trim();
                        const satrec = satellite.twoline2satrec(lines[i + 1].trim(), lines[i + 2].trim());
                        // Filter out decayed or invalid sats
                        if (satrec && satrec.error === 0) {
                            satrec.name = satName;
                            // Calculate mean motion to approximate altitude
                            // Mean motion (revolutions per day)
                            // 1440 minutes in a day, 2*PI radians in a revolution
                            const meanMotion = satrec.no * (1440 / (2 * Math.PI)); // Convert rad/min to rev/day

                            let orbitType = 'GEO';
                            // Rough altitude categories based on mean motion (rev/day)
                            if (meanMotion >= 11.25) { // Roughly < 2000km
                                stats.leo++;
                                orbitType = 'LEO';
                            } else if (meanMotion < 11.25 && meanMotion > 1.5) { // Roughly 2000km - 35786km
                                stats.meo++;
                                orbitType = 'MEO';
                            } else { // Roughly > 35786km (including GEO)
                                stats.geo++;
                            }
                            satrec.orbitType = orbitType;

                            parsedSats.push(satrec);
                        }
                    }
                }

                // For performance, let's limit to tracking 5000 sats if the file is massive
                setAnalytics(stats);
                setSatrecs(parsedSats.slice(0, 5000));
                setLoading(false);
            } catch (err) {
                console.error("Error loading satellite data:", err);
                setError(err.message);
                setLoading(false);
            }
        }

        fetchTLEs();
    }, []);

    const filteredSatrecs = useMemo(() => {
        if (!searchTerm) return satrecs;
        return satrecs.filter(sat =>
            sat.name && sat.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [satrecs, searchTerm]);

    // Live Telemetry Hook for Selected Satellite
    useEffect(() => {
        if (!selectedSat) {
            setLiveSatData(null);
            return;
        }

        // Setup real-time updates for velocity/altitude/coords
        const interval = setInterval(() => {
            const now = new Date();
            const positionAndVelocity = satellite.propagate(selectedSat, now);
            const gmst = satellite.gstime(now);

            if (positionAndVelocity.position && positionAndVelocity.velocity) {
                // Get Geodetic coordinates (Lat, Lon, Alt)
                const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
                const longitude = satellite.degreesLong(positionGd.longitude);
                const latitude = satellite.degreesLat(positionGd.latitude);
                const height = positionGd.height; // in km

                // Calculate total velocity scalar (km/s)
                const v = positionAndVelocity.velocity;
                const velocityKmS = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

                setLiveSatData({
                    lat: latitude,
                    lon: longitude,
                    alt: height,
                    vel: velocityKmS,
                    status: 'OPTIMAL',
                    // Simulate random storage load for realism based on the node ID
                    load: Math.abs(Math.sin(selectedSat.satnum)) * 100
                });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedSat]);

    return (
        <div className="w-full h-full relative">
            <Canvas camera={{ position: [0, 15, 25], fov: 45 }}>
                <color attach="background" args={['#02040A']} />

                <ambientLight intensity={0.5} color="#4facfe" />
                <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />

                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <Earth />
                <Atmosphere />

                {!loading && <SatelliteSwarm satrecs={satrecs} onSelect={setSelectedSat} />}

                <OrbitControls
                    enablePan={false}
                    minDistance={EARTH_RADIUS_KM * SCALE_FACTOR + 1}
                    maxDistance={40}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>

            {/* Analytics Overlay HUD */}
            {!loading && (
                <div className="absolute top-6 left-6 z-10 w-80 bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 right-1/2 translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

                    <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                        <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                            <Activity className="text-cyan-400" size={16} />
                        </div>
                        <div>
                            <h2 className="text-white font-bold tracking-wide text-sm">Orbital Analytics</h2>
                            <p className="text-[9px] text-cyan-500 font-mono tracking-widest uppercase mt-0.5">Live Telemetry Feed</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* Total Count */}
                        <div>
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Active Mesh Nodes</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-4xl font-mono text-white tracking-tight">{satrecs.length.toLocaleString()}</p>
                                <span className="text-xs text-emerald-400 font-mono font-bold">100% ACCURACY</span>
                            </div>
                        </div>

                        {/* Distributions */}
                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <h3 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Altitude Distribution</h3>

                            {/* LEO */}
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-gray-400 font-mono tracking-wider">LEO (&lt; 2000km)</span>
                                    <span className="text-white text-[10px] font-bold font-mono">{analytics.leo.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
                                    <div className="bg-cyan-400 h-full rounded-sm shadow-[0_0_10px_#22d3ee]" style={{ width: `${(analytics.leo / satrecs.length) * 100}%` }}></div>
                                </div>
                            </div>

                            {/* MEO */}
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-gray-400 font-mono tracking-wider">MEO (&lt; 35786km)</span>
                                    <span className="text-white text-[10px] font-bold font-mono">{analytics.meo.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
                                    <div className="bg-blue-500 h-full rounded-sm shadow-[0_0_10px_#3b82f6]" style={{ width: `${(analytics.meo / satrecs.length) * 100}%` }}></div>
                                </div>
                            </div>

                            {/* GEO */}
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-gray-400 font-mono tracking-wider">GEO (+35786km)</span>
                                    <span className="text-white text-[10px] font-bold font-mono">{analytics.geo.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
                                    <div className="bg-purple-500 h-full rounded-sm shadow-[0_0_10px_#a855f7]" style={{ width: `${(analytics.geo / satrecs.length) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Satellite Details Overlay */}
            {selectedSat && (
                <div className="absolute bottom-6 left-6 z-10 w-80 bg-white/[0.02] backdrop-blur-3xl border border-white/20 rounded-2xl p-5 shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-300 translate-y-0 opacity-100 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck className="text-emerald-400" size={16} />
                                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">{liveSatData?.status || 'SYNCHING...'}</span>
                            </div>
                            <h2 className="text-lg font-bold text-white tracking-wider">{selectedSat.name}</h2>
                        </div>
                        <button onClick={() => setSelectedSat(null)} className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${selectedSat.orbitType === 'LEO' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                                selectedSat.orbitType === 'GEO' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                    'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                            CLASS: {selectedSat.orbitType}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded border bg-white/5 text-gray-400 border-white/10">
                            NORAD: {selectedSat.satnum}
                        </span>
                    </div>

                    {/* Live Telemetry Data */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Altitude</p>
                                <p className="text-sm font-mono text-cyan-300 font-bold">{liveSatData ? liveSatData.alt.toFixed(1) : '---'} <span className="text-[10px] text-gray-500">km</span></p>
                            </div>
                            <div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Velocity</p>
                                <p className="text-sm font-mono text-rose-400 font-bold">{liveSatData ? liveSatData.vel.toFixed(2) : '---'} <span className="text-[10px] text-gray-500">km/s</span></p>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Latitude</p>
                                <p className="text-xs font-mono text-gray-300">{liveSatData ? liveSatData.lat.toFixed(4) : '---'}°</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Longitude</p>
                                <p className="text-xs font-mono text-gray-300">{liveSatData ? liveSatData.lon.toFixed(4) : '---'}°</p>
                            </div>
                        </div>
                    </div>

                    {/* Fictional/Project-specific Storage Data */}
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Network Storage Load</span>
                            <span className="text-white text-[10px] font-bold font-mono">{liveSatData ? liveSatData.load.toFixed(1) : 0}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-1.5 rounded-sm overflow-hidden border border-white/5">
                            <div
                                className={`h-full rounded-sm transition-all duration-500 ${liveSatData?.load > 80 ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : liveSatData?.load > 50 ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}
                                style={{ width: `${liveSatData ? liveSatData.load : 0}%` }}
                            ></div>
                        </div>
                        <p className="text-[9px] text-gray-500 font-mono mt-2 leading-relaxed">
                            Acting as an active Reed-Solomon storage node in the COSMEON distributed orbital mesh.
                        </p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                        <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Syncing Telemetry Array...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl backdrop-blur-md">
                    <p className="font-bold tracking-widest uppercase text-sm">Error Syncing Telemetry</p>
                    <p className="text-xs font-mono mt-1 opacity-80">{error}</p>
                </div>
            )}

            {/* Satellite Database Drawer */}
            {!loading && (
                <>
                    {/* Floating Toggle Button (visible when drawer is closed) */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className={`absolute top-6 right-6 z-10 w-12 h-12 bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center text-cyan-500 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    >
                        <Search size={20} />
                    </button>

                    {/* Sliding Glassmorphic Panel */}
                    <div
                        className={`absolute top-6 bottom-6 right-6 z-20 w-96 bg-[#02040A]/80 backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-out ${isSearchOpen ? 'translate-x-0' : 'translate-x-[120%]'}`}
                    >
                        {/* Header & Search */}
                        <div className="p-6 border-b border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Globe className="text-cyan-500" size={18} />
                                    <h2 className="text-white font-bold tracking-wide text-sm">Active Mesh Database</h2>
                                </div>
                                <button
                                    onClick={() => setIsSearchOpen(false)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by satellite designation..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* Scrolling List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredSatrecs.slice(0, 100).map((sat, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedSat(sat)}
                                    className="bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 p-3 rounded-lg transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-white text-xs font-bold truncate group-hover:text-cyan-400 max-w-[200px]">{sat.name || 'UNKNOWN SAT'}</p>
                                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${sat.orbitType === 'LEO' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                            sat.orbitType === 'GEO' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                            {sat.orbitType}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                                        <p>NORAD: <span className="text-gray-300">{sat.satnum}</span></p>
                                        <p>INCL: <span className="text-gray-300">{(sat.inclo * (180 / Math.PI)).toFixed(1)}°</span></p>
                                    </div>
                                </div>
                            ))}
                            {filteredSatrecs.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">No signals found</p>
                                </div>
                            )}
                            {filteredSatrecs.length > 100 && (
                                <div className="text-center pt-2 pb-4">
                                    <p className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-widest">+ {filteredSatrecs.length - 100} more nodes hidden</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
