import React, { useState } from 'react';
import { AlertCircle, Zap, Activity, ShieldAlert, RefreshCw } from 'lucide-react';

export function ChaosPanel() {
    const [active, setActive] = useState(null);

    const triggerChaos = async (scenario) => {
        setActive(scenario);
        try {
            await fetch(`http://localhost:8000/api/chaos/${scenario}`, { method: 'POST' });
        } catch (err) {
            console.error(err);
        }
    };

    const resetAll = async () => {
        try {
            await fetch(`http://localhost:8000/api/chaos/restore`, { method: 'POST' });
            setActive(null);
        } catch (err) {
            console.error(err);
        }
    };

    const cards = [
        { id: 'solar_flare', name: 'Solar Flare', desc: 'Kills Plane Beta (SAT-03, SAT-04)', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'bit_rot', name: 'Radiation Bit Rot', desc: 'Silently corrupts 1 byte in SAT-01', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { id: 'partition', name: 'Network Partition', desc: 'Cuts link to Plane Beta (DTN mode)', icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10' }
    ];

    return (
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col shadow-2xl relative overflow-hidden group">

            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[80px] group-hover:bg-red-500/10 transition-all duration-700"></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <AlertCircle className="text-red-500" size={20} />
                    <h3 className="text-white font-bold tracking-wide">Chaos Injection Array</h3>
                </div>
                <button
                    onClick={resetAll}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                >
                    <RefreshCw size={14} />
                    SYSTEM RESTORE
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3 flex-1 relative z-10">
                {cards.map(card => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.id}
                            onClick={() => triggerChaos(card.id)}
                            disabled={active && active !== card.id}
                            className={`text-left p-4 rounded-xl border transition-all ${active === card.id
                                ? `border-${card.color.split('-')[1]}-500 ${card.bg} shadow-[0_0_15px_rgba(255,255,255,0.1)]`
                                : `border-[#1e293b] hover:border-gray-500 bg-[#0f172a]/50 ${active ? 'opacity-40 grayscale' : ''}`
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Icon className={card.color} size={18} />
                                    <span className="font-bold text-gray-200">{card.name}</span>
                                </div>
                                {active === card.id && <span className="text-[10px] font-mono text-red-400 animate-pulse">ACTIVE</span>}
                            </div>
                            <p className="text-xs text-gray-500 ml-8 mt-1">{card.desc}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
