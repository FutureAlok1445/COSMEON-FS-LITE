import React, { useRef, useLayoutEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard, Text, Line, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useSpring, a } from '@react-spring/three';
import { useDrag } from '@use-gesture/react';

// Automatically scale and center any loaded GLB/GLTF model so it never breaks the layout
function AutoScaledModel({ url, targetSize = 1.5, ...props }) {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(true), [scene]);

    useLayoutEffect(() => {
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const scale = maxDim > 0 ? targetSize / maxDim : 1;
        clonedScene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        clonedScene.scale.set(scale, scale, scale);
    }, [clonedScene, targetSize]);

    return (
        <group {...props}>
            <primitive object={clonedScene} />
        </group>
    );
}

// Custom Draggable Planet Node for the Orbital Tracks
function DraggableSatellite({ color, label, position, modelUrl }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    // Drag functionality on 3D plane X,Z with Y=0
    const { size, viewport } = useThree();
    const aspect = size.width / viewport.width;
    const [{ pos }, api] = useSpring(() => ({ pos: position }));

    const bind = useDrag(({ offset: [x, y] }) => {
        api.start({ pos: [x / aspect, 0, y / aspect] });
    }, {
        pointerEvents: true,
        from: () => [pos.get()[0] * aspect, pos.get()[2] * aspect]
    });

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
            if (hovered) {
                meshRef.current.rotation.x += delta * 1.5;
            }
        }
    });

    return (
        <a.group {...bind()} position={pos} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} ref={meshRef}>
            {modelUrl ? (
                <AutoScaledModel url={modelUrl} targetSize={1.2} />
            ) : (
                <mesh>
                    <sphereGeometry args={[0.4, 32, 32]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 2 : 0.5} roughness={0.2} metalness={0.8} />
                </mesh>
            )}

            {label && (
                <Billboard>
                    <Text position={[0, 1.2, 0]} fontSize={0.3} color={color} outlineWidth={0.03} outlineColor="#000000">
                        {label}
                    </Text>
                </Billboard>
            )}
        </a.group>
    );
}

function MainEarth() {
    const earthGroupRef = useRef();

    // Animate pop in
    useLayoutEffect(() => {
        gsap.fromTo(earthGroupRef.current.scale,
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1, duration: 2.5, ease: "elastic.out(1, 0.4)" }
        );
    }, []);

    useFrame((state, delta) => {
        if (earthGroupRef.current) {
            earthGroupRef.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <group ref={earthGroupRef}>
            <AutoScaledModel url="/earth.glb" targetSize={3.5} />
            {/* Atmospheric glow ring layer */}
            <mesh>
                <sphereGeometry args={[1.8, 32, 32]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

function OrbitSystem({ radius, speed, color, tiltX = 0, tiltZ = 0, direction = 1, label, modelA, modelB }) {
    const groupRef = useRef();
    const ringRef = useRef();

    useLayoutEffect(() => {
        gsap.fromTo(groupRef.current.scale,
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1, duration: 1.5, delay: 0.2, ease: "back.out(1.5)" }
        );
    }, []);

    useFrame((state, delta) => {
        // Rotating the parent group makes the draggables follow the ring naturally
        ringRef.current.rotation.y += delta * speed * direction;
    });

    // 64 points for line circle
    const points = [];
    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }

    return (
        <group rotation={[tiltX, 0, tiltZ]} ref={groupRef}>
            <Line points={points} color={color} lineWidth={2} transparent opacity={0.3} />

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
            <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin border-blue-900"></div>
                <span className="text-xs font-mono text-blue-400 font-bold tracking-widest uppercase shadow-black">Acquiring Payload...</span>
            </div>
        </Html>
    )
}

// Prefetch models for instant loading
useGLTF.preload('/earth.glb');
useGLTF.preload('/mars.glb');
useGLTF.preload('/realistic_jupiter.glb');
useGLTF.preload('/mercury.glb');

export default function OrbitalMap3D() {
    return (
        <Canvas camera={{ position: [0, 8, 15], fov: 60 }} style={{ background: 'transparent' }}>
            <ambientLight intensity={1.5} color="#ffffff" />
            <directionalLight position={[10, 20, 10]} intensity={3} color="#ffffff" castShadow />
            <pointLight position={[-10, 0, -10]} intensity={2} color="#4ade80" />
            <pointLight position={[10, 0, 10]} intensity={2} color="#c084fc" />

            <Stars radius={120} depth={60} count={6000} factor={4} saturation={1} fade speed={1.5} />

            <OrbitControls
                makeDefault
                enablePan={true}
                enableZoom={true}
                autoRotate
                autoRotateSpeed={0.2}
                maxDistance={30}
                minDistance={4}
            />

            <Suspense fallback={<Loader />}>
                <MainEarth />

                {/* Alpha Plane uses Mars */}
                <OrbitSystem radius={4.5} speed={0.4} color="#22d3ee" label="Alpha" modelA="/mars.glb" modelB="/mars.glb" />

                {/* Beta Plane uses Jupiter */}
                <OrbitSystem radius={6.5} speed={0.25} direction={-1} color="#c084fc" tiltZ={Math.PI / 5} label="Beta" modelA="/realistic_jupiter.glb" modelB="/realistic_jupiter.glb" />

                {/* Gamma Plane uses Mercury */}
                <OrbitSystem radius={9.0} speed={0.15} color="#4ade80" tiltX={Math.PI / 4} label="Gamma" modelA="/mercury.glb" modelB="/mercury.glb" />
            </Suspense>

        </Canvas>
    );
}
