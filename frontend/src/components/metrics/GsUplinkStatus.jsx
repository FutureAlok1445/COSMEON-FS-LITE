import React from 'react';
import { Radio } from 'lucide-react';

export default function GsUplinkStatus() {
    return (
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">

            {/* Subtle Top Glow */}
            <div className="absolute top-0 right-0 w-48 h-1 bg-gradient-to-l from-blue-500/50 to-transparent"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none"></div>

            <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Radio className="text-blue-400" size={18} />
                </div>
                <div>
                    <h3 className="text-white font-bold tracking-wide text-sm">GS Uplink Status</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Telemetry Stream</p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative z-10 w-full px-4">
                {/* Minimalist Tech Vector Graphic */}
                <div className="w-full flex items-center justify-between gap-4">
                    {/* Source Node */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/5 relative">
                            <div className="w-2 h-2 rounded-full bg-blue-400 absolute animate-ping opacity-75"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <span className="text-[8px] text-gray-400 font-mono tracking-widest">EARTH</span>
                    </div>

                    {/* Data Stream Line */}
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/20 via-blue-400/80 to-blue-500/20 relative">
                        {/* Moving packet dots */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-1/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-[ping_2s_infinite]"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 left-2/4 w-1.5 h-1.5 bg-blue-300 rounded-full shadow-[0_0_8px_#93c5fd] animate-[ping_2s_infinite_500ms]"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 left-3/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-[ping_2s_infinite_1000ms]"></div>
                    </div>

                    {/* Target Node */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5">
                            <div className="w-3 h-3 border border-blue-400 rounded-sm rotate-45"></div>
                        </div>
                        <span className="text-[8px] text-gray-400 font-mono tracking-widest">SAT-COM</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 relative z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[9px] font-bold text-gray-400 tracking-[0.2em] leading-none">CAUCHY RS STRIPING</span>
                    <span className="text-xl font-mono text-white leading-none">72<span className="text-sm text-gray-500">%</span></span>
                </div>
                {/* Segmented Progress Bar */}
                <div className="w-full flex gap-1 mb-3">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className={`flex-1 h-1.5 rounded-sm ${i < 7 ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-white/10'}`}></div>
                    ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div> PYL: XAE-992</span>
                    <span>BUF: 1.2 GB/s</span>
                </div>
            </div>

        </div>
    );
}
