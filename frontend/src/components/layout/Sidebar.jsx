import React from 'react';
import { Globe, Network, Activity, Shield, HardDrive } from 'lucide-react';

export default function Sidebar() {
    return (
        <div className="w-64 border-r border-white/5 h-full flex flex-col p-6 relative z-20">

            {/* Brand */}
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Globe className="text-blue-400" size={20} />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-widest text-white leading-tight">COSMEON</h1>
                    <span className="text-[9px] text-blue-500 font-mono tracking-[0.2em] uppercase">Telemetry Ops</span>
                </div>
            </div>

            <div className="flex-1">
                <h2 className="text-[10px] font-bold text-gray-500 tracking-widest mb-4 uppercase">Navigation</h2>

                <div className="space-y-1.5">
                    <button className="w-full flex items-center justify-between text-blue-400 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/5 transition-all text-sm font-semibold shadow-[0_0_15px_rgba(59,130,246,0.1)] group">
                        <div className="flex items-center gap-3">
                            <Globe size={18} className="group-hover:animate-pulse" />
                            3D Global View
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
                    </button>

                    <button className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-4 py-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-sm font-semibold">
                        <Network size={18} />
                        OPS Topology
                    </button>

                    <button className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-4 py-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-sm font-semibold">
                        <HardDrive size={18} />
                        Storage Nodes
                    </button>
                </div>

                <h2 className="text-[10px] font-bold text-gray-500 tracking-widest mt-10 mb-4 uppercase">Status Matrix</h2>

                <div className="space-y-5 px-1">
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Atmos Density</span>
                            <span className="text-emerald-400 text-[10px] font-bold font-mono">OPTIMAL</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-sm overflow-hidden border border-white/5">
                            <div className="bg-emerald-500 h-full w-[45%] rounded-sm shadow-[0_0_10px_#10b981]"></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Plane Alignment</span>
                            <span className="text-white text-[10px] font-bold font-mono">98.2%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-sm overflow-hidden border border-white/5">
                            <div className="bg-blue-500 h-full w-[98.2%] rounded-sm shadow-[0_0_10px_#3b82f6]"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom mission delta */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 mt-auto">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                    <Activity className="text-blue-500 animate-pulse" size={14} />
                    <span className="text-[10px] font-mono font-bold text-gray-300 tracking-[0.2em] uppercase">Mission Delta</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    Phase 4 deployment active. 12 satellites awaiting orbital slot assignment in High Earth Orbit.
                </p>
            </div>
        </div>
    );
}
