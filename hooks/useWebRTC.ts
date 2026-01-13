
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};



// Add detailed logging
const log = (msg: string, ...args: any[]) => console.log(`[useWebRTC] ${msg}`, ...args);

export const useWebRTC = (user: any) => {
    const [callState, setCallState] = useState<'idle' | 'outgoing' | 'incoming' | 'connected' | 'reconnecting' | 'ending'>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isVideoCall, setIsVideoCall] = useState(false);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [callerInfo, setCallerInfo] = useState<{ id: string, name: string, avatar: string } | null>(null);
    const [callId, setCallId] = useState<string | null>(null); // DB ID
    const startTimeRef = useRef<number | null>(null);

    // Keep track of channels we are sending TO
    const signalingChannels = useRef<Map<string, any>>(new Map());

    // Cleanup sending channels on unmount or endCall
    useEffect(() => {
        return () => {
            signalingChannels.current.forEach(ch => ch.unsubscribe());
            signalingChannels.current.clear();
        };
    }, []);

    // Track current call partner to know where to send signals
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    // [CRITICAL FIX] Ref to avoid stale closures in callbacks
    const otherUserIdRef = useRef<string | null>(null);

    // Helper to update both state and ref
    const updateOtherUserId = (id: string | null) => {
        setOtherUserId(id);
        otherUserIdRef.current = id;
    };

    // Subscribe to MY signaling channel with robust error handling
    useEffect(() => {
        if (!user?.id) return;

        console.log(`[useWebRTC] Subscribing to signaling channel: user_signaling:${user.id}`);
        const channel = supabase.channel(`user_signaling:${user.id}`);

        channel
            .on('broadcast', { event: 'signal' }, (payload) => {
                console.log(`[useWebRTC] Received signal on my channel:`, payload.payload.type, "from", payload.payload.senderId);
                handleSignal(payload.payload);
            })
            .subscribe((status) => {
                console.log(`[useWebRTC] Subscription status for my channel: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`[useWebRTC] Successfully subscribed to incoming signals.`);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`[useWebRTC] Failed to subscribe to channel: ${status}`);
                }
            });

        return () => {
            console.log(`[useWebRTC] Unsubscribing from my channel`);
            channel.unsubscribe();
            endCall("unmount"); // Cleanup on unmount
        };
    }, [user?.id]);

    const createPeerConnection = () => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            // [CRITICAL FIX] Use ref to get current otherUserId
            if (event.candidate && otherUserIdRef.current) {
                // console.log("Sending ICE candidate to", otherUserIdRef.current);
                sendSignalToUser(otherUserIdRef.current, { type: 'ice-candidate', candidate: event.candidate });
            } else if (event.candidate) {
                console.warn("ICE candidate generated but no otherUserId", otherUserIdRef.current);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'disconnected') {
                console.warn("[useWebRTC] ICE Disconnected. Waiting for recovery...");
                // Optional: Delay showing 'reconnecting' to avoid UI flicker if it recovers quickly
                // setCallState('reconnecting'); 
            } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log("[useWebRTC] ICE Connected");
                setCallState('connected');
            } else if (pc.iceConnectionState === 'failed') {
                console.error("[useWebRTC] ICE Failed.");
                setCallState('reconnecting'); // Only show reconnecting/failed on actual failure
                // endCall("ice_failed"); // Don't auto-end, let user decide or retry
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log("ICE Gathering State:", pc.iceGatheringState);
        };

        pc.onsignalingstatechange = () => {
            console.log("Signaling State:", pc.signalingState);
        };

        pc.ontrack = (event) => {
            console.log("Track received:", event.track.kind, event.streams[0]?.id);
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                // Fallback for browsers/implementations that don't send stream (e.g. mobile sometimes)
                // Accumulate tracks instead of checking for replacement
                setRemoteStream(prev => {
                    const newStream = new MediaStream();
                    if (prev) {
                        prev.getTracks().forEach(t => newStream.addTrack(t));
                    }
                    newStream.addTrack(event.track);
                    return newStream;
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("Connection State:", pc.connectionState);
            if (pc.connectionState === 'failed') {
                console.error("[useWebRTC] Connection Failed. Not auto-ending to allow potential recovery or manual hangup.");
                // endCall("connection_failed"); // Too aggressive
            }
        };

        peerConnection.current = pc;
        return pc;
    };

    const getLocalStream = async (video: boolean) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsVideoEnabled(video);
            return stream;
        } catch (error: any) {
            console.error("Error accessing media devices", error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("Permission denied. Please enable microphone/camera.");
            } else {
                alert(`Media Error: ${error.name} - ${error.message}`);
            }
            return null;
        }
    };



    const sendSignalToUser = async (targetUserId: string, payload: any) => {
        if (!user) {
            console.error("[useWebRTC] Cannot send signal: User not authenticated");
            return;
        }

        console.log(`[useWebRTC] Preparing to send signal '${payload.type}' to user: ${targetUserId}`);

        let channel = signalingChannels.current.get(targetUserId);

        if (!channel) {
            console.log(`[useWebRTC] Creating new sending channel for target: user_signaling:${targetUserId}`);
            channel = supabase.channel(`user_signaling:${targetUserId}`);

            try {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("Subscription timeout"));
                    }, 5000); // 5s timeout

                    channel.subscribe((status: string) => {
                        console.log(`[useWebRTC] Sending channel status (${targetUserId}): ${status}`);
                        if (status === 'SUBSCRIBED') {
                            clearTimeout(timeout);
                            resolve();
                        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            clearTimeout(timeout);
                            reject(new Error(`Failed to subscribe: ${status}`));
                        }
                    });
                });
                signalingChannels.current.set(targetUserId, channel);
            } catch (err) {
                console.error(`[useWebRTC] Error subscribing to sending channel for ${targetUserId}:`, err);
                return; // Abort sending
            }
        } else {
            console.log(`[useWebRTC] Reusing existing channel for ${targetUserId}`);
        }

        try {
            const status = await channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                    ...payload,
                    senderId: user.id,
                    senderName: user.user_metadata?.full_name || 'User',
                    senderAvatar: user.user_metadata?.avatar_url
                }
            });
            console.log(`[useWebRTC] Signal '${payload.type}' sent result:`, status);
        } catch (err) {
            console.error(`[useWebRTC] FATAL: Failed to send signal '${payload.type}'`, err);
        }
    };



    const startCall = async (targetId: string, targetName: string, targetAvatar: string, video: boolean = false) => {
        console.log(`[useWebRTC] STARTING CALL with ${targetName} (${targetId})`);
        updateOtherUserId(targetId);
        setCallerInfo({ id: targetId, name: targetName, avatar: targetAvatar });

        const stream = await getLocalStream(video);
        if (!stream) {
            console.error("[useWebRTC] Failed to get local stream, aborting call.");
            return;
        }

        setIsVideoCall(video);
        setCallState('outgoing');
        const pc = createPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        console.log("[useWebRTC] Creating offer...");
        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: video
            });
            await pc.setLocalDescription(offer);
            console.log("[useWebRTC] Offer created and set locally. Sending...");

            await sendSignalToUser(targetId, { type: 'offer', sdp: offer, isVideo: video });
            console.log("[useWebRTC] Offer signal process completed.");
        } catch (err) {
            console.error("[useWebRTC] Error during startCall offer generation/sending:", err);
            setCallState('idle'); // Reset on failure
        }
    };

    const answerCall = async () => {
        if (!callerInfo?.id) return;
        updateOtherUserId(callerInfo.id);

        const stream = await getLocalStream(isVideoCall); // Respond with same video capability?
        if (!stream) return;

        const pc = createPeerConnection();
        // Assuming stream tracks are ready, but we should add them?
        // Wait, current logic adds them BEFORE creating answer usually.
        // Wait, current logic adds them BEFORE creating answer usually.
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideoCall
        });
        await pc.setLocalDescription(answer);

        await sendSignalToUser(callerInfo.id, { type: 'answer', sdp: answer });
        setCallState('connected');
    };

    // Fix Stale Closure: Keep a ref to callState
    const callStateRef = useRef(callState);
    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);

    const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
    const isRemoteDescriptionSet = useRef(false);

    const processIceQueue = async () => {
        if (!peerConnection.current || !isRemoteDescriptionSet.current) return;

        while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift();
            if (candidate) {
                try {
                    await peerConnection.current.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding buffered ICE candidate", e);
                }
            }
        }
    };

    const handleSignal = async (payload: any) => {
        // console.log("Received Signal:", payload.type);

        // Prevent self-signal loops (unlikely with user channels but safe)
        if (payload.senderId === user?.id) return;

        if (payload.type === 'offer') {
            // Check if already in call?
            if (callStateRef.current !== 'idle' && callStateRef.current !== 'incoming') {
                // Busy? Send 'busy' signal?
                console.warn(`[useWebRTC] Busy: received offer while in state ${callStateRef.current}`);
                return;
            }

            console.log(`[useWebRTC] Accepting offer from ${payload.senderName} (${payload.senderId})`);

            setCallState('incoming');
            setIsVideoCall(payload.isVideo || false);
            setCallerInfo({
                id: payload.senderId,
                name: payload.senderName,
                avatar: payload.senderAvatar || ''
            });

            // CRITICAL FIX: Set otherUserId immediately so we know where to send our signals (like ICE candidates)!
            if (payload.senderId) {
                updateOtherUserId(payload.senderId);
                console.log(`[useWebRTC] Set otherUserId to ${payload.senderId} for incoming call.`);
            } else {
                console.error("[useWebRTC] Received offer without senderId!", payload);
            }

            // Create PC to be ready, but don't answer yet
            const pc = createPeerConnection();

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                isRemoteDescriptionSet.current = true;
                console.log(`[useWebRTC] Remote description set for offer. Processing ICE queue...`);
                await processIceQueue(); // Process any early candidates
            } catch (err) {
                console.error("[useWebRTC] Error setting remote description for offer", err);
            }

        } else if (payload.type === 'answer') {
            // Check if we are in 'outgoing' state using the Ref to avoid stale closure
            if (callStateRef.current === 'outgoing' && peerConnection.current) {
                if (peerConnection.current.signalingState === 'stable') {
                    console.warn("[useWebRTC] Received answer but PC is already stable. Assuming call established/duplicate signal.");
                    if (!isRemoteDescriptionSet.current) {
                        isRemoteDescriptionSet.current = true; // Just in case
                        setCallState('connected');
                    }
                    return;
                }

                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    isRemoteDescriptionSet.current = true;
                    console.log("[useWebRTC] Remote description set for answer. Processing ICE queue...");
                    await processIceQueue();
                    setCallState('connected');
                } catch (err) {
                    console.error("[useWebRTC] Error setting remote answer", err);
                }
            } else {
                console.warn("Received answer but state is not outgoing or PC missing", callStateRef.current);
            }

        } else if (payload.type === 'ice-candidate') {
            const candidate = new RTCIceCandidate(payload.candidate);
            if (peerConnection.current && peerConnection.current.remoteDescription && isRemoteDescriptionSet.current) {
                try {
                    await peerConnection.current.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding ICE candidate", e);
                }
            } else {
                console.log("Buffering ICE candidate (remote desc not ready)");
                iceCandidatesQueue.current.push(candidate);
            }

        } else if (payload.type === 'hangup') {
            endCall("remote_hangup");
        }
    };

    const endCall = async (reason: string = "unknown") => {
        console.log(`[useWebRTC] Ending call. Reason: ${reason}`);
        if (otherUserIdRef.current && callState !== 'idle') {
            console.log(`[useWebRTC] Sending hangup signal to ${otherUserIdRef.current}`);
            sendSignalToUser(otherUserIdRef.current, { type: 'hangup' }).catch((e) => console.error("Failed to send hangup", e));
        }

        startTimeRef.current = null;
        setCallId(null);
        setRemoteStream(null);
        // Do not nullify otherUserIdRef immediately if we want to allow reconnects? No, cleaner to reset.
        updateOtherUserId(null);

        // Reset ICE buffering state
        iceCandidatesQueue.current = [];
        isRemoteDescriptionSet.current = false;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`[useWebRTC] Stopped local track: ${track.kind}`);
            });
            localStreamRef.current = null;
        }
        setLocalStream(null);

        if (peerConnection.current) {
            console.log("[useWebRTC] Closing PeerConnection");
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setCallState('idle');
        setCallerInfo(null);
        setIsVideoCall(false);
        setIsMuted(false);
        setIsVideoEnabled(false);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const newMuted = !isMuted;
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !newMuted);
            setIsMuted(newMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const newVideo = !isVideoEnabled;
            localStreamRef.current.getVideoTracks().forEach(track => track.enabled = newVideo);
            setIsVideoEnabled(newVideo);
        }
    };

    return {
        callState,
        callerInfo,
        isMuted,
        isVideoEnabled,
        isVideoCall,
        localStream,
        remoteStream,
        startCall,
        answerCall,
        endCall,
        toggleMute,
        toggleVideo
    };
};
