import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, MoreVertical, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import ChatInput from '../../components/chat/ChatInput';
import MessageBubble, { ChatMessage } from '../../components/chat/MessageBubble';
import ErrorBoundary from '../../components/ErrorBoundary';
import PDFPreviewModal from '../../components/PDFPreviewModal';
import ImageViewer from '../../components/ImageViewer';

interface SpaceMessage extends ChatMessage {
    sender_id: string;
    senderName?: string;
    senderAvatar?: string;
}

const formatDate = (dateString: string) => {
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "Now";
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "Now";
    }
};

export const SpaceChatRoomContent: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [messages, setMessages] = useState<SpaceMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [spaceName, setSpaceName] = useState('');
    const [isMember, setIsMember] = useState(false);
    const [previewPdf, setPreviewPdf] = useState<string | null>(null);
    const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Reuse helper from ChatRoom if possible, or duplicate safely
    const safeDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "";
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return "";
        }
    };

    const scrollToBottom = () => {
        try {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } catch (e) {
            console.warn("Scroll error:", e);
        }
    };

    useEffect(() => {
        console.log("ChatRoom mounted. ID:", id);
        if (!id) return;

        const fetchSpaceAndMessages = async () => {
            try {
                // 1. Fetch Space Name
                const { data: spaceData } = await supabase.from('spaces').select('name').eq('id', id).single();
                if (spaceData) setSpaceName(spaceData.name);

                // 2. Check Membership
                if (user) {
                    const { data: memberData } = await supabase
                        .from('space_members')
                        .select('user_id')
                        .eq('space_id', id)
                        .eq('user_id', user.id)
                        .maybeSingle();
                    setIsMember(!!memberData);
                }

                // 3. Fetch Messages
                const { data: msgsData, error } = await supabase
                    .from('space_messages')
                    .select(`
                        id,
                        content,
                        sender_id,
                        created_at,
                        type,
                        media_url,
                        metadata,
                        sender:sender_id(full_name, avatar_url, username)
                    `)
                    .eq('space_id', id)
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error("Supabase error messages:", error);
                    throw error;
                }

                const formattedMessages: SpaceMessage[] = (msgsData || []).map((m: any) => ({
                    id: m.id,
                    text: m.content || "",
                    sender: m.sender_id === user?.id ? 'me' : 'them',
                    time: safeDate(m.created_at),
                    type: m.type || 'text',
                    status: 'read',
                    mediaUrl: m.media_url,
                    metadata: m.metadata || {},
                    sender_id: m.sender_id,
                    // Extra for display if MessageBubble uses them (it uses sender 'me'|'them', but we might want names)
                    // MessageBubble logic might need tweaking or we pass custom render props? 
                    // MessageBubble is designed for DMs mainly.
                    // For Groups/Spaces, we usually want to show the sender name.
                    // Let's assume MessageBubble handles 'them' by showing name if provided? 
                    // Checking MessageBubble props... it takes `message`.
                    // We might need to hack 'sender' to be the name? No, 'sender' is limit to 'me' | 'them'.
                    // We can add a 'senderName' and 'senderAvatar' to valid Message interface?
                    // Or we just modify MessageBubble to accept optional sender details.
                    // For now, let's map standard fields.
                    senderName: m.sender?.full_name,
                    senderAvatar: m.sender?.avatar_url
                }));

                setMessages(formattedMessages);
            } catch (error) {
                console.error("Error loading chat:", error);
            } finally {
                setLoading(false);
                setTimeout(scrollToBottom, 100);
            }
        };

        fetchSpaceAndMessages();

        const channel = supabase
            .channel(`space_chat:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'space_messages',
                filter: `space_id=eq.${id}`
            }, async (payload) => {
                console.log("Realtime payload:", payload);
                const { data: senderData } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, username')
                    .eq('id', payload.new.sender_id)
                    .single();

                const newMsg: SpaceMessage = {
                    id: payload.new.id,
                    text: payload.new.content,
                    sender: payload.new.sender_id === user?.id ? 'me' : 'them',
                    time: safeDate(payload.new.created_at),
                    type: payload.new.type || 'text',
                    status: 'read',
                    mediaUrl: payload.new.media_url,
                    metadata: payload.new.metadata || {},
                    sender_id: payload.new.sender_id,
                    senderName: senderData?.full_name,
                    senderAvatar: senderData?.avatar_url
                };

                setMessages(prev => {
                    // Deduplicate by ID
                    if (prev.some(m => m.id === newMsg.id)) return prev;

                    // Deduplicate by tempId (Optimistic Update)
                    if (newMsg.metadata?.tempId) {
                        const idx = prev.findIndex(m => m.id === newMsg.metadata.tempId);
                        if (idx !== -1) {
                            const newArr = [...prev];
                            newArr[idx] = newMsg;
                            return newArr;
                        }
                    }
                    return [...prev, newMsg];
                });
                setTimeout(scrollToBottom, 100);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user]);

    const handleJoinSpace = async () => {
        if (!user || !id) return;
        try {
            const { error } = await supabase
                .from('space_members')
                .insert({ space_id: id, user_id: user.id });

            if (error) throw error;
            setIsMember(true);
        } catch (error) {
            console.error("Error joining space:", error);
            alert("Could not join space.");
        }
    };

    const handleSend = async (content: string, type: 'text' | 'image' | 'video' | 'voice' | 'buzz' | 'location' | 'audio' | 'file', file?: File, duration?: number, metadata?: any) => {
        if (!user || !id) return;
        if (!isMember) {
            alert("You must join the space to send messages.");
            return;
        }

        const tempId = `temp-${Date.now()}`;

        // Optimistic UI Update
        const optimisticMsg: SpaceMessage = {
            id: tempId,
            text: content,
            sender: 'me',
            time: "Now",
            type: type,
            status: 'sending',
            mediaUrl: file ? URL.createObjectURL(file) : '', // Preview local
            metadata: metadata || {},
            sender_id: user.id,
            senderName: user.user_metadata?.full_name || 'Me',
            senderAvatar: user.user_metadata?.avatar_url
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(scrollToBottom, 100);

        try {
            let mediaUrl = '';

            if (file) {
                const ext = file.name.split('.').pop();
                const fileName = `space_${id}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('chat-attachments')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
                mediaUrl = data.publicUrl;
            }

            const { error } = await supabase
                .from('space_messages')
                .insert({
                    space_id: id,
                    sender_id: user.id,
                    content: content,
                    type: type,
                    media_url: mediaUrl,
                    metadata: { ...metadata, tempId }
                });

            if (error) throw error;
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Message failed to send.");
            // Remove optimistic message
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#f5f7fb]">
            {/* Header */}
            <div className="bg-white p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg leading-tight">{spaceName || "Space"}</h2>
                        <div className="flex items-center gap-1">
                            <p className="text-xs text-green-500 font-medium">● Online</p>
                            {!isMember && <span className="text-xs text-gray-400">• You are viewing as guest</span>}
                        </div>
                    </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                    <MoreVertical size={24} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        <p>Welcome to the chat room!</p>
                        <p className="text-sm">Be the first to say hello.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender_id === user?.id;
                        const isSequential = index > 0 && messages[index - 1]?.sender_id === msg.sender_id;

                        // Add simple sequential time grouping context logic if desiered, but for now just layout
                        // MessageBubble manages its own "me" alignment but we need to layout the avatar external to it for "them"
                        // Actually MessageBubble uses w-full and justify-start/end.
                        // To add an avatar, we need to wrap it.

                        return (
                            <div key={msg.id} className={cn("flex gap-2 mb-1", isMe ? "justify-end" : "justify-start")}>
                                {!isMe && (
                                    <div className="flex flex-col justify-end w-8 shrink-0">
                                        {!isSequential ? (
                                            <img
                                                src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${msg.senderName}`}
                                                className="w-8 h-8 rounded-full object-cover border border-gray-100 mb-2"
                                                alt={msg.senderName}
                                            />
                                        ) : <div className="w-8" />}
                                    </div>
                                )}

                                <div className={isMe ? "max-w-[85%]" : "max-w-[75%]"}>
                                    {!isMe && !isSequential && (
                                        <p className="text-[10px] text-gray-400 ml-1 mb-0.5">{msg.senderName}</p>
                                    )}
                                    <MessageBubble
                                        message={msg}
                                        onMediaClick={(url, type) => {
                                            if (type === 'file' && url.toLowerCase().endsWith('.pdf')) {
                                                setPreviewPdf(url);
                                            } else {
                                                setPreviewMedia({ url, type: type as 'image' | 'video' });
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <PDFPreviewModal
                isOpen={!!previewPdf}
                url={previewPdf || ''}
                onClose={() => setPreviewPdf(null)}
            />

            <ImageViewer
                isOpen={!!previewMedia && previewMedia.type === 'image'}
                onClose={() => setPreviewMedia(null)}
                src={previewMedia?.url || ''}
            />

            {/* Input Area or Join Prompt */}
            {isMember ? (
                <ChatInput onSend={handleSend} />
            ) : (
                <div className="p-4 bg-white border-t border-gray-100">
                    <button
                        onClick={handleJoinSpace}
                        className="w-full py-3 bg-[#ff1744] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
                    >
                        Join Space to Chat
                    </button>
                </div>
            )}
        </div>
    );
};

const SpaceChatRoom = () => (
    <ErrorBoundary>
        <SpaceChatRoomContent />
    </ErrorBoundary>
);

export default SpaceChatRoom;
