
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Repeat, Share, MoreHorizontal, BadgeCheck, Trash2, Edit2, Send, X, Music, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { Post, Comment } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface PostCardProps {
    post: Post;
    onDelete?: (id: string) => void;
    onPin?: (id: string) => void;
}

interface CommentItemProps {
    comment: Comment;
    depth?: number;
    currentUserId?: string;
    onDelete: (id: string) => void;
    onReply: (id: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, depth = 0, currentUserId, onDelete, onReply }) => (
    <div className={`flex gap-3 group mt-4 ${depth > 0 ? 'ml-12 border-l-2 border-gray-100 dark:border-gray-800 pl-4' : ''}`}>
        <img
            src={comment.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${comment.profiles?.full_name}`}
            className="w-8 h-8 rounded-full object-cover border border-gray-100 dark:border-gray-700"
            alt={comment.profiles?.full_name || 'User'}
        />
        <div className="flex-1">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 px-4 relative">
                <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{comment.profiles?.full_name}</span>
                    {currentUserId && currentUserId === comment.user_id && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{comment.content}</p>
            </div>
            <div className="flex items-center gap-4 mt-1 ml-2">
                <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">Like</button>
                <button
                    onClick={() => onReply(comment.id)}
                    className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                >
                    Reply
                </button>
            </div>
            {/* Render Children */}
            {comment.children && comment.children.map((child: Comment) => (
                <CommentItem
                    key={child.id}
                    comment={child}
                    depth={depth + 1}
                    currentUserId={currentUserId}
                    onDelete={onDelete}
                    onReply={onReply}
                />
            ))}
        </div>
    </div>
);

const PostCard: React.FC<PostCardProps> = ({ post, onDelete, onPin }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [liked, setLiked] = useState(post.isLiked || false);
    const [likeCount, setLikeCount] = useState(post.likes);
    const [menuOpen, setMenuOpen] = useState(false);

    // Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);

    // Comments
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [commentCount, setCommentCount] = useState(post.comments);

    // Check if current user is author (needs author ID in post type ideally, inferring from username for now or needs update)
    // NOTE: In a real app, use IDs. Assuming post.author has an ID or we match username if unique.
    // For safety, let's assume we need to match user ID properly. 
    // Since Post type might not have authorId, we might be limited. 
    // Let's assume we can compare usernames for this demo if ID is missing.
    const isAuthor = user?.user_metadata?.username === post.author.username || user?.email?.split('@')[0] === post.author.username;

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;

        // Optimistic update
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

        try {
            if (newLiked) {
                await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
            } else {
                await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            // Revert on error
            setLiked(!newLiked);
            setLikeCount(prev => !newLiked ? prev + 1 : prev - 1);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this post?")) return;
        try {
            const { error } = await supabase.from('posts').delete().eq('id', post.id);
            if (error) throw error;
            if (onDelete) onDelete(post.id);
        } catch (error) {
            console.error("Error deleting post:", error);
            alert("Could not delete post.");
        }
    };

    const handleSaveEdit = async () => {
        try {
            const { error } = await supabase
                .from('posts')
                .update({ content: editContent })
                .eq('id', post.id);

            if (error) throw error;
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating post:", error);
            alert("Could not update post.");
        }
    };

    const fetchComments = async () => {
        if (!showComments) {
            // Opening comments
            const { data } = await supabase
                .from('comments')
                .select('*, profiles(full_name, avatar_url, username)')
                .eq('post_id', post.id)
                .order('created_at', { ascending: true });
            if (data) setComments(data);
        }
        setShowComments(!showComments);
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !user) return;
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: post.id,
                    user_id: user.id,
                    content: newComment.trim(),
                    parent_id: replyingTo
                })
                .select('*, profiles(full_name, avatar_url, username)')
                .single();

            if (error) throw error;

            setComments([...comments, data]);
            setNewComment('');
            setReplyingTo(null);
            setCommentCount(prev => prev + 1);
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            const { error } = await supabase.from('comments').delete().eq('id', commentId);
            if (error) throw error;
            setComments(comments.filter(c => c.id !== commentId));
            setCommentCount(prev => prev - 1);
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    };

    // Helper to organize comments into threads (simple 1-level nesting for view or just flat with indentation)
    // For simplicity in this iteration, we'll render flat but check parent_id for indentation
    // A better approach is a recursive component, but let's do a simple sort first.
    // Actually, flat list with indentation is easier if we sort by thread. 
    // But since we just got list by created_at, a simple map with logic or a Tree build is needed.
    // Let's do a simple Tree build.

    const buildCommentTree = (flatComments: Comment[]) => {
        const roots: Comment[] = [];
        const map: Record<string, Comment> = {};

        flatComments.forEach(c => {
            map[c.id] = { ...c, children: [] };
        });

        flatComments.forEach(c => {
            if (c.parent_id && map[c.parent_id]) {
                map[c.parent_id].children = map[c.parent_id].children || [];
                map[c.parent_id].children!.push(map[c.id]);
            } else {
                roots.push(map[c.id]);
            }
        });

        return roots;
    };



    return (
        <article className="p-4 border-b border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
            <div className="flex gap-3">
                <div
                    className="flex-shrink-0 cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/${post.author.id}`);
                    }}
                >
                    <img
                        src={post.author.avatar || `https://ui-avatars.com/api/?name=${post.author.name}&background=random`}
                        alt={post.author.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700"
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-1 overflow-hidden">
                            <span className="font-bold text-gray-900 dark:text-white truncate">{post.author.name}</span>
                            {post.author.isVerified && <BadgeCheck size={16} className="text-[#ff1744] flex-shrink-0" />}
                            <span className="text-gray-500 dark:text-gray-400 text-sm truncate">@{post.author.username}</span>
                            <span className="text-gray-400 text-sm mx-1">·</span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm flex-shrink-0">{post.timestamp}</span>
                        </div>

                        {/* More Menu */}
                        {isAuthor && (
                            <div className="relative">
                                <button
                                    onClick={() => setMenuOpen(!menuOpen)}
                                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    <MoreHorizontal size={18} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-6 w-32 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 p-1 z-10 animate-in fade-in zoom-in-95 duration-200">
                                        {onPin && (
                                            <button
                                                onClick={() => { onPin(post.id); setMenuOpen(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-left"
                                            >
                                                <BadgeCheck size={14} /> {post.is_pinned ? "Unpin" : "Pin"}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setIsEditing(true); setMenuOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-left"
                                        >
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button
                                            onClick={() => { handleDelete(); setMenuOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-left"
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Location Badge */}
                    {post.location && (
                        <div className="inline-flex items-center gap-1 text-[#ff1744] bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-lg text-xs mt-1">
                            <MapPin size={12} />
                            <span>{post.location.name}</span>
                        </div>
                    )}



                    {/* Content Area */}
                    {isEditing ? (
                        <div className="mt-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-[#ff1744] outline-none min-h-[100px] dark:text-white"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-3 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-3 py-1.5 text-sm font-bold text-white bg-[#ff1744] hover:bg-red-600 rounded-lg"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap leading-normal text-[15px]">
                            {isEditing ? editContent : post.content}
                        </p>
                    )}

                    {post.media && !isEditing && (
                        <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
                            {post.media_type === 'audio' ? (
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-[#ff1744]">
                                        <Music size={20} />
                                    </div>
                                    <audio controls src={post.media} className="flex-1 h-8" />
                                </div>
                            ) : post.media_type === 'video' ? (
                                <video controls src={post.media} className="w-full h-auto max-h-[400px] object-cover bg-black" />
                            ) : (
                                <img src={post.media} alt="Post content" className="w-full h-auto max-h-[400px] object-cover bg-gray-100" />
                            )}
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between mt-3 text-gray-500 dark:text-gray-400 max-w-md">
                        <button
                            onClick={fetchComments}
                            className={cn("flex items-center gap-2 group transition-colors text-sm", showComments ? "text-blue-500" : "hover:text-blue-500")}
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                                <MessageCircle size={18} className={cn(showComments && "fill-current")} />
                            </div>
                            <span>{commentCount}</span>
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                /* Placeholder for Repost logic - would open a confirm modal or create immediately */
                                /* For now, simple console log or alert as per plan */
                                if (confirm("Repost this?")) {
                                    /* Logic would actully go here to call explicit handleRepost from parent or internal */
                                    alert("Repost functionality requires custom Modal implementation. Coming soon!");
                                }
                            }}
                            className="flex items-center gap-2 group hover:text-green-500 transition-colors text-sm"
                        >
                            <div className="p-2 rounded-full group-hover:bg-green-50 dark:group-hover:bg-green-900/30 transition-colors">
                                <Repeat size={18} />
                            </div>
                            <span>{post.reposts}</span>
                        </button>

                        <button
                            onClick={handleLike}
                            className={cn(
                                "flex items-center gap-2 group transition-colors text-sm",
                                liked ? "text-[#ff1744]" : "hover:text-[#ff1744]"
                            )}
                        >
                            <div className="p-2 rounded-full group-hover:bg-red-50 dark:group-hover:bg-red-900/30 transition-colors">
                                <Heart size={18} className={cn(liked && "fill-current")} />
                            </div>
                            <span>{likeCount}</span>
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (navigator.share) {
                                    navigator.share({
                                        title: `Post by ${post.author.name}`,
                                        text: post.content,
                                        url: window.location.href // In real app, deep link to post
                                    });
                                } else {
                                    navigator.clipboard.writeText(post.content);
                                    alert("Copied to clipboard!");
                                }
                            }}
                            className="flex items-center gap-2 group hover:text-blue-500 transition-colors text-sm"
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                                <Share size={18} />
                            </div>
                        </button>
                    </div>

                    {/* Comments Section */}
                    {showComments && (
                        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 animate-in slide-in-from-top-2">
                            {/* Comment Input */}
                            <div className="flex gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                                    {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 relative">
                                    {replyingTo && (
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1 ml-2">
                                            <span>Replying to comment...</span>
                                            <button onClick={() => setReplyingTo(null)} className="hover:text-red-500"><X size={12} /></button>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder={replyingTo ? "Write a reply..." : "Post your reply"}
                                        className="w-full pl-4 pr-10 py-2 bg-gray-50 dark:bg-gray-800 rounded-full text-sm outline-none focus:ring-1 focus:ring-[#ff1744] transition-all dark:text-white"
                                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                    />
                                    <button
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim()}
                                        className="absolute right-1 bottom-1 p-1.5 text-[#ff1744] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Comments List */}
                            <div className="space-y-4">
                                {comments.length > 0 ? (
                                    buildCommentTree(comments).map(comment => (
                                        <CommentItem
                                            key={comment.id}
                                            comment={comment}
                                            currentUserId={user?.id}
                                            onDelete={handleDeleteComment}
                                            onReply={setReplyingTo}
                                        />
                                    ))
                                ) : (
                                    <p className="text-center text-gray-400 text-sm py-2">No comments yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </article>
    );
};

export default PostCard;
