import React, { useState, useEffect } from 'react';
import { PenLine, Image as ImageIcon, Video, Loader2, X, BarChart2, Plus, Minus } from 'lucide-react';
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
  const [selectedMedia, setSelectedMedia] = useState<{ file: File, type: 'image' | 'video' } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
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
            id,
            content,
            media_url,
            media_type,
            location,
            created_at,
            poll_options,
            likes_count,
            comments_count,
            reposts_count,
            is_pinned,
            user_id,
            profiles:user_id (
                full_name,
                username,
                avatar_url,
                avatar_url,
                is_verified,
                badge_type
            ),
            post_likes(user_id),
            poll_votes(option_index)
        `)
        .is('space_id', null) // Filter out space posts
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
          badge_type: item.profiles?.badge_type
        },
        content: item.content,
        timestamp: new Date(item.created_at).toLocaleDateString(),
        likes: item.likes_count || 0,
        comments: item.comments_count || 0,
        reposts: item.reposts_count || 0,
        media: item.media_url,
        media_type: item.media_type,
        location: item.location,
        isLiked: user ? item.post_likes?.some((l: any) => l.user_id === user.id) : false,
        is_pinned: item.is_pinned,
        poll_options: item.poll_options,
        user_vote: user && item.poll_votes?.length > 0 ? item.poll_votes[0].option_index : null
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      setSelectedMedia({ file, type });
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !selectedMedia && !isPollMode) || !user) return;
    if (isPollMode && pollOptions.filter(o => o.trim()).length < 2) {
      alert("Please add at least 2 poll options.");
      return;
    }
    setIsPosting(true);

    // Optimistic Post
    const tempId = `temp-${Date.now()}`;
    const optimisticPost: Post = {
      id: tempId,
      author: {
        id: user.id,
        name: user.user_metadata?.full_name || 'Me',
        username: user.user_metadata?.username || 'me',
        avatar: user.user_metadata?.avatar_url || '',
        isVerified: false
      },
      content: newPostContent.trim(),
      timestamp: "Just now",
      likes: 0,
      comments: 0,
      reposts: 0,
      media: mediaPreview ? mediaPreview : undefined,
      media_type: selectedMedia?.type || undefined,
      poll_options: isPollMode ? pollOptions.filter(o => o.trim()).map(text => ({ text, count: 0 })) : undefined,
      location: null,
      isLiked: false
    };

    setPosts(prev => [optimisticPost, ...prev]);
    setNewPostContent('');
    removeMedia();
    setIsPollMode(false);
    setPollOptions(['', '']);

    try {
      let mediaUrl = null;

      // Upload Media
      if (selectedMedia) {
        const fileExt = selectedMedia.file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post_media')
          .upload(fileName, selectedMedia.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post_media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { data, error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: optimisticPost.content,
        media_url: mediaUrl,
        media_type: selectedMedia?.type,
        poll_options: optimisticPost.poll_options
      }).select().single();

      if (error) throw error;

    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to post. Please try again.");
      setPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePinPost = async (id: string, currentPinStatus: boolean) => {
    // Optimistic Update
    setPosts(prev => prev.map(p => p.id === id ? { ...p, is_pinned: !currentPinStatus } : p)); // Note: Post type needs is_pinned

    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_pinned: !currentPinStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error("Error pinning post:", error);
      // Revert
      setPosts(prev => prev.map(p => p.id === id ? { ...p, is_pinned: currentPinStatus } : p));
      alert("Failed to pin post.");
    }
  };

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: 'space_id=is.null' },
        async (payload) => {
          // Fetch only the new post details
          const { data, error } = await supabase
            .from('posts')
            .select(`
                    id,
                    content,
                    media_url,
                    media_type,
                    location,
                    media_type,
                    location,
                    created_at,
                    poll_options,
                    likes_count,
                    comments_count,
                    reposts_count,
                    is_pinned,
                    user_id,
                    profiles:user_id (
                        full_name,
                        username,
                        avatar_url,
                        is_verified,
                        badge_type
                    ),
                    post_likes(user_id)
                `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            const newPost: Post = {
              id: data.id,
              author: {
                id: data.user_id,
                name: data.profiles?.full_name || 'Unknown',
                username: data.profiles?.username || 'user',
                avatar: data.profiles?.avatar_url || '',
                isVerified: data.profiles?.is_verified || false,
                badge_type: data.profiles?.badge_type
              },
              content: data.content,
              timestamp: new Date(data.created_at).toLocaleDateString(),
              likes: data.likes_count || 0,
              comments: data.comments_count || 0,
              reposts: data.reposts_count || 0,
              media: data.media_url,
              media_type: data.media_type,
              location: data.location,
              isLiked: user ? data.post_likes?.some((l: any) => l.user_id === user.id) : false,
              is_pinned: data.is_pinned,
              poll_options: data.poll_options
            };

            setPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          // Update local state without full refetch for smoothness
          setPosts(prev => prev.map(p => p.id === payload.new.id ? {
            ...p,
            content: payload.new.content,
            is_pinned: payload.new.is_pinned,
            likes: payload.new.likes_count,
            comments: payload.new.comments_count,
            poll_options: payload.new.poll_options
          } : p));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
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

            {mediaPreview && (
              <div className="relative mt-2 rounded-2xl overflow-hidden group w-fit">
                {selectedMedia?.type === 'video' ? (
                  <video src={mediaPreview} className="max-h-[200px] object-cover rounded-xl" controls />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-[200px] object-cover rounded-xl" />
                )}
                <button
                  onClick={removeMedia}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 mt-2 text-[#ff1744]">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors flex items-center gap-2"
                title="Add Image or Video"
              >
                <ImageIcon size={20} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors flex items-center gap-2"
                title="Add Video"
              >
                <Video size={20} />
              </button>
              <button
                onClick={() => {
                  setIsPollMode(!isPollMode);
                  if (!isPollMode) {
                    removeMedia(); // Polls usually exclusive with media in this design
                  }
                }}
                className={`hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors flex items-center gap-2 ${isPollMode ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                title="Create Poll"
              >
                <BarChart2 size={20} />
              </button>

            </div>

            {isPollMode && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#ff1744] transition-colors"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 p-2"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-[#ff1744] text-sm font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Option
                  </button>
                )}
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleMediaSelect}
              accept="image/*,video/*"
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
                onPin={(id) => handlePinPost(id, post.is_pinned || false)}
                onMediaClick={(url, type) => setViewingImage({ url, type: type as 'image' | 'video' || 'image' })}
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
        src={viewingImage?.url || ''}
        type={viewingImage?.type || 'image'}
      />
    </div>
  );
};

export default FeedView;
