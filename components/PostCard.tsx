import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Repeat, Share, MoreHorizontal, BadgeCheck, Trash2, Edit2, Send, X, Music, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { Post, Comment } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import RepostModal from './RepostModal';

interface PostCardProps {
    post: Post;
    onDelete?: (id: string) => void;
    onPin?: (id: string) => void;
    onMediaClick?: (url: string) => void;
}

interface CommentItemProps {
    comment: Comment;
    depth?: number;
    currentUserId?: string;
    onDelete: (id: string) => void;
    onReply: (id: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, depth = 0, currentUserId, onDelete, onReply }) => (
    <div className={`flex gap-3 group mt-4 ${depth > 0 ? 'ml-4 sm:ml-8 md:ml-12 border-l-2 border-gray-100 dark:border-gray-800 pl-4' : ''}`}>
        <img
            src={comment.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${comment.profiles?.full_name}`}
            className="w-8 h-8 rounded-full object-cover border border-gray-100 dark:border-gray-700"
            alt={comment.profiles?.full_name || 'User'}
        />
        <div className="flex-1 min-w-0">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 px-4 relative">
                <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate pr-2">{comment.profiles?.full_name}</span>
                    {currentUserId && currentUserId === comment.user_id && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 break-words">{comment.content}</p>
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

const PostCard: React.FC<PostCardProps> = ({ post, onDelete, onPin, onMediaClick }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [liked, setLiked] = useState(post.isLiked || false);
    const [likeCount, setLikeCount] = useState(post.likes);
    const [repostCount, setRepostCount] = useState(post.reposts || 0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isReposting, setIsReposting] = useState(false);

    // Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [displayContent, setDisplayContent] = useState(post.content);

    // Comments
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [commentCount, setCommentCount] = useState(post.comments);

    const isAuthor = user?.id === post.author.id;

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

    const handleRepost = async (type: 'repost' | 'quote', content?: string) => {
        if (!user) return;

        setIsReposting(false); // Close Modal

        try {
            // Optimistic update
            setRepostCount(prev => prev + 1);

            const { error } = await supabase.from('posts').insert({
                user_id: user.id,
                content: type === 'quote' ? content : '', // Empty content for pure repost, or should it duplicate? Usually empty + link
                repost_of: post.id,
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            alert(type === 'quote' ? "Quote posted!" : "Reposted to your feed!");

            // In a real app, we might trigger a global feed refresh here

        } catch (error) {
            console.error("Repost failed", error);
            setRepostCount(prev => prev - 1); // Revert
            alert("Failed to repost.");
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
        if (!editContent.trim()) return;
        try {
            const { error } = await supabase.from('posts').update({ content: editContent, is_edited: true }).eq('id', post.id);
            if (error) throw error;
            setIsEditing(false);
            setDisplayContent(editContent);
        } catch (e) {
            console.error("Edit failed", e);
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

        const optimisticComment: Comment = {
            id: Date.now().toString(),
            post_id: post.id,
            user_id: user.id,
            content: newComment,
            created_at: new Date().toISOString(),
            parent_id: replyingTo,
            profiles: {
                full_name: user.user_metadata?.full_name || 'Me',
                avatar_url: user.user_metadata?.avatar_url || '',
                username: 'me'
            }
        };

        setComments([...comments, optimisticComment]);
        setNewComment('');
        setReplyingTo(null);
        setCommentCount(prev => prev + 1);

        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: post.id,
                    user_id: user.id,
                    content: optimisticComment.content,
                    parent_id: replyingTo
                })
                .select('*, profiles(full_name, avatar_url, username)')
                .single();

            if (error) throw error;
            // Update with real ID/data if needed, but optimistic is usually enough for display
            // setComments(prev => prev.map(c => c.id === optimisticComment.id ? data : c)); 
        } catch (error) {
            console.error("Error posting comment:", error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Delete comment?")) return;
        setComments(comments.filter(c => c.id !== commentId));
        setCommentCount(prev => prev - 1);
        await supabase.from('comments').delete().eq('id', commentId);
    };

    // Recursive builder for UI
    const buildCommentTree = (flatComments: Comment[]) => {
        const map = new Map();
        const roots: Comment[] = [];

        flatComments.forEach(c => {
            map.set(c.id, { ...c, children: [] });
        });

        flatComments.forEach(c => {
            if (c.parent_id && map.has(c.parent_id)) {
                map.get(c.parent_id).children.push(map.get(c.id));
            } else {
                roots.push(map.get(c.id));
            }
        });
        return roots;
    };


    return (
        <article className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all cursor-pointer animate-in fade-in duration-300">
            {/* Repost Header */}
            {post.repostOf && (
                <div className="flex items-center gap-2 px-4 pt-3 text-xs font-bold text-gray-500 mb-[-8px]">
                    <Repeat size={12} />
                    <span>{post.repostAuthor === user?.user_metadata?.username ? 'You' : post.repostAuthor} reposted</span>
                </div>
            )}

            <div className="flex p-4 gap-3">
                {/* Avatar */}
                <div
                    className="flex-shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/${post.author.id}`);
                    }}
                >
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden ring-2 ring-transparent hover:ring-[#ff1744] transition-all">
                        {post.author.avatar ? (
                            <img src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                                {post.author.name?.[0]}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0" onClick={(e) => { e.stopPropagation(); navigate(`/user/${post.author.id}`); }}>
                            <h3 className="font-bold text-gray-900 dark:text-white truncate hover:underline">{post.author.name}</h3>
                            {post.author.isVerified && <BadgeCheck size={14} className="text-[#ff1744] fill-current" />}
                            <span className="text-gray-500 text-sm truncate">@{post.author.username}</span>
                            <span className="text-gray-400 text-xs whitespace-nowrap">· {post.timestamp}</span>
                            {post.is_pinned && <span className="text-xs text-[#ff1744] font-bold ml-2">📌 Pinned</span>}
                        </div>

                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                                className="p-1.5 text-gray-400 hover:text-[#ff1744] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {/* Menu Dropdown */}
                            {menuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                                    <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 w-32 overflow-hidden py-1 animate-in zoom-in-95 duration-100 origin-top-right">
                                        {isAuthor && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(post.id); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 font-medium flex items-center gap-2">
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 font-medium flex items-center gap-2">
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onPin && onPin(post.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 font-medium flex items-center gap-2">
                                                    <MapPin size={14} /> {post.is_pinned ? 'Unpin' : 'Pin'}
                                                </button>
                                            </>
                                        )}
                                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 font-medium flex items-center gap-2">
                                            <Share size={14} /> Share
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Post Text / Edit Mode */}
                    {isEditing ? (
                        <div onClick={e => e.stopPropagation()} className="mt-2">
                            <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm rounded-lg hover:bg-gray-100">Cancel</button>
                                <button onClick={handleSaveEdit} className="px-3 py-1 text-sm bg-[#ff1744] text-white rounded-lg">Save</button>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-1 text-[15px] text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                            {displayContent}
                        </p>
                    )}

                    {/* Media */}
                    {post.media && (
                        <div
                            className="mt-3 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer max-w-lg shadow-sm hover:shadow-md transition-shadow"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onMediaClick) onMediaClick(post.media!);
                            }}
                        >
                            {post.media_type === 'video' ? (
                                <video src={post.media} controls className="w-full h-full object-cover max-h-[400px]" />
                            ) : post.media_type === 'audio' ? (
                                <div className="p-4 bg-gray-50 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#ff1744] rounded-full flex items-center justify-center text-white">
                                        <Music size={20} />
                                    </div>
                                    <audio src={post.media} controls className="w-full" />
                                </div>
                            ) : (
                                <img src={post.media} alt="Post media" className="w-full h-full object-cover max-h-[500px]" />
                            )}
                        </div>
                    )}

                    {/* Location Badge */}
                    {post.location && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                            <MapPin size={12} />
                            {post.location.name || `${post.location.lat.toFixed(2)}, ${post.location.lng.toFixed(2)}`}
                        </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mt-3 max-w-md text-gray-500 dark:text-gray-400">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchComments();
                            }}
                            className="flex items-center gap-2 group hover:text-blue-500 transition-colors text-sm"
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                                <MessageCircle size={18} className={cn(showComments && "fill-current")} />
                            </div>
                            <span>{commentCount}</span>
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsReposting(true);
                            }}
                            className={cn("flex items-center gap-2 group hover:text-green-500 transition-colors text-sm", post.reposts > 0 && "text-green-500")}
                        >
                            <div className="p-2 rounded-full group-hover:bg-green-50 dark:group-hover:bg-green-900/30 transition-colors">
                                <Repeat size={18} />
                            </div>
                            <span>{repostCount}</span>
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
                            <div className="flex gap-3 mb-4 items-start">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                                    {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    {replyingTo && (
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2 ml-2">
                                            <span>Replying to comment...</span>
                                            <button onClick={() => setReplyingTo(null)} className="hover:text-red-500"><X size={12} /></button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-3xl px-4 py-2 border border-transparent focus-within:border-[#ff1744] focus-within:ring-1 focus-within:ring-[#ff1744]/20 transition-all">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={replyingTo ? "Write a reply..." : "Post your reply"}
                                            className="flex-1 bg-transparent text-sm outline-none dark:text-white placeholder:text-gray-400"
                                            onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                        />
                                        <button
                                            onClick={handlePostComment}
                                            disabled={!newComment.trim()}
                                            className="p-1.5 text-[#ff1744] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
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

            <RepostModal
                isOpen={isReposting}
                onClose={() => setIsReposting(false)}
                onRepost={handleRepost}
                post={post}
            />
        </article>
    );
};

export default PostCard;
