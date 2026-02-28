import React from 'react';
import { Globe, Network, Activity, Shield, HardDrive } from 'lucide-react';

export default function Sidebar() {
    return (
        <div className="w-64 bg-[#0a0f1c] border-r border-[#1e293b] h-full flex flex-col p-4">

            {/* Brand */}
            <div className="flex items-center gap-2 mb-10">
                <Globe className="text-blue-500" size={28} />
                <h1 className="text-xl font-bold tracking-wider text-white">COSMEON</h1>
                <span className="text-[10px] text-blue-600 font-mono tracking-widest mt-1">3D TELEMETRY OPS</span>
            </div>

            <div className="flex-1">
                <h2 className="text-xs font-bold text-gray-500 tracking-widest mb-4">NAVIGATION</h2>

                <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 bg-blue-900/20 text-blue-400 px-4 py-3 rounded-xl border border-blue-500/30 transition-all text-sm font-semibold shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <Globe size={18} />
                        3D Global View
                    </button>

                    <button className="w-full flex items-center gap-3 text-gray-400 hover:text-gray-200 px-4 py-3 rounded-xl hover:bg-[#1e293b]/50 transition-all text-sm font-semibold">
                        <Network size={18} />
                        OPS Topology
                    </button>
                </div>

                <h2 className="text-xs font-bold text-gray-500 tracking-widest mt-10 mb-4">CONSTELLATION STATUS</h2>

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Atmosphere Density</span>
                            <span className="text-emerald-400">Optimal</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full w-[45%] rounded-full shadow-[0_0_10px_#2563eb]"></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Plane Alignment</span>
                            <span className="text-white">98.2%</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full w-[98.2%] rounded-full shadow-[0_0_10px_#10b981]"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom mission delta */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 mt-auto">
                <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-blue-500" size={14} />
                    <span className="text-xs font-bold text-blue-500 tracking-wider">MISSION DELTA</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    Phase 4 deployment active. 12 satellites awaiting orbital slot assignment.
                </p>
            </div>
        </div>
    );
}
