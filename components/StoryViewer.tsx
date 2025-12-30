import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Send, Eye, Mic, Trash2 } from 'lucide-react';
import { Story } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

interface StoryViewerProps {
    stories: Story[];
    initialIndex: number;
    onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(5000); // Default duration 5s
    const videoRef = useRef<HTMLVideoElement>(null);

    // Interaction State
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [liked, setLiked] = useState(false);

    const currentStory = stories[currentIndex];

    // Reset progress & state on story change
    useEffect(() => {
        setProgress(0);
        setDuration(5000);
        setReplyText('');
        setLiked(false);
        setSending(false);

        if (currentStory?.type === 'video') {
            setIsPaused(true);
        } else {
            setIsPaused(false);
        }

        // Check if liked (In a real app, fetch this)
        // checkLikeStatus();
    }, [currentIndex, currentStory]);

    useEffect(() => {
        // Record View
        const recordView = async () => {
            if (!user || !currentStory) return;
            // Don't record own view or if already viewed (optimization)
            if (currentStory.user_id === user.id) return;

            await supabase.from('story_views').insert({
                story_id: currentStory.id,
                user_id: user.id
            }).then(({ error }) => { if (error && error.code !== '23505') console.error(error); }); // Ignore duplicates
        };
        recordView();
    }, [currentStory, user]);

    // Timer Logic
    useEffect(() => {
        if (currentStory?.type === 'video' && videoRef.current) {
            if (isPaused) {
                videoRef.current.pause();
                return;
            } else {
                videoRef.current.play().catch(() => { });
            }
        }

        if (isPaused) return;

        const interval = 50;
        const step = 100 / (duration / interval);

        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    handleNext();
                    return 0;
                }
                return prev + step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [currentIndex, isPaused, duration, currentStory]);

    const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const vidDuration = e.currentTarget.duration * 1000;
        if (vidDuration && !isNaN(vidDuration)) {
            setDuration(vidDuration);
            setIsPaused(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleLike = async () => {
        if (!currentStory || !user) return;
        setLiked(true);
        try {
            const { error } = await supabase
                .from('story_interactions')
                .insert({
                    story_id: currentStory.id,
                    user_id: user.id,
                    reaction_type: 'like'
                });
            if (error && error.code !== '23505') throw error;
        } catch (e) {
            console.error(e);
            setLiked(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !user || !currentStory) return;
        setSending(true);
        setIsPaused(true);

        try {
            const { data: chatId, error: chatError } = await supabase
                .rpc('get_or_create_dm', { target_user_id: currentStory.user_id });

            if (chatError) throw chatError;

            const context = currentStory.type === 'image' || currentStory.type === 'video'
                ? 'Replied to your story'
                : `Replied to your story: "${currentStory.content?.substring(0, 20)}..."`;

            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    chat_id: chatId,
                    sender_id: user.id,
                    content: `${context}\n\n${replyText}`
                });

            if (msgError) throw msgError;

            setReplyText('');
            alert('Reply sent!');
            setIsPaused(false);

        } catch (e) {
            console.error(e);
            alert('Failed to send reply');
            setIsPaused(false);
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async () => {
        if (!currentStory || !user) return;
        if (!window.confirm("Are you sure you want to delete this story?")) return;
        setIsPaused(true);

        try {
            const { error } = await supabase.from('stories').delete().eq('id', currentStory.id);
            if (error) throw error;

            // Move to next or close
            if (stories.length > 1) {
                // Remove from local list if we could (but props are immutable, so just close/next)
                // In a perfect world we'd update parent state, but for now just force close or next
                handleNext();
                // A full refresh would be better, but we close for safety/simplicity to trigger re-fetch in parent
                onClose();
            } else {
                onClose();
            }
        } catch (error) {
            console.error("Error deleting story:", error);
            alert("Failed to delete story");
            setIsPaused(false);
        }
    };

    if (!currentStory) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[60] bg-black flex flex-col">
            {/* Progress Bar */}
            <div className="absolute top-2 left-0 right-0 p-2 z-60 flex gap-1 safe-top">
                {stories.map((_, idx) => (
                    <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-white transition-all duration-100 ease-linear ${idx < currentIndex ? 'w-full' : idx === currentIndex ? '' : 'w-0'
                                }`}
                            style={{ width: idx === currentIndex ? `${progress}%` : undefined }}
                        />
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-12 z-50 flex justify-between items-center text-white mt-0 pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <img
                        src={currentStory.user?.avatar_url || `https://ui-avatars.com/api/?name=${currentStory.user?.username}`}
                        className="w-10 h-10 rounded-full border border-white/20"
                        alt="User"
                    />
                    <div className="flex flex-col">
                        <span className="font-bold text-shadow leading-none">{currentStory.user?.username}</span>
                        <span className="text-white/70 text-xs">{new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* View Count (Owner Only) */}
                    {user?.id === currentStory.user_id && (
                        <div className="flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                            <Eye size={14} className="text-white" />
                            <span className="text-xs font-bold text-white">{currentStory.views_count || 0}</span>
                        </div>
                    )}
                    {user?.id === currentStory.user_id && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors backdrop-blur-md"
                        >
                            <Trash2 size={24} className="text-white hover:text-red-500" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors backdrop-blur-md"
                    >
                        <X size={28} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div
                className="flex-1 flex items-center justify-center relative bg-gray-900"
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
            >
                {/* Navigation Hit Areas */}
                <div className="absolute inset-y-0 left-0 w-1/3 z-20" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
                <div className="absolute inset-y-0 right-0 w-1/3 z-20" onClick={(e) => { e.stopPropagation(); handleNext(); }} />

                {currentStory.type === 'video' ? (
                    <video
                        ref={videoRef}
                        src={currentStory.media_url}
                        className="w-full h-full object-contain"
                        playsInline
                        onLoadedMetadata={handleVideoLoad}
                        onEnded={handleNext}
                    />
                ) : currentStory.type === 'image' ? (
                    <img src={currentStory.media_url} className="w-full h-full object-contain" alt="Story" />
                ) : currentStory.type === 'voice' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-red-500 to-pink-600 text-white">
                        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-pulse">
                            <Mic size={48} />
                        </div>
                        <audio controls src={currentStory.media_url} className="w-full max-w-sm mb-8" autoPlay />
                        <p className="text-xl font-bold">Voice Note</p>
                    </div>
                ) : currentStory.type === 'poll' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
                        <h2 className="text-3xl font-bold text-center mb-8">{currentStory.content}</h2>
                        <div className="w-full max-w-sm space-y-4">
                            {currentStory.poll_options?.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        // TODO: Implement voting logic securely
                                        alert("Voting functionality coming soon!");
                                    }}
                                    className="w-full p-4 bg-white/20 hover:bg-white/30 rounded-xl text-left font-bold transition-all border border-white/30 backdrop-blur-md"
                                >
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center p-8 text-center bg-gradient-to-br from-purple-600 to-blue-500">
                        <p className="text-2xl font-bold text-white">{currentStory.content}</p>
                    </div>
                )}
            </div>

            {/* Footer / Reply */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10 bg-gradient-to-t from-black/80 to-transparent pt-10">
                <div className="flex gap-4 items-center max-w-lg mx-auto w-full">
                    <input
                        type="text"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onFocus={() => setIsPaused(true)}
                        onBlur={() => setIsPaused(false)}
                        placeholder="Send a message..."
                        className="flex-1 bg-transparent border border-white/50 rounded-full px-4 py-3 text-white placeholder-white/70 outline-none focus:border-white transition-colors backdrop-blur-sm"
                        onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                    />
                    <button
                        onClick={handleLike}
                        className={`text-white hover:scale-110 transition-transform ${liked ? 'text-red-500 fill-red-500' : ''}`}
                    >
                        <Heart size={28} fill={liked ? "currentColor" : "none"} />
                    </button>
                    {replyText && (
                        <button
                            onClick={handleSendReply}
                            disabled={sending}
                            className="text-[#ff1744] hover:scale-110 transition-transform"
                        >
                            <Send size={28} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoryViewer;
