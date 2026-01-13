import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import CallOverlay from '../components/chat/CallOverlay';

interface CallContextType {
    startCall: (targetId: string, targetName: string, targetAvatar: string, isVideo: boolean) => void;
    endCall: () => void;
    callState: 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ending';
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session, user } = useAuth();

    // Pass user to useWebRTC for signaling subscription
    const webrtc = useWebRTC(user);

    // Ringtone Logic
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (webrtc.callState === 'incoming' || webrtc.callState === 'outgoing') {
            console.log(`[CallContext] State is ${webrtc.callState}, attempting to play ringtone...`);
            if (!ringtoneRef.current) {
                ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
                ringtoneRef.current.loop = true;
                ringtoneRef.current.volume = 0.5; // Ensure not too loud
            }
            ringtoneRef.current.play()
                .then(() => console.log('[CallContext] Ringtone playing successfully'))
                .catch(e => console.error('[CallContext] Ringtone autoplay blocked or failed:', e));
        } else {
            if (ringtoneRef.current) {
                console.log('[CallContext] Stopping ringtone');
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
            }
        }
    }, [webrtc.callState]);

    return (
        <CallContext.Provider value={{
            startCall: webrtc.startCall,
            endCall: webrtc.endCall,
            callState: webrtc.callState
        }}>
            {children}
            <CallOverlay
                isOpen={webrtc.callState !== 'idle'}
                state={webrtc.callState}
                callerName={webrtc.callerInfo?.name || 'Unknown'}
                callerAvatar={webrtc.callerInfo?.avatar}
                isAudioEnabled={!webrtc.isMuted} // Note: Overlay expects "isEnabled" but hook has "isMuted". !isMuted = Enabled.
                isVideoEnabled={webrtc.isVideoEnabled}
                isVideoCall={webrtc.isVideoCall}
                localStream={webrtc.localStream}
                remoteStream={webrtc.remoteStream}
                onToggleAudio={webrtc.toggleMute}
                onToggleVideo={webrtc.toggleVideo}
                onAccept={webrtc.answerCall}
                onReject={webrtc.endCall}
                onHangup={webrtc.endCall}
            />
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};
