import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { VoiceParticipant } from '../../types';
import { Mic, MicOff, Users, Headphones } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface VoiceLoungeProps {
    spaceId: string;
}

const VoiceLounge: React.FC<VoiceLoungeProps> = ({ spaceId }) => {
    const { user } = useAuth();
    const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
    const [inSession, setInSession] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    // Mock Audio visuals
    const [volumeLevels, setVolumeLevels] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchParticipants();

        const channel = supabase
            .channel(`voice:${spaceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_voice_sessions', filter: `space_id=eq.${spaceId}` }, () => {
                fetchParticipants();
            })
            .subscribe();

        // Simulate speaking volume
        const interval = setInterval(() => {
            setVolumeLevels(prev => {
                const next = { ...prev };
                participants.forEach(p => {
                    if (!p.is_muted) {
                        next[p.user_id] = Math.random() * 100;
                    } else {
                        next[p.user_id] = 0;
                    }
                });
                return next;
            });
        }, 300);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [spaceId, participants.length]);

    const fetchParticipants = async () => {
        const { data } = await supabase
            .from('space_voice_sessions')
            .select(`*, profile:user_id(full_name, avatar_url)`)
            .eq('space_id', spaceId);

        if (data) {
            setParticipants(data);
            const amIIn = data.some((p: any) => p.user_id === user?.id);
            setInSession(amIIn);
        }
    };

    const handleJoin = async () => {
        if (!user) return;
        await supabase.from('space_voice_sessions').insert({
            space_id: spaceId,
            user_id: user.id,
            is_muted: true
        });
        setInSession(true);
        setIsMuted(true);
    };

    const handleLeave = async () => {
        if (!user) return;
        await supabase.from('space_voice_sessions').delete().match({ space_id: spaceId, user_id: user.id });
        setInSession(false);
    };

    const toggleMute = async () => {
        if (!user) return;
        const newMute = !isMuted;
        setIsMuted(newMute);
        await supabase.from('space_voice_sessions').update({ is_muted: newMute }).match({ space_id: spaceId, user_id: user.id });
    };

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-4 text-white shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-20">
                <Headphones size={64} />
            </div>

            <div className="flex justify-between items-center mb-4 relative z-10">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Voice Lounge
                    </h3>
                    <p className="text-xs text-white/60">{participants.length} active (mic required)</p>
                </div>

                {inSession ? (
                    <div className="flex gap-2">
                        <button
                            onClick={toggleMute}
                            className={cn("p-3 rounded-full transition-colors", isMuted ? "bg-red-500/20 hover:bg-red-500/40" : "bg-white/20 hover:bg-white/30")}
                        >
                            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <button
                            onClick={handleLeave}
                            className="bg-red-500 px-4 py-2 rounded-full font-bold text-sm hover:bg-red-600 transition-colors"
                        >
                            Leave
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleJoin}
                        className="bg-white text-indigo-900 px-5 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg"
                    >
                        Join Voice
                    </button>
                )}
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4">
                {participants.map(p => (
                    <div key={p.user_id} className="flex flex-col items-center gap-2">
                        <div className={cn(
                            "w-14 h-14 rounded-full border-2 p-0.5 relative transition-all duration-300",
                            !p.is_muted && (volumeLevels[p.user_id] > 20) ? "border-green-400 ring-4 ring-green-400/20 scale-110" : "border-white/20"
                        )}>
                            <img src={p.profile?.avatar_url || `https://ui-avatars.com/api/?name=${p.profile?.full_name}`} className="w-full h-full rounded-full object-cover" />
                            {p.is_muted && (
                                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border border-indigo-900">
                                    <MicOff size={10} />
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-medium truncate max-w-full text-white/80">
                            {p.profile?.full_name?.split(' ')[0]}
                        </span>
                    </div>
                ))}
                {participants.length === 0 && (
                    <div className="col-span-4 text-center py-6 text-white/30 text-sm">
                        Room is empty. Be the first to join!
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceLounge;
