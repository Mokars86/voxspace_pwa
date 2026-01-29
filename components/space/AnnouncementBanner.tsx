import React, { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { SpaceAnnouncement } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface AnnouncementBannerProps {
    spaceId: string;
    isOwner: boolean;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ spaceId, isOwner }) => {
    const { user } = useAuth(); // Use hook
    const [isCreating, setIsCreating] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [announcement, setAnnouncement] = useState<SpaceAnnouncement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnnouncement();

        const channel = supabase
            .channel(`announcements:${spaceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'space_announcements', filter: `space_id=eq.${spaceId}` }, () => {
                fetchAnnouncement();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [spaceId]);

    const fetchAnnouncement = async () => {
        const { data } = await supabase
            .from('space_announcements')
            .select('*')
            .eq('space_id', spaceId)
            .gt('active_until', new Date().toISOString()) // Only active ones
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        setAnnouncement(data || null);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newContent.trim() || !user) return;

        // Default 7 days expiry
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        try {
            console.log("Attempting to create announcement:", { spaceId, content: newContent, user: user.id });
            const { data, error } = await supabase
                .from('space_announcements')
                .insert({
                    space_id: spaceId,
                    content: newContent,
                    active_until: nextWeek.toISOString(),
                    created_by: user.id
                })
                .select()
                .single();

            if (error) {
                console.error("Supabase error creating announcement:", error);
                throw error;
            }

            console.log("Announcement created:", data);
            setAnnouncement(data);
            setIsCreating(false);
            setNewContent('');
        } catch (error: any) {
            console.error("Catch error:", error);
            alert(`Failed to post announcement: ${error.message || error.details || "Check console"}`);
        }
    };

    const handleClear = async () => {
        if (!announcement) return;
        // Logic to "dismiss" or "deactivate" (requires update)
        await supabase
            .from('space_announcements')
            .update({ active_until: new Date().toISOString() }) // Expire immediately
            .eq('id', announcement.id);
        setAnnouncement(null);
    };

    if (loading) return null;

    if (!announcement) {
        if (!isOwner) return null; // Regular members see nothing

        // Owner sees "Create" placeholder or input
        return (
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3 px-4 shadow-md relative z-10 transition-all">
                {isCreating ? (
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-full">
                            <Megaphone size={20} fill="currentColor" />
                        </div>
                        <input
                            autoFocus
                            className="flex-1 bg-white/10 border-b border-white/50 text-white placeholder-white/70 outline-none px-2 py-1 text-sm font-medium"
                            placeholder="Type announcement..."
                            value={newContent}
                            onChange={e => setNewContent(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        <button onClick={handleCreate} className="text-xs font-bold bg-white text-orange-600 px-3 py-1 rounded-full shadow-sm hover:bg-gray-100">
                            Post
                        </button>
                        <button onClick={() => setIsCreating(false)} className="p-1 hover:bg-white/20 rounded-full">
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-3 w-full text-left hover:bg-white/10 p-1 rounded-lg transition-colors"
                    >
                        <div className="bg-white/20 p-2 rounded-full opacity-70">
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-sm uppercase tracking-wider opacity-80">Announcement</p>
                            <p className="font-medium text-sm md:text-base opacity-90 italic">Tap to add an announcement...</p>
                        </div>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3 px-4 flex items-center justify-between shadow-md relative z-10 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full animate-pulse">
                    <Megaphone size={20} fill="currentColor" />
                </div>
                <div>
                    <p className="font-bold text-sm uppercase tracking-wider opacity-80">Announcement</p>
                    <p className="font-medium text-sm md:text-base">{announcement.content}</p>
                </div>
            </div>
            {isOwner && (
                <button onClick={handleClear} className="p-1 hover:bg-white/20 rounded-full transition-colors ml-4" title="Remove Announcement">
                    <X size={18} />
                </button>
            )}
        </div>
    );
};

export default AnnouncementBanner;
