import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { db, ChatMessageDB } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import MessageBubble, { ChatMessage } from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import ForwardModal from '../../components/chat/ForwardModal';
import CallOverlay from '../../components/chat/CallOverlay';
import { useWebRTC } from '../../hooks/useWebRTC';
import ErrorBoundary from '../../components/ErrorBoundary';
import { cn } from '../../lib/utils';
import {
    ArrowLeft, Phone, Video, MoreVertical, Loader2, Clock, Trash2, Pin, ChevronDown, User, Image as ImageIcon, Ban, ShieldAlert
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
    const { chatWallpaper } = useTheme();

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
    const [participantStatus, setParticipantStatus] = useState<'accepted' | 'blocked' | 'blocked_by' | 'pending'>('accepted');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [chatTimer, setChatTimer] = useState<number>(0);
    const [showTimerModal, setShowTimerModal] = useState(false);
    const [privacySettings, setPrivacySettings] = useState<{
        last_seen_privacy: string;
        online_status_privacy: string;
        profile_photo_privacy: string;
        about_privacy: string;
    } | null>(null);

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
                        id,
                        full_name,
                        avatar_url,
                        username,
                        last_seen_privacy,
                        online_status_privacy,
                        profile_photo_privacy,
                        about_privacy
                    )
                `)
                .eq('chat_id', chatId)
                .neq('user_id', user.id)
                .single();

            if (participantData && participantData.profiles) {
                const profile: any = Array.isArray(participantData.profiles) ? participantData.profiles[0] : participantData.profiles;
                setChatProfile(profile);
                setPrivacySettings({
                    last_seen_privacy: profile.last_seen_privacy || 'everyone',
                    online_status_privacy: profile.online_status_privacy || 'everyone',
                    profile_photo_privacy: profile.profile_photo_privacy || 'everyone',
                    about_privacy: profile.about_privacy || 'everyone',
                });

                // Check Block Status
                const { data: blockData, error: blockError } = await supabase
                    .from('blocked_users')
                    .select('*')
                    .or(`blocker_id.eq.${user.id},blocker_id.eq.${profile.id}`)
                    .or(`blocked_id.eq.${user.id},blocked_id.eq.${profile.id}`);

                if (blockData && blockData.length > 0) {
                    const iBlockedThem = blockData.some(b => b.blocker_id === user.id);
                    const theyBlockedMe = blockData.some(b => b.blocker_id === profile.id);

                    if (iBlockedThem) setParticipantStatus('blocked');
                    else if (theyBlockedMe) setParticipantStatus('blocked_by');
                } else {
                    setParticipantStatus('accepted');
                }
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
            // Check for Buzz
            if (newMsgRaw.type === 'buzz') {
                setIsBuzzing(true);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // Stronger pattern
                setTimeout(() => setIsBuzzing(false), 500); // Match animation duration
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
        if (participantStatus === 'blocked' || participantStatus === 'blocked_by') {
            alert("Cannot send message. User is blocked or has blocked you.");
            return;
        }

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
            if (replyTo) {
                finalMetadata.replyTo = {
                    id: replyTo.id,
                    text: replyTo.text,
                    sender: replyTo.sender
                };
            }

            const expiresAt = chatTimer > 0 ? new Date(Date.now() + chatTimer * 1000).toISOString() : null;

            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content,
                type: type,
                media_url: mediaUrl,
                metadata: finalMetadata,
                expires_at: expiresAt
            });

            if (error) throw error;
            setReplyTo(null);

        } catch (e) {
            console.error("Send failed", e);
            alert("Failed to send message");
        }
    };

    const handleSwipeReply = (message: Message) => {
        setReplyTo({
            id: message.id,
            text: message.text || (message.type === 'voice' ? 'Voice Message' : message.type === 'image' ? 'Image' : 'Media'),
            sender: message.sender === 'me' ? 'me' : (chatProfile?.full_name || 'them')
        });
        // Wait for UI update then focus input? ChatInput handles focus if replyTo changes? Not explicitly.
        // But the input is always there.
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

    const handleBlockUser = async () => {
        if (!chatProfile || !user) return;
        const isBlocked = participantStatus === 'blocked';
        const action = isBlocked ? "Unblock" : "Block";

        if (!confirm(`Are you sure you want to ${action.toLowerCase()} this user?`)) return;

        try {
            if (isBlocked) {
                // Unblock
                await supabase
                    .from('blocked_users')
                    .delete()
                    .eq('blocker_id', user.id)
                    .eq('blocked_id', (chatProfile as any).id); // profile object needs id
                setParticipantStatus('accepted');
                alert("User unblocked");
            } else {
                // Block
                await supabase
                    .from('blocked_users')
                    .insert({ blocker_id: user.id, blocked_id: (chatProfile as any).id });
                setParticipantStatus('blocked');
                alert("User blocked");
            }
            setIsMenuOpen(false);
        } catch (e) {
            console.error("Block action failed", e);
            alert("Failed to update block status");
        }
    };

    const handleClearChat = async () => {
        if (!confirm("Are you sure you want to clear this chat? This cannot be undone.")) return;
        try {
            // Soft delete or hard delete depending on policy. Hard delete for now as per user request context.
            // Or updating is_deleted for all messages matchin chat_id
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('chat_id', chatId);

            if (error) throw error;
            setMessages([]);
            db.messages.where({ chat_id: chatId }).delete();
            setIsMenuOpen(false);
            alert("Chat cleared.");
        } catch (e) {
            console.error("Failed to clear chat", e);
            alert("Failed to clear chat");
        }
    };

    return (
        <ErrorBoundary>
            <div className={cn("flex flex-col h-[100dvh] w-full max-w-full bg-[#f0f2f5] dark:bg-black transition-transform fixed inset-0 overflow-hidden", isBuzzing && "animate-shake")}>
                {/* Menu Backdrop */}
                {isMenuOpen && (
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMenuOpen(false)} />
                )}

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

                <div className={cn("flex flex-col h-full bg-inherit", isBuzzing && "animate-shake")}>
                    {/* Header */}
                    <header className="px-2 py-3 bg-white dark:bg-gray-900 flex items-center justify-between shadow-sm z-50 border-b border-gray-100 dark:border-gray-800 absolute top-0 w-full">
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                            </button>
                            {/* Avatar and Name */}
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => chatProfile?.id && navigate(`/user/${chatProfile.id}`)}>
                                <div className="relative">
                                    <img
                                        src={
                                            (privacySettings?.profile_photo_privacy === 'nobody' || (privacySettings?.profile_photo_privacy === 'contacts' && false)) // TODO: Check contacts
                                                ? `https://ui-avatars.com/api/?name=${chatProfile?.full_name?.charAt(0) || 'U'}&background=random`
                                                : (chatProfile?.avatar_url || `https://ui-avatars.com/api/?name=${chatProfile?.full_name || 'User'}&background=random`)
                                        }
                                        className="w-10 h-10 rounded-full object-cover bg-gray-200"
                                        alt={chatProfile?.full_name || 'User'}
                                    />
                                    {privacySettings?.online_status_privacy !== 'nobody' && (
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                                    )}
                                </div>
                                <div>
                                    <h2 className="font-bold text-sm text-gray-900 dark:text-white">
                                        {chatProfile?.full_name || "Loading..."}
                                    </h2>
                                    {typingUsers.size > 0 ? (
                                        <span className="text-xs font-bold text-[#ff1744] animate-pulse">
                                            Typing...
                                        </span>
                                    ) : (
                                        privacySettings?.online_status_privacy !== 'nobody' && (
                                            <span className="text-xs text-green-500">Online</span>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => startCall(chatId || '', 'User', '', false)}><Phone size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <button onClick={() => startCall(chatId || '', 'User', '', true)}><Video size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <div className="relative">
                                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                    <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => { navigate(`/user/${chatId}`); setIsMenuOpen(false); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                        >
                                            <User size={16} /> View Contact
                                        </button>
                                        <button
                                            onClick={() => { navigate('/settings/appearance'); setIsMenuOpen(false); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                        >
                                            <ImageIcon size={16} /> Wallpaper
                                        </button>
                                        <button
                                            onClick={handleClearChat}
                                            className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-sm text-red-600"
                                        >
                                            <Trash2 size={16} /> Clear Chat
                                        </button>
                                        <button
                                            onClick={() => { setShowTimerModal(true); setIsMenuOpen(false); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                        >
                                            <Clock size={16} /> Disappearing Messages
                                        </button>
                                        <button
                                            onClick={() => { handleBlockUser(); }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200"
                                        >
                                            {participantStatus === 'blocked' ? <ShieldAlert size={16} /> : <Ban size={16} />}
                                            {participantStatus === 'blocked' ? "Unblock User" : "Block User"}
                                        </button>
                                    </div>
                                )}
                            </div>
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
                        className={cn("flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 pt-20 relative", pinnedMessages.length > 0 && "pt-32")}
                        style={{ background: chatWallpaper }}
                    >
                        {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>}

                        {messages.map((msg) => (
                            <div id={`msg-\${msg.id}`} key={msg.id}>
                                <MessageBubble
                                    message={msg}
                                    onReact={handleReaction}
                                    onSwipeReply={handleSwipeReply}
                                    onEdit={handleEditMessage}
                                    onDelete={handleDeleteMessage}
                                    onForward={setForwardingMessage}
                                    onPin={handlePinMessage}
                                    onMediaClick={(url, type) => setPreviewMedia({ url, type: type as 'image' | 'video' })}
                                    onViewOnce={handleViewOnce}
                                />
                            </div>
                        ))}



                        <div className="h-4" /> {/* Spacer */}
                    </div>

                    {showScrollBottom && (
                        <button
                            onClick={scrollToBottom}
                            className="fixed bottom-32 right-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-[100] animate-in fade-in zoom-in duration-200 hover:scale-110 transition-transform"
                        >
                            <ChevronDown size={24} />
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
                                <p className="text-gray-500">
                                    {participantStatus === 'blocked'
                                        ? "You have blocked this user."
                                        : participantStatus === 'blocked_by'
                                            ? "You can no longer send messages to this user."
                                            : "Request pending."}
                                </p>
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
                {/* Timer Modal */}
                {showTimerModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Disappearing Messages</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Messages in this chat will disappear after:
                                </p>
                            </div>
                            <div className="p-2">
                                {[
                                    { label: '24 Hours', value: 24 * 60 * 60 },
                                    { label: '7 Days', value: 7 * 24 * 60 * 60 },
                                    { label: '90 Days', value: 90 * 24 * 60 * 60 },
                                    { label: 'Off', value: 0 },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setChatTimer(option.value);
                                            // TODO: Persist this to chat settings in DB if desired
                                            setShowTimerModal(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <span className="text-gray-900 dark:text-white font-medium">{option.label}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${chatTimer === option.value ? 'border-[#ff1744] bg-[#ff1744]' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {chatTimer === option.value && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-center">
                                <button onClick={() => setShowTimerModal(false)} className="text-[#ff1744] font-medium text-sm">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </ErrorBoundary >
    );
};

export default ChatRoom;
