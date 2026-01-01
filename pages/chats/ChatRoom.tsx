import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Phone, Video, MoreVertical, Loader2, ShieldAlert,
    Info, Users, Image as ImageIcon, VolumeX, LogOut, CheckCircle2, Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import MessageBubble, { ChatMessage } from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import ForwardModal from '../../components/chat/ForwardModal';

interface Message extends ChatMessage { }

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("ChatRoom Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 text-center text-red-500">
                    <h2>Something went wrong.</h2>
                    <pre className="text-xs text-left overflow-auto mt-2 bg-gray-100 p-2 border">
                        {this.state.error?.toString()}
                    </pre>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const safeDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "";
    }
};

const ChatRoom: React.FC = () => {
    const { id: chatId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatName, setChatName] = useState('Chat');
    const [chatAvatar, setChatAvatar] = useState('');
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [participantStatus, setParticipantStatus] = useState<'accepted' | 'pending' | 'rejected' | 'blocked'>('accepted');
    const [replyTo, setReplyTo] = useState<any>(null);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const listRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);
    const [isBuzzing, setIsBuzzing] = useState(false);
    const typingTimeoutRef = useRef<any>(null);
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        if (!user || !chatId) {
            setLoading(false);
            return;
        }

        const fetchChatDetails = async () => {
            setLoading(true);
            try {
                // Fetch Chat Info
                const { data: chatData, error: chatError } = await supabase
                    .from('chats')
                    .select('name, is_group')
                    .eq('id', chatId)
                    .single();

                if (chatError) throw chatError;

                // Fetch MY status
                const { data: myParticipant } = await supabase
                    .from('chat_participants')
                    .select('status')
                    .eq('chat_id', chatId)
                    .eq('user_id', user.id)
                    .single();

                if (myParticipant) setParticipantStatus(myParticipant.status);

                if (chatData.is_group) {
                    setChatName(chatData.name);
                    // Group logic simplified/removed for now
                } else {
                    const { data: participants } = await supabase
                        .from('chat_participants')
                        .select('user_id, profiles(full_name, avatar_url)')
                        .eq('chat_id', chatId)
                        .neq('user_id', user.id)
                        .single();

                    if (participants?.profiles) {
                        const profile: any = Array.isArray(participants.profiles) ? participants.profiles[0] : participants.profiles;
                        setChatName(profile.full_name);
                        setChatAvatar(profile.avatar_url);
                        setOtherUserId(participants.user_id);
                    }
                }

                await fetchMessages();

                // Mark as Read
                await supabase
                    .from('chat_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('chat_id', chatId)
                    .eq('user_id', user.id);

                // Subscribe to real-time updates for messages and presence
                const channel = supabase
                    .channel(`chat:${chatId}`)
                    .on('postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                        (payload) => handleNewMessage(payload.new)
                    )
                    .on('presence', { event: 'sync' }, () => {
                        const state = channel.presenceState();
                        const typing = new Set<string>();
                        Object.values(state).forEach((presences: any) => {
                            presences.forEach((p: any) => {
                                if (p.typing && p.user_id !== user.id) {
                                    typing.add(p.full_name || 'Someone');
                                }
                            });
                        });
                        setTypingUsers(typing);
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            await channel.track({
                                user_id: user.id,
                                full_name: user.user_metadata?.full_name || 'User',
                                typing: false
                            });
                        }
                    });

                channelRef.current = channel;

                return () => {
                    supabase.removeChannel(channel);
                };

            } catch (error) {
                console.error("Error loading chat:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchChatDetails();
    }, [user, chatId]);

    const handleNewMessage = (newMsgRaw: any) => {
        if (newMsgRaw.sender_id === user?.id) return; // handled locally

        const incomingMsg: Message = {
            id: newMsgRaw.id,
            text: newMsgRaw.content,
            sender: 'them',
            time: safeDate(newMsgRaw.created_at),
            type: newMsgRaw.type || 'text',
            status: 'read',
            mediaUrl: newMsgRaw.media_url,
            metadata: newMsgRaw.metadata,
            replyTo: newMsgRaw.reply_to_id ? getLastMessage(newMsgRaw.reply_to_id) : undefined
        };
        if (newMsgRaw.type === 'buzz') {
            triggerBuzz();
        }
        setMessages(prev => [...prev, incomingMsg]);
    };

    const triggerBuzz = () => {
        setIsBuzzing(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        setTimeout(() => setIsBuzzing(false), 1000);
    };

    // Helper to find reply context locally (simplified)
    const getLastMessage = (id: string) => {
        // In real app, might need to fetch if not in current list
        return undefined; // Placeholder
    };

    const fetchMessages = async () => {
        if (!chatId || !user) return;

        // Join with reactions if possible or fetch separately. 
        // For simplicity, fetching messages raw.
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                message_reactions(reaction, user_id)
            `)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            const formatted: Message[] = data.map((m: any) => {
                // Process Reactions
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
                    status: 'read',
                    mediaUrl: m.media_url,
                    metadata: m.metadata,
                    reactions: reactions,
                    isDeleted: m.is_deleted
                };
            });
            setMessages(formatted);
        }
    };

    const handleSend = async (content: string, type: 'text' | 'image' | 'video' | 'voice' | 'buzz', file?: File, duration?: number, extras?: any) => {
        if (!user || !chatId) return;

        let mediaUrl = '';

        // 1. Upload File if present
        if (file) {
            const ext = file.name.split('.').pop();
            const fileName = `${Date.now()}.${ext}`;
            const filePath = `${chatId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload failed", uploadError);
                return;
            }

            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
            mediaUrl = data.publicUrl;
        }

        const optimisticMsg: Message = {
            id: Date.now().toString(),
            text: content,
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: type,
            status: 'sent',
            mediaUrl: mediaUrl,
            metadata: { duration },
            replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.sender } : undefined
        };

        setMessages([...messages, optimisticMsg]);
        setReplyTo(null); // Clear reply context

        try {
            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content,
                type: type,
                media_url: mediaUrl,
                metadata: { duration },
                reply_to_id: replyTo?.id
            });

            if (error) throw error;

            // Allow immediate re-typing trigger if needed, but typically sending stops typing
            if (channelRef.current) {
                await channelRef.current.track({ user_id: user.id, full_name: user.user_metadata?.full_name, typing: false });
            }

        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!confirm("Delete this message?")) return;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));
        await supabase.from('messages').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', msgId);
    };

    const handleEditMessage = async (msgId: string, newText: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: newText, isEdited: true } : m));
        await supabase.from('messages').update({ content: newText, is_edited: true }).eq('id', msgId);
    };

    const handleReaction = async (msgId: string, reaction: string) => {
        // Optimistic UI update could go here
        try {
            const { error } = await supabase.rpc('toggle_reaction', {
                p_message_id: msgId,
                p_reaction: reaction
            });
            if (error) throw error;
            // Refetch or wait for realtime subscription to update reactions (needs detailed subscription)
        } catch (e) {
            console.error("Reaction failed", e);
        }
    };

    const handleForwardToChats = async (targetChatIds: string[]) => {
        if (!forwardingMessage || !user) return;

        const promises = targetChatIds.map(targetId => {
            return supabase.from('messages').insert({
                chat_id: targetId,
                sender_id: user.id,
                content: forwardingMessage.text,
                type: forwardingMessage.type,
                media_url: forwardingMessage.mediaUrl,
                metadata: { ...forwardingMessage.metadata, forwarded: true }
            });
        });

        await Promise.all(promises);
        setReplyTo(null); // Just close/reset things
        alert("Message forwarded!");
    };

    const handleTyping = async () => {
        if (!channelRef.current || !user) return;

        // If no timer is running, it means we weren't previously marked as typing.
        // So we send the "true" status now.
        if (!typingTimeoutRef.current) {
            await channelRef.current.track({
                user_id: user.id,
                full_name: user.user_metadata?.full_name || 'User',
                typing: true
            });
        }

        // Clear any existing timer to restart the countdown
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set a new timer to mark as "not typing" after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(async () => {
            if (channelRef.current) {
                await channelRef.current.track({
                    user_id: user.id,
                    full_name: user.user_metadata?.full_name || 'User',
                    typing: false
                });
                typingTimeoutRef.current = null;
            }
        }, 3000);
    };

    return (
        <ErrorBoundary>
            <div className={cn("flex flex-col h-[100dvh] w-full bg-[#f0f2f5] transition-transform fixed inset-0 overflow-hidden", isBuzzing && "animate-[spin_0.5s_ease-in-out]")}>
                <style>{`
                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
            `}</style>
                <div className={cn("flex flex-col h-full", isBuzzing && "animate-[shake_0.5s_ease-in-out_infinite]")}>
                    {/* Header */}
                    <header className="px-4 py-3 bg-white flex items-center justify-between shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="text-gray-600">
                                <ArrowLeft size={24} />
                            </button>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 overflow-hidden cursor-pointer"
                                    onClick={() => otherUserId && navigate(`/user/${otherUserId}`)}
                                >
                                    {chatAvatar ? <img src={chatAvatar} className="w-full h-full object-cover" alt="avatar" /> : chatName[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-tight">{chatName}</h3>
                                    <p className="text-xs text-green-500 font-medium">Online</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-[#ff1744]">
                            <Video size={24} />
                            <Phone size={22} />
                            <button
                                onClick={() => {
                                    const duration = prompt("Set disappearing messages (minutes)? Enter 0 to disable.");
                                    if (duration !== null) {
                                        // In real app, update 'chats' table
                                        alert(`Disappearing messages set to ${duration} minutes (Visual only for now).`);
                                    }
                                }}
                                className="p-1 rounded-full hover:bg-gray-100"
                            >
                                <Clock size={22} className="text-gray-500" />
                            </button>
                            <button className="p-1 rounded-full hover:bg-gray-100"><MoreVertical size={24} className="text-gray-500" /></button>
                        </div>
                    </header>

                    {/* Messages Area */}
                    <div
                        ref={listRef}
                        className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] opacity-95"
                    >
                        {loading ? (
                            <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-gray-500" /></div>
                        ) : (
                            <>
                                {messages.map((msg) => (
                                    <MessageBubble
                                        key={msg.id}
                                        message={msg}
                                        onReact={handleReaction}
                                        onSwipeReply={(m: any) => setReplyTo(m)}
                                        onEdit={handleEditMessage}
                                        onDelete={handleDeleteMessage}
                                        onForward={(m) => setForwardingMessage(m)}
                                        onMediaClick={(url) => setPreviewImage(url)}
                                    />
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
                            </>
                        )}
                    </div>

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
                            {participantStatus === 'blocked'
                                ? <p className="text-gray-500">You have blocked this user.</p>
                                : <p className="text-gray-500">Request pending.</p>
                            }
                        </div>
                    )}
                </div>

                <ForwardModal
                    isOpen={!!forwardingMessage}
                    onClose={() => setForwardingMessage(null)}
                    onSend={handleForwardToChats}
                />

                {/* Image Preview Modal */}
                {previewImage && (
                    <div
                        className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-in fade-in duration-200"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50 hover:bg-black/70">
                            <ArrowLeft size={24} />
                        </button>
                        <img
                            src={previewImage}
                            className="max-w-full max-h-screen object-contain"
                            alt="Preview"
                        />
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};
export default ChatRoom;
