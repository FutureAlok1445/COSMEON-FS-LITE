import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar, Rocket, UploadCloud, Download, FileAudio, FileText,
    FileVideo, FileImage, File, CheckCircle2, AlertTriangle,
    Wifi, WifiOff, Send, Loader2, ArrowRight
} from 'lucide-react';

const WEBSOCKET_URL = `ws://${window.location.hostname}:9000/api/p2p/signaling`;
const CHUNK_SIZE = 16384; // 16KB WebRTC optimal chunk size

export default function OrbitalDrop() {
    const [ws, setWs] = useState(null);
    const [connected, setConnected] = useState(false);
    const [myProfile, setMyProfile] = useState(null);
    const [peers, setPeers] = useState([]);

    // Transfer State
    const [selectedFile, setSelectedFile] = useState(null);
    const [targetPeer, setTargetPeer] = useState(null);
    const [transferStatus, setTransferStatus] = useState('idle'); // idle, connecting, sending, receiving, complete, error
    const [transferProgress, setTransferProgress] = useState(0);
    const [incomingFileMeta, setIncomingFileMeta] = useState(null);

    // WebRTC Refs
    const peerConnection = useRef(null);
    const dataChannel = useRef(null);
    const receiveBuffer = useRef([]);
    const receivedSize = useRef(0);

    // ── 1. Connect to Signaling Server ──
    useEffect(() => {
        const socket = new WebSocket(WEBSOCKET_URL);

        socket.onopen = () => {
            console.log("Connected to Orbital Signaling Network");
            setConnected(true);
            setWs(socket);
        };

        socket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === 'welcome') {
                setMyProfile(msg.profile);
            }
            else if (msg.type === 'peer-list-update') {
                setPeers(msg.peers);
            }
            else if (msg.type === 'signal') {
                handleIncomingSignal(msg.sender, msg.data);
            }
        };

        socket.onclose = () => {
            setConnected(false);
            setWs(null);
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };
    }, []);

    const handleIncomingSignal = async (senderId, data) => {
        if (data.type === 'offer') {
            setTargetPeer(peers.find(p => p.id === senderId));
            setTransferStatus('connecting');
            const pc = initPeerConnection(senderId, false);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'signal', target: senderId, data: { type: 'answer', answer } }));
        }
        else if (data.type === 'answer') {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        else if (data.type === 'ice') {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    };

    const initPeerConnection = (peerId, isInitiator) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && ws) {
                ws.send(JSON.stringify({ type: 'signal', target: peerId, data: { type: 'ice', candidate: event.candidate } }));
            }
        };

        if (isInitiator) {
            const dc = pc.createDataChannel('fileTransfer');
            setupDataChannel(dc);
        } else {
            pc.ondatachannel = (event) => setupDataChannel(event.channel);
        }

        return pc;
    };

    const setupDataChannel = (dc) => {
        dataChannel.current = dc;
        dc.binaryType = 'arraybuffer';
        dc.onopen = () => {
            console.log("Data Channel OPEN");
            if (selectedFile && transferStatus === 'connecting') {
                startFileTransfer();
            }
        };
        dc.onmessage = (event) => {
            if (typeof event.data === 'string') {
                const meta = JSON.parse(event.data);
                if (meta.type === 'file-meta') {
                    setIncomingFileMeta(meta);
                    setTransferStatus('receiving');
                    setTransferProgress(0);
                    receiveBuffer.current = [];
                    receivedSize.current = 0;
                } else if (meta.type === 'transfer-complete') {
                    finalizeDownload();
                }
            } else {
                receiveBuffer.current.push(event.data);
                receivedSize.current += event.data.byteLength;
                const progress = (receivedSize.current / incomingFileMeta.size) * 100;
                setTransferProgress(progress);
            }
        };
    };

    const startFileTransfer = async () => {
        setTransferStatus('sending');
        dataChannel.current.send(JSON.stringify({
            type: 'file-meta',
            name: selectedFile.name,
            size: selectedFile.size,
            mime: selectedFile.type
        }));

        const reader = new FileReader();
        let offset = 0;

        const readSlice = (o) => {
            const slice = selectedFile.slice(offset, o + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            dataChannel.current.send(e.target.result);
            offset += e.target.result.byteLength;
            setTransferProgress((offset / selectedFile.size) * 100);

            if (offset < selectedFile.size) {
                if (dataChannel.current.bufferedAmount > 16000000) {
                    setTimeout(() => readSlice(offset), 100);
                } else {
                    readSlice(offset);
                }
            } else {
                dataChannel.current.send(JSON.stringify({ type: 'transfer-complete' }));
                setTransferStatus('complete');
            }
        };
        readSlice(0);
    };

    const finalizeDownload = () => {
        const receivedBlob = new Blob(receiveBuffer.current, { type: incomingFileMeta.mime });
        const url = URL.createObjectURL(receivedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = incomingFileMeta.name;
        a.click();
        URL.revokeObjectURL(url);
        setTransferStatus('complete');
    };

    const initiateTransfer = async (peer) => {
        if (!selectedFile) return;
        setTargetPeer(peer);
        setTransferStatus('connecting');
        const pc = initPeerConnection(peer.id, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'signal', target: peer.id, data: { type: 'offer', offer } }));
    };

    return (
        <div className="w-full h-full flex flex-col gap-6 font-sans text-gray-200">
            {/* Header */}
            <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                        <Radar className="text-cyan-400 animate-pulse" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">Orbital Drop</h1>
                        <p className="text-xs text-gray-400 font-mono">P2P Satellite-to-Satellite Signaling</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {connected ? (
                        <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Mesh Active</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                            <WifiOff className="text-red-500" size={14} />
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Mesh Offline</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Peer List / Radar */}
                <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/50 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-cyan-500/30 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-cyan-500/20 rounded-full" />
                    </div>

                    <div className="z-10 text-center mb-8">
                        <h2 className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Discovery Network</h2>
                        <div className="flex flex-wrap justify-center gap-6 mt-10">
                            <AnimatePresence>
                                {peers.map(peer => (
                                    <motion.div
                                        key={peer.id}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        whileHover={{ scale: 1.1 }}
                                        onClick={() => initiateTransfer(peer)}
                                        className="cursor-pointer group relative"
                                    >
                                        <div className="w-20 h-20 bg-cyan-900/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-all flex-col gap-2">
                                            <Satellite className="text-cyan-400" size={32} />
                                            <span className="text-[10px] font-mono text-gray-400">{peer.name}</span>
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {peers.length === 0 && (
                                <div className="flex flex-col items-center gap-4 text-gray-500 font-mono text-sm py-20">
                                    <Loader2 className="animate-spin" />
                                    Scanning Orbital Planes...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Controls & Progress */}
                <div className="w-[400px] flex flex-col gap-6">
                    <div className="bg-[#111827] border border-white/5 p-6 rounded-3xl shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payload Selection</h3>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="text-gray-500 mb-2" size={24} />
                                <p className="text-xs text-gray-500 font-mono">
                                    {selectedFile ? selectedFile.name : 'Select File for Drop'}
                                </p>
                            </div>
                            <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files[0])} />
                        </label>
                    </div>

                    <div className="flex-1 bg-[#111827] border border-white/5 p-6 rounded-3xl flex flex-col relative overflow-hidden">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Transfer Matrix</h3>
                        <div className="flex-1 flex flex-col justify-center gap-8">
                            {transferStatus === 'idle' ? (
                                <div className="text-center text-gray-600 font-mono text-sm">
                                    <Rocket className="mx-auto mb-4 opacity-20" size={48} />
                                    Select Peer to Begin Transfer
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 border border-cyan-500/30">
                                                <Satellite className="text-cyan-400" size={24} />
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-mono">LOCAL</span>
                                        </div>
                                        <div className="flex-1 px-4 relative">
                                            <div className="h-0.5 w-full bg-gray-800" />
                                            <motion.div
                                                className="absolute top-1/2 -translate-y-1/2 text-cyan-500"
                                                animate={{ left: ["0%", "100%"] }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            >
                                                <Send size={16} />
                                            </motion.div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 border border-purple-500/30">
                                                <Satellite className="text-purple-400" size={24} />
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-mono uppercase">{targetPeer?.name || 'PEER'}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">{transferStatus}</span>
                                            <span className="text-xl font-mono text-cyan-400">{transferProgress.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${transferProgress}%` }}
                                            />
                                        </div>
                                        {transferStatus === 'complete' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-3"
                                            >
                                                <CheckCircle2 className="text-green-500" size={20} />
                                                <span className="text-xs text-green-500 font-bold uppercase tracking-tight">Mission Success: Payload Transferred</span>
                                            </motion.div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
