import React from 'react';
import { cn } from '../../lib/utils';
import { Check, CheckCheck, Play, Pause, File as FileIcon } from 'lucide-react';

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'me' | 'them';
    time: string;
    type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'buzz';
    status: 'sent' | 'delivered' | 'read';
    mediaUrl?: string;
    metadata?: any;
    reactions?: { [key: string]: number }; // e.g. { '❤️': 2 }
    replyTo?: {
        id: string;
        text: string;
        sender: string;
    };
    isDeleted?: boolean;
    isEdited?: boolean;
}

export interface MessageProps {
    message: ChatMessage;
    onSwipeReply?: (msg: any) => void;
    onReact?: (msgId: string, reaction: string) => void;
    onLongPress?: (msg: any) => void;
    onEdit?: (msgId: string, newText: string) => void;
    onDelete?: (msgId: string) => void;
    onForward?: (msg: any) => void;
    onMediaClick?: (url: string) => void;
}

const MessageBubble: React.FC<MessageProps> = ({ message, onSwipeReply, onReact, onLongPress, onEdit, onDelete, onForward, onMediaClick }) => {
    const isMe = message.sender === 'me';
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editText, setEditText] = React.useState(message.text);

    if (message.isDeleted) {
        return (
            <div className={cn("flex w-full mb-2", isMe ? "justify-end" : "justify-start")}>
                <div className="px-4 py-2 bg-gray-100 rounded-xl text-gray-400 italic text-sm border border-gray-200">
                    Message deleted
                </div>
            </div>
        );
    }

    const handleSaveEdit = () => {
        if (onEdit && editText !== message.text) {
            onEdit(message.id, editText);
        }
        setIsEditing(false);
        setShowMenu(false);
    };

    return (
        <div
            className={cn("flex w-full mb-2 group relative", isMe ? "justify-end" : "justify-start")}
            onDoubleClick={() => onReact && onReact(message.id, '❤️')}
            onContextMenu={(e) => {
                e.preventDefault();
                setShowMenu(true);
            }}
        >
            {/* Context Menu */}
            {showMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className={cn(
                        "absolute top-8 z-50 bg-white rounded-xl shadow-xl w-32 py-2 overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200 origin-top-left",
                        isMe ? "right-0" : "left-0"
                    )}>
                        {isMe && message.type === 'text' && (
                            <button onClick={() => setIsEditing(true)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm font-medium">Edit</button>
                        )}
                        <button onClick={() => { onForward && onForward(message); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm font-medium">Forward</button>
                        {isMe && (
                            <button onClick={() => { onDelete && onDelete(message.id); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500 text-sm font-medium">Delete</button>
                        )}
                    </div>
                </>
            )}

            <div className={cn(
                "relative max-w-[75%] rounded-2xl shadow-sm transition-all",
                isMe
                    ? "bg-[#ff1744] text-white rounded-tr-none"
                    : "bg-white text-gray-900 rounded-tl-none"
            )}>
                {/* Reply Context */}
                {message.replyTo && (
                    <div className={cn(
                        "text-xs mb-1 p-2 rounded-lg border-l-4 opacity-80 truncate",
                        isMe ? "bg-white/20 border-white/50" : "bg-gray-100 border-gray-300"
                    )}>
                        <span className="font-bold block">{message.replyTo.sender === 'me' ? 'You' : 'Them'}</span>
                        {message.replyTo.text}
                    </div>
                )}

                <div className="px-3 py-2">
                    {/* Media: Image */}
                    {message.type === 'image' && message.mediaUrl && (
                        <div
                            className="mb-1 overflow-hidden rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent message bubble click/long-press interactions if any
                                onMediaClick && onMediaClick(message.mediaUrl!);
                            }}
                        >
                            <img src={message.mediaUrl} alt="Shared" className="w-full h-auto max-h-[300px] object-cover" />
                        </div>
                    )}

                    {/* Media: Video */}
                    {message.type === 'video' && message.mediaUrl && (
                        <div className="mb-1 overflow-hidden rounded-lg relative">
                            <video src={message.mediaUrl} controls className="w-full max-h-[300px] rounded-lg" />
                        </div>
                    )}

                    {/* Media: Voice */}
                    {message.type === 'voice' && message.mediaUrl && (
                        <div className="flex items-center gap-3 min-w-[200px] py-2">
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                    isMe ? "bg-white text-[#ff1744]" : "bg-[#ff1744] text-white"
                                )}
                            >
                                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                            </button>
                            {/* Fake waveform */}
                            <div className="flex-1 flex items-center gap-0.5 h-6">
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-1 rounded-full",
                                            isMe ? "bg-white/50" : "bg-gray-300"
                                        )}
                                        style={{ height: Math.random() * 100 + '%' }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs opacity-70">
                                {message.metadata?.duration || '0:15'}
                            </span>
                            {/* Note: Real audio player needed here normally */}
                            {isPlaying && <audio src={message.mediaUrl} autoPlay onEnded={() => setIsPlaying(false)} className="hidden" />}
                        </div>
                    )}

                    {/* Media: File (Generic) */}
                    {message.type === 'file' && (
                        <a href={message.mediaUrl} target="_blank" rel="noreferrer" className={cn(
                            "flex items-center gap-3 p-3 rounded-xl mb-1 transition-colors",
                            isMe ? "bg-white/20 hover:bg-white/30" : "bg-gray-100 hover:bg-gray-200"
                        )}>
                            <div className={cn(
                                "p-2 rounded-lg",
                                isMe ? "bg-white/20" : "bg-white"
                            )}>
                                <FileIcon size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate max-w-[150px]">
                                    {message.text || "Attachment"}
                                </p>
                                <span className="text-xs opacity-70">Click to open</span>
                            </div>
                        </a>
                    )}

                    {/* Text Content */}
                    {message.type === 'text' && (
                        isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                                <input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="bg-white/20 text-white rounded p-1 outline-none border border-white/30"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 text-xs font-bold">
                                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                                    <button onClick={handleSaveEdit} className="bg-white text-[#ff1744] px-2 py-1 rounded">Save</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                                {message.text}
                                {message.isEdited && <span className="text-[10px] opacity-60 ml-1">(edited)</span>}
                            </p>
                        )
                    )}

                    {/* Buzz Content */}
                    {message.type === 'buzz' && (
                        <div className="flex items-center gap-2 font-bold text-lg italic tracking-wider py-1 px-2">
                            <span className="text-2xl">⚡</span> BUZZ!
                        </div>
                    )}

                    {/* Metadata Footer */}
                    <div className={cn(
                        "flex items-center justify-end gap-1 mt-1 text-[10px]",
                        isMe ? "text-white/80" : "text-gray-400"
                    )}>
                        <span>{message.time}</span>
                        {isMe && (
                            <>
                                {message.status === 'sent' && <Check size={12} />}
                                {message.status === 'delivered' && <CheckCheck size={12} />}
                                {message.status === 'read' && <CheckCheck size={12} className="text-blue-200" />}
                            </>
                        )}
                    </div>
                </div>

                {/* Reactions */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="absolute -bottom-2 -left-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-full px-1.5 py-0.5 flex text-xs">
                        {Object.entries(message.reactions).map(([emoji, count]) => (
                            <span key={emoji}>{emoji} {count > 1 ? count : ''}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Action Menu Trigger (Invisible but accessible for long press logic later) */}
        </div>
    );
};

export default MessageBubble;
