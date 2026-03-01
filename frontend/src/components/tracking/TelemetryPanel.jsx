import React from 'react';
import { Activity, MapPin, Satellite, Zap, Database, Globe } from 'lucide-react';

export default function TelemetryPanel({
    telemetry,
    selectedSatellite,
    onSatelliteChange,
    satellites,
    nodes,
    showAll,
    onToggleShowAll,
    dtnEvents = [],
    onToggleNode
}) {
    return (
        <div className="flex flex-col gap-6 h-full text-xs font-mono">
            {/* 1. Satellite Selector */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <Satellite size={16} />
                        <h3 className="uppercase tracking-widest font-bold text-[10px]">Satellite Selector</h3>
                    </div>

                    <button
                        onClick={onToggleShowAll}
                        className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-all duration-300 ${showAll ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                    >
                        <Globe size={10} className={showAll ? 'animate-spin-slow' : ''} />
                        <span className="text-[8px] font-bold uppercase tracking-tighter">{showAll ? 'Showing All' : 'Show All'}</span>
                    </button>
                </div>

                <select
                    value={selectedSatellite.noradId}
                    onChange={(e) => {
                        const sat = satellites.find(s => s.noradId === parseInt(e.target.value));
                        onSatelliteChange(sat);
                    }}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2 text-gray-300 outline-none focus:border-cyan-500/50 transition-colors"
                >
                    {satellites.map(sat => (
                        <option key={sat.noradId} value={sat.noradId}>{sat.name}</option>
                    ))}
                </select>
            </div>

            {/* 2. Live Telemetry */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-h-[180px]">
                <div className="flex items-center gap-2 mb-4 text-cyan-400">
                    <Activity size={16} />
                    <h3 className="uppercase tracking-widest font-bold text-[10px]">Live Telemetry</h3>
                </div>

                {telemetry && !isNaN(telemetry.lat) ? (
                    <div className="space-y-3">
                        <TelemetryItem label="LATITUDE" value={`${telemetry.lat.toFixed(4)}°`} unit={telemetry.lat > 0 ? 'N' : 'S'} />
                        <TelemetryItem label="LONGITUDE" value={`${telemetry.lng.toFixed(4)}°`} unit={telemetry.lng > 0 ? 'E' : 'W'} />
                        <TelemetryItem label="ALTITUDE" value={`${telemetry.alt.toFixed(2)}`} unit="KM" />
                        <TelemetryItem label="VELOCITY" value={`${telemetry.vel.toFixed(2)}`} unit="KM/S" />
                        <div className="h-px bg-white/5 my-1" />
                        <TelemetryItem label="STATUS" value="NOMINAL" color="text-green-500" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-cyan-500/50">
                        <Activity size={24} className="animate-pulse mb-2" />
                        <div className="text-[9px] tracking-widest animate-pulse font-bold uppercase">Searching Signal...</div>
                    </div>
                )}
            </div>

            {/* 3. DTN Queue Status & Controls */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4 text-purple-400">
                    <Database size={16} />
                    <h3 className="uppercase tracking-widest font-bold text-[10px]">Nodal Outage Controls</h3>
                </div>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {nodes.map(node => (
                        <div key={node.node_id} className="flex flex-col gap-1 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-center text-[9px]">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 font-bold">{node.node_id}</span>
                                    <span className={`px-1 rounded-[2px] text-[7px] ${node.status === 'ONLINE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-500'}`}>
                                        {node.status}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onToggleNode(node.node_id)}
                                    className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${node.status === 'ONLINE' ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20'}`}
                                >
                                    {node.status === 'ONLINE' ? 'Cut Link' : 'Restore'}
                                </button>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden flex mt-1">
                                <div
                                    className={`h-full transition-all duration-300 ${node.dtn_queue_depth > 0 ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-gray-800'}`}
                                    style={{ width: `${Math.min(100, (node.dtn_queue_depth / 20) * 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[8px] text-gray-500 font-mono">
                                <span>QUEUE DEPTH</span>
                                <span className={node.dtn_queue_depth > 0 ? 'text-purple-400' : ''}>{node.dtn_queue_depth || 0} BUNDLES</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. DTN Protocol Event Log */}
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col flex-1 min-h-[200px] overflow-hidden">
                <div className="flex items-center gap-2 mb-4 text-cyan-400">
                    <Zap size={16} />
                    <h3 className="uppercase tracking-widest font-bold text-[10px]">DTN Protocol Log</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {dtnEvents.length > 0 ? dtnEvents.map(event => (
                        <div key={event.id} className="text-[8px] font-mono leading-tight animate-in fade-in slide-in-from-left duration-300 border-l border-cyan-500/30 pl-2 py-0.5">
                            <span className="text-gray-600 mr-2">[{event.time}]</span>
                            <span className={`uppercase font-bold mr-2 ${event.type.includes('FLUSH') ? 'text-purple-400' :
                                    event.type.includes('QUEUED') ? 'text-orange-400' :
                                        event.type.includes('DELIVERED') ? 'text-green-400' : 'text-cyan-400'
                                }`}>{event.type.replace('DTN_', '')}</span>
                            <span className="text-gray-400"># {event.message}</span>
                        </div>
                    )) : (
                        <div className="h-full flex items-center justify-center text-gray-600 italic text-[9px] uppercase tracking-widest">
                            Scanning for protocol packets...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TelemetryItem({ label, value, unit, color = "text-white" }) {
    return (
        <div className="flex justify-between items-end border-b border-white/5 pb-1">
            <span className="text-[9px] text-gray-500 tracking-tighter">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className={`text-sm font-bold ${color}`}>{value}</span>
                {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
            </div>
        </div>
    );
}
