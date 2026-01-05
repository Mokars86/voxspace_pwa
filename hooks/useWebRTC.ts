

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};



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

    // Subscribe to MY signaling channel
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase.channel(`user_signaling:${user.id}`);

        channel
            .on('broadcast', { event: 'signal' }, (payload) => {
                handleSignal(payload.payload);
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
            endCall(); // Cleanup on unmount
        };
    }, [user?.id]);

    const createPeerConnection = () => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate && otherUserId) {
                sendSignalToUser(otherUserId, { type: 'ice-candidate', candidate: event.candidate });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'disconnected') {
                setCallState('reconnecting');
            } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setCallState('connected');
            } else if (pc.iceConnectionState === 'failed') {
                endCall();
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
                console.log("No stream in ontrack, creating new MediaStream");
                const newStream = new MediaStream();
                newStream.addTrack(event.track);
                setRemoteStream(newStream);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("Connection State:", pc.connectionState);
            if (pc.connectionState === 'failed') {
                endCall();
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
        if (!user) return;

        let channel = signalingChannels.current.get(targetUserId);

        if (!channel) {
            // console.log(`Creating new signaling channel to ${targetUserId}`);
            channel = supabase.channel(`user_signaling:${targetUserId}`);

            // We must subscribe to SEND broadcast messages reliably
            await new Promise<void>((resolve, reject) => {
                channel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        resolve();
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        reject(new Error(`Failed to subscribe to signaling channel: ${status}`));
                    }
                });
            });

            signalingChannels.current.set(targetUserId, channel);
        }

        // console.log(`Sending signal ${payload.type} to ${targetUserId}`);
        await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
                ...payload,
                senderId: user.id,
                senderName: user.user_metadata?.full_name || 'User',
                senderAvatar: user.user_metadata?.avatar_url
            }
        });
    };



    const startCall = async (targetId: string, targetName: string, targetAvatar: string, video: boolean = false) => {
        setOtherUserId(targetId);
        setCallerInfo({ id: targetId, name: targetName, avatar: targetAvatar }); // Temporarily reused for display

        const stream = await getLocalStream(video);
        if (!stream) return;

        setIsVideoCall(video);
        setCallState('outgoing');
        const pc = createPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendSignalToUser(targetId, { type: 'offer', sdp: offer, isVideo: video });

        // IMPORTANT: Ringing sound should be handled by UI/Context
    };

    const answerCall = async () => {
        if (!callerInfo?.id) return;
        setOtherUserId(callerInfo.id);

        const stream = await getLocalStream(isVideoCall); // Respond with same video capability?
        if (!stream) return;

        const pc = createPeerConnection();
        // Assuming stream tracks are ready, but we should add them?
        // Wait, current logic adds them BEFORE creating answer usually.
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const answer = await pc.createAnswer();
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
                console.log("Busy: received offer while in state", callStateRef.current);
                return;
            }

            setCallState('incoming');
            setIsVideoCall(payload.isVideo || false);
            setCallerInfo({
                id: payload.senderId,
                name: payload.senderName,
                avatar: payload.senderAvatar || ''
            });
            // CRITICAL FIX: Set otherUserId so we know where to send our ICE candidates!
            setOtherUserId(payload.senderId);

            // Create PC to be ready, but don't answer yet
            const pc = createPeerConnection();

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                isRemoteDescriptionSet.current = true;
                await processIceQueue(); // Process any early candidates
            } catch (err) {
                console.error("Error setting remote description", err);
            }

        } else if (payload.type === 'answer') {
            // Check if we are in 'outgoing' state using the Ref to avoid stale closure
            if (callStateRef.current === 'outgoing' && peerConnection.current) {
                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    isRemoteDescriptionSet.current = true;
                    await processIceQueue();
                    setCallState('connected');
                } catch (err) {
                    console.error("Error setting remote answer", err);
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
            endCall();
        }
    };

    const endCall = async () => {
        if (otherUserId && callState !== 'idle') {
            sendSignalToUser(otherUserId, { type: 'hangup' }).catch(() => { });
        }

        startTimeRef.current = null;
        setCallId(null);
        setRemoteStream(null);
        setOtherUserId(null);

        // Reset ICE buffering state
        iceCandidatesQueue.current = [];
        isRemoteDescriptionSet.current = false;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);

        if (peerConnection.current) {
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
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = isMuted; // Toggle logic inverse
                // Wait. if isMuted is currently false, we want to SET MUTE (track.enabled = false).
                // if isMuted is currently true, we want to UNMUTE (track.enabled = true).
                track.enabled = isMuted; // Valid because state update happens after? No.
                // CURRENT state: isMuted = false. We want MUTE. Track should be false.
                // So track.enabled = !currentState.
                // No, 'enabled' true means active (Unmuted).
                // So if we are currently Unmuted (isMuted=false), we want to Mute. track.enabled = false.
            });
            // Fix logic:
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
