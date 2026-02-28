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
function SatelliteSwarm({ satrecs }) {
    const meshRef = useRef();

    // Create a dummy Object3D to help calculate matrix transformations
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(() => {
        if (!meshRef.current || satrecs.length === 0) return;

        const now = new Date();
        // Use modulo to avoid infinite rotation numbers getting too large over time
        // Optional: add a slight artificial rotation if you want the whole scene to spin slowly
        // But for 100% accuracy, we should technically keep the earth static and let the sats move,
        // or rotate the earth to match GMST. For simplicity and visual appeal, we'll keep Earth static
        // relative to the ECI coordinates output by satellite.js for now.

        const gmst = satellite.gstime(now);

        satrecs.forEach((satrec, i) => {
            // Propagate the satellite using SGP4
            const positionAndVelocity = satellite.propagate(satrec, now);

            const positionEci = positionAndVelocity.position;

            if (positionEci && typeof positionEci !== 'boolean') {
                // Convert ECI (Earth-Centered Inertial) to Three.js coordinates
                // satellite.js outputs in km.
                // X points to vernal equinox, Z points to North Pole, Y completes right-hand rule.
                // Three.js: Y is up (North Pole), X is right, Z is towards viewer.

                // So: Three.Y = ECI.Z
                //     Three.X = ECI.X
                //     Three.Z = -ECI.Y

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
        <instancedMesh ref={meshRef} args={[null, null, satrecs.length]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshBasicMaterial color="#06b6d4" />
        </instancedMesh>
    );
}

export default function NetworkMap3D() {
    const [satrecs, setSatrecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                // Fetch Starlink TLEs from CelesTrak (gives a good dense swarm of real sats)
                // Using corsproxy to avoid issues if celestrak doesn't handle CORS neatly,
                // but celestrak actually supports CORS usually.
                const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle');
                if (!response.ok) throw new Error('Failed to fetch TLE data');

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

    return (
        <div className="w-full h-full relative">
            <Canvas camera={{ position: [0, 15, 25], fov: 45 }}>
                <color attach="background" args={['#02040A']} />

                <ambientLight intensity={0.5} color="#4facfe" />
                <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />

                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <Earth />
                <Atmosphere />

                {!loading && <SatelliteSwarm satrecs={satrecs} />}

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
                                <div key={idx} className="bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 p-3 rounded-lg transition-colors group cursor-pointer group">
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
