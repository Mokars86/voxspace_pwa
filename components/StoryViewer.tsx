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
    const audioRef = useRef<HTMLAudioElement>(null);

    // Interaction State
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [liked, setLiked] = useState(false);

    // Viewers Modal State
    const [showViewersModal, setShowViewersModal] = useState(false);
    const [viewersList, setViewersList] = useState<any[]>([]);
    const [storyLikesCount, setStoryLikesCount] = useState(0);
    const [loadingViewers, setLoadingViewers] = useState(false);

    const fetchViewersAndLikes = async () => {
        if (!currentStory) return;
        setLoadingViewers(true);
        try {
            // 1. Fetch Viewers from story_views joined with profiles
            const { data: viewsData, error: viewsError } = await supabase
                .from('story_views')
                .select(`
                    user_id,
                    created_at,
                    profiles:user_id (
                        full_name, avatar_url, username
                    )
                `)
                .eq('story_id', currentStory.id)
                .order('created_at', { ascending: false });

            if (viewsError) throw viewsError;
            setViewersList(viewsData || []);

            // 2. Fetch Likes Count from story_interactions
            const { count, error: likesError } = await supabase
                .from('story_interactions')
                .select('id', { count: 'exact', head: true })
                .eq('story_id', currentStory.id)
                .eq('reaction_type', 'like');

            if (likesError) throw likesError;
            setStoryLikesCount(count || 0);

        } catch (e) {
            console.error("Error fetching story details:", e);
        } finally {
            setLoadingViewers(false);
        }
    };

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

    // Timer Logic & Media Control
    useEffect(() => {
        // Video Control
        if (currentStory?.type === 'video' && videoRef.current) {
            if (isPaused) {
                videoRef.current.pause();
                return;
            } else {
                videoRef.current.play().catch(() => { });
            }
        }

        // Voice/Audio Control
        if (currentStory?.type === 'voice' && audioRef.current) {
            if (isPaused) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.error("Audio Play Error:", e));
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
            <div className="absolute top-0 left-0 right-0 p-2 z-[61] flex gap-1 safe-top mt-2">
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
            <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(3rem+env(safe-area-inset-top))] z-50 flex justify-between items-center text-white mt-0 pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <img
                        src={currentStory.user?.avatar_url || `https://ui-avatars.com/api/?name=${currentStory.user?.username}`}
                        className="w-10 h-10 rounded-full border border-white/20"
                        alt="User"
                    />
                    <div className="flex flex-col">
                        <span className="font-bold text-shadow leading-none truncate max-w-[120px] sm:max-w-xs">{currentStory.user?.username}</span>
                        <div className="flex gap-2 text-xs text-white/70">
                            <span>{new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>Expires in {Math.max(0, Math.ceil((new Date((currentStory as any).expires_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* View Count (Owner Only) */}
                    {user?.id === currentStory.user_id && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPaused(true);
                                setShowViewersModal(true);
                                fetchViewersAndLikes();
                            }}
                            className="flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md cursor-pointer hover:bg-black/60 transition-colors"
                        >
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
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-red-500 to-pink-600 text-white z-30 relative">
                        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-pulse pointer-events-none">
                            <Mic size={48} />
                        </div>
                        {/* Audio Player with Ref and higher z-index for interaction */}
                        <audio
                            ref={audioRef}
                            controls
                            src={currentStory.media_url}
                            className="w-full max-w-sm mb-8 relative z-50"
                            autoPlay
                            onLoadedMetadata={(e) => {
                                const audioDuration = e.currentTarget.duration * 1000;
                                if (audioDuration && !isNaN(audioDuration)) {
                                    setDuration(audioDuration);
                                    setIsPaused(false);
                                }
                            }}
                            onEnded={handleNext}
                        />
                        <p className="text-xl font-bold pointer-events-none">Voice Note</p>
                    </div>
                ) : currentStory.type === 'poll' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
                        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{currentStory.content}</h2>
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
                    <div className={`w-full h-full flex items-center justify-center p-8 text-center bg-gradient-to-br ${currentStory.metadata?.backgroundColor || 'from-purple-600 to-blue-500'}`}>
                        <p className="text-xl md:text-2xl font-bold text-white">{currentStory.content}</p>
                    </div>
                )}
            </div>

            {/* Footer / Reply */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-40 bg-gradient-to-t from-black/80 to-transparent pt-10 safe-bottom">
                {/* Caption Display */}
                {currentStory.content && (currentStory.type === 'image' || currentStory.type === 'video' || currentStory.type === 'voice') && (
                    <div className="absolute bottom-24 left-0 right-0 p-4 text-center z-40 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                        <p className="text-white text-lg font-medium drop-shadow-md">{currentStory.content}</p>
                    </div>
                )}

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

            {/* Viewers Modal */}
            {showViewersModal && (
                <div
                    className="absolute inset-x-0 bottom-0 top-20 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom rounded-t-3xl border-t border-white/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 rounded-t-3xl">
                        <h3 className="text-white font-bold text-lg">Story Insights</h3>
                        <button
                            onClick={() => {
                                setShowViewersModal(false);
                                setIsPaused(false);
                            }}
                            className="p-2 hover:bg-white/10 rounded-full text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 content-start">
                        {/* Stats Summary */}
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 bg-white/5 rounded-2xl p-4 flex flex-col items-center border border-white/10 shadow-lg">
                                <Eye className="text-blue-400 mb-2" size={28} />
                                <span className="text-3xl font-bold text-white">{viewersList.length}</span>
                                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold mt-1">Views</span>
                            </div>
                            <div className="flex-1 bg-white/5 rounded-2xl p-4 flex flex-col items-center border border-white/10 shadow-lg">
                                <Heart className="text-red-500 mb-2" fill="#ef4444" size={28} />
                                <span className="text-3xl font-bold text-white">{storyLikesCount}</span>
                                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold mt-1">Likes</span>
                            </div>
                        </div>

                        <h4 className="text-white/60 text-xs font-bold mb-4 uppercase tracking-wider px-2">Recent Viewers</h4>

                        {loadingViewers ? (
                            <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full"></div></div>
                        ) : viewersList.length === 0 ? (
                            <div className="text-white/30 text-center py-10 flex flex-col items-center">
                                <Eye size={32} className="mb-2 opacity-50" />
                                <p>No views yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {viewersList.map((viewer: any) => (
                                    <div key={viewer.user_id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
                                        <img
                                            src={viewer.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${viewer.profiles?.full_name || 'User'}`}
                                            className="w-12 h-12 rounded-full border-2 border-white/10 object-cover"
                                            alt={viewer.profiles?.username}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{viewer.profiles?.full_name || 'Unknown User'}</p>
                                            <p className="text-white/50 text-xs truncate">@{viewer.profiles?.username}</p>
                                        </div>
                                        <span className="text-white/30 text-xs whitespace-nowrap font-medium px-2 py-1 bg-white/5 rounded-lg">
                                            {new Date(viewer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryViewer;
