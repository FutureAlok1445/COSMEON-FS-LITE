import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const data = [
    { name: '10:00', durability: 85, failures: 15 },
    { name: '10:05', durability: 90, failures: 10 },
    { name: '10:10', durability: 95, failures: 5 },
    { name: '10:15', durability: 82, failures: 18 },
    { name: '10:20', durability: 100, failures: 0 },
    { name: '10:25', durability: 100, failures: 0 },
    { name: '10:30', durability: 70, failures: 30 },
    { name: '10:35', durability: 88, failures: 12 },
    { name: '10:40', durability: 92, failures: 8 },
    { name: '10:45', durability: 98, failures: 2 },
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#02040A]/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] min-w-[160px]">
                <p className="text-[#94a3b8] text-[10px] font-bold tracking-widest uppercase mb-3 border-b border-white/5 pb-2">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center mb-1 last:mb-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: entry.color }}>
                            {entry.name}
                        </span>
                        <span className="font-mono text-sm font-bold text-white">
                            {entry.value}%
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function ResilienceChart() {
    return (
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">

            {/* Subtle Top Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>

            <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Activity className="text-blue-400" size={18} />
                </div>
                <div>
                    <h3 className="text-white font-bold tracking-wide text-sm">Resilience Monitor</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Real-time mesh integrity</p>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative z-10 -ml-2 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorDurability" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorFailures" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area
                            type="monotone"
                            dataKey="durability"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorDurability)"
                            animationDuration={1500}
                        />
                        <Area
                            type="monotone"
                            dataKey="failures"
                            stroke="#f97316"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fillOpacity={1}
                            fill="url(#colorFailures)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Minimal Legend Base */}
            <div className="mt-4 flex gap-6 border-t border-white/5 pt-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
                        DURABILITY
                    </div>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_#f97316]"></div>
                        FAILURES
                    </div>
                </div>
            </div>

        </div>
    );
}
