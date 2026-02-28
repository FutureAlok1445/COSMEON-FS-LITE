import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';

export function MissionLog({ messages }) {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const getColor = (type) => {
        if (type.includes("SUCCESS") || type.includes("COMPLETE") || type.includes("DELIVERED") || type.includes("RESTORE")) return "text-emerald-400";
        if (type.includes("ERROR") || type.includes("CORRUPT") || type.includes("OFFLINE") || type.includes("DESTROYED")) return "text-red-400";
        if (type.includes("QUEUE") || type.includes("PARTITION") || type.includes("WARNING")) return "text-amber-400";
        if (type.includes("RECOVERY") || type.includes("FLUSH")) return "text-purple-400";
        return "text-blue-400";
    };

    return (
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-5 flex flex-col min-h-0 h-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">
            {/* Subtle Terminal Glow */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>

            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2 text-gray-400 font-mono text-[10px] tracking-[0.2em] uppercase font-bold">
                    <Terminal size={12} className="text-cyan-500" />
                    <span>Mission Terminal</span>
                </div>
                {/* Simulated activity dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse"></div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5 pr-2 custom-scrollbar">
                {messages.length === 0 && <div className="text-gray-600 animate-pulse flex items-center gap-2"><span className="text-cyan-500">_</span> Awaiting matrix telemetry stream...</div>}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 hover:bg-white/5 p-1 -mx-1 rounded transition-colors ${getColor(msg.type)}`}>
                        <span className="opacity-30 tracking-wider">[{new Date().toISOString().split('T')[1].substring(0, 8)}]</span>
                        <div className="flex-1 flex gap-2">
                            <span className="font-bold opacity-80 w-24 shrink-0">[{msg.type}]</span>
                            <span className="opacity-90 leading-tight text-gray-300">{msg.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
