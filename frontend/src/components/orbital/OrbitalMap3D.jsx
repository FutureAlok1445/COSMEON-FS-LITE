import React, { useRef, useLayoutEffect, useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard, Text, Line, useGLTF, Html, Float, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { useSpring, a } from '@react-spring/three';
import { useDrag } from '@use-gesture/react';

// Specific scales defined by SpaceScope Standards
const SCALES = {
    '/satellite.glb': 0.45, // Adjusted scale for a generic satellite
    '/earth.glb': 0.0005,
};

// Global Store for tracking satellite positions
const satellitePositions = {
    'Alpha-A': new THREE.Vector3(),
    'Alpha-B': new THREE.Vector3(),
    'Beta-A': new THREE.Vector3(),
    'Beta-B': new THREE.Vector3(),
    'Gamma-A': new THREE.Vector3(),
    'Gamma-B': new THREE.Vector3(),
};

// Standardized Planet Renderer
function PlanetActor({ url, envMapIntensity = 1, defaultScale = 1, ...props }) {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(true), [scene]);
    const finalScale = SCALES[url] || defaultScale;

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.envMapIntensity = envMapIntensity;
                    // Ensure standard material properties if missing
                    if (child.material.roughness === undefined) {
                        child.material.roughness = 0.6;
                    }
                    if (child.material.metalness === undefined) {
                        child.material.metalness = 0.4;
                    }
                }
            }
        });
    }, [clonedScene, envMapIntensity]);

    return (
        <group {...props}>
            <primitive object={clonedScene} scale={finalScale} />
        </group>
    );
}

// Custom Draggable Planet Node for the Orbital Tracks
function DraggableSatellite({ color, label, position, modelUrl }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);
    const [active, setActive] = useState(false);

    // Drag functionality on 3D plane X,Z with Y=0
    const { size, viewport } = useThree();
    const aspect = size.width / viewport.width;
    const [{ pos }, api] = useSpring(() => ({ pos: position }));

    const bind = useDrag(({ offset: [x, y], event }) => {
        event.stopPropagation();
        api.start({ pos: [x / aspect, 0, y / aspect] });
    }, {
        pointerEvents: true,
        from: () => [pos.get()[0] * aspect, pos.get()[2] * aspect]
    });

    // Update global store with true world position
    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.getWorldPosition(satellitePositions[label]);
        }
    });

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.6;
            if (active) {
                // Pulse effect if active
                meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.1);
            } else {
                meshRef.current.scale.setScalar(1);
            }
        }
    });

    return (
        <a.group
            {...bind()}
            position={pos}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            onClick={(e) => { e.stopPropagation(); setActive(!active); }}
        >
            <Float speed={2.5} rotationIntensity={0.6} floatIntensity={0.8}>
                <group ref={meshRef}>
                    {modelUrl ? (
                        <PlanetActor url={modelUrl} envMapIntensity={active ? 2.5 : 1.5} />
                    ) : (
                        <mesh>
                            <sphereGeometry args={[0.2, 32, 32]} />
                            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.8 : 0.3} />
                        </mesh>
                    )}
                </group>
            </Float>

            {label && !active && (
                <Billboard>
                    <Text
                        position={[0, 2.2, 0]}
                        fontSize={0.25}
                        color={color}
                        fontWeight="bold"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                    >
                        {label}
                    </Text>
                </Billboard>
            )}

            {/* TETHERED INFO CARD */}
            {active && (
                <Html position={[0.5, 0.5, 0]} center zIndexRange={[100, 0]}>
                    <div
                        className="bg-[#050B14]/90 backdrop-blur-md border-l-2 border-b-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col gap-3 w-56 transform translate-x-4 -translate-y-4 pointer-events-auto"
                        style={{
                            borderColor: color,
                            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                        }}
                    >
                        {/* Connecting Line from 3D object to card */}
                        <div className="absolute top-full right-full w-8 h-px bg-white/30 origin-top-right -rotate-45" style={{ backgroundColor: color }}></div>

                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                            <span className="text-[10px] font-bold tracking-[0.2em] font-mono text-white" style={{ color }}>{label}</span>
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color }}></div>
                        </div>

                        <div className="flex flex-col gap-1.5 font-mono">
                            <div className="flex justify-between text-[9px] uppercase tracking-wider">
                                <span className="text-gray-500">Status</span>
                                <span className="text-emerald-400 font-bold">ONLINE</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase tracking-wider">
                                <span className="text-gray-500">Uptime</span>
                                <span className="text-white">99.99%</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase tracking-wider">
                                <span className="text-gray-500">Storage Load</span>
                                <span className="text-white">{(Math.random() * 60 + 20).toFixed(1)}%</span>
                            </div>

                            <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: '75%', backgroundColor: color }}></div>
                            </div>
                        </div>

                        <button
                            className="mt-1 w-full py-1.5 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 tracking-widest uppercase transition-colors"
                            onClick={(e) => { e.stopPropagation(); setActive(false); }}
                        >
                            Close Link
                        </button>
                    </div>
                </Html>
            )}
        </a.group>
    );
}

function MainEarth() {
    const earthGroupRef = useRef();

    useLayoutEffect(() => {
        gsap.fromTo(earthGroupRef.current.scale,
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1, duration: 2, ease: "back.out(1.7)" }
        );
    }, []);

    useFrame((state, delta) => {
        if (earthGroupRef.current) {
            earthGroupRef.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <group ref={earthGroupRef}>
            <Float speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
                {/* Specific scaling is handled by PlanetActor internally using SpaceScope standards */}
                <PlanetActor url="/earth.glb" envMapIntensity={1.2} />

                {/* Atmospheric glow */}
                <mesh scale={[1.15, 1.15, 1.15]}>
                    <sphereGeometry args={[0.005 * 200, 32, 32]} /> {/* Rough size matching Earth */}
                    <meshBasicMaterial
                        color="#3b82f6"
                        transparent
                        opacity={0.08}
                        side={THREE.BackSide}
                    />
                </mesh>
            </Float>
        </group>
    );
}

function OrbitSystem({ radius, speed, color, tiltX = 0, tiltZ = 0, direction = 1, label, modelA, modelB }) {
    const groupRef = useRef();
    const ringRef = useRef();

    useFrame((state, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation.y += delta * speed * direction;
        }
    });

    const points = useMemo(() => {
        const pts = [];
        for (let i = 0; i <= 120; i++) {
            const angle = (i / 120) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        }
        return pts;
    }, [radius]);

    return (
        <group rotation={[tiltX, 0, tiltZ]} ref={groupRef}>
            <Line points={points} color={color} lineWidth={0.5} transparent opacity={0.15} />
            <group ref={ringRef}>
                <DraggableSatellite position={[radius, 0, 0]} color={color} label={`${label}-A`} modelUrl={modelA} />
                <DraggableSatellite position={[-radius, 0, 0]} color={color} label={`${label}-B`} modelUrl={modelB} />
            </group>
        </group>
    );
}

function Loader() {
    return (
        <Html center>
            <div className="flex flex-col items-center gap-3 bg-[#0B0E14]/80 p-6 rounded-2xl border border-blue-500/20 shadow-2xl backdrop-blur-md">
                <div className="w-10 h-10 rounded-full border-2 border-t-blue-500 border-blue-900/20 animate-spin"></div>
                <span className="text-[10px] font-mono text-blue-400 font-bold tracking-widest uppercase animate-pulse">Initializing Mesh...</span>
            </div>
        </Html>
    )
}

function DataBeam({ start, end, color }) {
    const lineRef = useRef();
    const [points, setPoints] = useState(() => [start, start]);

    useLayoutEffect(() => {
        // Animate the beam from start to end
        const proxy = { t: 0 };
        gsap.to(proxy, {
            t: 1,
            duration: 0.6,
            ease: "power2.out",
            onUpdate: () => {
                const currentEnd = new THREE.Vector3().lerpVectors(start, end, proxy.t);
                setPoints([start, currentEnd]);
            }
        });

        // Beam lifetime is exactly 1 second, then disappears
    }, [start, end]);

    return (
        <Line
            ref={lineRef}
            points={points}
            color={color || "#ffffff"}
            lineWidth={4}
            transparent
            opacity={0.8}
        />
    );
}

function EventOrchestrator({ messages, setBeams, setUploadCompleteRing }) {
    useEffect(() => {
        if (!messages || messages.length === 0) return;
        const msg = messages[messages.length - 1];

        if (msg.type === "CHUNK_UPLOADED") {
            const nodeInfo = msg.data.node_id;
            // Map node_id (e.g., SAT-01) to a logical orbit
            let targetLabel = "Alpha-A";
            if (nodeInfo.includes("01")) targetLabel = "Alpha-A";
            else if (nodeInfo.includes("02")) targetLabel = "Alpha-B";
            else if (nodeInfo.includes("03")) targetLabel = "Beta-A";
            else if (nodeInfo.includes("04")) targetLabel = "Beta-B";
            else if (nodeInfo.includes("05")) targetLabel = "Gamma-A";
            else if (nodeInfo.includes("06")) targetLabel = "Gamma-B";

            // Spawn a beam
            const targetPos = satellitePositions[targetLabel].clone();
            const newBeam = {
                id: Math.random().toString(),
                start: new THREE.Vector3(0, 0, 0),
                end: targetPos,
                color: "#ffffff"
            };

            setBeams(prev => [...prev, newBeam]);

            // Remove beam after 1 second
            setTimeout(() => {
                setBeams(prev => prev.filter(b => b.id !== newBeam.id));
            }, 1000);
        }

        if (msg.type === "UPLOAD_COMPLETE") {
            // Trigger a satisfying ping animation from Earth
            setUploadCompleteRing(true);
            setTimeout(() => setUploadCompleteRing(false), 2000);
        }

    }, [messages]);

    return null;
}

function EarthPulseRing({ active }) {
    const ringRef = useRef();

    useLayoutEffect(() => {
        if (active && ringRef.current) {
            gsap.fromTo(ringRef.current.scale,
                { x: 1, y: 1, z: 1 },
                { x: 15, y: 15, z: 15, duration: 1.5, ease: "power2.out" }
            );
            gsap.fromTo(ringRef.current.material,
                { opacity: 0.8 },
                { opacity: 0, duration: 1.5, ease: "power2.out" }
            );
        }
    }, [active]);

    if (!active) return null;

    return (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1, 1.05, 64]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
    );
}

// Prefetch models
useGLTF.preload('/earth.glb');
useGLTF.preload('/satellite.glb');

export default function OrbitalMap3D({ messages }) {
    const [beams, setBeams] = useState([]);
    const [uploadCompleteRing, setUploadCompleteRing] = useState(false);

    return (
        <Canvas shadows camera={{ position: [0, 8, 20], fov: 35 }} gl={{ alpha: true }}>
            <EventOrchestrator messages={messages} setBeams={setBeams} setUploadCompleteRing={setUploadCompleteRing} />
            <ambientLight intensity={0.1} color="#4facfe" />
            <directionalLight position={[30, 40, 30]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} />
            <pointLight position={[-30, -10, -30]} color="#3b82f6" intensity={1} />
            <pointLight position={[0, -10, 0]} color="#c084fc" intensity={0.5} />

            <Stars radius={200} depth={50} count={8000} factor={6} saturation={1} fade speed={1} />

            <OrbitControls
                makeDefault
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.3}
                maxDistance={50}
                minDistance={5}
                maxPolarAngle={Math.PI / 2.1}
            />

            <Suspense fallback={<Loader />}>
                <MainEarth />
                <EarthPulseRing active={uploadCompleteRing} />

                {beams.map(beam => (
                    <DataBeam key={beam.id} start={beam.start} end={beam.end} color={beam.color} />
                ))}

                <OrbitSystem radius={3} speed={0.4} color="#22d3ee" label="Alpha" modelA="/satellite.glb" modelB="/satellite.glb" />
                <OrbitSystem radius={5} speed={0.25} direction={-1} color="#c084fc" tiltZ={Math.PI / 10} label="Beta" modelA="/satellite.glb" modelB="/satellite.glb" />
                <OrbitSystem radius={7} speed={0.15} color="#4ade80" tiltX={Math.PI / 8} label="Gamma" modelA="/satellite.glb" modelB="/satellite.glb" />
                <ContactShadows resolution={1024} scale={50} blur={3} opacity={0.2} far={30} color="#000000" />
            </Suspense>

            <gridHelper args={[80, 24, '#1e293b', '#0f172a']} position={[0, -5, 0]} opacity={0.05} transparent />

            <EffectComposer multibuffer>
                <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
                <ChromaticAberration offset={[0.0005, 0.0005]} blendFunction={BlendFunction.NORMAL} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
        </Canvas>
    );
}
