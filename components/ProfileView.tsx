import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Calendar, Settings, Grid, Image, Heart, Loader2, QrCode, Archive, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import PostCard from './PostCard';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import ImageViewer from './ImageViewer';
import QRCodeModal from './QRCodeModal';
import { BadgeIcon } from './BadgeIcon';
import { BadgeType } from '../src/constants/badges';

interface ProfileData {
  full_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  website: string;
  is_verified: boolean;
  created_at: string;
  followers_count: number;
  following_count: number;
  badge_type?: BadgeType;
  referral_count?: number;
  referral_code?: string;
}

const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'posts' | 'media' | 'likes'>('posts');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      setLoading(true);

      try {
        // Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();


        // If no profile exists, profileData is null.
        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        // Fetch Referral Count
        const { count: referralCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('referred_by', user.id);

        setProfile({ ...profileData, referral_count: referralCount || 0 });

        // Fetch User Posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;

        const formattedPosts: Post[] = postsData.map((item: any) => ({
          id: item.id,
          author: {
            id: user.id,
            name: profileData?.full_name || 'User',
            username: profileData?.username || 'user',
            avatar: profileData?.avatar_url,
            isVerified: profileData?.is_verified,
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

        // Fetch Liked Posts
        const { data: likedData, error: likedError } = await supabase
          .from('post_likes')
          .select('post_id') // Only need IDs
          .eq('user_id', user.id);

        if (likedError) console.error('Error fetching liked posts:', likedError);

        if (!likedError && likedData) {
          const likedPostIds = likedData.map(l => l.post_id);
          console.log('DEBUG: Liked post IDs', likedPostIds);

          if (likedPostIds.length > 0) {
            console.log('DEBUG: Fetching details for liked posts...');
            const { data: likedPostsDetails, error: lpError } = await supabase
              .from('posts')
              .select('*, profiles!inner(*)') // Inner join to ensure author exists
              .in('id', likedPostIds)
              .order('created_at', { ascending: false });

            if (!lpError && likedPostsDetails) {
              const formattedLikedPosts: Post[] = likedPostsDetails.map((item: any) => {
                // SAFEGUARD for profiles
                const authorProfile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;

                return {
                  id: item.id,
                  author: {
                    id: authorProfile?.id,
                    name: authorProfile?.full_name,
                    username: authorProfile?.username,
                    avatar: authorProfile?.avatar_url,
                    isVerified: authorProfile?.is_verified,
                    badge_type: authorProfile?.badge_type
                  },
                  content: item.content,
                  timestamp: new Date(item.created_at).toLocaleDateString(),
                  likes: item.likes_count || 0,
                  comments: item.comments_count || 0,
                  reposts: item.reposts_count,
                  media: item.media_url,
                  media_type: item.media_type,
                  isLiked: true
                };
              });
              setLikedPosts(formattedLikedPosts);
            }
          }
        }


      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>;
  }

  // Default mock data if profile is technically "empty" / null from DB
  const displayProfile = profile || {
    full_name: user?.user_metadata?.full_name || 'New User',
    username: 'newuser',
    avatar_url: '',
    bio: 'Ready to set up your profile!',
    website: '',
    is_verified: false,
    created_at: new Date().toISOString(),
    referral_count: 0,
    referral_code: ''
  };

  const mediaPosts = posts.filter(p => p.media);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors">
      {/* Header/Cover */}
      <div className="h-32 bg-gradient-to-r from-pink-500 to-orange-500 relative">
        <button onClick={() => navigate('/settings')} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white backdrop-blur-sm hover:bg-black/30 transition-colors">
          <Settings size={20} />
        </button>
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 relative">
        <div className="flex justify-between items-end -mt-10 mb-4">
          <button
            onClick={() => displayProfile.avatar_url && setPreviewImage(displayProfile.avatar_url)}
            className={`relative rounded-full ${displayProfile.avatar_url ? 'cursor-pointer' : 'cursor-default'}`}
            disabled={!displayProfile.avatar_url}
          >
            <img
              src={displayProfile.avatar_url || `https://ui-avatars.com/api/?name=${displayProfile.full_name || 'User'}&background=random`}
              alt="Profile"
              className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-900 object-cover hover:opacity-90 transition-opacity"
            />
            {displayProfile.badge_type && (
              <div className="absolute bottom-1 right-1 z-10">
                <BadgeIcon type={displayProfile.badge_type} size={20} className="p-0.5" />
              </div>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-1.5 border border-gray-300 dark:border-gray-700 rounded-full font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors"
          >
            Edit Profile
          </button>
        </div>

        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayProfile.full_name}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">@{displayProfile.username}</p>
          <p className="text-gray-900 dark:text-gray-100 mb-3 whitespace-pre-wrap">
            {displayProfile.bio || "No bio yet."}
          </p>

          <div className="flex items-center gap-1">
            <Calendar size={16} />
            Joined {new Date(displayProfile.created_at).toLocaleDateString()}
          </div>
          {displayProfile.website && (() => {
            try {
              const url = new URL(displayProfile.website.includes('://') ? displayProfile.website : `https://${displayProfile.website}`);
              return (
                <div className="flex items-center gap-1 mt-1">
                  <LinkIcon size={16} />
                  <a href={url.toString()} target="_blank" rel="noopener noreferrer" className="text-[#ff1744] hover:underline">
                    {url.hostname}
                  </a>
                </div>
              );
            } catch {
              return (
                <div className="flex items-center gap-1 mt-1">
                  <LinkIcon size={16} />
                  <span className="text-gray-500">{displayProfile.website}</span>
                </div>
              );
            }
          })()}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <QrCode size={18} />
            <span>My QR Code</span>
          </button>
          <RouterLink
            to="/chats"
            state={{ tab: 'archived' }}
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <Archive size={18} />
            <span>Archived</span>
          </RouterLink>

          <RouterLink
            to="/my-bag"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <Lock size={18} className="text-[#ff1744]" />
            <span>My Bag</span>
          </RouterLink>
        </div>

        <QRCodeModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />


        <div className="flex gap-4 text-sm mb-4">
          <div>
            <span className="font-bold text-gray-900 dark:text-white">{(displayProfile as any).following_count || 0}</span>{' '}
            <span className="text-gray-500 dark:text-gray-400">Following</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-white">{(displayProfile as any).followers_count || 0}</span>{' '}
            <span className="text-gray-500 dark:text-gray-400">Followers</span>
          </div>
        </div>

        {/* Referral Points Card */}
        <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-yellow-500">✨</span> VoxPoints
            </h3>
            <div className="text-2xl font-black text-[#ff1744]">
              {displayProfile.referral_count ? displayProfile.referral_count * 50 : 0}
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            You have referred {displayProfile.referral_count || 0} friends. Keep inviting to unlock badges!
          </p>

          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-xl border border-dashed border-gray-300">
            <code className="flex-1 font-mono font-bold text-center text-gray-700 dark:text-gray-300">
              {displayProfile.referral_code || 'NO CODE'}
            </code>
            <button
              onClick={() => {
                if (displayProfile.referral_code) {
                  navigator.clipboard.writeText(displayProfile.referral_code);
                  alert("Code copied!");
                }
              }}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
        <button onClick={() => setActiveTab('posts')} className="flex-1 py-3 relative hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <div className="flex justify-center items-center gap-2 text-gray-600 dark:text-gray-400">
            <Grid size={20} className={activeTab === 'posts' ? "text-gray-900 dark:text-white" : ""} />
          </div>
          {activeTab === 'posts' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#ff1744] rounded-full" />}
        </button>
        <button onClick={() => setActiveTab('media')} className="flex-1 py-3 relative hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <div className="flex justify-center items-center gap-2 text-gray-600 dark:text-gray-400">
            <Image size={20} className={activeTab === 'media' ? "text-gray-900 dark:text-white" : ""} />
          </div>
          {activeTab === 'media' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#ff1744] rounded-full" />}
        </button>
        <button onClick={() => setActiveTab('likes')} className="flex-1 py-3 relative hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <div className="flex justify-center items-center gap-2 text-gray-600 dark:text-gray-400">
            <Heart size={20} className={activeTab === 'likes' ? "text-gray-900 dark:text-white" : ""} />
          </div>
          {activeTab === 'likes' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#ff1744] rounded-full" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'posts' && (
          <div>
            {posts.length > 0 ? (
              posts.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="p-8 text-center text-gray-400">No posts yet</div>
            )}
          </div>
        )}
        {activeTab === 'media' && (
          <div className="p-1">
            {mediaPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {mediaPosts.map(post => (
                  <div
                    key={post.id}
                    className="aspect-square bg-gray-100 dark:bg-gray-800 relative cursor-pointer group overflow-hidden"
                    onClick={() => setPreviewImage(post.media!)}
                  >
                    {post.media_type === 'video' ? (
                      <video src={post.media} className="w-full h-full object-cover" />
                    ) : (
                      <img src={post.media} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">No media</div>
            )}
          </div>
        )}
        {activeTab === 'likes' && (
          <div>
            {likedPosts.length > 0 ? (
              likedPosts.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="p-8 text-center text-gray-400">No liked posts yet</div>
            )}
          </div>
        )}
      </div>

      <ImageViewer
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        src={previewImage || ''}
      />
    </div>
  );
};

export default ProfileView;
