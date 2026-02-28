import React, { useState, useEffect, useRef } from 'react';
import { Terminal, TerminalSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MissionTerminal({ currentTab, messages }) {
    const [lines, setLines] = useState([]);
    const bottomRef = useRef(null);

    // Initial boot sequence based on the tab
    useEffect(() => {
        setLines([]);
        const bootMessages = {
            'Orbital Engine': [
                'Initializing Orbital Physics Engine v2.4...',
                'Connecting to CelesTrak Proxy...',
                'Loading TLE Elements across 3 orbital planes.',
                'SGP4 Propagators: ONLINE.',
                'Raycasting engine ready for mesh interaction.'
            ],
            'Storage Nodes': [
                'Accessing Remote Storage Daemon...',
                'Pinging active constellation nodes...',
                'Fetching capacity limits and shard heatmaps.',
                'Ready to display shard telemetry.'
            ],
            'Payload Ops': [
                'Initializing Cauchy Reed-Solomon Codec RS(4,2)...',
                'Engaging 256-bit AES encryption layer.',
                'Awaiting secure payload transmission...'
            ],
            'Chaos Ops': [
                'WARNING: Accessing High-Risk Sandbox Environment.',
                'Disabling fail-safes...',
                'Chaos Monkey Module: ARMED.',
                'Awaiting fault injection commands.'
            ]
        };

        const msgs = bootMessages[currentTab] || ['System Idle. Waiting for commands.'];

        let i = 0;
        const interval = setInterval(() => {
            if (i < msgs.length) {
                setLines(prev => [...prev, { id: Date.now() + i, text: msgs[i], type: 'sys' }]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [currentTab]);

    // Listen to real-time websocket messages
    useEffect(() => {
        if (!messages || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        if (lastMsg.type === 'UPLOAD_START' || lastMsg.type === 'DOWNLOAD_START' || lastMsg.type === 'CHAOS_TRIGGERED') {
            setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `>> ${lastMsg.data.message || 'Executing command...'}`, type: 'exec' }]);
        } else if (lastMsg.type === 'ERROR') {
            setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `!! ERROR: ${lastMsg.data.message}`, type: 'err' }]);
        } else if (lastMsg.type === 'METRIC_UPDATE') {
            // Occasionally print a metric tick
            if (Math.random() > 0.8) {
                setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `[SYS] Syncing mesh state... Entropy: ${lastMsg.data?.entropy?.toFixed(3) || 'N/A'}`, type: 'dim' }]);
            }
        }
    }, [messages]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines]);

    return (
        <div
            className="bg-[#0b101e]/80 backdrop-blur-3xl border-l-2 border-b-2 border-l-cyan-500/30 border-b-cyan-500/30 border-t border-r border-t-white/5 border-r-white/5 rounded-none h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-l-cyan-400 hover:border-b-cyan-400 transition-all duration-500"
            style={{ clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)' }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="p-1.5 bg-cyan-500/10 rounded-md border border-cyan-500/20">
                    <TerminalSquare className="text-cyan-400" size={16} />
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold tracking-widest text-[11px] uppercase">Mission Terminal</h3>
                    <p className="text-[9px] text-cyan-500/70 font-mono uppercase tracking-widest mt-0.5">tty-{currentTab.split(' ')[0].toLowerCase()}</p>
                </div>
            </div>

            {/* Terminal Window */}
            <div className="flex-1 min-h-0 bg-[#050B14] p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed relative flex flex-col gap-1.5 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
                <AnimatePresence>
                    {lines.map((l) => (
                        <motion.div
                            key={l.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`
                                ${l.type === 'sys' ? 'text-gray-400' : ''}
                                ${l.type === 'exec' ? 'text-cyan-400 font-bold' : ''}
                                ${l.type === 'err' ? 'text-red-400 font-bold' : ''}
                                ${l.type === 'dim' ? 'text-gray-600' : ''}
                            `}
                        >
                            <span className="text-gray-600 mr-2 opacity-50">$</span>
                            {l.text}
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input Bar */}
            <div className="h-10 bg-black/40 border-t border-white/5 px-4 flex items-center gap-3 pointer-events-none">
                <span className="text-cyan-500/50 font-bold text-xs">{'>'}</span>
                <span className="w-2 h-4 bg-cyan-500/70 animate-pulse"></span>
            </div>
        </div>
    );
}
