import { useState, useEffect, useCallback } from 'react';

export function useWebSocket(url) {
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const ws = new WebSocket(url);

        ws.onopen = () => {
            setConnected(true);
            console.log("WebSocket connected");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMessages((prev) => [...prev, data]);
        };

        ws.onclose = () => {
            setConnected(false);
            console.log("WebSocket disconnected");
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [url]);

    return { messages, connected };
}
