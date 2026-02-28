import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CinematicBoot({ onComplete }) {
    const [lines, setLines] = useState([]);
    const [progress, setProgress] = useState(0);

    const bootSequence = [
        "KERNEL LOADED [OK]",
        "MOUNTING ENCRYPTED VFS...",
        "INITIALIZING CAUCHY REED-SOLOMON DECODER",
        "CONNECTING TO ORBITAL MESH G1...",
        "FETCHING SGP4 TELEMETRY FROM CELESTRAK",
        "SYNCING SHANNON ENTROPY DAEMON",
        "CALIBRATING HOLOGRAPHIC PROJECTION",
        "SYSTEM ONLINE. ENGAGING HUD."
    ];

    useEffect(() => {
        let currentLine = 0;

        const typeInterval = setInterval(() => {
            if (currentLine <= bootSequence.length) {
                setLines(bootSequence.slice(0, currentLine));
                setProgress(Math.floor((currentLine / bootSequence.length) * 100));
                currentLine++;
            } else {
                clearInterval(typeInterval);
                setTimeout(onComplete, 800); // Small pause before fade out
            }
        }, 300); // 300ms per line = ~2.4 seconds total boot time

        return () => clearInterval(typeInterval);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 1.2, ease: "anticipate" }}
            className="fixed inset-0 z-50 bg-[#02040A] flex flex-col items-center justify-center font-mono overflow-hidden"
        >
            {/* Ambient Background Glow during boot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-900/10 blur-[100px] pointer-events-none" />

            {/* Central Boot Console */}
            <div className="w-full max-w-2xl px-8 relative z-10 flex flex-col gap-8">

                {/* Header Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-2 mb-8"
                >
                    <div className="w-16 h-16 border-2 border-cyan-500 rounded-sm flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-cyan-500/20 animate-pulse" />
                        <div className="w-8 h-8 border border-white/50 rotate-45" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-[0.4em] uppercase">COSMEON <span className="text-cyan-500">FS-LITE</span></h1>
                    <p className="text-[10px] text-cyan-500/50 tracking-[0.3em] uppercase">Tactical Orbital Data Mesh</p>
                </motion.div>

                {/* TTY Output */}
                <div className="h-64 flex flex-col justify-end text-[11px] leading-loose text-cyan-400/80">
                    <AnimatePresence>
                        {lines.map((line, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-4 items-center"
                            >
                                <span className="opacity-50">[{new Date().toISOString().split('T')[1].substring(0, 11)}]</span>
                                <span className={i === bootSequence.length - 1 ? "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" : ""}>
                                    {line}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/5 relative overflow-hidden mt-4">
                    <motion.div
                        className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear", duration: 0.3 }}
                    />
                </div>

                <div className="text-center text-[10px] text-gray-500 tracking-[0.2em] uppercase">
                    SYSTEM BOOT SEQUENCE... {progress}%
                </div>
            </div>
        </motion.div>
    );
}
