import React, { useState, useEffect } from 'react';

export default function MatrixDensity({ messages = [] }) {
    // A 5x7 grid (35 cells)
    const [grid, setGrid] = useState(Array(35).fill('idle'));

    useEffect(() => {
        if (messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        const newGrid = [...grid];

        // Pick a random cell to animate
        const idx = Math.floor(Math.random() * 35);

        if (lastMsg.type.includes('UPLOAD') || lastMsg.type.includes('SUCCESS') || lastMsg.type.includes('FETCH')) {
            newGrid[idx] = 'active'; // bright blue
        } else if (lastMsg.type.includes('ERROR') || lastMsg.type.includes('CORRUPT') || lastMsg.type.includes('DESTROYED')) {
            newGrid[idx] = 'error'; // orange/red
        } else if (lastMsg.type.includes('RECOVERY') || lastMsg.type.includes('FLUSH')) {
            newGrid[idx] = 'recovery'; // green/purple
        }

        setGrid(newGrid);

        // Fade back to idle after a moment
        const timeout = setTimeout(() => {
            setGrid(prev => {
                const reset = [...prev];
                if (reset[idx] !== 'error') { // Keep errors visible longer
                    reset[idx] = 'idle';
                }
                return reset;
            });
        }, 1500);

        return () => clearTimeout(timeout);
    }, [messages]);

    const getColor = (state) => {
        switch (state) {
            case 'active': return 'bg-blue-500 shadow-[0_0_10px_#3b82f6]';
            case 'error': return 'bg-orange-800 shadow-[0_0_10px_#9a3412]';
            case 'recovery': return 'bg-green-600 shadow-[0_0_10px_#16a34a]';
            default: return 'bg-[#1e3a8a]/40 border border-[#1e40af]/30'; // idle dark blue
        }
    };

    return (
        <div className="flex-1 bg-[#111827] border border-[#1e293b] rounded-2xl p-6 flex flex-col mt-6 shadow-2xl">
            <h3 className="text-[11px] font-bold text-gray-400 tracking-[0.2em] mb-4">MATRIX DENSITY</h3>

            <div className="flex-1 grid grid-cols-5 gap-2 content-start">
                {grid.map((state, i) => (
                    <div
                        key={i}
                        className={`w-full aspect-[2/3] rounded transition-all duration-300 ${getColor(state)}`}
                    ></div>
                ))}
            </div>
        </div>
    );
}
