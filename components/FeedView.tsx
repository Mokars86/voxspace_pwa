import React, { useState, useEffect } from 'react';
import { PenLine, Image as ImageIcon, Sparkles, Loader2, X } from 'lucide-react';
import PostCard from './PostCard';
import StoryBar from './StoryBar';
import ImageViewer from './ImageViewer';
import { Post } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const FeedView: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
            id,
            content,
            media_url,
            media_type,
            location,
            created_at,
            likes_count,
            comments_count,
            reposts_count,
            user_id,
            profiles:user_id (
                full_name,
                username,
                avatar_url,
                is_verified
            ),
            post_likes(user_id)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'following' && user) {
        // 1. Get list of followed users AND their profile info
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select(`
            following_id,
            profiles:following_id (
              id,
              full_name,
              username,
              avatar_url
            )
          `)
          .eq('follower_id', user.id);

        if (followsError) throw followsError;

        // Set the list of followed users for the UI
        // Supabase returns an array of objects, where profiles is the joined data.
        // We filter out any null profiles just in case.
        const users = followsData.map((f: any) => f.profiles).filter(Boolean);
        setFollowedUsers(users);

        const followingIds = followsData.map(f => f.following_id);

        // If following no one, return empty
        if (followingIds.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }

        // 2. Filter posts by these IDs
        query = query.in('user_id', followingIds);
      } else if (activeTab === 'following' && !user) {
        setPosts([]);
        setFollowedUsers([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedPosts: Post[] = data.map((item: any) => ({
        id: item.id,
        author: {
          id: item.user_id,
          name: item.profiles?.full_name || 'Unknown',
          username: item.profiles?.username || 'user',
          avatar: item.profiles?.avatar_url || '',
          isVerified: item.profiles?.is_verified || false,
        },
        content: item.content,
        timestamp: new Date(item.created_at).toLocaleDateString(),
        likes: item.likes_count || 0,
        comments: item.comments_count || 0,
        reposts: item.reposts_count || 0,
        media: item.media_url,
        media_type: item.media_type,
        location: item.location,
        isLiked: user ? item.post_likes?.some((l: any) => l.user_id === user.id) : false
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !selectedImage) || !user) return;
    setIsPosting(true);
    try {
      let mediaUrl = null;

      // Upload Image
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post_media')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post_media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: newPostContent.trim(),
        media_url: mediaUrl,
        media_type: mediaUrl ? 'image' : undefined
      });

      if (error) throw error;

      setNewPostContent('');
      removeImage();

      // Refresh manually as fallback
      fetchPosts();

    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to post. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [activeTab, user]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors">
      {/* Header Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 pt-2">
        <button
          onClick={() => setActiveTab('foryou')}
          className="flex-1 py-3 text-center relative"
        >
          <span className={cn("font-bold text-[15px]", activeTab === 'foryou' ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>
            {t('feed.tabs.foryou')}
          </span>
          {activeTab === 'foryou' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#ff1744] rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className="flex-1 py-3 text-center relative"
        >
          <span className={cn("font-bold text-[15px]", activeTab === 'following' ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>
            {t('feed.tabs.following')}
          </span>
          {activeTab === 'following' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#ff1744] rounded-full" />
          )}
        </button>
      </div>

      {/* Stories - Visible on both tabs or just one? Usually visible on top of 'For You' or global. */}
      {/* WhatsApp Status style usually implies a separate tab, but here requested on feed. */}
      {/* Best place: Top of 'For You' list. */}
      {activeTab === 'foryou' && (
        <div className="border-b border-gray-50 dark:border-gray-800">
          <StoryBar />
        </div>
      )}

      {/* Followed Users List (Horizontal Scroll) - Only on Following Tab */}
      {activeTab === 'following' && followedUsers.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-50 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex gap-4">
            {followedUsers.map((u: any) => (
              <div key={u.id} className="flex flex-col items-center gap-1 min-w-[64px]">
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#ff1744] to-purple-500">
                  <img
                    src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`}
                    alt={u.username}
                    className="w-full h-full rounded-full border-2 border-white object-cover"
                  />
                </div>
                <span className="text-xs text-gray-600 truncate w-full text-center max-w-[70px]">
                  {u.full_name?.split(' ')[0] || 'User'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Create (Mini) - Only on For You */}
      {activeTab === 'foryou' && (
        <div className="p-4 flex gap-3 border-b border-gray-50 dark:border-gray-800">
          <img
            src={profile?.avatar_url || user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || user?.user_metadata?.full_name || 'User'}&background=random`}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
          />
          <div className="flex-1">

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('feed.placeholder')}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreatePost();
                  }
                }}
                disabled={isPosting}
                className="w-full py-2 bg-transparent outline-none text-lg placeholder:text-gray-500 dark:text-white dark:placeholder:text-gray-400"
              />
              {newPostContent.trim() && (
                <button
                  onClick={handleCreatePost}
                  disabled={isPosting}
                  className="bg-[#ff1744] text-white px-4 py-1 rounded-full text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isPosting ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
                </button>
              )}
            </div>

            {imagePreview && (
              <div className="relative mt-2 rounded-2xl overflow-hidden group w-fit">
                <img src={imagePreview} alt="Preview" className="max-h-[200px] object-cover rounded-xl" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 mt-2 text-[#ff1744]">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded-full transition-colors"
                title="Add Image"
              >
                <ImageIcon size={20} />
              </button>
              <button className="hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded-full transition-colors"><Sparkles size={20} /></button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex py-12 justify-center">
            <Loader2 className="animate-spin text-gray-300" />
          </div>
        ) : (
          posts.length > 0 ? (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDeletePost}
                onMediaClick={(url) => setViewingImage(url)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              {activeTab === 'following'
                ? (followedUsers.length > 0
                  ? <p>{t('feed.empty_following')}</p>
                  : <p>{t('feed.empty_following_all')}</p>)
                : <p>{t('feed.empty')}</p>
              }
            </div>
          )
        )}

      </div>

      <ImageViewer
        isOpen={!!viewingImage}
        onClose={() => setViewingImage(null)}
        src={viewingImage || ''}
      />
    </div>
  );
};

export default FeedView;
