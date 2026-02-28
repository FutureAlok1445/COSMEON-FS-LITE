import React from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

export default function ResilienceChart() {
    return (
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col shadow-2xl relative overflow-hidden group">

            {/* Glow Effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-blue-500/10 blur-[80px] group-hover:bg-blue-500/20 transition-all duration-700"></div>

            <div className="flex items-center gap-4 mb-6 relative z-10">
                <Activity className="text-blue-400" size={20} />
                <h3 className="text-white font-bold tracking-wide">Active Resilience Monitor</h3>
                <div className="flex gap-4 ml-auto text-xs font-bold tracking-widest">
                    <div className="flex items-center gap-1 text-blue-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> DURABILITY
                    </div>
                    <div className="flex items-center gap-1 text-orange-500">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> FAILURES
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                            itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="durability"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={false}
                            animationDuration={2000}
                            isAnimationActive={true}
                        />
                        <Line
                            type="monotone"
                            dataKey="failures"
                            stroke="#f97316"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            animationDuration={2000}
                            isAnimationActive={true}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
