import React, { useRef, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

function Earth() {
    const earthRef = useRef();

    useLayoutEffect(() => {
        gsap.fromTo(earthRef.current.scale,
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1, duration: 2, ease: "elastic.out(1, 0.5)" }
        );
    }, []);

    useFrame((state, delta) => {
        earthRef.current.rotation.y += delta * 0.1;
    });

    return (
        <group ref={earthRef}>
            <mesh>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshStandardMaterial color="#1e3a8a" wireframe={true} emissive="#1e40af" emissiveIntensity={0.8} />
            </mesh>
            <mesh>
                <sphereGeometry args={[1.55, 32, 32]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
            </mesh>
        </group>
    );
}

function Orbit({ radius, speed, color, tiltX = 0, tiltZ = 0, direction = 1, label }) {
    const groupRef = useRef();
    const orbitRef = useRef();

    useLayoutEffect(() => {
        gsap.fromTo(groupRef.current.scale,
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1, duration: 1.5, delay: 0.5, ease: "power3.out" }
        );
    }, []);

    useFrame((state, delta) => {
        orbitRef.current.rotation.y += delta * speed * direction;
    });

    // Calculate points for the orbit line
    const points = [];
    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }

    return (
        <group rotation={[tiltX, 0, tiltZ]} ref={groupRef}>
            <Line points={points} color={color} lineWidth={1.5} transparent opacity={0.3} />

            <group ref={orbitRef}>
                {/* Sat-1 */}
                <mesh position={[radius, 0, 0]}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    {label && (
                        <Billboard>
                            <Text position={[0, 0.5, 0]} fontSize={0.25} color={color} outlineWidth={0.02} outlineColor="#000000">
                                {label}-A
                            </Text>
                        </Billboard>
                    )}
                </mesh>
                {/* Sat-2 */}
                <mesh position={[-radius, 0, 0]}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                    {label && (
                        <Billboard>
                            <Text position={[0, 0.5, 0]} fontSize={0.25} color={color} outlineWidth={0.02} outlineColor="#000000">
                                {label}-B
                            </Text>
                        </Billboard>
                    )}
                </mesh>
            </group>
        </group>
    );
}

export default function OrbitalMap3D() {
    return (
        <Canvas camera={{ position: [0, 6, 10], fov: 60 }} style={{ background: 'transparent' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={2} color="#ffffff" />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            <OrbitControls enablePan={false} enableZoom={true} autoRotate autoRotateSpeed={0.3} maxDistance={20} minDistance={5} />

            <Earth />

            {/* Plane Alpha (Cyan, Inner) */}
            <Orbit radius={3.2} speed={0.5} color="#22d3ee" label="Alpha" />

            {/* Plane Beta (Purple, Middle, Tilted) */}
            <Orbit radius={5.0} speed={0.3} direction={-1} color="#c084fc" tiltZ={Math.PI / 6} label="Beta" />

            {/* Plane Gamma (Green, Outer, Tilted) */}
            <Orbit radius={7.0} speed={0.2} color="#4ade80" tiltX={Math.PI / 5} label="Gamma" />

        </Canvas>
    );
}
