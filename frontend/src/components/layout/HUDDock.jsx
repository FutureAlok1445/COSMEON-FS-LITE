import React, { useState } from 'react';
import { Network, Database, UploadCloud, Zap, Satellite, Binary, Shield } from 'lucide-react';

export default function HUDDock({ currentTab, setCurrentTab, onViewSatellite }) {
    const navItems = [
        { id: 'Orbital Engine', icon: Network, label: 'Main Engine' },
        { id: 'Storage Nodes', icon: Database, label: 'Storage Mesh' },
        { id: 'Orbit Tracking', icon: Satellite, label: 'Orbit Track' },
        { id: 'Payload Ops', icon: UploadCloud, label: 'Payload Ops' },
        { id: 'Data Demo', icon: Binary, label: 'Data Demo' },
        { id: 'Reliability Model', icon: Shield, label: 'Reliability' },
        { id: 'Chaos Ops', icon: Zap, label: 'Chaos Eng.' },
    ];

    const [hovered, setHovered] = useState(null);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div
                className="flex items-center gap-2 p-2 bg-[#02040A]/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] relative isolate
                after:absolute after:inset-0 after:rounded-2xl after:-z-10 after:opacity-50 after:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
            >
                {navItems.map((item) => {
                    const isActive = currentTab === item.id;
                    const isHovered = hovered === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'Orbit Tracking') {
                                    onViewSatellite();
                                } else {
                                    setCurrentTab(item.id);
                                }
                            }}
                            onMouseEnter={() => setHovered(item.id)}
                            onMouseLeave={() => setHovered(null)}
                            className="relative group transition-all duration-300 outline-none"
                        >
                            <div className={`p-4 rounded-xl flex items-center justify-center transition-all duration-300
                                ${isActive ? 'bg-cyan-500/20 shadow-[inset_0_0_15px_rgba(6,182,212,0.3)]' : 'hover:bg-white/5'}
                                ${isHovered && !isActive ? 'scale-110' : isActive ? 'scale-100' : 'scale-100'}
                            `}>
                                <item.icon
                                    size={24}
                                    className={`transition-colors duration-300 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : isHovered ? 'text-white' : 'text-gray-500'}`}
                                />
                            </div>

                            {/* Tooltip */}
                            <div className={`absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 rounded font-mono text-[10px] tracking-widest text-white whitespace-nowrap transition-all duration-200 pointer-events-none 
                                ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                            >
                                {item.label}
                            </div>

                            {/* Active Indicator Underline */}
                            {isActive && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-cyan-500 shadow-[0_0_10px_#06b6d4] rounded-t-sm" />
                            )}
                        </button>
                    )
                })}

                <div className="w-px h-8 bg-white/10 mx-2" />

                {/* Secondary Actions / Mode Switchers */}
                <button
                    onClick={() => setCurrentTab('Network Topology')}
                    onMouseEnter={() => setHovered('Network Topology')}
                    onMouseLeave={() => setHovered(null)}
                    className="relative group transition-all duration-300 outline-none"
                >
                    <div className={`p-4 rounded-xl flex items-center justify-center transition-all duration-300
                                ${currentTab === 'Network Topology' ? 'bg-purple-500/20 shadow-[inset_0_0_15px_rgba(168,85,247,0.3)]' : 'hover:bg-white/5'}
                                ${hovered === 'Network Topology' && currentTab !== 'Network Topology' ? 'scale-110' : 'scale-100'}
                            `}>
                        <div className={`w-6 h-6 rounded-full border-2 border-dashed animate-spin-slow ${currentTab === 'Network Topology' ? 'border-purple-400' : 'border-gray-500 group-hover:border-white'}`} style={{ animationDuration: '8s' }} />
                    </div>
                </button>
            </div>
        </div>
    );
}
