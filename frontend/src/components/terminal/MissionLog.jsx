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
        if (type.includes("SUCCESS") || type.includes("COMPLETE") || type.includes("DELIVERED") || type.includes("RESTORE")) return "text-green-400";
        if (type.includes("ERROR") || type.includes("CORRUPT") || type.includes("OFFLINE") || type.includes("DESTROYED")) return "text-red-400";
        if (type.includes("QUEUE") || type.includes("PARTITION") || type.includes("WARNING")) return "text-yellow-400";
        if (type.includes("RECOVERY") || type.includes("FLUSH")) return "text-purple-400";
        return "text-cyan-400";
    };

    return (
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-4 flex flex-col h-full shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#1e293b] text-gray-400 font-mono text-[10px] tracking-widest uppercase font-bold">
                <Terminal size={14} className="text-blue-500" />
                <span>Mission Log Terminal</span>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[11px] space-y-2 pr-2 custom-scrollbar">
                {messages.length === 0 && <div className="text-gray-600 animate-pulse">Awaiting matrix telemetry stream...</div>}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${getColor(msg.type)}`}>
                        <span className="opacity-40">[{new Date().toISOString().split('T')[1].substring(0, 8)}]</span>
                        <span className="font-bold whitespace-nowrap">[{msg.type}]</span>
                        <span className="opacity-90 leading-tight">{msg.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
