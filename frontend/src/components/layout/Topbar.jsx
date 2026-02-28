import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export default function Topbar({ currentTab, setCurrentTab }) {
    const tabs = ['Orbital Engine', 'Network Map', 'Payload Telemetry', 'Ground Links'];

    return (
        <div className="flex justify-between items-center h-16 bg-[#0a0f1c] border-b border-[#1e293b] px-6">
            <div className="flex gap-8 text-sm font-semibold text-gray-400">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setCurrentTab && setCurrentTab(tab)}
                        className={`pb-[18px] transition-colors ${currentTab === tab ? 'text-white border-b-2 border-blue-500' : 'hover:text-gray-200'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search constellations..."
                        className="bg-[#111827] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div className="relative cursor-pointer">
                    <Bell className="text-gray-400 hover:text-white transition-colors" size={20} />
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                </div>

                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-200 to-amber-500"></div>
            </div>
        </div>
    );
}
