import React, { useState, useEffect, useRef } from 'react';
import { Search, Edit, Archive, CheckCheck, Loader2, Phone, ArrowDownLeft, ArrowUpRight, QrCode, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ChatPreview } from '../types';
import { useAuth } from '../context/AuthContext';
import { storeChats, getAllChats } from '../utils/idb';
import { supabase } from '../services/supabase';
import PinModal from './PinModal';

const ChatView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'archived' | 'calls'>((location.state as any)?.tab || 'all');
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [missedCallsCount, setMissedCallsCount] = useState(0);

  // Badge timestamps
  const [lastViewedRequests, setLastViewedRequests] = useState(() => localStorage.getItem('lastViewedRequests') || new Date(0).toISOString());

  const handleTabChange = async (tab: 'all' | 'requests' | 'archived' | 'calls') => {
    setActiveTab(tab);
    const now = new Date().toISOString();

    if (tab === 'calls') {
      // Mark all missed, unviewed calls as viewed in DB
      setMissedCallsCount(0); // Optimistic clear
      if (user) {
        supabase.from('call_logs')
          .update({ is_viewed: true })
          .eq('status', 'missed')
          .eq('is_viewed', false)
          .neq('caller_id', user.id)
          .then(({ error }) => {
            if (error) console.error("Error marking calls as viewed", error);
          });
      }
    }

    if (tab === 'requests') {
      localStorage.setItem('lastViewedRequests', now);
      setLastViewedRequests(now);
    }
  };

  const [pinModal, setPinModal] = useState<{ isOpen: boolean, mode: 'create' | 'enter' | 'confirm', chatId?: string, action?: 'open' | 'toggleLock' }>({ isOpen: false, mode: 'enter' });
  const [userPin, setUserPin] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('chat_lock_pin').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setUserPin(data.chat_lock_pin);
        });
    }
  }, [user]);

  const fetchCallLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
                  *,
                  caller:caller_id(full_name, avatar_url),
                  chat:chat_id(is_group, name)
              `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCallLogs(data || []);
    } catch (error) {
      console.error("Error fetching call logs", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMissedCallsCount = async () => {
    if (!user) return;
    try {
      // Count missed incoming calls that are NOT viewed
      const { count, error } = await supabase
        .from('call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'missed')
        .neq('caller_id', user.id)
        .eq('is_viewed', false);

      if (!error && count !== null) {
        setMissedCallsCount(count);
      }
    } catch (e) {
      console.error("Error fetching missed calls count", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'calls') {
      fetchCallLogs();
      // Don't fetch count if we are ON the tab, we want it cleared.
      // But actually, we might want to see new ones coming in LIVE.
      // The handleTabChange sets local variable, which affects query.
      fetchMissedCallsCount();
    } else {
      fetchChats();
      fetchMissedCallsCount();
    }
  }, [user, activeTab]); // Removed lastViewedCalls dependency

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get all chats where the current user is a participant
      const { data: myChats, error: myChatsError } = await supabase
        .from('chat_participants')
        .select('chat_id, is_archived, is_pinned, is_locked, status, chats(id, name, is_group, created_at)')
        .eq('user_id', user.id);

      if (myChatsError) throw myChatsError;
      if (!myChats || myChats.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      const chatIds = myChats.map(c => c.chat_id);

      // 2. Fetch the latest message for each chat
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('chat_id, content, created_at, sender_id, type')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // 3. Fetch OTHER participants info for DM names/avatars
      const { data: participants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id, profiles(full_name, avatar_url, is_verified)')
        .in('chat_id', chatIds)
        .neq('user_id', user.id); // Get everyone else

      if (participantsError) throw participantsError;

      // 4. Fetch Unread Counts (NEW)
      const { data: unreadCounts, error: unreadError } = await supabase
        .rpc('get_unread_counts', { p_user_id: user.id });

      if (unreadError) console.error("Error fetching unread counts:", unreadError);

      const unreadMap: { [key: string]: number } = {};
      if (unreadCounts) {
        unreadCounts.forEach((u: any) => {
          unreadMap[u.chat_id] = u.unread_count;
        });
      }

      // 5. Combine data
      const formattedChats: ChatPreview[] = myChats.map((myChat: any) => {
        const chatInfo = myChat.chats;
        const LatestMsg = messages?.find((m: any) => m.chat_id === chatInfo.id);

        // Determine name/avatar
        let name = 'Unknown Chat';
        let avatar = '';
        let isOnline = false;

        if (chatInfo?.is_group) {
          name = chatInfo.name || 'Group Chat';
        } else {            // It's a DM, find the other person
          const otherPerson = participants?.find((p: any) => p.chat_id === chatInfo.id);
          if (otherPerson && otherPerson.profiles) {
            const profile = Array.isArray(otherPerson.profiles) ? otherPerson.profiles[0] : otherPerson.profiles;
            if (profile) {
              name = profile.full_name;
              avatar = profile.avatar_url;
            }
          }
        }

        // Determine preview text based on type
        let previewText = LatestMsg ? LatestMsg.content : 'No messages yet';
        if (LatestMsg) {
          switch (LatestMsg.type) {
            case 'image': previewText = '📷 Image'; break;
            case 'video': previewText = '🎥 Video'; break;
            case 'voice': previewText = '🎤 Voice Note'; break;
            case 'audio': previewText = '🎵 Audio'; break;
            case 'file': previewText = '📁 File'; break;
            case 'location': previewText = '📍 Location'; break;
            case 'buzz': previewText = '⚡ BUZZ!'; break;
            default: previewText = LatestMsg.content || 'Sent a message';
          }
        }

        if (myChat.is_locked) {
          previewText = '🔒 Locked Message';
        }

        return {
          id: chatInfo?.id,
          name: name,
          lastMessage: previewText,
          time: LatestMsg ? new Date(LatestMsg.created_at).toLocaleDateString() : '',
          unread: unreadMap[chatInfo.id] || 0, // Use RPC data
          avatar: avatar,
          isOnline: isOnline,
          isArchived: myChat.is_archived,
          isPinned: myChat.is_pinned,
          isLocked: myChat.is_locked,
          isGroup: chatInfo?.is_group ?? false,
          status: myChat.status || 'accepted',
          createdAt: chatInfo?.created_at // Use chat creation as fallback for request time
        };
      });

      setChats(formattedChats);

    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch handled by viewMode effect
    // But we also need realtime updates for the chat list (unread counts, new messages)
    if (!user) return;

    const channel = supabase
      .channel('chat_list_updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT (new msg) and UPDATE (read status)
          schema: 'public',
          table: 'messages'
        },
        () => fetchChats()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Listen for last_read_at updates
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchChats()
      )
      .subscribe();

    const callChannel = supabase
      .channel('call_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_logs' },
        () => fetchMissedCallsCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
    };
  }, [user]);

  const handleArchive = async (e: React.MouseEvent, chatId: string, currentStatus: boolean) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .update({ is_archived: !currentStatus })
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchChats(); // Refresh list
    } catch (error) {
      console.error("Error archiving chat:", error);
      alert("Could not archive chat");
    }
  };

  const handlePin = async (e: React.MouseEvent, chatId: string, currentStatus: boolean) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .update({ is_pinned: !currentStatus })
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchChats(); // Refresh list
    } catch (error) {
      console.error("Error pinning chat:", error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete/leave this chat?")) return;
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchChats();
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Could not delete chat");
    }
  };

  const [editingChat, setEditingChat] = useState<{ id: string, name: string } | null>(null);
  const [newName, setNewName] = useState('');

  const handleEdit = (e: React.MouseEvent, chat: ChatPreview) => {
    e.stopPropagation();
    if (!chat.isGroup) {
      alert("You can only rename group chats.");
      return;
    }
    setEditingChat({ id: chat.id, name: chat.name });
    setNewName(chat.name);
  };

  const saveRename = async () => {
    if (!editingChat || !newName.trim()) return;
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chats')
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq('id', editingChat.id);

      if (error) throw error;

      setEditingChat(null);
      fetchChats();
    } catch (error) {
      console.error("Error renaming chat:", error);
      alert("Could not rename chat");
    }
  };

  const filteredChats = chats.filter(chat => {
    const matchesFilter = (chat.name || '').toLowerCase().includes((filter || '').toLowerCase());

    // Status Logic
    let matchesTab = false;
    if (activeTab === 'requests') {
      matchesTab = chat.status === 'pending';
    } else if (activeTab === 'archived') {
      matchesTab = !!chat.isArchived;
    } else {
      // 'all' shows active, accepted chats
      matchesTab = !chat.isArchived && chat.status !== 'pending' && chat.status !== 'blocked' && chat.status !== 'rejected';
    }

    return matchesFilter && matchesTab;
  }).sort((a, b) => {
    // Sort: Pinned first, then by date 
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0; // Existing order preserved (created_at desc)
  });

  const handlePinSubmit = async (pin: string) => {
    // 1. Create PIN Flow
    if (pinModal.mode === 'create') {
      const { error } = await supabase.from('profiles').update({ chat_lock_pin: pin }).eq('id', user!.id);
      if (error) {
        alert("Failed to create PIN");
        return;
      }
      setUserPin(pin);

      if (pinModal.chatId && pinModal.action === 'toggleLock') {
        toggleChatLock(pinModal.chatId, false); // Current status was false
      }
      setPinModal({ isOpen: false, mode: 'enter' });
      return;
    }

    // 2. Verify PIN Flow (Enter/Confirm)
    if (pin !== userPin) {
      alert("Incorrect PIN");
      return;
    }

    // PIN Correct
    if (pinModal.action === 'open' && pinModal.chatId) {
      navigate(`/chat/${pinModal.chatId}`);
    } else if (pinModal.action === 'toggleLock' && pinModal.chatId) {
      const chat = chats.find(c => c.id === pinModal.chatId);
      if (chat) toggleChatLock(chat.id, chat.isLocked || false);
    }
    setPinModal({ isOpen: false, mode: 'enter' });
  };

  const toggleChatLock = async (chatId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('chat_participants')
      .update({ is_locked: !currentStatus })
      .eq('chat_id', chatId)
      .eq('user_id', user!.id);

    if (error) alert("Failed to update lock status");
    else fetchChats();
  };

  // Long Press Logic
  const longPressTimer = useRef<any>(null);
  const isLongPress = useRef(false);
  const [contextMenuChat, setContextMenuChat] = useState<ChatPreview | null>(null);

  const startPress = (chat: ChatPreview) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setContextMenuChat(chat);
    }, 500);
  };

  const cancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleChatClick = (chat: ChatPreview) => {
    if (isLongPress.current) return;

    if (chat.isLocked) {
      setPinModal({ isOpen: true, mode: 'enter', chatId: chat.id, action: 'open' });
    } else {
      navigate(`/chat/${chat.id}`);
    }
  };

  const initiateLockAction = (chat: ChatPreview) => {
    if (!userPin) {
      setPinModal({ isOpen: true, mode: 'create', chatId: chat.id, action: 'toggleLock' });
    } else {
      setPinModal({ isOpen: true, mode: 'enter', chatId: chat.id, action: 'toggleLock' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors relative">
      {/* Header / Search */}
      <div className="p-4 bg-white dark:bg-gray-900 sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold tracking-tight dark:text-white">
              Chats
            </h2>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full text-sm">
            <button
              onClick={() => handleTabChange('all')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all", activeTab === 'all' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              All
            </button>
            <button
              onClick={() => handleTabChange('calls')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all relative", activeTab === 'calls' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              Calls
              {missedCallsCount > 0 && (
                <span className="ml-2 bg-[#ff1744] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                  {missedCallsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('requests')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all", activeTab === 'requests' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              Requests
              {chats.filter(c => c.status === 'pending' && (!c.createdAt || c.createdAt > lastViewedRequests)).length > 0 && (
                <span className="ml-2 bg-[#ff1744] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                  {chats.filter(c => c.status === 'pending' && (!c.createdAt || c.createdAt > lastViewedRequests)).length}
                </span>
              )}
            </button>

          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search chats..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border-none focus:ring-1 focus:ring-[#ff1744] outline-none text-sm font-medium transition-all text-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto select-none" onScroll={cancelPress}>
        {loading ? (
          <div className="flex py-12 justify-center">
            <Loader2 className="animate-spin text-gray-300" />
          </div>
        ) : activeTab === 'calls' ? (
          <div className="flex flex-col">
            {callLogs.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No recent calls</div>
            ) : (
              callLogs.map(log => {
                const isOutgoing = log.caller_id === user?.id;
                const isMissed = log.status === 'missed' && !isOutgoing;
                return (
                  <div key={log.id} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-4 overflow-hidden">
                      {log.caller?.avatar_url ? <img src={log.caller.avatar_url} className="w-full h-full object-cover" /> : <Phone size={20} />}
                    </div>
                    <div className="flex-1">
                      <h3 className={cn("font-medium", isMissed ? "text-red-500" : "text-gray-900 dark:text-white")}>
                        {log.caller?.full_name || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {isOutgoing ? <ArrowUpRight size={14} className="text-green-500" /> : <ArrowDownLeft size={14} className={isMissed ? "text-red-500" : "text-blue-500"} />}
                        <span>{isOutgoing ? 'Outgoing' : 'Incoming'}</span>
                        <span>•</span>
                        <span>{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <Phone size={20} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              onMouseDown={() => startPress(chat)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={() => startPress(chat)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              className="group relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-colors cursor-pointer border-b border-gray-50 dark:border-gray-800"
            >
              <div className="relative mr-4">
                <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-500 dark:text-gray-300 overflow-hidden">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                  ) : (
                    (chat.name || '?')[0]
                  )}
                </div>
                {chat.isLocked && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-[1px]">
                    <Lock size={16} className="text-white" />
                  </div>
                )}
                {chat.isOnline && !chat.isLocked && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">{chat.name}</h3>
                  <span className={cn("text-xs whitespace-nowrap flex items-center gap-1", chat.unread > 0 ? "text-[#ff1744] font-bold" : "text-gray-400")}>
                    {chat.isPinned && <span className="text-[10px]">📌</span>}
                    {chat.time}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={cn("text-sm truncate pr-2", (chat.unread > 0 || chat.isLocked) ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-gray-400")}>
                    {chat.status === 'pending' ? 'Message Request' : chat.lastMessage}
                  </p>

                  {/* Unread Count / Status */}
                  {chat.unread > 0 ? (
                    <div className="w-5 h-5 bg-[#ff1744] rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">{chat.unread}</span>
                    </div>
                  ) : (
                    <div className="opacity-0">
                      <CheckCheck size={16} className="text-blue-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>
              {activeTab === 'all' ? "No active chats." :
                activeTab === 'requests' ? "No message requests." :
                  "No archived chats."}
            </p>
          </div>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenuChat && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setContextMenuChat(null)} />
          <div className="fixed bottom-0 sm:bottom-4 sm:left-4 sm:right-4 z-[70] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-full duration-200 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {contextMenuChat.avatar ? <img src={contextMenuChat.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">{(contextMenuChat.name || '?')[0]}</div>}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg dark:text-white">{contextMenuChat.name}</h3>
                <p className="text-xs text-gray-500">{contextMenuChat.isGroup ? 'Group Chat' : 'Personal Chat'}</p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Lock Button */}
              <button
                onClick={() => {
                  initiateLockAction(contextMenuChat);
                  setContextMenuChat(null);
                }}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left font-medium dark:text-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 flex items-center justify-center">
                  <Lock size={20} className={contextMenuChat.isLocked ? "text-[#ff1744]" : ""} />
                </div>
                {contextMenuChat.isLocked ? 'Unlock Chat' : 'Lock Chat'}
              </button>

              <button
                onClick={(e) => {
                  handlePin(e, contextMenuChat.id, contextMenuChat.isPinned || false);
                  setContextMenuChat(null);
                }}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left font-medium dark:text-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <span className="text-lg">📌</span>
                </div>
                {contextMenuChat.isPinned ? 'Unpin Chat' : 'Pin Chat'}
              </button>

              <button
                onClick={(e) => {
                  handleArchive(e, contextMenuChat.id, contextMenuChat.isArchived || false);
                  setContextMenuChat(null);
                }}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left font-medium dark:text-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                  <Archive size={20} />
                </div>
                {contextMenuChat.isArchived ? 'Unarchive Chat' : 'Archive Chat'}
              </button>

              <button
                onClick={(e) => {
                  handleDelete(e, contextMenuChat.id);
                  setContextMenuChat(null);
                }}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left font-medium text-red-500"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                  <div className="text-lg">🗑️</div>
                </div>
                Delete Chat
              </button>

              {contextMenuChat.isGroup && (
                <button
                  onClick={(e) => {
                    handleEdit(e, contextMenuChat);
                    setContextMenuChat(null);
                  }}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left font-medium dark:text-gray-200"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
                    <Edit size={20} />
                  </div>
                  Rename Group
                </button>
              )}
            </div>

            <button
              onClick={() => setContextMenuChat(null)}
              className="w-full mt-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Rename Modal */}
      {
        editingChat && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-4">Rename Chat</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#ff1744] outline-none mb-4 font-medium"
                placeholder="Enter new name"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingChat(null)}
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRename}
                  disabled={!newName.trim()}
                  className="flex-1 py-3 bg-[#ff1744] text-white font-bold rounded-xl shadow-md hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )
      }

      <PinModal
        isOpen={pinModal.isOpen}
        mode={pinModal.mode}
        onClose={() => setPinModal({ ...pinModal, isOpen: false })}
        onSuccess={handlePinSubmit}
      />

    </div>
  );
};

export default ChatView;
