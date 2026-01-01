import React, { useState, useEffect } from 'react';
import { Search, Edit, Archive, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ChatPreview } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const ChatView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'archived'>('all');

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get all chats where the current user is a participant
      const { data: myChats, error: myChatsError } = await supabase
        .from('chat_participants')
        .select('chat_id, is_archived, is_pinned, status, chats(id, name, is_group)')
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
        .select('chat_id, content, created_at, sender_id')
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

        return {
          id: chatInfo?.id,
          name: name,
          lastMessage: LatestMsg ? LatestMsg.content : 'No messages yet',
          time: LatestMsg ? new Date(LatestMsg.created_at).toLocaleDateString() : '',
          unread: unreadMap[chatInfo.id] || 0, // Use RPC data
          avatar: avatar,
          isOnline: isOnline,
          isArchived: myChat.is_archived,
          isPinned: myChat.is_pinned,
          isGroup: chatInfo?.is_group ?? false,
          status: myChat.status || 'accepted'
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
    fetchChats();
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
    const matchesFilter = chat.name.toLowerCase().includes(filter.toLowerCase());

    // Status Logic
    // If 'requests' -> status must be 'pending'
    // If 'archived' -> isArchived true
    // If 'all' -> status 'accepted' AND isArchived false

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
    // Sort: Pinned first, then by date (implied by array order since we sorted messages, but stricter sort logic here is good)
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0; // Existing order preserved (created_at desc)
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors relative">
      {/* Header / Search */}
      <div className="p-4 bg-white dark:bg-gray-900 sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight dark:text-white">Chats</h2>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full text-sm">
            <button
              onClick={() => setActiveTab('all')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all", activeTab === 'all' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all", activeTab === 'requests' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              Requests
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={cn("px-4 py-1 rounded-full text-xs font-bold transition-all", activeTab === 'archived' ? "bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >
              Archived
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex py-12 justify-center">
            <Loader2 className="animate-spin text-gray-300" />
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="group relative flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-colors cursor-pointer border-b border-gray-50 dark:border-gray-800"
            >
              <div className="relative mr-4">
                <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-500 dark:text-gray-300 overflow-hidden">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                  ) : (
                    chat.name[0]
                  )}
                </div>
                {chat.isOnline && (
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
                  <p className={cn("text-sm truncate pr-2", chat.unread > 0 ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-gray-400")}>
                    {chat.status === 'pending' ? 'Message Request' : chat.lastMessage}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4 bg-white/80 dark:bg-gray-900/80 p-1 rounded-lg backdrop-blur-sm">
                    <button
                      onClick={(e) => handleArchive(e, chat.id, chat.isArchived || false)}
                      className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-full"
                      title={chat.isArchived ? "Unarchive" : "Archive"}
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      onClick={(e) => handlePin(e, chat.id, chat.isPinned || false)}
                      className={cn("p-1.5 rounded-full", chat.isPinned ? "text-[#ff1744] bg-red-50" : "text-gray-500 hover:text-[#ff1744] hover:bg-red-50")}
                      title={chat.isPinned ? "Unpin" : "Pin"}
                    >
                      <div className="rotate-45">📌</div>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, chat.id)}
                      className="p-1 px-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                    >
                      Delete
                    </button>
                  </div>

                  {chat.unread > 0 ? (
                    <div className="w-5 h-5 bg-[#ff1744] rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">{chat.unread}</span>
                    </div>
                  ) : (
                    <div className="group-hover:opacity-0 transition-opacity">
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

      {/* Rename Modal */}
      {editingChat && (
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
      )}

    </div>
  );
};

export default ChatView;
