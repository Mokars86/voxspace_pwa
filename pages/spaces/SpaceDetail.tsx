import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MessageSquare, Mic, Globe, Share2, MoreVertical, Loader2, Camera, Trash2, Calendar, Image as ImageIcon, Pin, X, StopCircle, Play, Pause, MapPin } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { Post, SpaceEvent } from '../../types';
import PostCard from '../../components/PostCard';
import { SpaceChatRoomContent } from './SpaceChatRoom';
import SpaceMembersModal from '../../components/SpaceMembersModal';
import ImageViewer from '../../components/ImageViewer';


const SpaceDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [space, setSpace] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'media' | 'events'>('posts');

    // Feature States
    const [posts, setPosts] = useState<Post[]>([]);
    const [events, setEvents] = useState<SpaceEvent[]>([]);

    // Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    const [editDescription, setEditDescription] = useState('');
    const [newPostContent, setNewPostContent] = useState('');

    // Upload/Join States
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isMember, setIsMember] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);

    // Post Media States
    const [postMedia, setPostMedia] = useState<File | Blob | null>(null);
    const [postMediaType, setPostMediaType] = useState<'image' | 'audio' | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    // Event State
    const [showEventModal, setShowEventModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', description: '', start_time: '', location: '' });
    const [viewingImage, setViewingImage] = useState<{ url: string, type: 'image' | 'video' } | null>(null);


    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.start_time || !user) return;
        try {
            const { error } = await supabase.from('space_events').insert({
                space_id: id,
                title: newEvent.title,
                description: newEvent.description,
                start_time: new Date(newEvent.start_time).toISOString(),
                location: newEvent.location,
                created_by: user.id
            });
            if (error) throw error;
            setShowEventModal(false);
            setNewEvent({ title: '', description: '', start_time: '', location: '' });
            fetchEvents();
            alert("Event created successfully!");
        } catch (error: any) {
            console.error("Error creating event:", error);
            alert("Failed to create event");
        }
    };

    const [recordingDuration, setRecordingDuration] = useState(0);

    // Refs
    const postFileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    // Handlers
    const handlePostMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPostMedia(file);
            setPostMediaType('image');
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setPostMedia(audioBlob);
                setPostMediaType('audio');
                setPreviewUrl(URL.createObjectURL(audioBlob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Timer
            let seconds = 0;
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                seconds++;
                setRecordingDuration(seconds);
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handlePostSubmit = async () => {
        if ((!newPostContent.trim() && !postMedia) || !user) return;

        setUploading(true);

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const optimisticPost: Post = {
            id: tempId,
            author: {
                id: user.id,
                name: user.user_metadata?.full_name || 'Me',
                username: user.user_metadata?.username || 'user',
                avatar: user.user_metadata?.avatar_url || '',
                isVerified: false
            },
            content: newPostContent,
            timestamp: "Just now",
            likes: 0,
            comments: 0,
            reposts: 0,
            media: previewUrl || undefined,
            media_type: postMediaType || undefined, // Use current state or default
            isLiked: false,
            is_pinned: false
        };

        setPosts(prev => [optimisticPost, ...prev]);

        // Clear Form Immediately
        const tempContent = newPostContent;
        const tempMedia = postMedia;
        const tempMediaType = postMediaType;

        setNewPostContent('');
        setPostMedia(null);
        setPostMediaType(null);
        setPreviewUrl(null);

        try {
            let mediaUrl = '';
            let mediaType = null;

            if (tempMedia) {
                const ext = tempMediaType === 'audio' ? 'webm' : tempMedia instanceof File ? tempMedia.name.split('.').pop() : 'jpg';
                const fileName = `space-post-${Date.now()}.${ext}`;
                // Usage of proven bucket
                const { error: uploadError } = await supabase.storage.from('post_media').upload(fileName, tempMedia);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('post_media').getPublicUrl(fileName);
                mediaUrl = data.publicUrl;
                mediaType = tempMediaType;
            }

            const { error } = await supabase.from('posts').insert({
                space_id: id,
                user_id: user.id,
                content: tempContent,
                media_url: mediaUrl || null,
                media_type: mediaType || undefined // FIX: Send undefined if null to use DB default
            });

            if (error) throw error;

            fetchPosts(); // Refresh to get real ID

        } catch (error: any) {
            console.error("Post failed:", error);
            alert("Failed to post: " + error.message);
            // Rollback
            setPosts(prev => prev.filter(p => p.id !== tempId));
            // Restore form state? 
            setNewPostContent(tempContent);
            setPostMedia(tempMedia);
            setPostMediaType(tempMediaType);
            if (tempMedia) setPreviewUrl(URL.createObjectURL(tempMedia as any)); // Re-create preview
        } finally {
            setUploading(false);
        }
    };



    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert("Space link copied to clipboard!");
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleDelete = async () => {
        if (!space || !user) return;
        if (!window.confirm("Are you sure you want to delete this space? This cannot be undone.")) return;

        try {
            const { error } = await supabase.from('spaces').delete().eq('id', space.id);
            if (error) throw error;
            navigate('/spaces');
        } catch (error: any) {
            console.error("Error deleting space:", error);
            alert("Failed to delete space: " + error.message);
        }
    };

    const fetchPosts = async () => {
        if (!id) return;
        const { data, error } = await supabase
            .from('posts')
            .select(`*, profiles:user_id(full_name, username, avatar_url, is_verified), post_likes(user_id)`)
            .eq('space_id', id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching space posts:", error);
        else {
            const formatted: Post[] = data.map((p: any) => ({
                id: p.id,
                author: {
                    id: p.user_id,
                    name: p.profiles?.full_name || 'Unknown',
                    username: p.profiles?.username || 'user',
                    avatar: p.profiles?.avatar_url || '',
                    isVerified: p.profiles?.is_verified || false
                },
                content: p.content,
                timestamp: new Date(p.created_at).toLocaleDateString(),
                likes: p.likes_count,
                comments: p.comments_count,
                reposts: p.reposts_count,
                media: p.media_url,
                isLiked: user ? p.post_likes?.some((l: any) => l.user_id === user.id) : false,
                is_pinned: p.is_pinned
            }));
            setPosts(formatted);
        }
    };

    const fetchEvents = async () => {
        if (!id) return;
        const { data, error } = await supabase.from('space_events').select('*').eq('space_id', id).order('start_time', { ascending: true });
        if (data) setEvents(data);
    };

    const [memberStatus, setMemberStatus] = useState<'pending' | 'approved' | null>(null);

    useEffect(() => {
        const fetchSpace = async () => {
            if (!id) return;
            try {
                // Fetch Space Details
                const { data, error } = await supabase
                    .from('spaces')
                    .select('*, owner:owner_id(full_name, avatar_url)')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setSpace(data);
                setEditName(data.name);
                setEditDescription(data.description);

                // Check Membership if user is logged in
                if (user) {
                    const { data: memberData } = await supabase
                        .from('space_members')
                        .select('status')
                        .eq('space_id', id)
                        .eq('user_id', user.id)
                        .single();

                    if (memberData) {
                        setIsMember(memberData.status === 'approved');
                        setMemberStatus(memberData.status);
                    } else {
                        setIsMember(false);
                        setMemberStatus(null);
                    }
                }

                // Initial Fetch
                fetchPosts();
                fetchEvents();

            } catch (error) {
                console.error("Error fetching space:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSpace();

        // ... (rest of useEffect logic for posts subscription)
        const channel = supabase
            .channel(`space_posts:${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'posts',
                filter: `space_id=eq.${id}`
            }, async (payload) => {
                // ... (handling payload)
                const { data, error } = await supabase
                    .from('posts')
                    .select(`*, profiles:user_id(full_name, username, avatar_url, is_verified), post_likes(user_id)`)
                    .eq('id', payload.new.id)
                    .single();

                if (!error && data) {
                    // ... (construction newPost)
                    const newPost: Post = {
                        id: data.id,
                        author: {
                            id: data.user_id,
                            name: data.profiles?.full_name || 'Unknown',
                            username: data.profiles?.username || 'user',
                            avatar: data.profiles?.avatar_url || '',
                            isVerified: data.profiles?.is_verified || false
                        },
                        content: data.content,
                        timestamp: new Date(data.created_at).toLocaleDateString(),
                        likes: data.likes_count,
                        comments: data.comments_count,
                        reposts: data.reposts_count,
                        media: data.media_url,
                        isLiked: user ? data.post_likes?.some((l: any) => l.user_id === user.id) : false,
                        is_pinned: data.is_pinned
                    };

                    setPosts(prev => {
                        if (prev.some(p => p.id === newPost.id)) return prev;
                        return [newPost, ...prev];
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user]);


    const handleJoinLeave = async () => {
        if (!user || !space) return;
        setJoinLoading(true);
        try {
            if (memberStatus) {
                // Leave Space (or Cancel Request)
                const { error } = await supabase
                    .from('space_members')
                    .delete()
                    .eq('space_id', id)
                    .eq('user_id', user.id);
                if (error) throw error;

                setIsMember(false);
                setMemberStatus(null);

                // Only decrement if they were actually a member (approved)
                if (memberStatus === 'approved') {
                    setSpace((prev: any) => ({ ...prev, members_count: Math.max(0, prev.members_count - 1) }));
                }
            } else {
                // Join Request
                // Note: RLS will handle 'pending' default, but we can be explicit if we want
                const { error } = await supabase
                    .from('space_members')
                    .insert({ space_id: id, user_id: user.id });
                if (error) throw error;

                // Status is pending by default (from DB or RLS)
                setMemberStatus('pending');
                setIsMember(false);
                alert("Request sent! An admin must approve your request.");
            }
        } catch (error) {
            console.error("Error joining/leaving space:", error);
            alert("Action failed. Please try again.");
        } finally {
            setJoinLoading(false);
        }
    };

    const handleDeletePost = (id: string) => {
        setPosts(prev => prev.filter(p => p.id !== id));
    };

    const handlePin = async (postId: string) => {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const newPinned = !post.is_pinned;

        // Optimistic
        setPosts(posts.map(p => p.id === postId ? { ...p, is_pinned: newPinned } : p).sort((a, b) => (Number(b.is_pinned) - Number(a.is_pinned))));

        try {
            const { error } = await supabase.from('posts').update({ is_pinned: newPinned }).eq('id', postId);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            alert("Failed to pin post");
            fetchPosts(); // Revert
        }
    };

    const handleUpdateSpace = async () => {
        if (!space || !user) return;
        try {
            const { error } = await supabase
                .from('spaces')
                .update({ name: editName, description: editDescription })
                .eq('id', space.id);

            if (error) throw error;
            setSpace({ ...space, name: editName, description: editDescription });
            setIsEditing(false);
        } catch (error: any) {
            console.error("Error updating space:", error);
            alert("Failed to update space");
        }
    };

    const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0 || !space) return;
            setUploading(true);
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `space-banner-${space.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('VoxSpace_App').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('VoxSpace_App').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;
            await supabase.from('spaces').update({ banner_url: publicUrl }).eq('id', space.id);
            setSpace({ ...space, banner_url: publicUrl });
        } catch (error: any) {
            console.error('Error uploading banner:', error);
            alert('Failed to upload banner: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <Loader2 className="animate-spin text-[#ff1744]" size={32} />
            </div>
        );
    }

    if (!space) return <div>Space not found</div>;

    const isOwner = user?.id === space.owner_id;

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-black relative">
            {/* Header Image */}
            <div className="h-48 md:h-64 relative group flex-shrink-0">
                <img
                    src={space.banner_url || "https://source.unsplash.com/random/800x600/?abstract"}
                    alt={space.name}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

                {/* Navbar over image */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white z-20">
                    <button onClick={() => navigate(-1)} className="p-2 bg-black/20 backdrop-blur-md rounded-full hover:bg-black/40">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex gap-2">
                        <button onClick={handleShare} className="p-2 bg-black/20 backdrop-blur-md rounded-full hover:bg-black/40">
                            <Share2 size={24} />
                        </button>
                        {isOwner && (
                            <button onClick={handleDelete} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full hover:bg-red-600">
                                <Trash2 size={24} />
                            </button>
                        )}
                    </div>
                </div>

                {isOwner && (
                    <div className="absolute top-16 right-4 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 flex items-center gap-2 px-4 shadow-lg border border-white/20"
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                            <span className="text-sm font-bold">Edit Cover</span>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleBannerUpload} className="hidden" accept="image/*" />
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10 flex items-end justify-between">
                    <div>
                        {isEditing ? (
                            <input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="text-3xl font-bold mb-2 bg-black/40 text-white border-b border-white/50 focus:outline-none w-full"
                            />
                        ) : (
                            <h1 className="text-3xl font-bold mb-2 shadow-sm drop-shadow-md">{space.name}</h1>
                        )}

                        <div className="flex items-center gap-4 text-sm font-medium">
                            <button
                                onClick={() => setShowMembersModal(true)}
                                className="flex items-center gap-1 hover:text-gray-200 transition-colors cursor-pointer"
                            >
                                <Users size={16} />
                                <span>{space.members_count || 1} members</span>
                            </button>
                        </div>
                    </div>

                    {isOwner ? (
                        <div className="flex gap-2">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-sm font-bold">Cancel</button>
                                    <button onClick={handleUpdateSpace} className="px-4 py-2 bg-[#ff1744] hover:bg-red-600 rounded-lg text-sm font-bold shadow-lg">Save</button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full">
                                    <MoreVertical size={20} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleJoinLeave}
                            disabled={joinLoading}
                            className={cn(
                                "px-6 py-2 rounded-full font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50",
                                isMember
                                    ? "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
                                    : memberStatus === 'pending'
                                        ? "bg-yellow-500/80 hover:bg-yellow-600 text-white backdrop-blur-md"
                                        : "bg-[#ff1744] hover:bg-red-600 text-white"
                            )}
                        >
                            {joinLoading ? <Loader2 className="animate-spin" size={20} /> :
                                (isMember ? "Joined" : memberStatus === 'pending' ? "Request Sent" : "Join Space")}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-100 flex sticky top-0 z-10">
                {['posts', 'chat', 'media', 'events'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "flex-1 py-3 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors",
                            activeTab === tab
                                ? "border-[#ff1744] text-[#ff1744]"
                                : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-white dark:bg-black"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 pb-20">
                {/* POSTS TAB */}
                {activeTab === 'posts' && (
                    <div className="p-4 space-y-4">
                        {/* Pinned / About */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">About this Space</h3>
                            {isEditing ? (
                                <textarea
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    className="w-full h-24 p-2 border rounded-lg text-sm focus:border-[#ff1744] outline-none"
                                />
                            ) : (
                                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{space.description}</p>
                            )}
                        </div>

                        {/* Create Post */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm space-y-3">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                    {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <input
                                        type="text"
                                        placeholder={!isMember ? "Join the space to post..." : memberStatus === 'pending' ? "Waiting for approval..." : isRecording ? "Recording audio..." : "Post something to the space..."}
                                        className="w-full bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff1744] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                        disabled={isRecording || !isMember || memberStatus === 'pending'}
                                    />

                                    {/* Media Previews */}
                                    {previewUrl && (
                                        <div className="relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 w-fit max-w-full">
                                            <button
                                                onClick={() => {
                                                    setPostMedia(null);
                                                    setPostMediaType(null);
                                                    setPreviewUrl(null);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white z-10"
                                            >
                                                <X size={14} />
                                            </button>

                                            {postMediaType === 'image' ? (
                                                <img src={previewUrl} className="max-h-48 object-cover" />
                                            ) : (
                                                <div className="p-3 flex items-center gap-3 pr-8">
                                                    <div className="w-8 h-8 rounded-full bg-[#ff1744] flex items-center justify-center text-white">
                                                        <Mic size={16} />
                                                    </div>
                                                    <audio src={previewUrl} controls className="h-8 w-48" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center pl-14 pt-1">
                                <div className="flex gap-4 text-gray-400 items-center">
                                    {/* Image Upload */}
                                    <button
                                        onClick={() => postFileInputRef.current?.click()}
                                        className="hover:text-[#ff1744] cursor-pointer transition-colors p-1 rounded-full hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        disabled={isRecording || uploading || !isMember || memberStatus === 'pending'}
                                    >
                                        <ImageIcon size={20} />
                                    </button>
                                    <input
                                        type="file"
                                        ref={postFileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handlePostMediaSelect}
                                    />

                                    {/* Audio Recording */}
                                    {isRecording ? (
                                        <div className="flex items-center gap-2 text-[#ff1744] animate-pulse">
                                            <div className="w-2 h-2 bg-[#ff1744] rounded-full" />
                                            <span className="text-xs font-bold font-mono">
                                                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                            </span>
                                            <button onClick={handleStopRecording} className="ml-2 hover:scale-110 transition-transform">
                                                <StopCircle size={20} className="fill-current" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleStartRecording}
                                            className="hover:text-[#ff1744] cursor-pointer transition-colors p-1 rounded-full hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                            disabled={!!postMedia || uploading || !isMember || memberStatus === 'pending'}
                                        >
                                            <Mic size={20} />
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={handlePostSubmit}
                                    disabled={(!newPostContent.trim() && !postMedia) || uploading || isRecording || !isMember || memberStatus === 'pending'}
                                    className="px-5 py-1.5 bg-[#ff1744] hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-full transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    {uploading && <Loader2 size={14} className="animate-spin" />}
                                    Post
                                </button>
                            </div>
                        </div>

                        {/* Posts List */}
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <div key={post.id} className="relative">
                                    {post.is_pinned && (
                                        <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 z-10">
                                            <Pin size={10} /> Pinned
                                        </div>
                                    )}
                                    <PostCard
                                        post={post}
                                        onPin={isOwner ? handlePin : undefined}
                                        onDelete={handleDeletePost}
                                        onMediaClick={(url, type) => setViewingImage({ url, type: type as 'image' | 'video' || 'image' })}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <p>No posts yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <div className="h-full">
                        {isMember ? (
                            <SpaceChatRoomContent />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                                <Users size={48} className="text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-700">Join to Chat</h3>
                                <p className="text-gray-500 mb-4">You must be a member to access the chat room.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* MEDIA TAB */}
                {activeTab === 'media' && (
                    <div className="p-4 grid grid-cols-3 gap-1">
                        {posts.filter(p => p.media).map(post => (
                            <div key={post.id} className="aspect-square bg-gray-200">
                                <img src={post.media} className="w-full h-full object-cover" />
                            </div>
                        ))}
                        {posts.filter(p => p.media).length === 0 && (
                            <div className="col-span-3 text-center py-10 text-gray-400">
                                <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                No media shared yet.
                            </div>
                        )}
                    </div>
                )}

                {/* EVENTS TAB */}
                {activeTab === 'events' && (
                    <div className="p-4 space-y-4">
                        {isMember && (
                            <button
                                onClick={() => setShowEventModal(true)}
                                className="w-full py-3 bg-white border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold hover:border-[#ff1744] hover:text-[#ff1744] transition-colors flex items-center justify-center gap-2"
                            >
                                <Calendar size={20} />
                                Create New Event
                            </button>
                        )}

                        {events.length > 0 ? (
                            events.map(ev => (
                                <div key={ev.id} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-[#ff1744]">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-lg">{ev.title}</h4>
                                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                                <Calendar size={14} />
                                                <span>{new Date(ev.start_time).toLocaleString()}</span>
                                            </div>
                                            {ev.location && (
                                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                                    <MapPin size={14} />
                                                    <span>{ev.location}</span>
                                                </div>
                                            )}
                                            <p className="text-gray-600 mt-2 text-sm">{ev.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No upcoming events.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Join / Leave (Floating if not in Chat tab) */}
            {
                activeTab !== 'chat' && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t z-50">
                        {isOwner ? (
                            <button className="w-full py-3 bg-gray-100 text-gray-400 font-bold rounded-xl text-lg cursor-not-allowed">
                                You own this space
                            </button>
                        ) : (
                            <button
                                onClick={handleJoinLeave}
                                disabled={joinLoading}
                                className={cn(
                                    "w-full py-3 font-bold rounded-xl text-lg shadow-lg transition-transform active:scale-95",
                                    isMember
                                        ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                        : "bg-[#ff1744] text-white shadow-red-200"
                                )}
                            >
                                {joinLoading ? <Loader2 className="animate-spin inline mr-2" /> : null}
                                {isMember ? "Leave Space" : "Join Space"}
                            </button>
                        )}
                    </div>
                )
            }

            <ImageViewer
                isOpen={!!viewingImage}
                onClose={() => setViewingImage(null)}
                src={viewingImage?.url || ''}
                type={viewingImage?.type || 'image'}
            />

            {space && (
                <SpaceMembersModal
                    isOpen={showMembersModal}
                    onClose={() => setShowMembersModal(false)}
                    spaceId={space.id}
                    isOwner={isOwner}
                />
            )}

            {/* Event Creation Modal */}
            {showEventModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Create Event</h3>
                            <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Event Title</label>
                                <input
                                    type="text"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm border border-gray-200 outline-none focus:border-[#ff1744]"
                                    placeholder="e.g. Weekly Meetup"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm border border-gray-200 outline-none focus:border-[#ff1744] h-24 resize-none"
                                    placeholder="What is this event about?"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={newEvent.start_time}
                                        onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm border border-gray-200 outline-none focus:border-[#ff1744]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                                    <input
                                        type="text"
                                        value={newEvent.location}
                                        onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                        className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm border border-gray-200 outline-none focus:border-[#ff1744]"
                                        placeholder="Online or Address"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleCreateEvent}
                                disabled={!newEvent.title || !newEvent.start_time}
                                className="w-full py-3 bg-[#ff1744] text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
export default SpaceDetail;
