import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { db, ChatMessageDB } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import MessageBubble, { ChatMessage } from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import ForwardModal from '../../components/chat/ForwardModal';
import CallOverlay from '../../components/chat/CallOverlay';
import { useWebRTC } from '../../hooks/useWebRTC';
import ErrorBoundary from '../../components/ErrorBoundary';
import { cn } from '../../lib/utils';
import {
    ArrowLeft, Phone, Video, MoreVertical, Loader2, Clock, Trash2, Pin
} from 'lucide-react';

interface Message extends ChatMessage {
    // Extended properties if needed, currently matching ChatMessage
}

const safeDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "Now";
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return "Now"; }
};

const ChatRoom = () => {
    const { id } = useParams<{ id: string }>();
    const chatId = id;
    const { user } = useAuth();
    const navigate = useNavigate();

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatProfile, setChatProfile] = useState<{ full_name: string; avatar_url: string; username: string } | null>(null);
    const [replyTo, setReplyTo] = useState<any>(null); // Message to reply to
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' | 'text', content?: string } | null>(null);
    const [isBuzzing, setIsBuzzing] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [participantStatus, setParticipantStatus] = useState('accepted'); // accepted, blocked, pending

    // Call Hook
    const {
        callState, callerInfo, isMuted, isVideoEnabled, isVideoCall,
        localStream, remoteStream, startCall, answerCall, endCall,
        toggleMute, toggleVideo
    } = useWebRTC(user);

    const listRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Derived State
    const pinnedMessages = messages.filter(m => m.isPinned);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    const handleScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollBottom(!isNearBottom);
        }
    };

    // Fetch Messages (Offline + Online)
    const fetchMessages = async () => {
        if (!chatId || !user) {
            // Do not set loading false here. Wait for user/chatId to be ready.
            // The effect will re-run when they change.
            return;
        }

        // Fetch Chat Profile Info
        try {
            // Get the OTHER participant in this chat
            const { data: participantData } = await supabase
                .from('chat_participants')
                .select(`
                    profiles:user_id (
                        full_name,
                        avatar_url,
                        username
                    )
                `)
                .eq('chat_id', chatId)
                .neq('user_id', user.id)
                .single();

            if (participantData && participantData.profiles) {
                // Supabase returns array or object depending on join, usually object if 1:1 relation or explicitly handled
                // But here profiles is joined on user_id.
                // Let's cast it or handle it safely.
                const profile = Array.isArray(participantData.profiles) ? participantData.profiles[0] : participantData.profiles;
                setChatProfile(profile as any);
            }
        } catch (e) {
            console.error("Error fetching chat profile", e);
        }

        // 1. Load from Cache
        try {
            const cached = await db.messages
                .where('[chat_id+created_at]')
                .between([chatId, ''], [chatId, '\uffff'])
                .sortBy('created_at');

            if (cached.length > 0) {
                const formattedCached: Message[] = cached.map(m => ({
                    id: m.id,
                    text: m.content || '',
                    sender: m.sender_id === user.id ? 'me' : 'them',
                    time: safeDate(m.created_at),
                    type: (m.type as any) || 'text',
                    status: (m.status as any) || 'read',
                    mediaUrl: m.media_url,
                    metadata: m.metadata,
                    isDeleted: m.is_deleted,
                    isPinned: m.is_pinned // Cache supports pin
                }));
                setMessages(formattedCached);
                setLoading(false);
            }
        } catch (e) {
            console.error("Cache load error", e);
        }

        // 2. Fetch from Network
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                message_reactions(reaction, user_id)
            `)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching messages", error);
            setLoading(false);
        } else if (data) {
            const formatted: Message[] = data.map((m: any) => {
                const reactions: { [key: string]: number } = {};
                m.message_reactions?.forEach((r: any) => {
                    reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
                });

                return {
                    id: m.id,
                    text: m.content,
                    sender: m.sender_id === user.id ? 'me' : 'them',
                    time: safeDate(m.created_at),
                    type: m.type || 'text',
                    status: 'read', // Simplified
                    mediaUrl: m.media_url,
                    metadata: m.metadata,
                    reactions: reactions,
                    isDeleted: m.is_deleted,
                    expiresAt: m.expires_at,
                    viewOnce: m.view_once,
                    isViewed: m.is_viewed,
                    isPinned: m.is_pinned
                };
            });
            setMessages(formatted);
            setLoading(false);

            // 3. Update Cache
            try {
                const dbMessages: ChatMessageDB[] = data.map((m: any) => ({
                    id: m.id,
                    chat_id: chatId,
                    content: m.content,
                    sender_id: m.sender_id,
                    created_at: m.created_at,
                    type: m.type,
                    media_url: m.media_url,
                    metadata: m.metadata,
                    is_deleted: m.is_deleted,
                    is_pinned: m.is_pinned,
                    status: 'read'
                }));
                await db.messages.bulkPut(dbMessages);
            } catch (e) {
                console.error("Error updating cache", e);
            }
        } else {
            setLoading(false);
        }
    };

    // Mark messages as read
    const markMessagesAsRead = async () => {
        if (!chatId || !user) return;
        try {
            // 1. Update individual message status (for read receipts on bubbles)
            await supabase
                .from('messages')
                .update({ status: 'read', is_viewed: true })
                .eq('chat_id', chatId)
                .neq('sender_id', user.id)
                .neq('status', 'read');

            // 2. Update last_read_at timestamp (CRITICAL for Chat List unread counts)
            await supabase
                .from('chat_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('chat_id', chatId)
                .eq('user_id', user.id);

        } catch (e) {
            console.error("Error marking messages as read", e);
        }
    };

    // Safety Timeout
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) setLoading(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, [loading]);

    // Realtime & Effects
    useEffect(() => {
        fetchMessages().then(() => markMessagesAsRead()); // Mark read after initial fetch

        if (!chatId) return;

        const handleNewMessage = (newMsgRaw: any) => {
            // Check for Buzz
            if (newMsgRaw.type === 'buzz') {
                setIsBuzzing(true);
                if (navigator.vibrate) navigator.vibrate([100, 30, 100, 30, 100]);
                setTimeout(() => setIsBuzzing(false), 1000);
            }

            // Mark incoming message as read since we are in the room
            if (newMsgRaw.sender_id !== user?.id) {
                markMessagesAsRead();
            }

            // Construct Message
            const newMsg: Message = {
                id: newMsgRaw.id,
                text: newMsgRaw.content,
                sender: newMsgRaw.sender_id === user?.id ? 'me' : 'them',
                time: safeDate(newMsgRaw.created_at),
                type: newMsgRaw.type || 'text',
                status: 'read',
                mediaUrl: newMsgRaw.media_url,
                metadata: newMsgRaw.metadata,
                isPinned: newMsgRaw.is_pinned
            };

            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();

            // Cache
            db.messages.put({
                id: newMsg.id,
                chat_id: chatId,
                content: newMsgRaw.content,
                sender_id: newMsgRaw.sender_id,
                created_at: newMsgRaw.created_at,
                type: newMsgRaw.type,
                media_url: newMsgRaw.media_url,
                metadata: newMsgRaw.metadata,
                is_pinned: newMsgRaw.is_pinned,
                status: 'read'
            }).catch(console.error);
        };

        const handleMessageUpdate = (updatedMsg: any) => {
            setMessages(prev => prev.map(m => {
                if (m.id === updatedMsg.id) {
                    return {
                        ...m,
                        text: updatedMsg.content,
                        isPinned: updatedMsg.is_pinned,
                        isDeleted: updatedMsg.is_deleted,
                        type: updatedMsg.type,
                        // handle other fields like isEdited if supported
                    };
                }
                return m;
            }));

            // Sync Cache
            db.messages.update(updatedMsg.id, {
                content: updatedMsg.content,
                is_pinned: updatedMsg.is_pinned,
                is_deleted: updatedMsg.is_deleted
            }).catch(console.error);
        };

        const channel = supabase
            .channel(`chat:${chatId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                (payload) => handleNewMessage(payload.new)
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                (payload) => handleMessageUpdate(payload.new)
            )
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.userId !== user?.id) {
                    setTypingUsers(prev => new Set(prev).add(payload.payload.username || "Someone"));
                    setTimeout(() => {
                        setTypingUsers(prev => {
                            const next = new Set(prev);
                            next.delete(payload.payload.username || "Someone");
                            return next;
                        });
                    }, 3000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, user?.id]);

    useEffect(() => {
        // Auto-scroll on initial load or new messages if near bottom
        scrollToBottom();
    }, [messages.length, loading]);


    // Handlers
    const handleSend = async (content: string, type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'buzz' | 'location' | 'audio', file?: File, duration?: number, metadata?: any) => {
        if (!user || !chatId) return;

        try {
            let mediaUrl = '';
            if (file) {
                const ext = file.name.split('.').pop();
                const fileName = `chat_${chatId}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('chat-attachments')
                    .upload(fileName, file);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
                mediaUrl = data.publicUrl;
            }

            const finalMetadata = { ...metadata, duration };
            if (replyTo) finalMetadata.replyToId = replyTo.id;

            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content,
                type: type,
                media_url: mediaUrl,
                metadata: finalMetadata
            });

            if (error) throw error;
            setReplyTo(null);

        } catch (e) {
            console.error("Send failed", e);
            alert("Failed to send message");
        }
    };

    const handlePinMessage = async (msg: Message) => {
        const newPinnedStatus = !msg.isPinned;

        // Optimistic
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: newPinnedStatus } : m));

        try {
            const { error } = await supabase
                .from('messages')
                .update({ is_pinned: newPinnedStatus })
                .eq('id', msg.id);

            if (error) throw error;
            db.messages.update(msg.id, { is_pinned: newPinnedStatus }).catch(console.error);
        } catch (e) {
            console.error("Pinning failed", e);
            // Revert
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: !newPinnedStatus } : m));
        }
    };

    const handleReaction = async (msgId: string, reaction: string) => {
        // Optimistic UI updates for reactions are complex without a normalized store, skipping for now
        // Directly call RPC
        try {
            // Assuming toggle_reaction RPC exists as per previous context
            // Or regular insert/delete to message_reactions table
            // RPC is safer
            const { error } = await supabase.rpc('toggle_reaction', {
                p_message_id: msgId,
                p_user_id: user?.id,
                p_reaction: reaction
            });
            // Realtime subscription should handle reaction updates if we listen to message_reactions? 
            // Currently we only listen to messages updates. 
            // For now, simpler implementation:
            if (!error) {
                // Manual refetch or update state?
                // Let's just update local state slightly?
                setMessages(prev => prev.map(m => {
                    if (m.id === msgId) {
                        const current = m.reactions?.[reaction] || 0;
                        return {
                            ...m,
                            reactions: {
                                ...m.reactions,
                                [reaction]: current + 1 // Simply add 1 for optimistic feeling (inaccurate for toggle)
                            }
                        };
                    }
                    return m;
                }));
            }
        } catch (e) {
            console.error("Reaction failed", e);
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        try {
            await supabase.from('messages').update({ is_deleted: true }).eq('id', msgId);
        } catch (e) { console.error("Delete failed", e); }
    };

    const handleEditMessage = async (msgId: string, newText: string) => {
        try {
            await supabase.from('messages').update({ content: newText, is_edited: true }).eq('id', msgId);
        } catch (e) { console.error("Edit failed", e); }
    };

    const handleTyping = () => {
        // Throttle
        if (!typingTimeoutRef.current && chatId && user) {
            supabase.channel(`chat:${chatId}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, username: user.user_metadata?.full_name }
            });
            typingTimeoutRef.current = setTimeout(() => {
                typingTimeoutRef.current = null;
            }, 2000);
        }
    };

    const handleForwardToChats = async (selectedChatIds: string[]) => {
        if (!forwardingMessage || !user) return;
        try {
            const inserts = selectedChatIds.map(cid => ({
                chat_id: cid,
                sender_id: user.id,
                content: forwardingMessage.text,
                type: forwardingMessage.type,
                media_url: forwardingMessage.mediaUrl,
                metadata: forwardingMessage.metadata
            }));

            await supabase.from('messages').insert(inserts);
            setForwardingMessage(null);
            alert("Message forwarded!");
        } catch (e) {
            console.error("Forward failed", e);
        }
    };

    const handleViewOnce = async (msg: ChatMessage) => {
        setPreviewMedia({
            url: msg.mediaUrl || '',
            type: msg.type === 'text' ? 'text' : msg.type as 'image' | 'video',
            content: msg.text
        });

        // Mark as viewed in DB
        try {
            await supabase.from('messages').update({ is_viewed: true }).eq('id', msg.id);
        } catch (e) { console.error(e); }
    };

    return (
        <ErrorBoundary>
            <div className={cn("flex flex-col h-[100dvh] w-full max-w-full bg-[#f0f2f5] dark:bg-black transition-transform fixed inset-0 overflow-hidden", isBuzzing && "animate-[spin_0.5s_ease-in-out]")}>

                <CallOverlay
                    isOpen={callState !== 'idle'}
                    state={callState}
                    callerName={callerInfo?.name || 'Unknown'}
                    callerAvatar={callerInfo?.avatar}
                    isAudioEnabled={!isMuted}
                    isVideoEnabled={isVideoEnabled}
                    isVideoCall={isVideoCall || false}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    onToggleAudio={toggleMute}
                    onToggleVideo={toggleVideo}
                    onAccept={answerCall}
                    onReject={endCall}
                    onHangup={endCall}
                />

                <div className={cn("flex flex-col h-full bg-inherit", isBuzzing && "animate-[shake_0.5s_ease-in-out_infinite]")}>
                    {/* Header */}
                    <header className="px-2 py-3 bg-white dark:bg-gray-900 flex items-center justify-between shadow-sm z-50 border-b border-gray-100 dark:border-gray-800 absolute top-0 w-full">
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                            </button>
                            {/* Avatar and Name */}
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/profile/${chatId}`)}>
                                <div className="relative">
                                    <img
                                        src={chatProfile?.avatar_url || `https://ui-avatars.com/api/?name=${chatProfile?.full_name || 'User'}&background=random`}
                                        className="w-10 h-10 rounded-full object-cover bg-gray-200"
                                        alt={chatProfile?.full_name || 'User'}
                                    />
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-sm text-gray-900 dark:text-white">
                                        {chatProfile?.full_name || "Loading..."}
                                    </h2>
                                    <span className="text-xs text-green-500">Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => startCall(chatId || '', 'User', '', false)}><Phone size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <button onClick={() => startCall(chatId || '', 'User', '', true)}><Video size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <button><MoreVertical size={20} className="text-gray-600 dark:text-gray-300" /></button>
                        </div>
                    </header>

                    {/* Pinned Messages Header (Sticky below main header) */}
                    {pinnedMessages.length > 0 && (
                        <div className="absolute top-[65px] left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between animate-in slide-in-from-top-2 shadow-sm cursor-pointer"
                            onClick={() => {
                                const el = document.getElementById(`msg-\${pinnedMessages[pinnedMessages.length - 1].id}`);
                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Pin size={14} className="text-[#ff1744] fill-[#ff1744] shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#ff1744]">Pinned Message</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                                        {pinnedMessages[pinnedMessages.length - 1].text || "Media"}
                                    </span>
                                </div>
                            </div>
                            {pinnedMessages.length > 1 && (
                                <div className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                    +{pinnedMessages.length - 1}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Messages Area */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        className={cn("flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 pt-20 bg-[#e5ddd5] dark:bg-black relative", pinnedMessages.length > 0 && "pt-32")}
                    >
                        {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>}

                        {messages.map((msg) => (
                            <div id={`msg-\${msg.id}`} key={msg.id}>
                                <MessageBubble
                                    message={msg}
                                    onReact={handleReaction}
                                    onSwipeReply={setReplyTo}
                                    onEdit={handleEditMessage}
                                    onDelete={handleDeleteMessage}
                                    onForward={setForwardingMessage}
                                    onPin={handlePinMessage}
                                    onMediaClick={(url, type) => setPreviewMedia({ url, type: type as 'image' | 'video' })}
                                    onViewOnce={handleViewOnce}
                                />
                            </div>
                        ))}

                        {typingUsers.size > 0 && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 ml-4 mb-2 animate-pulse">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-0" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200" />
                                </div>
                                <span>{Array.from(typingUsers).join(', ')} is typing...</span>
                            </div>
                        )}

                        <div className="h-4" /> {/* Spacer */}
                    </div>

                    {showScrollBottom && (
                        <button
                            onClick={scrollToBottom}
                            className="fixed bottom-32 right-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 p-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-[100] animate-in fade-in zoom-in duration-200 hover:scale-110 transition-transform"
                        >
                            <Clock size={24} className="rotate-180" /> {/* Chevron replacement */}
                        </button>
                    )}

                    {/* Input Area */}
                    {!loading && participantStatus === 'accepted' ? (
                        <ChatInput
                            onSend={handleSend}
                            onTyping={handleTyping}
                            replyTo={replyTo}
                            onCancelReply={() => setReplyTo(null)}
                        />
                    ) : !loading && (
                        <div className="p-6 bg-white border-t border-gray-200 text-center safe-bottom">
                            <p className="text-gray-500">
                                {participantStatus === 'blocked' ? "You have blocked this user." : "Request pending."}
                            </p>
                        </div>
                    )}
                </div>

                <ForwardModal
                    isOpen={!!forwardingMessage}
                    onClose={() => setForwardingMessage(null)}
                    onSend={handleForwardToChats}
                />

                {/* Media Preview Modal */}
                {
                    previewMedia && (
                        <div
                            className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-in fade-in duration-200"
                            onClick={() => setPreviewMedia(null)}
                        >
                            <button className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50 hover:bg-black/70">
                                <ArrowLeft size={24} />
                            </button>
                            {previewMedia.type === 'video' ? (
                                <video
                                    src={previewMedia.url}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-screen"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : previewMedia.type === 'text' ? (
                                <div
                                    className="bg-white dark:bg-gray-900 p-8 rounded-2xl max-w-lg w-full m-4 text-center shadow-2xl relative"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="mb-4 text-gray-500 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2">
                                        <Clock size={16} /> View Once Message
                                    </div>
                                    <p className="text-xl md:text-2xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                                        {previewMedia.content}
                                    </p>
                                </div>
                            ) : (
                                <img
                                    src={previewMedia.url}
                                    className="max-w-full max-h-screen object-contain"
                                    alt="Preview"
                                />
                            )}
                        </div>
                    )
                }
            </div >
        </ErrorBoundary >
    );
};

export default ChatRoom;
