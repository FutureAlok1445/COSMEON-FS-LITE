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
        { id: 'solar_flare', name: 'Solar Flare', desc: 'Kills Plane Beta (SAT-03, SAT-04)', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { id: 'bit_rot', name: 'Radiation Bit Rot', desc: 'Silently corrupts 1 byte in SAT-01', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { id: 'partition', name: 'Network Partition', desc: 'Cuts link to Plane Beta (DTN mode)', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' }
    ];

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-red-500 font-bold">
                    <AlertCircle size={20} />
                    <span>CHAOS ENGINEERING</span>
                </div>
                <button
                    onClick={resetAll}
                    className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded text-sm hover:bg-green-500/30 transition-colors"
                >
                    <RefreshCw size={14} />
                    RESTORE ALL
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3 flex-1">
                {cards.map(card => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.id}
                            onClick={() => triggerChaos(card.id)}
                            disabled={active && active !== card.id}
                            className={`text-left p-3 rounded border transition-all ${active === card.id
                                    ? `${card.border} ${card.bg} border-${card.color.split('-')[1]}-500 animate-pulse`
                                    : `border-gray-800 hover:border-gray-600 bg-gray-800/50 ${active ? 'opacity-50' : ''}`
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-1">
                                <Icon className={card.color} size={18} />
                                <span className="font-semibold text-gray-200">{card.name}</span>
                            </div>
                            <p className="text-xs text-gray-500 ml-7">{card.desc}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
