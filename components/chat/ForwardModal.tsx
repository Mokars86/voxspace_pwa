import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

interface ForwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (targetChatIds: string[]) => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, onClose, onSend }) => {
    const { user } = useAuth();
    const [chats, setChats] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !user) return;

        const fetchChats = async () => {
            setLoading(true);
            try {
                // Fetch chats I'm in
                const { data, error } = await supabase
                    .from('chat_participants')
                    .select(`
                        chat:chats (
                            id,
                            name,
                            is_group
                        )
                    `)
                    .eq('user_id', user.id);

                if (error) throw error;

                // Flatten and dedupe
                const fetchedChats = data.map((d: any) => d.chat).filter(Boolean);

                // For direct chats, we might want to fetch the other person's name, 
                // but for speed we'll stick to 'name' or 'Chat' for now. 
                // A production app would fetch profile names here.
                setChats(fetchedChats);
            } catch (err) {
                console.error("Failed to load chats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchChats();
    }, [isOpen, user]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSend = () => {
        if (selectedIds.size > 0) {
            onSend(Array.from(selectedIds));
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-lg">Forward to...</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="text-center p-4 text-gray-500">Loading chats...</div>
                    ) : (
                        <div className="space-y-1">
                            {chats.map(chat => (
                                <div
                                    key={chat.id}
                                    onClick={() => toggleSelection(chat.id)}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">
                                            {chat.name?.[0] || '?'}
                                        </div>
                                        <span className="font-medium">{chat.name || 'Untitled Chat'}</span>
                                    </div>
                                    {selectedIds.has(chat.id) ? (
                                        <CheckCircle2 className="text-[#ff1744]" />
                                    ) : (
                                        <Circle className="text-gray-300" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={handleSend}
                        disabled={selectedIds.size === 0}
                        className="w-full bg-[#ff1744] text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    >
                        Send {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
