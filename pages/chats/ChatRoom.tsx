import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { db, ChatMessageDB } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import MessageBubble, { ChatMessage } from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import ForwardModal from '../../components/chat/ForwardModal';
import ImageViewer from '../../components/ImageViewer';
import PDFPreviewModal from '../../components/PDFPreviewModal';
import { useCall } from '../../context/CallContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import { cn } from '../../lib/utils';
import { generateVideoThumbnail } from '../../lib/videoUtils';
import {
    ArrowLeft, Phone, Video, MoreVertical, Loader2, Clock, Trash2, Pin, ChevronDown, User, Image as ImageIcon, Ban, ShieldAlert, Check, X
} from 'lucide-react';

import { useNotifications } from '../../context/NotificationContext';
import { BadgeIcon } from '../../components/BadgeIcon';
import { BadgeType } from '../../constants/badges';

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

const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'Today';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
        return `last seen today at ${timeStr}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return `last seen yesterday at ${timeStr}`;
    }
    return `last seen on ${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${timeStr}`;
};

const ChatRoom = () => {
    const { id } = useParams<{ id: string }>();
    const chatId = id;
    const { user } = useAuth();
    const navigate = useNavigate();
    const { chatWallpaper } = useTheme();
    const { sentMessageSound, markChatNotificationsAsRead, setActiveChatId } = useNotifications();

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatProfile, setChatProfile] = useState<{ full_name: string; avatar_url: string; username: string; is_online?: boolean; last_seen_at?: string } | null>(null);
    const [replyTo, setReplyTo] = useState<any>(null); // Message to reply to
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' | 'text', content?: string, allUrls?: string[] } | null>(null);
    const [previewPdf, setPreviewPdf] = useState<string | null>(null);
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
    const [recordingUsers, setRecordingUsers] = useState<Set<string>>(new Set());
    const [isPartnerOnline, setIsPartnerOnline] = useState(false);

    // Call Hook - Global
    const { startCall } = useCall();

    const listRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Derived State
    const pinnedMessages = messages.filter(m => m.isPinned);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: 'smooth'
            });
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
            // Get all participants to ensure we find the partner
            const { data: participantsData, error: participantError } = await supabase
                .from('chat_participants')
                .select(`
                    user_id,
                    status,
                    profiles:user_id (
                        id,
                        full_name,
                        avatar_url,
                        username,
                        badge_type,
                        last_seen_at,
                        last_seen_privacy,
                        online_status_privacy,
                        profile_photo_privacy,
                        about_privacy
                    )
                `)
                .eq('chat_id', chatId);

            if (participantError) console.error("Participant fetch error:", participantError);

            if (participantsData) {
                // Find the other user
                const otherParticipant = participantsData.find((p: any) => p.user_id !== user.id);

                // If found, or if self-chat (fallback to self)
                const targetData = otherParticipant || participantsData[0];

                if (targetData && targetData.profiles) {
                    const profile: any = Array.isArray(targetData.profiles) ? targetData.profiles[0] : targetData.profiles;
                    console.log("Setting Chat Profile:", profile);
                    setChatProfile(profile);
                    setPrivacySettings({
                        last_seen_privacy: profile.last_seen_privacy || 'everyone',
                        online_status_privacy: profile.online_status_privacy || 'everyone',
                        profile_photo_privacy: profile.profile_photo_privacy || 'everyone',
                        about_privacy: profile.about_privacy || 'everyone',
                    });

                    // Set My Status
                    const myParticipant = participantsData.find((p: any) => p.user_id === user.id);
                    if (myParticipant) {
                        setParticipantStatus(myParticipant.status);
                    }

                    // Check Block Status
                    const { data: blockData } = await supabase
                        .from('blocked_users')
                        .select('*')
                        .or(`blocker_id.eq.${user.id},blocker_id.eq.${profile.id}`)
                        .or(`blocked_id.eq.${user.id},blocked_id.eq.${profile.id}`);

                    if (blockData && blockData.length > 0) {
                        const iBlockedThem = blockData.some(b => b.blocker_id === user.id);
                        const theyBlockedMe = blockData.some(b => b.blocker_id === profile.id);

                        if (iBlockedThem) setParticipantStatus('blocked');
                        else if (theyBlockedMe) setParticipantStatus('blocked_by');
                    } else if (myParticipant && myParticipant.status !== 'pending') {
                        // Only default to accepted if NOT pending and NOT blocked
                        // Actually, myParticipant.status should be the truth. 
                        // If pending, it stays pending. If accepted, it stays accepted.
                        // But if we want to default for some reason?
                        // If we found myParticipant, we already set it. 
                        // So we ONLY need to override if BLOCKED.
                        // If NOT blocked, we trust myParticipant.status.
                        // So this else block is actually harmful if we already set checking myParticipant.
                        // But what if myParticipant is NOT found? Then we might assume accepted? 
                        // If not found, they aren't in the chat... so that's an edge case.
                        // Let's just remove the else block or handle the null case.
                        if (!myParticipant) setParticipantStatus('accepted');
                    }
                }
            } else {
                console.warn("No participant profile found");
                // Fallback?
                // setChatProfile({ full_name: "Unknown", avatar_url: "", username: "unknown" });
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

                    isPinned: m.is_pinned, // Cache supports pin
                    createdAt: m.created_at
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
                    isPinned: m.is_pinned,
                    isEdited: m.is_edited,
                    createdAt: m.created_at
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

            // 3. Sync Notification System (Clear Badge)
            await markChatNotificationsAsRead(chatId);

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

    const channelRef = useRef<any>(null);

    // Realtime & Effects
    useEffect(() => {
        fetchMessages().then(() => markMessagesAsRead()); // Mark read after initial fetch

        if (!chatId || !user) return;

        const handleNewMessage = (newMsgRaw: any) => {
            // Check for Buzz
            if (newMsgRaw.type === 'buzz') {
                setIsBuzzing(true);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // Stronger pattern
                setTimeout(() => setIsBuzzing(false), 500); // Match animation duration
            }

            // Mark incoming message as read since we are in the room
            if (newMsgRaw.sender_id !== user.id) {
                markMessagesAsRead();
            }

            // Construct Message
            const newMsg: Message = {
                id: newMsgRaw.id,
                text: newMsgRaw.content,
                sender: newMsgRaw.sender_id === user.id ? 'me' : 'them',
                time: safeDate(newMsgRaw.created_at),
                type: newMsgRaw.type || 'text',
                status: 'read',
                mediaUrl: newMsgRaw.media_url,
                metadata: newMsgRaw.metadata,

                createdAt: newMsgRaw.created_at
            };

            setMessages(prev => {
                // Deduplicate based on ID
                if (prev.some(m => m.id === newMsg.id)) return prev;

                // Deduplicate based on optimistic update (tempId)
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
                if (payload.payload.userId !== user.id) {
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
            .on('broadcast', { event: 'recording' }, (payload) => {
                const { userId, username, isRecording } = payload.payload;
                if (userId !== user.id) {
                    setRecordingUsers(prev => {
                        const next = new Set(prev);
                        if (isRecording) next.add(username || "Someone");
                        else next.delete(username || "Someone");
                        return next;
                    });
                }
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                // Check if other participant is online
                // We don't have the other user's ID directly in logic easily without `chatProfile`
                // But `chatProfile` is state.
                // Simpler: Check if ANYONE else is in the room. 
                // However, presenceState keys are usually random user session IDs.
                // We need to look at the values.

                let onlineFound = false;
                for (const key in state) {
                    const presences = state[key] as any[];
                    presences.forEach(p => {
                        if (p.user_id !== user.id) {
                            onlineFound = true;
                        }
                    });
                }

                if (onlineFound) {
                    setIsPartnerOnline(true);
                } else {
                    setIsPartnerOnline(false);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [chatId, user?.id]);

    useEffect(() => {
        // Auto-scroll on initial load or new messages if near bottom
        scrollToBottom();
    }, [messages.length, loading]);

    useEffect(() => {
        if (chatId) {
            setActiveChatId(chatId);
            return () => setActiveChatId(null);
        }
    }, [chatId]);


    // Handlers
    const handleSend = async (content: string, type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'buzz' | 'location' | 'audio' | 'contact', files?: File | File[], duration?: number, metadata?: any) => {
        if (!user || !chatId) return;
        if (participantStatus === 'blocked' || participantStatus === 'blocked_by') {
            alert("Cannot send message. User is blocked or has blocked you.");
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const finalMetadata = { ...metadata, duration, tempId };

        if (replyTo) {
            finalMetadata.replyTo = {
                id: replyTo.id,
                text: replyTo.text,
                sender: replyTo.sender
            };
        }

        const expiresAt = chatTimer > 0 ? new Date(Date.now() + chatTimer * 1000).toISOString() : null;

        // Handle Array of Files
        const fileList = Array.isArray(files) ? files : (files ? [files] : []);
        let mediaUrls: string[] = [];
        let singleMediaUrl = '';

        // Optimistic Update
        const optimisticMsg: Message = {
            id: tempId,
            text: content,
            sender: 'me',
            time: "Now",
            type: type,
            status: 'sent',
            mediaUrl: fileList.length > 0 ? URL.createObjectURL(fileList[0]) : '', // Primary preview
            mediaUrls: fileList.map(f => URL.createObjectURL(f)), // All previews
            metadata: finalMetadata,
            isPinned: false,
            reactions: {},
            expiresAt: expiresAt || undefined,
            isDeleted: false,
            isViewed: false,

            viewOnce: metadata?.viewOnce || false,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottom();
        setReplyTo(null);

        if (sentMessageSound && sentMessageSound !== 'none') {
            new Audio(`/sounds/${sentMessageSound}.mp3`).play().catch(e => console.error("Sound play failed", e));
        }

        try {
            // Upload Loop
            if (fileList.length > 0) {
                const uploadPromises = fileList.map(async (file) => {
                    const ext = file.name.split('.').pop();
                    const fileName = `chat_${chatId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const { error: uploadError } = await supabase.storage
                        .from('chat-attachments')
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);
                    return data.publicUrl;
                });

                mediaUrls = await Promise.all(uploadPromises);
                singleMediaUrl = mediaUrls[0];

                // Video Thumbnail Logic
                if (type === 'video' && fileList[0]) {
                    try {
                        const thumbBlob = await generateVideoThumbnail(fileList[0]);
                        if (thumbBlob) {
                            const thumbName = `chat_thumbs/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                            const { error: thumbErr } = await supabase.storage
                                .from('chat-attachments')
                                .upload(thumbName, thumbBlob);

                            if (!thumbErr) {
                                const { data: thumbData } = supabase.storage
                                    .from('chat-attachments')
                                    .getPublicUrl(thumbName);
                                finalMetadata.thumbnailUrl = thumbData.publicUrl;
                            }
                        }
                    } catch (err) {
                        console.error("Thumbnail generation failed", err);
                    }
                }
            }

            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: user.id,
                content: content,
                type: type,
                media_url: singleMediaUrl, // Backwards compatibility / primary image
                metadata: finalMetadata,
                expires_at: expiresAt
            });

            if (error) throw error;

        } catch (e: any) {
            console.error("Send failed:", e);
            alert(`Failed to send message: ${e.message || e.toString()}`);
            setMessages(prev => prev.filter(m => m.id !== tempId));
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
        const msgToDelete = messages.find(m => m.id === msgId);

        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));

        try {
            // Delete Media File if exists
            if (msgToDelete?.mediaUrl) {
                // Extract file path from URL
                // URL format: .../storage/v1/object/public/chat-attachments/chat_ID/filename
                const parts = msgToDelete.mediaUrl.split('chat-attachments/');
                if (parts.length === 2) {
                    const filePath = parts[1];
                    const { error: removeError } = await supabase.storage
                        .from('chat-attachments')
                        .remove([filePath]);

                    if (removeError) console.error("Failed to remove media file", removeError);
                }
            }

            // Mark as deleted in DB
            await supabase.from('messages').update({ is_deleted: true, media_url: null, content: 'Message deleted' }).eq('id', msgId);
            await db.messages.update(msgId, { is_deleted: true, media_url: '', content: 'Message deleted' });
        } catch (e) {
            console.error("Delete failed", e);
            // Revert (hard to revert delete perfectly without knowing old state, but typically network doesn't fail often here.
            // A refresher would be needed or just alert user.)
            alert("Failed to delete message");
            // Ideally we'd rollback state here, but for simple delete we might skip complex rollback logic for now
        }
    };

    const handleEditMessage = async (msgId: string, newText: string) => {
        const oldMessage = messages.find(m => m.id === msgId);

        if (!oldMessage) return;

        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: newText, isEdited: true } : m));

        try {
            await supabase.from('messages').update({ content: newText, is_edited: true }).eq('id', msgId);
            await db.messages.update(msgId, { content: newText, is_edited: true }); // Cache update
        } catch (e) {
            console.error("Edit failed", e);
            alert("Failed to edit message");
            // Revert
            setMessages(prev => prev.map(m => m.id === msgId ? oldMessage : m));
        }
    };

    const handleTyping = () => {
        // Throttle
        if (!typingTimeoutRef.current && chatId && user && channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, username: (user as any).user_metadata?.full_name }
            });
            typingTimeoutRef.current = setTimeout(() => {
                typingTimeoutRef.current = null;
            }, 2000);
        }
    };

    const handleRecording = (isRecording: boolean) => {
        if (chatId && user && channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'recording',
                payload: { userId: user.id, username: (user as any).user_metadata?.full_name, isRecording }
            });
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

    const handleSaveToBag = async (msg: ChatMessage) => {
        if (!user) return;
        try {
            const newItem: any = {
                user_id: user.id,
                type: msg.type === 'text' ? 'message' : msg.type, // Map text to message or note? Let's use message for saved chats
                content: msg.type === 'text' ? msg.text : (msg.mediaUrl || ''),
                title: `Saved Message from ${msg.sender === 'me' ? 'Me' : (chatProfile?.full_name || 'Chat')}`,
                metadata: {
                    original_chat_id: chatId,
                    original_sender: msg.sender,
                    timestamp: msg.time
                },
                category: msg.type === 'text' ? 'messages' : 'media', // Simple categorization
                is_locked: false // Default
            };

            // 1. Save to Supabase
            const { data, error } = await supabase.from('my_bag_items').insert(newItem).select().single();

            if (error) {
                // Fallback to local ID generation if offline?
                // For now, assume online or throw.
                console.error("Supabase save failed", error);
                // If offline, we could save to Dexie with a temp ID and sync later.
                // Let's at least save to Dexie:
                newItem.id = `local-${Date.now()}`;
                newItem.created_at = new Date().toISOString();
                await db.my_bag.add(newItem);
                alert("Saved to Bag (Offline)");
                return;
            }

            // 2. Save to Dexie Sync
            if (data) {
                await db.my_bag.put(data);
                alert("Saved to My Bag 🔒");
            }
        } catch (e) {
            console.error("Save to bag failed", e);
            alert("Failed to save item");
        }
    };

    const handleAcceptRequest = async () => {
        if (!user || !chatId) return;
        try {
            const { error } = await supabase
                .from('chat_participants')
                .update({ status: 'accepted' })
                .eq('chat_id', chatId)
                .eq('user_id', user.id);

            if (error) throw error;
            setParticipantStatus('accepted');
            // Notify sender? usually handled by realtime or they see it enabled.
        } catch (e) {
            console.error("Error accepting request", e);
            alert("Failed to accept request");
        }
    };

    const handleRejectRequest = async () => {
        if (!confirm("Reject this message request? The chat will be removed.")) return;
        if (!user || !chatId) return;
        try {
            // Clean up - delete participant row or set to rejected
            // Deleting allows them to request again potentially, or just clean up.
            // If we want to block, that's separate. 'Rejected' status might be better if we want to hide it but keep record.
            // For now, let's just delete the participant entry so it vanishes from list.
            const { error } = await supabase
                .from('chat_participants')
                .delete()
                .eq('chat_id', chatId)
                .eq('user_id', user.id);

            if (error) throw error;
            navigate('/chats');
        } catch (e) {
            console.error("Error rejecting request", e);
            alert("Failed to reject request");
        }
    };

    return (
        <ErrorBoundary>
            <div className={cn("flex flex-col h-[100dvh] w-full max-w-full bg-[#f0f2f5] dark:bg-black transition-transform fixed inset-0 overflow-hidden", isBuzzing && "animate-shake")}>

                {/* Menu Backdrop */}
                {isMenuOpen && (
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMenuOpen(false)} />
                )}

                {/* CallOverlay handled globally by CallProvider */}

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
                                    {chatProfile?.badge_type && (
                                        <div className="absolute bottom-0 right-0 z-10 scale-90">
                                            <BadgeIcon type={chatProfile.badge_type as BadgeType} size={16} className="p-0.5" />
                                        </div>
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
                                            isPartnerOnline ? (
                                                <span className="text-xs text-green-500">Online</span>
                                            ) : (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {privacySettings?.last_seen_privacy !== 'nobody' && chatProfile?.last_seen_at
                                                        ? formatLastSeen(chatProfile.last_seen_at)
                                                        : "Offline"
                                                    }
                                                </span>
                                            )
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => {
                                if (!chatProfile?.id) { console.error("Call failed: No target user ID"); return; }
                                console.log(`[ChatRoom] Starting AUDIO call to ${chatProfile.full_name} (${chatProfile.id})`);
                                startCall(chatProfile.id, chatProfile.full_name || 'User', chatProfile.avatar_url || '', false);
                            }}><Phone size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <button onClick={() => {
                                if (!chatProfile?.id) { console.error("Call failed: No target user ID"); return; }
                                console.log(`[ChatRoom] Starting VIDEO call to ${chatProfile.full_name} (${chatProfile.id})`);
                                startCall(chatProfile.id, chatProfile.full_name || 'User', chatProfile.avatar_url || '', true);
                            }}><Video size={20} className="text-gray-600 dark:text-gray-300" /></button>
                            <div className="relative">
                                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                    <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => {
                                                if (chatProfile?.id) {
                                                    navigate(`/user/${chatProfile.id}`);
                                                }
                                                setIsMenuOpen(false);
                                            }}
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
                                const el = document.getElementById(`msg-${pinnedMessages[pinnedMessages.length - 1].id}`);
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

                        {messages.map((msg, index) => {
                            const prevMsg = messages[index - 1];
                            const showDate = index === 0 ||
                                (prevMsg?.createdAt && msg.createdAt &&
                                    new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString());

                            return (
                                <React.Fragment key={msg.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-4 sticky top-[70px] z-10 pointer-events-none">
                                            <div className="bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 backdrop-blur-md">
                                                {formatDateLabel(msg.createdAt)}
                                            </div>
                                        </div>
                                    )}
                                    <div id={`msg-${msg.id}`}>
                                        <MessageBubble
                                            message={msg}
                                            onReact={handleReaction}
                                            onSwipeReply={handleSwipeReply}
                                            onEdit={handleEditMessage}
                                            onDelete={handleDeleteMessage}

                                            onForward={setForwardingMessage}
                                            onPin={handlePinMessage}
                                            onMediaClick={(url, type) => {
                                                if (type === 'file' && url.toLowerCase().endsWith('.pdf')) {
                                                    setPreviewPdf(url);
                                                } else {
                                                    setPreviewMedia({ url, type: type as 'image' | 'video' });
                                                }
                                            }}
                                            onViewOnce={handleViewOnce}
                                            onSaveToBag={handleSaveToBag}
                                        />
                                    </div>
                                </React.Fragment>
                            );
                        })}



                        <div className="h-4" /> {/* Spacer */}
                    </div>

                    {
                        showScrollBottom && (
                            <button
                                onClick={scrollToBottom}
                                className="fixed bottom-32 right-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-[100] animate-in fade-in zoom-in duration-200 hover:scale-110 transition-transform"
                            >
                                <ChevronDown size={24} />
                            </button>
                        )
                    }

                    {/* Input Area */}
                    {
                        !loading && participantStatus === 'accepted' ? (
                            <div className="w-full bg-white dark:bg-gray-900">
                                {recordingUsers.size > 0 && (
                                    <div className="px-4 py-1 animate-in slide-in-from-bottom-2 fade-in bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800">
                                        <span className="text-xs font-bold text-[#ff1744] animate-pulse flex items-center gap-2">
                                            <div className="w-2 h-2 bg-[#ff1744] rounded-full animate-ping" />
                                            {Array.from(recordingUsers).join(', ')} is recording voice...
                                        </span>
                                    </div>
                                )}
                                <ChatInput
                                    onSend={handleSend}
                                    onTyping={handleTyping}
                                    onRecording={handleRecording}
                                    replyTo={replyTo}
                                    onCancelReply={() => setReplyTo(null)}
                                />
                            </div>
                        ) : !loading && (
                            <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-bottom">
                                {participantStatus === 'pending' ? (
                                    <div className="flex flex-col gap-4">
                                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                                            {chatProfile?.full_name} wants to send you a message.
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleRejectRequest}
                                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <X size={18} /> Delete
                                            </button>
                                            <button
                                                onClick={handleAcceptRequest}
                                                className="flex-1 py-3 bg-[#ff1744] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                                            >
                                                <Check size={18} /> Accept
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center">
                                        {participantStatus === 'blocked'
                                            ? "You have blocked this user."
                                            : participantStatus === 'blocked_by'
                                                ? "You can no longer send messages to this user."
                                                : "Chat unavailable."}
                                    </p>
                                )}
                            </div>
                        )
                    }
                </div>

                <ForwardModal
                    isOpen={!!forwardingMessage}
                    onClose={() => setForwardingMessage(null)}
                    onSend={handleForwardToChats}
                />

                {/* Media Preview Modal */}
                {
                    previewMedia && (
                        previewMedia.type === 'image' ? (
                            <ImageViewer
                                isOpen={!!previewMedia}
                                onClose={() => setPreviewMedia(null)}
                                src={previewMedia.url}
                                images={previewMedia.allUrls}
                                alt="Preview"
                            />
                        ) : (
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
                                ) : (
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
                                )}
                            </div>
                        )
                    )
                }


                <PDFPreviewModal
                    isOpen={!!previewPdf}
                    url={previewPdf || ''}
                    onClose={() => setPreviewPdf(null)}
                />

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
