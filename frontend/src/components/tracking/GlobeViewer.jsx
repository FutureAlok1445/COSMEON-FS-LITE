import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { geoToCartesian } from '../../utils/geoUtils';

export default function GlobeViewer({ satellites, groundStations }) {
    const earthRef = useRef();

    // Load high-quality textures
    const earthTexture = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
    const specularMap = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');

    useFrame((state, delta) => {
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.0005;
        }
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                rotateSpeed={0.5}
                minDistance={3.5}
                maxDistance={15}
            />

            <Stars
                radius={200}
                depth={100}
                count={10000}
                factor={4}
                saturation={1}
                fade
                speed={0.5}
            />

            <ambientLight intensity={0.8} />
            <pointLight position={[15, 15, 15]} intensity={3.5} color="#ffffff" />

            <group>
                <mesh ref={earthRef}>
                    <sphereGeometry args={[2.5, 64, 64]} />
                    <meshPhongMaterial
                        map={earthTexture}
                        specularMap={specularMap}
                        specular={new THREE.Color('#444444')}
                        shininess={15}
                        emissive={new THREE.Color('#1a1a1a')}
                    />
                </mesh>

                <mesh scale={[1.03, 1.03, 1.03]}>
                    <sphereGeometry args={[2.5, 64, 64]} />
                    <meshPhongMaterial
                        color="#00EEFF"
                        transparent
                        opacity={0.15}
                        side={THREE.BackSide}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>

                {/* Render Ground Stations */}
                {groundStations && groundStations.map((gs, idx) => (
                    <GroundStation key={idx} gs={gs} />
                ))}

                {/* Render Multiple Satellites and Orbits */}
                {satellites.map((sat, idx) => (
                    <SatelliteGroup
                        key={sat.noradId || idx}
                        sat={sat}
                        groundStations={groundStations}
                    />
                ))}
            </group>
        </>
    );
}

function GroundStation({ gs }) {
    const pos = useMemo(() => geoToCartesian(gs.lat, gs.lng, 0), [gs]);
    return (
        <group position={pos}>
            <mesh>
                <boxGeometry args={[0.04, 0.04, 0.04]} />
                <meshBasicMaterial color={gs.color} />
            </mesh>
            <Html distanceFactor={10} position={[0.1, 0, 0]}>
                <div className="bg-black/60 border border-cyan-500/30 px-1 py-0.5 rounded text-[6px] font-mono text-cyan-300 pointer-events-none uppercase">
                    {gs.name}
                </div>
            </Html>
        </group>
    );
}

function SatelliteGroup({ sat, groundStations }) {
    const { currentPos, orbitPath, isPrimary, name, queueDepth, isOnline } = sat;

    const { points: curvePoints } = useMemo(() => {
        if (!orbitPath || orbitPath.length < 2) return { points: null };
        const pts = orbitPath.map(p => geoToCartesian(p.lat, p.lng, p.alt));
        const curve = new THREE.CatmullRomCurve3(pts, true);
        return { points: curve.getPoints(200) };
    }, [orbitPath]);

    const satPos = useMemo(() => {
        if (!currentPos) return new THREE.Vector3(0, 0, 0);
        return geoToCartesian(currentPos.lat, currentPos.lng, currentPos.alt);
    }, [currentPos]);

    // Link Logic: Find nearest Ground Station within LoS
    const activeLink = useMemo(() => {
        if (!currentPos || !groundStations) return null;

        let nearest = null;
        let minDist = 3.0; // LoS Threshold (approx)

        groundStations.forEach(gs => {
            const gsPos = geoToCartesian(gs.lat, gs.lng, 0);
            const dist = satPos.distanceTo(gsPos);
            if (dist < minDist) {
                minDist = dist;
                nearest = gsPos;
            }
        });
        return nearest;
    }, [satPos, groundStations, currentPos]);

    if (!currentPos) return null;

    return (
        <group>
            {/* Orbit Path Line */}
            {curvePoints && (
                <Line
                    points={curvePoints}
                    color={isPrimary ? "#00FFC8" : "#444444"}
                    opacity={isPrimary ? 0.3 : 0.08}
                    transparent
                    lineWidth={1.2}
                />
            )}

            {/* Link Line to Ground Station */}
            {activeLink && isOnline && (
                <Line
                    points={[satPos, activeLink]}
                    color="#00FFC8"
                    lineWidth={1}
                    transparent
                    opacity={0.3}
                />
            )}

            {/* Satellite Object */}
            <group position={satPos}>
                <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                    <mesh>
                        <sphereGeometry args={[isPrimary ? 0.04 : 0.025, 16, 16]} />
                        <meshBasicMaterial color={!isOnline ? "#FF4444" : (isPrimary ? "#ffffff" : "#00FFC8")} />
                    </mesh>

                    {/* DTN Queue Aura */}
                    {queueDepth > 0 && (
                        <mesh scale={[1.5 + (queueDepth * 0.1), 1.5 + (queueDepth * 0.1), 1.5 + (queueDepth * 0.1)]}>
                            <sphereGeometry args={[0.04, 16, 16]} />
                            <meshBasicMaterial color="#FF8800" transparent opacity={0.3} />
                        </mesh>
                    )}

                    {isPrimary && (
                        <mesh scale={[2.5, 2.5, 2.5]}>
                            <sphereGeometry args={[0.04, 16, 16]} />
                            <meshBasicMaterial color={isOnline ? "#00FFC8" : "#FF4444"} transparent opacity={0.2} />
                        </mesh>
                    )}

                    {/* Label */}
                    <Html distanceFactor={10} position={[0.1, 0, 0]}>
                        <div className={`px-2 py-0.5 rounded text-[8px] font-mono whitespace-nowrap border backdrop-blur-md transition-all duration-500 flex flex-col gap-1 ${isPrimary
                            ? "bg-black/80 border-cyan-400 text-cyan-400 opacity-100 scale-110 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                            : "bg-black/40 border-white/10 text-gray-400 opacity-60 hover:opacity-100"
                            }`}>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1 h-1 rounded-full ${isOnline ? 'bg-cyan-500' : 'bg-red-500'} animate-pulse`} />
                                <span>{name} {isPrimary && "(TRACKED)"}</span>
                            </div>

                            {isPrimary && (
                                <>
                                    {queueDepth > 0 && (
                                        <span className="bg-orange-500/20 text-orange-400 px-1 rounded border border-orange-500/30 text-[6px] animate-pulse">
                                            DTN: {queueDepth} BUNDLES
                                        </span>
                                    )}
                                    {!isOnline && (
                                        <span className="bg-red-500/20 text-red-400 px-1 rounded border border-red-500/30 text-[6px]">
                                            NODAL OUTAGE
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </Html>
                </Float>
            </group>
        </group>
    );
}
