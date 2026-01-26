import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MessageSquare, Calendar, Link as LinkIcon, Loader2, MoreVertical, Ban, ShieldAlert } from 'lucide-react';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import ImageViewer from '../components/ImageViewer';
import { BadgeIcon } from '../components/BadgeIcon';
import { BadgeType } from '../constants/badges';

interface ProfileData {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    bio: string;
    website: string;
    created_at: string;
    profile_photo_privacy?: 'everyone' | 'contacts' | 'nobody';
    about_privacy?: 'everyone' | 'contacts' | 'nobody';
    badge_type?: BadgeType;
}

const UserProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState<ProfileData & { followers_count: number; following_count: number } | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const [messagingLoading, setMessagingLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Profile
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                // 1.5 Fetch Referral Count
                const { count: referralCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('referred_by', id);

                setProfile({ ...data, referral_count: referralCount || 0 });

                // 2. Check Follow Status (if logged in and not own profile)
                if (currentUser && currentUser.id !== id) {
                    const { data: followData } = await supabase
                        .from('follows')
                        .select('follower_id')
                        .eq('follower_id', currentUser.id)
                        .eq('following_id', id)
                        .maybeSingle();

                    setIsFollowing(!!followData);

                    // Check Block Status
                    const { data: blockData } = await supabase
                        .from('blocked_users')
                        .select('id')
                        .eq('blocker_id', currentUser.id)
                        .eq('blocked_id', id)
                        .maybeSingle();

                    setIsBlocked(!!blockData);
                }

                // 3. Fetch Posts
                const { data: postsData, error: postsError } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false });

                if (postsError) throw postsError;

                const formattedPosts: Post[] = postsData.map((item: any) => ({
                    id: item.id,
                    author: {
                        id: data.id,
                        name: data.full_name,
                        username: data.username,
                        avatar: data.avatar_url,
                        isVerified: false,
                        badge_type: data.badge_type,
                    },
                    content: item.content,
                    timestamp: new Date(item.created_at).toLocaleDateString(),
                    likes: item.likes_count || 0,
                    comments: item.comments_count || 0,
                    reposts: item.reposts_count || 0,
                    media: item.media_url,
                    media_type: item.media_type
                }));
                setPosts(formattedPosts);

            } catch (error) {
                console.error("Error fetching user profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [id, currentUser]);

    const handleFollowToggle = async () => {
        if (!currentUser || !id || followLoading) return;
        setFollowLoading(true);

        const isNowFollowing = !isFollowing;
        // Optimistic UI Update
        setIsFollowing(isNowFollowing);
        setProfile(prev => prev ? ({
            ...prev,
            followers_count: prev.followers_count + (isNowFollowing ? 1 : -1)
        }) : null);

        try {
            if (isNowFollowing) {
                // Follow
                const { error } = await supabase
                    .from('follows')
                    .insert({ follower_id: currentUser.id, following_id: id });
                if (error) throw error;
            } else {
                // Unfollow
                const { error } = await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', currentUser.id)
                    .eq('following_id', id);
                if (error) throw error;
            }
        } catch (error) {
            console.error("Error updating follow status:", error);
            // Revert changes on error
            setIsFollowing(!isNowFollowing);
            setProfile(prev => prev ? ({
                ...prev,
                followers_count: prev.followers_count + (isNowFollowing ? -1 : 1)
            }) : null);
            alert("Failed to update follow status.");
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!currentUser || !id) return;
        setMessagingLoading(true);
        try {
            const { data: chatId, error: rpcError } = await supabase
                .rpc('create_direct_chat', { other_user_id: id });

            if (rpcError) throw rpcError;
            navigate(`/chat/${chatId}`);
        } catch (error: any) {
            console.error("Error starting chat:", error);
            alert(`Could not start chat: ${error.message || JSON.stringify(error)}`);
        } finally {
            setMessagingLoading(false);
        }
    };

    const handleBlockToggle = async () => {
        if (!currentUser || !id) return;
        if (!confirm(`Are you sure you want to ${isBlocked ? 'unblock' : 'block'} this user?`)) return;

        try {
            if (isBlocked) {
                // Unblock
                const { error } = await supabase
                    .from('blocked_users')
                    .delete()
                    .eq('blocker_id', currentUser.id)
                    .eq('blocked_id', id);
                if (error) throw error;
                setIsBlocked(false);
                alert("User unblocked");
            } else {
                // Block
                const { error } = await supabase
                    .from('blocked_users')
                    .insert({ blocker_id: currentUser.id, blocked_id: id });
                if (error) throw error;
                setIsBlocked(true);
                alert("User blocked");
            }
            setShowMenu(false);
        } catch (error) {
            console.error("Error updating block status", error);
            alert("Failed to update block status");
        }
    };

    const isOwnProfile = currentUser?.id === profile?.id;
    const showAvatar = isOwnProfile ||
        profile?.profile_photo_privacy === 'everyone' ||
        (profile?.profile_photo_privacy === 'contacts' && isFollowing); // Assuming following = contact

    const showBio = isOwnProfile ||
        profile?.about_privacy === 'everyone' ||
        (profile?.about_privacy === 'contacts' && isFollowing);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>;
    if (!profile) return <div>User not found</div>;

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-black">
            {/* Header */}
            <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-500 relative">
                <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full text-white backdrop-blur-sm hover:bg-black/30 transition-colors z-10">
                    <ArrowLeft size={20} />
                </button>
                {!isOwnProfile && currentUser && (
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 bg-black/20 rounded-full text-white backdrop-blur-sm hover:bg-black/30 transition-colors"
                        >
                            <MoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={handleBlockToggle}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 text-sm text-red-600 dark:text-red-400"
                                >
                                    {isBlocked ? <ShieldAlert size={16} /> : <Ban size={16} />}
                                    {isBlocked ? "Unblock User" : "Block User"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="px-4 pb-4 relative">
                <div className="flex justify-between items-end mt-4 mb-4">
                    <button
                        onClick={() => profile.avatar_url && setPreviewImage(profile.avatar_url)}
                        className={`relative rounded-full ${profile.avatar_url ? 'cursor-pointer' : 'cursor-default'}`}
                        disabled={!profile.avatar_url}
                    >
                        <img
                            src={showAvatar
                                ? (profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}&background=random`)
                                : `https://ui-avatars.com/api/?name=${profile.full_name?.charAt(0) || 'U'}&background=random`}
                            alt="Profile"
                            className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-sm bg-white hover:opacity-90 transition-opacity"
                        />
                        {profile.badge_type && (
                            <div className="absolute bottom-1 right-1 z-10">
                                <BadgeIcon type={profile.badge_type} size={20} className="p-0.5" />
                            </div>
                        )}
                    </button>
                    <div className="flex gap-2">
                        {isOwnProfile ? (
                            <button onClick={() => navigate('/edit-profile')} className="px-4 py-1.5 border border-gray-300 rounded-full font-bold text-sm hover:bg-gray-50">
                                Edit Profile
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleMessage}
                                    disabled={messagingLoading}
                                    className="p-2 border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                                >
                                    {messagingLoading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={18} />}
                                </button>
                                <button
                                    onClick={handleFollowToggle}
                                    disabled={followLoading}
                                    className={`px-6 py-1.5 rounded-full font-bold text-sm flex items-center justify-center min-w-[100px] transition-all
                                        ${isFollowing
                                            ? "bg-white border border-gray-300 text-gray-900 hover:bg-gray-50"
                                            : "bg-gray-900 text-white hover:bg-gray-800"
                                        }`}
                                >
                                    {followLoading ? <Loader2 size={14} className="animate-spin" /> : (isFollowing ? "Following" : "Follow")}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-1">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.full_name}</h1>
                    </div>
                    <p className="text-gray-500 text-sm mb-3">@{profile.username}</p>
                    <p className="text-gray-900 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                        {showBio ? (profile.bio || "No bio yet.") : <span className="text-gray-400 italic">Bio hidden</span>}
                    </p>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-900 dark:text-white">{profile.following_count || 0}</span>
                            <span className="text-gray-500 text-sm">Following</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-900 dark:text-white">{profile.followers_count || 0}</span>
                            <span className="text-gray-500 text-sm">Followers</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1"><Calendar size={16} /> Joined {new Date(profile.created_at).toLocaleDateString()}</div>
                        {profile.website && (() => {
                            try {
                                const url = new URL(profile.website.includes('://') ? profile.website : `https://${profile.website}`);
                                return (
                                    <div className="flex items-center gap-1">
                                        <LinkIcon size={16} />
                                        <a href={url.toString()} target="_blank" rel="noopener noreferrer" className="text-[#ff1744] hover:underline">
                                            {url.hostname}
                                        </a>
                                    </div>
                                );
                            } catch {
                                return (
                                    <div className="flex items-center gap-1">
                                        <LinkIcon size={16} />
                                        <span className="text-gray-500">{profile.website}</span>
                                    </div>
                                );
                            }
                        })()}
                    </div>

                    {/* Referral Points Card (Only Visible to Owner) */}
                    {isOwnProfile && (
                        <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="text-yellow-500">✨</span> VoxPoints
                                </h3>
                                <div className="text-2xl font-black text-[#ff1744]">
                                    {(profile as any).referral_count ? (profile as any).referral_count * 50 : 0}
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-4">
                                You have referred {(profile as any).referral_count || 0} friends. Keep inviting to unlock badges!
                            </p>

                            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-xl border border-dashed border-gray-300">
                                <code className="flex-1 font-mono font-bold text-center text-gray-700 dark:text-gray-300">
                                    {(profile as any).referral_code || 'NO CODE'}
                                </code>
                                <button
                                    onClick={() => {
                                        if ((profile as any).referral_code) {
                                            navigator.clipboard.writeText((profile as any).referral_code);
                                            alert("Code copied!");
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800">
                {posts.map(post => <PostCard key={post.id} post={post} />)}
                {posts.length === 0 && <div className="p-8 text-center text-gray-400">No posts yet</div>}
            </div>

            <ImageViewer
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                src={previewImage || ''}
            />
        </div>
    );
};

export default UserProfile;
