import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, User, Video, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'reconnecting' | 'ending';

interface CallOverlayProps {
    isOpen: boolean;
    state: CallState;
    callerName: string;
    callerAvatar?: string | null;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isVideoCall: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onAccept: () => void;
    onReject: () => void;
    onHangup: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({
    isOpen,
    state,
    callerName,
    callerAvatar,
    isAudioEnabled,
    isVideoEnabled,
    isVideoCall,
    localStream,
    remoteStream,
    onToggleAudio,
    onToggleVideo,
    onAccept,
    onReject,
    onHangup
}) => {
    const [duration, setDuration] = useState(0);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);


    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else if (state === 'idle' || state === 'incoming' || state === 'outgoing') {
            // Only reset if effectively not in a call
            setDuration(0);
        }
        // If reconnecting/ending, we just pause (clear interval)
        return () => clearInterval(interval);
    }, [state]);

    // Helper to attempt playback
    const attemptPlay = async (element: HTMLMediaElement, updateState: boolean = true) => {
        if (!element) return;
        try {
            await element.play();
            if (updateState) setIsPlaying(true);
        } catch (err) {
            console.error("Autoplay prevented:", err);
            if (updateState) setIsPlaying(false);
        }
    };

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.onloadedmetadata = () => {
                localVideoRef.current!.muted = true; // Always mute local video
                attemptPlay(localVideoRef.current!, false);
            };
        }
    }, [localStream, isOpen]);

    // Unified Remote Media Handling
    useEffect(() => {
        if (remoteVideoRef.current) {
            if (remoteStream) {
                console.log("[CallOverlay] Attaching remote stream to video element", remoteStream.getTracks().map(t => t.kind));
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.onloadedmetadata = () => {
                    // Ensure unmuted so we can hear audio!
                    remoteVideoRef.current!.muted = false;
                    remoteVideoRef.current!.volume = 1.0;
                    attemptPlay(remoteVideoRef.current!);
                };
            } else {
                remoteVideoRef.current.srcObject = null;
            }
        }
    }, [remoteStream, isOpen]);

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    useEffect(() => {
        if (isOpen) {
            console.log(`[CallOverlay] Overlay opened. State: ${state}, Caller: ${callerName}`);
        }
    }, [isOpen, state, callerName]);

    if (!isOpen || state === 'idle') return null;

    return (
        <div className={cn("fixed inset-0 z-[99999] backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-300 overflow-hidden", isVideoCall ? "bg-black/50" : "bg-gray-900/95")}>

            {/* Background Video (Remote) - Always render for audio playback */}
            <div className="absolute inset-0 z-[-1] bg-black">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={cn("w-full h-full object-cover transition-opacity duration-300",
                        state === 'connected' && isVideoCall ? "opacity-100" : "opacity-0")}
                />
            </div>

            {/* Local Video (PIP) */}
            {isVideoCall && state === 'connected' && (
                <div className="absolute top-4 right-4 w-32 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-all hover:scale-105">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }} // Mirror effect
                    />
                    {!isVideoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                            <VideoOff size={24} className="text-gray-500" />
                        </div>
                    )}
                </div>
            )}

            {/* Caller Info (Fade out if video active and connected) */}
            <div className={cn("flex flex-col items-center gap-6 mb-12 transition-all duration-500", isVideoCall && state === 'connected' ? "opacity-0 translate-y-[-50px] pointer-events-none" : "opacity-100")}>
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-gray-800 flex items-center justify-center">
                    {callerAvatar ? (
                        <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
                    ) : (
                        <User size={64} className="text-gray-400" />
                    )}
                </div>
                <div className="text-center">
                    <h2 className="text-3xl font-bold mb-2 drop-shadow-md">{callerName}</h2>
                    <p className="text-lg text-gray-100 font-medium opacity-90 drop-shadow-md">
                        {state === 'incoming' && (isVideoCall ? 'Incoming Video Call...' : 'Incoming Audio Call...')}
                        {state === 'outgoing' && 'Calling...'}
                        {state === 'connected' && formatDuration(duration)}
                        {state === 'reconnecting' && <span className="text-yellow-400 animate-pulse">Reconnecting...</span>}
                        {state === 'ending' && 'Call Ended'}
                    </p>
                </div>
            </div>



            {/* Fallback "Tap to Play" if autoplay blocked */}
            {!isPlaying && state === 'connected' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <button
                        onClick={() => {
                            if (remoteVideoRef.current) attemptPlay(remoteVideoRef.current);
                            if (localVideoRef.current) attemptPlay(localVideoRef.current);
                        }}
                        className="px-6 py-3 bg-blue-600 rounded-full text-white font-bold shadow-2xl animate-bounce"
                    >
                        Tap to Start Audio/Video
                    </button>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-8 absolute bottom-12 z-20">
                {/* ... existing controls ... */}
                {state === 'incoming' ? (
                    <>
                        {/* ... incoming controls ... */}
                        <button
                            onClick={onReject}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                                <PhoneOff size={32} />
                            </div>
                            <span className="text-sm font-medium drop-shadow-md">Decline</span>
                        </button>
                        <button
                            onClick={onAccept}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-transform animate-pulse">
                                {isVideoCall ? <Video size={32} /> : <Phone size={32} />}
                            </div>
                            <span className="text-sm font-medium drop-shadow-md">Accept</span>
                        </button>
                    </>
                ) : (
                    <>
                        {state === 'connected' && (
                            <>
                                <button
                                    onClick={onToggleAudio}
                                    className={cn(
                                        "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm",
                                        isAudioEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-white text-gray-900"
                                    )}
                                >
                                    {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                                </button>

                                {isVideoCall && (
                                    <button
                                        onClick={onToggleVideo}
                                        className={cn(
                                            "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm",
                                            isVideoEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-white text-gray-900"
                                        )}
                                    >
                                        {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                                    </button>
                                )}
                            </>
                        )}

                        <button
                            onClick={onHangup}
                            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        >
                            <PhoneOff size={32} />
                        </button>
                    </>
                )}
            </div>


        </div>
    );
};

export default CallOverlay;
