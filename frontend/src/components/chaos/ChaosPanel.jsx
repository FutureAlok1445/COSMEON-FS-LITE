import React, { useState } from 'react';
import { AlertCircle, Zap, Activity, ShieldAlert, RefreshCw } from 'lucide-react';

export function ChaosPanel() {
    const [active, setActive] = useState(null);

    const triggerChaos = async (scenario) => {
        setActive(scenario);
        try {
            await fetch(`http://${window.location.hostname}:9000/api/chaos/${scenario}`, { method: 'POST' });
        } catch (err) {
            console.error(err);
        }
    };

    const resetAll = async () => {
        try {
            await fetch(`http://${window.location.hostname}:9000/api/chaos/restore`, { method: 'POST' });
            setActive(null);
        } catch (err) {
            console.error(err);
        }
    };

    const cards = [
        { id: 'solar_flare', name: 'Solar Flare', desc: 'Kills Plane Beta (SAT-03, SAT-04)', icon: Zap, color: 'text-amber-500', glow: 'rgba(245,158,11,0.2)' },
        { id: 'bit_rot', name: 'Radiation Bit Rot', desc: 'Silently corrupts 1 byte in SAT-01', icon: Activity, color: 'text-purple-500', glow: 'rgba(168,85,247,0.2)' },
        { id: 'partition', name: 'Network Partition', desc: 'Cuts link to Plane Beta (DTN mode)', icon: ShieldAlert, color: 'text-rose-500', glow: 'rgba(244,63,94,0.2)' }
    ];

    return (
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">

            {/* Subtle Top Glow */}
            <div className="absolute top-0 right-0 w-48 h-1 bg-gradient-to-l from-red-500/50 to-transparent opacity-50"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[80px] pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                        <AlertCircle className="text-red-400" size={18} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold tracking-wide text-sm">Chaos Array</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Fault Injection</p>
                    </div>
                </div>
                <button
                    onClick={resetAll}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all shadow-lg"
                >
                    <RefreshCw size={12} />
                    Restore
                </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 flex-1 relative z-10">
                {cards.map(card => {
                    const Icon = card.icon;
                    const isActive = active === card.id;
                    const isDisabled = active && !isActive;

                    return (
                        <button
                            key={card.id}
                            onClick={() => triggerChaos(card.id)}
                            disabled={isDisabled}
                            style={{
                                boxShadow: isActive ? `inset 0 0 20px ${card.glow}, 0 0 15px ${card.glow}` : 'none'
                            }}
                            className={`text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${isActive
                                ? `border-white/30 bg-white/5`
                                : `border-white/5 bg-white/[0.01] hover:bg-white/5 hover:border-white/20 ${isDisabled ? 'opacity-30 grayscale cursor-not-allowed' : ''}`
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon className={`${card.color} ${isActive ? 'animate-pulse' : ''}`} size={16} />
                                <div>
                                    <span className="font-bold text-gray-200 text-xs block">{card.name}</span>
                                    <span className="text-[10px] text-gray-500 font-mono tracking-wide">{card.desc}</span>
                                </div>
                            </div>
                            {isActive && <span className="text-[9px] font-mono text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded animate-pulse">EXEC</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
