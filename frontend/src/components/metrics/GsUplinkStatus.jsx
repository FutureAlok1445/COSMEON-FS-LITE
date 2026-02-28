import React from 'react';
import { Radio } from 'lucide-react';

export default function GsUplinkStatus() {
    return (
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col shadow-2xl relative overflow-hidden">

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]"></div>

            <div className="flex items-center gap-3 mb-8 relative z-10">
                <Radio className="text-blue-500" size={20} />
                <h3 className="text-white font-bold tracking-wide">GS Uplink Status</h3>
            </div>

            <div className="flex-1 flex items-center justify-center relative z-10">
                {/* Abstract Server Graphic Inspired by Mockup */}
                <div className="relative flex items-center gap-2">
                    {/* Left fins */}
                    <div className="flex gap-1">
                        <div className="w-6 h-12 border border-blue-500/30 rounded flex items-center justify-center"><div className="w-1 h-2 bg-blue-500/20"></div></div>
                        <div className="w-6 h-12 border border-blue-500/30 rounded flex items-center justify-center"><div className="w-1 h-2 bg-blue-500/20"></div></div>
                    </div>

                    {/* Main Body */}
                    <div className="w-12 h-20 bg-[#0f172a] border-2 border-blue-500 rounded-lg shadow-[0_0_25px_rgba(59,130,246,0.3)] flex flex-col justify-around p-2">
                        <div className="w-full h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-full h-2 bg-blue-500/50 rounded-full"></div>
                        <div className="w-full h-2 bg-blue-500/30 rounded-full"></div>
                        <div className="w-full h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '500ms' }}></div>
                    </div>

                    {/* Right fins */}
                    <div className="flex gap-1">
                        <div className="w-6 h-12 border border-blue-500/30 rounded flex items-center justify-center"><div className="w-1 h-2 bg-blue-500/20"></div></div>
                        <div className="w-6 h-12 border border-blue-500/30 rounded flex items-center justify-center"><div className="w-1 h-2 bg-blue-500/20"></div></div>
                    </div>
                </div>
            </div>

            <div className="mt-auto relative z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-gray-500 tracking-widest leading-none">CAUCHY RS STRIPING</span>
                    <span className="text-lg font-bold text-blue-400 leading-none">72%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-blue-500 h-full w-[72%] rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>Payload: XAE-992</span>
                    <span>Buffer: 1.2 GB/s</span>
                </div>
            </div>

        </div>
    );
}
