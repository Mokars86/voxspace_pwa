import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Search, UserX, Loader2 } from 'lucide-react';

interface BlockedUser {
    id: string; // This is the ID of the blocked record
    blocked_id: string; // The ID of the user who is blocked
    created_at: string;
    blocked_profile: {
        id: string;
        full_name: string;
        username: string;
        avatar_url: string;
    };
}

const BlockedUsers: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchBlockedUsers();
        }
    }, [user]);

    const fetchBlockedUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blocked_users')
                .select(`
                    id,
                    blocked_id,
                    created_at,
                    blocked_profile:blocked_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                `)
                .eq('blocker_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to ensure type safety if needed, or cast
            setBlockedUsers(data as any);
        } catch (error) {
            console.error("Error fetching blocked users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (blockedRecordId: string, blockedUserId: string) => {
        if (!confirm("Are you sure you want to unblock this user?")) return;

        setUnblockingId(blockedRecordId);
        try {
            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('id', blockedRecordId);

            if (error) throw error;

            // Remove from local state
            setBlockedUsers(prev => prev.filter(user => user.id !== blockedRecordId));
        } catch (error) {
            console.error("Error unblocking user:", error);
            alert("Failed to unblock user");
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5] dark:bg-black">
            <header className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10">
                <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Blocked Users</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{blockedUsers.length} blocked</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : blockedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <UserX size={48} className="mb-4 opacity-50" />
                        <p>No blocked users</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                        {blockedUsers.map((item) => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <div className="flex items-center gap-3" onClick={() => navigate(`/user/${item.blocked_profile.id}`)}>
                                    <img
                                        src={item.blocked_profile.avatar_url || `https://ui-avatars.com/api/?name=${item.blocked_profile.full_name}&background=random`}
                                        className="w-10 h-10 rounded-full object-cover bg-gray-200"
                                        alt={item.blocked_profile.full_name}
                                    />
                                    <div>
                                        <h3 className="font-medium text-gray-900 dark:text-white">{item.blocked_profile.full_name}</h3>
                                        <p className="text-xs text-gray-500">@{item.blocked_profile.username}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnblock(item.id, item.blocked_id)}
                                    disabled={unblockingId === item.id}
                                    className="px-4 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                                >
                                    {unblockingId === item.id ? 'Unblocking...' : 'Unblock'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center mt-6 px-8">
                    Blocked users will not be able to send you messages or execute calls. They will not know they are blocked.
                </p>
            </div>
        </div>
    );
};

export default BlockedUsers;
