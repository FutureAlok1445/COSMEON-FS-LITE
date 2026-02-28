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
    '/mercury.glb': 0.003,
    '/earth.glb': 0.0005,
    '/mars.glb': 0.05,
    '/realistic_jupiter.glb': 0.004
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

// Prefetch models
useGLTF.preload('/earth.glb');
useGLTF.preload('/mars.glb');
useGLTF.preload('/realistic_jupiter.glb');
useGLTF.preload('/mercury.glb');

export default function OrbitalMap3D() {
    return (
        <Canvas shadows camera={{ position: [0, 8, 20], fov: 35 }} gl={{ alpha: true }}>
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
                <OrbitSystem radius={3} speed={0.4} color="#22d3ee" label="Alpha" modelA="/mars.glb" modelB="/mars.glb" />
                <OrbitSystem radius={5} speed={0.25} direction={-1} color="#c084fc" tiltZ={Math.PI / 10} label="Beta" modelA="/realistic_jupiter.glb" modelB="/realistic_jupiter.glb" />
                <OrbitSystem radius={7} speed={0.15} color="#4ade80" tiltX={Math.PI / 8} label="Gamma" modelA="/mercury.glb" modelB="/mercury.glb" />
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
