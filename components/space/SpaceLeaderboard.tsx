import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { SpaceMember } from '../../types';
import { Medal, Crown, Shield } from 'lucide-react';

interface SpaceLeaderboardProps {
    spaceId: string;
}

const SpaceLeaderboard: React.FC<SpaceLeaderboardProps> = ({ spaceId }) => {
    const [members, setMembers] = useState<SpaceMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTopMembers();
    }, [spaceId]);

    const fetchTopMembers = async () => {
        // In a real app, this would be an RPC call like 'get_space_leaderboard'
        // For now, we fetch members and prioritize owners/mods
        const { data } = await supabase
            .from('space_members')
            .select(`*, profile:user_id(full_name, username, avatar_url)`)
            .eq('space_id', spaceId)
            .order('joined_at', { ascending: true }) // Earliest members first as proxy for 'top'
            .limit(10);

        // Custom sort to put Owner > Moderator > Member locally
        const sorted = (data || []).sort((a: any, b: any) => {
            const roleScore = { owner: 3, moderator: 2, member: 1 };
            return (roleScore[b.role as 'owner'] || 0) - (roleScore[a.role as 'owner'] || 0);
        });

        setMembers(sorted);
        setLoading(false);
    };

    const getRoleIcon = (role: string, rank: number) => {
        if (role === 'owner') return <Crown size={16} className="text-yellow-500 fill-yellow-500" />;
        if (role === 'moderator') return <Shield size={16} className="text-blue-500 fill-blue-500" />;
        if (rank === 0) return <Medal size={16} className="text-yellow-400" />;
        if (rank === 1) return <Medal size={16} className="text-gray-400" />;
        if (rank === 2) return <Medal size={16} className="text-amber-700" />;
        return <span className="text-xs font-bold text-gray-400">#{rank + 1}</span>;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
                <Medal size={16} /> Top Contributors
            </h3>

            <div className="space-y-3">
                {members.map((member, idx) => (
                    <div key={member.user_id} className="flex items-center gap-3">
                        <div className="w-6 flex justify-center">
                            {getRoleIcon(member.role, idx)}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border-2 border-transparent hover:border-[#ff1744] transition-colors">
                            <img src={member.profile?.avatar_url || `https://ui-avatars.com/api/?name=${member.profile?.full_name}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate dark:text-white flex items-center gap-1">
                                {member.profile?.full_name}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SpaceLeaderboard;
