import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float, Html } from '@react-three/drei';
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

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#E8F4F8" />

            <group>
                <mesh ref={earthRef}>
                    <sphereGeometry args={[2.5, 64, 64]} />
                    <meshPhongMaterial
                        map={earthTexture}
                        specularMap={specularMap}
                        specular={new THREE.Color('#333333')}
                        shininess={10}
                        emissive={new THREE.Color('#111111')}
                    />
                </mesh>

                <mesh scale={[1.02, 1.02, 1.02]}>
                    <sphereGeometry args={[2.5, 64, 64]} />
                    <meshPhongMaterial
                        color="#00EEFF"
                        transparent
                        opacity={0.1}
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

    const lineGeometry = useMemo(() => {
        if (!orbitPath || orbitPath.length < 2) return null;
        const points = orbitPath.map(p => geoToCartesian(p.lat, p.lng, p.alt));
        const curve = new THREE.CatmullRomCurve3(points, true);
        const curvePoints = curve.getPoints(200);
        return new THREE.BufferGeometry().setFromPoints(curvePoints);
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
            {lineGeometry && (
                <line geometry={lineGeometry}>
                    <lineBasicMaterial
                        color={isPrimary ? "#00FFC8" : "#444444"}
                        opacity={isPrimary ? 0.4 : 0.15}
                        transparent
                        linewidth={1}
                    />
                </line>
            )}

            {/* Link Line to Ground Station */}
            {activeLink && isOnline && (
                <line>
                    <bufferGeometry attach="geometry">
                        <float32Array attach="attributes-position" args={[
                            new Float32Array([
                                satPos.x, satPos.y, satPos.z,
                                activeLink.x, activeLink.y, activeLink.z
                            ]),
                            3
                        ]} />
                    </bufferGeometry>
                    <lineBasicMaterial color="#00FFC8" opacity={0.3} transparent />
                </line>
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

                    {isPrimary && (
                        <Html distanceFactor={10} position={[0.1, 0, 0]}>
                            <div className="px-2 py-0.5 rounded text-[8px] font-mono whitespace-nowrap border backdrop-blur-md transition-all duration-500 flex flex-col gap-1 bg-black/80 border-cyan-400 text-cyan-400 opacity-100 scale-110 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                                <span>{name} (TRACKED)</span>
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
                            </div>
                        </Html>
                    )}
                </Float>
            </group>
        </group>
    );
}
