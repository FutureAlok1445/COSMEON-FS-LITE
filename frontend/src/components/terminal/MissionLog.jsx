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
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex flex-col h-64">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-800 text-gray-400 font-mono text-sm">
                <Terminal size={16} />
                <span>MISSION_LOG_TERMINAL &gt;_</span>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
                {messages.length === 0 && <div className="text-gray-600">Awaiting telemetry...</div>}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${getColor(msg.type)}`}>
                        <span className="opacity-50">[{new Date().toISOString().split('T')[1].substring(0, 8)}]</span>
                        <span className="font-bold">[{msg.type}]</span>
                        <span>{msg.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
