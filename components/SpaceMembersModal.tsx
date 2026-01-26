import React, { useState, useEffect } from 'react';
import { X, Search, Trash2, Shield, User, Check, Ban, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import ImageViewer from './ImageViewer';
import { cn } from '../lib/utils';

interface SpaceMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    spaceId: string;
    isOwner: boolean;
}

const SpaceMembersModal: React.FC<SpaceMembersModalProps> = ({ isOpen, onClose, spaceId, isOwner }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');
    const [allMembers, setAllMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [countRequests, setCountRequests] = useState(0);

    // Current user's role in this space
    const [myRole, setMyRole] = useState<'admin' | 'co_admin' | 'member'>('member');

    useEffect(() => {
        if (isOpen) {
            fetchMembers();
        }
    }, [isOpen, spaceId]);

    const fetchMembers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch current user's role first
            const { data: myData } = await supabase
                .from('space_members')
                .select('role')
                .eq('space_id', spaceId)
                .eq('user_id', user.id)
                .single();

            if (myData) setMyRole(myData.role || 'member');
            if (isOwner) setMyRole('admin'); // Verify owner override

            const { data, error } = await supabase
                .from('space_members')
                .select(`
                    joined_at,
                    status,
                    role,
                    profiles:user_id (
                        id,
                        full_name,
                        username,
                        avatar_url,
                        is_verified
                    )
                `)
                .eq('space_id', spaceId)
                .order('joined_at', { ascending: false });

            if (error) throw error;

            // Flatten
            const formatted = data.map((item: any) => ({
                ...item.profiles,
                joined_at: item.joined_at,
                status: item.status || 'approved', // fallback
                role: item.role || 'member'
            }));

            setAllMembers(formatted);
            setCountRequests(formatted.filter((m: any) => m.status === 'pending').length);

        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (memberId: string, action: 'approve' | 'reject' | 'remove' | 'promote' | 'demote') => {
        if (action === 'remove' && !confirm("Remove this member?")) return;
        if (action === 'reject' && !confirm("Reject this request?")) return;

        try {
            let update = {};
            if (action === 'approve') update = { status: 'approved' };
            if (action === 'promote') update = { role: 'co_admin' };
            if (action === 'demote') update = { role: 'member' };

            if (action === 'remove' || action === 'reject') {
                await supabase
                    .from('space_members')
                    .delete()
                    .eq('space_id', spaceId)
                    .eq('user_id', memberId);

                setAllMembers(prev => prev.filter(m => m.id !== memberId));
            } else {
                await supabase
                    .from('space_members')
                    .update(update)
                    .eq('space_id', spaceId)
                    .eq('user_id', memberId);

                setAllMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...update } : m));
            }

            // Update counts
            if (action === 'approve' || action === 'reject') {
                setCountRequests(prev => Math.max(0, prev - 1));
            }

        } catch (error) {
            console.error(`Error performing ${action}:`, error);
            alert("Action failed.");
        }
    };

    const hasAdminRights = isOwner || myRole === 'admin' || myRole === 'co_admin';

    const getFilteredList = () => {
        let list = activeTab === 'requests'
            ? allMembers.filter(m => m.status === 'pending')
            : allMembers.filter(m => m.status === 'approved');

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(m =>
                (m.full_name || '').toLowerCase().includes(q) ||
                (m.username || '').toLowerCase().includes(q)
            );
        }
        return list;
    };

    if (!isOpen) return null;

    const displayList = getFilteredList();

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg dark:text-white">Space Members</h3>
                        <p className="text-xs text-gray-500">{allMembers.filter(m => m.status === 'approved').length} members</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs (Only if Admin) */}
                {hasAdminRights && (
                    <div className="flex border-b border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setActiveTab('members')}
                            className={cn(
                                "flex-1 py-3 text-sm font-bold transition-colors",
                                activeTab === 'members' ? "text-[#ff1744] border-b-2 border-[#ff1744]" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                            )}
                        >
                            Members
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={cn(
                                "flex-1 py-3 text-sm font-bold transition-colors relative",
                                activeTab === 'requests' ? "text-[#ff1744] border-b-2 border-[#ff1744]" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                            )}
                        >
                            Requests
                            {countRequests > 0 && (
                                <span className="absolute top-2 right-8 bg-[#ff1744] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                    {countRequests}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Search */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-[#ff1744] text-sm dark:text-white"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400">Loading...</div>
                    ) : displayList.length > 0 ? (
                        <div className="space-y-1">
                            {displayList.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setPreviewImage(member.avatar_url)}
                                            disabled={!member.avatar_url}
                                            className={`w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden transition-transform hover:scale-105 ${member.avatar_url ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#ff1744]' : ''}`}
                                        >
                                            {member.avatar_url ? (
                                                <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                                                    {member.username?.[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{member.full_name}</span>
                                                {member.role === 'admin' && <ShieldAlert size={14} className="text-[#ff1744]" />}
                                                {member.role === 'co_admin' && <Shield size={14} className="text-blue-500" />}
                                                {activeTab === 'requests' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded ms-2">Pending</span>}
                                            </div>
                                            <span className="text-xs text-gray-500">@{member.username}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        {/* REQUESTS ACTIONS */}
                                        {activeTab === 'requests' && hasAdminRights && (
                                            <>
                                                <button
                                                    onClick={() => handleAction(member.id, 'approve')}
                                                    className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors"
                                                    title="Approve"
                                                >
                                                    <Check size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleAction(member.id, 'reject')}
                                                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                                                    title="Reject"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </>
                                        )}

                                        {/* MEMBERS ACTIONS */}
                                        {activeTab === 'members' && hasAdminRights && member.id !== user?.id && member.role !== 'admin' && (
                                            <>
                                                {/* Only Owner/Admin can promote/demote */}
                                                {(myRole === 'admin' || (myRole === 'co_admin' && member.role === 'member')) && (
                                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                        {member.role === 'member' ? (
                                                            <button
                                                                onClick={() => handleAction(member.id, 'promote')}
                                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
                                                                title="Promote to Co-Admin"
                                                            >
                                                                <Shield size={18} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAction(member.id, 'demote')}
                                                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"
                                                                title="Remove Co-Admin"
                                                            >
                                                                <User size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAction(member.id, 'remove')}
                                                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-full"
                                                            title="Remove from Space"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            {activeTab === 'requests' ? 'No pending requests.' : 'No members found.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Preview */}
            <ImageViewer
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                src={previewImage || ''}
            />
        </div>
    );
};

export default SpaceMembersModal;
