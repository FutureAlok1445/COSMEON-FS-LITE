import React from 'react';

export default function GlobalMetrics({ connected }) {
    return (
        <div className="absolute top-6 right-6 z-10 flex flex-col gap-4 pointer-events-auto">
            {/* Network Load Widget */}
            <div className="flex items-center justify-between bg-black/40 backdrop-blur-md border-r-4 border-b-4 border-r-cyan-500/50 border-b-cyan-500/50 border-white/10 px-5 py-4 min-w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15px 100%, 0 calc(100% - 15px))' }}>
                <div>
                    <p className="text-[10px] text-cyan-500/80 font-bold tracking-[0.2em] uppercase font-mono mb-1">Network Load // Live</p>
                    <p className="text-3xl font-bold text-white leading-none font-mono">
                        {connected ? '42.1' : 'ERR'}
                        <span className="text-sm text-cyan-400 ml-1 opacity-80 uppercase">{connected ? 'Gbps' : ''}</span>
                    </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${connected ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className={`w-4 h-4 shadow-lg ${connected ? 'bg-cyan-400 blur-[1px] animate-pulse shadow-cyan-400' : 'bg-red-500 shadow-red-500'}`}></div>
                </div>
            </div>

            {/* Core Temp Widget */}
            <div className="flex items-center justify-between bg-black/40 backdrop-blur-md border-r-4 border-b-4 border-r-purple-500/50 border-b-purple-500/50 border-white/10 px-5 py-4 min-w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15px 100%, 0 calc(100% - 15px))' }}>
                <div>
                    <p className="text-[10px] text-purple-400/80 font-bold tracking-[0.2em] uppercase font-mono mb-1">Mesh Entropy</p>
                    <p className="text-3xl font-bold text-white leading-none font-mono">
                        0.92<span className="text-sm text-purple-400 ml-1 opacity-80">SHN</span>
                    </p>
                </div>
                <div className="w-12 h-12 rounded-xl flex flex-col justify-end p-2 border bg-purple-500/10 border-purple-500/30 shadow-[inset_0_0_15px_rgba(168,85,247,0.2)]">
                    <div className="flex space-x-1 items-end h-full">
                        <div className="w-1.5 bg-purple-500 h-[60%]"></div>
                        <div className="w-1.5 bg-purple-500 h-[80%]"></div>
                        <div className="w-1.5 bg-purple-400 h-[100%] drop-shadow-[0_0_5px_rgba(192,132,252,1)]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
