import React from 'react';
import { cn } from '../../lib/utils';
import { Check, CheckCheck, Play, Pause, File as FileIcon, MapPin, Music, Timer, EyeOff, Lock, Video, Reply, ShoppingBag, Download } from 'lucide-react';

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'me' | 'them';
    time: string;
    type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'buzz' | 'location' | 'audio' | 'contact';
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
    expiresAt?: string;
    viewOnce?: boolean;
    isViewed?: boolean;
    isPinned?: boolean;
    createdAt?: string; // Full ISO string for date separators
}

export interface MessageProps {
    message: ChatMessage;
    onSwipeReply?: (msg: any) => void;
    onReact?: (msgId: string, reaction: string) => void;
    onLongPress?: (msg: any) => void;
    onEdit?: (msgId: string, newText: string) => void;
    onDelete?: (msgId: string) => void;
    onForward?: (msg: any) => void;
    onMediaClick?: (url: string, type: 'image' | 'video' | 'file', allUrls?: string[]) => void;
    onViewOnce?: (msg: ChatMessage) => void;
    onPin?: (msg: ChatMessage) => void;
    onSaveToBag?: (msg: ChatMessage) => void;
}

const AudioPlayer = ({ url, isMe, duration: initialDuration, type }: { url: string, isMe: boolean, duration?: number | string, type: string }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const progressBarRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (initialDuration && typeof initialDuration === 'number') {
            setDuration(initialDuration);
        }
    }, [initialDuration]);

    const togglePlay = async () => {
        if (!audioRef.current) return;
        try {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                await audioRef.current.play();
            }
        } catch (e) {
            console.error("Playback failed", e);
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (!initialDuration && audioRef.current.duration && audioRef.current.duration !== Infinity) {
                setDuration(audioRef.current.duration);
            }
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.min(Math.max(x / rect.width, 0), 1);
        const newTime = (duration || audioRef.current.duration || 10) * percentage;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (time: number) => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className="flex items-center gap-3 w-full py-1">
            <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95",
                    isMe ? "bg-white text-[#ff1744]" : "bg-[#ff1744] text-white"
                )}
            >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </button>

            <div
                className="flex-1 flex flex-col justify-center gap-1 cursor-pointer group"
                onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
                ref={progressBarRef}
            >
                <div className="h-8 flex items-center gap-[2px] w-full">
                    {[...Array(30)].map((_, i) => {
                        const progress = currentTime / (duration || 1);
                        const height = Math.max(20, Math.random() * 100) + '%';
                        const isPlayed = (i / 30) < progress;

                        return (
                            <div
                                key={i}
                                className={cn(
                                    "w-1 rounded-full transition-all duration-100",
                                    isMe
                                        ? (isPlayed ? "bg-white opacity-100" : "bg-white opacity-40")
                                        : (isPlayed ? "bg-[#ff1744] opacity-100" : "bg-gray-300 dark:bg-gray-600")
                                )}
                                style={{ height: height }}
                            />
                        );
                    })}
                </div>
            </div>

            <span className={cn("text-xs font-medium tabular-nums w-10 text-right", isMe ? "text-white/90" : "text-gray-500")}>
                {formatTime(isPlaying ? currentTime : (duration || 0))}
            </span>

            <audio
                ref={audioRef}
                src={url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onEnded={handleEnded}
                // onError={(e) => console.error("Audio Load Error", e)} // Suppress noise
                onError={() => { }} // Silent fail
                className="hidden"
            />

            <a
                href={url}
                download={`audio_${Date.now()}.mp3`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                    "p-2 rounded-full transition-colors",
                    isMe ? "text-white/80 hover:bg-white/20" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
            >
                <Download size={18} />
            </a>
        </div>
    );
};

const MessageBubble: React.FC<MessageProps> = ({ message, onSwipeReply, onReact, onLongPress, onEdit, onDelete, onForward, onMediaClick, onViewOnce, onPin, onSaveToBag }) => {
    const isMe = message.sender === 'me';
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editText, setEditText] = React.useState(message.text);

    // Swipe & Long Press Logic
    const [swipeOffset, setSwipeOffset] = React.useState(0);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const SWIPE_THRESHOLD = 50;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (showMenu || isEditing) return; // Disable if menu/edit open
        touchStartRef.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };

        // Start Long Press Timer
        longPressTimerRef.current = setTimeout(() => {
            setShowMenu(true);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartRef.current === null) return;
        const currentX = e.targetTouches[0].clientX;
        const currentY = e.targetTouches[0].clientY;
        const diffX = currentX - touchStartRef.current.x;
        const diffY = currentY - touchStartRef.current.y;

        // If vertical scroll is significant, cancel everything and don't track horizontal
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 5) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            return;
        }

        // Cancel Long Press if moved
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }

        // Only allow swiping right (positive diff) and clamp it
        // Add a small deadzone of 10px before starting visual swipe to allow clean vertical scroll start
        if (diffX > 10 && diffX < 100) {
            // Prevent default only if we are sure it's a swipe (handled via CSS touch-action mostly)
            setSwipeOffset(diffX);
        }
    };

    const handleTouchEnd = () => {
        // Clear Long Press Timer
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (swipeOffset > SWIPE_THRESHOLD) {
            if (onSwipeReply) onSwipeReply(message);
            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(50);
        }
        setSwipeOffset(0);
        touchStartRef.current = null;
    };


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
            className={cn("flex w-full mb-2 group relative items-center touch-pan-y", isMe ? "justify-end" : "justify-start")}
            onDoubleClick={() => onReact && onReact(message.id, '❤️')}
            onContextMenu={(e) => {
                e.preventDefault();
                setShowMenu(true);
            }}
            // Swipe Listeners
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Reply Icon Indicator (Visible on Swipe) */}
            <div
                className="absolute left-0 flex items-center justify-center text-gray-400 transition-opacity duration-200"
                style={{
                    opacity: swipeOffset > 10 ? Math.min(swipeOffset / SWIPE_THRESHOLD, 1) : 0,
                    transform: `translateX(${Math.min(swipeOffset / 2, 20)}px) scale(${Math.min(swipeOffset / SWIPE_THRESHOLD, 1)})`
                }}
            >
                <div className={cn("p-1.5 rounded-full", swipeOffset > SWIPE_THRESHOLD ? "bg-gray-200 text-[#ff1744]" : "")}>
                    <Reply size={20} />
                </div>
            </div>


            {/* Context Menu */}
            {showMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className={cn(
                        "absolute top-8 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl w-40 py-2 overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 origin-top-left",
                        isMe ? "right-0" : "left-0"
                    )}>
                        <button onClick={() => { onPin && onPin(message); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-bold text-gray-700 dark:text-gray-200">
                            {message.isPinned ? "Unpin Message" : "Pin Message"}
                        </button>
                        {isMe && message.type === 'text' && (
                            <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-bold text-gray-700 dark:text-gray-200">Edit</button>
                        )}
                        <button onClick={() => { onForward && onForward(message); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-bold text-gray-700 dark:text-gray-200">Forward</button>
                        <button onClick={() => { onSaveToBag && onSaveToBag(message); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            Save to Bag
                        </button>
                        {message.type === 'text' && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(message.text);
                                    setShowMenu(false);
                                    /* Optional: Show toast */
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm font-bold text-gray-700 dark:text-gray-200"
                            >
                                Copy Text
                            </button>
                        )}
                        {isMe && (
                            <button onClick={() => { onDelete && onDelete(message.id); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 text-sm font-bold">Delete</button>
                        )}
                    </div>
                </>
            )}

            <div
                className={cn(
                    "relative max-w-[75%] rounded-2xl shadow-sm transition-transform duration-75 overflow-hidden",
                    isMe
                        ? "bg-[#ff1744] text-white rounded-tr-none"
                        : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-none"
                )}
                style={{ transform: `translateX(${swipeOffset}px)` }}
            >
                {/* Reply Context */}
                {message.replyTo && (
                    <div className={cn(
                        "text-xs mb-1 p-2 rounded-lg border-l-4 opacity-80 truncate",
                        isMe ? "bg-black/10 border-white/50" : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    )}>
                        <span className="font-bold block">{message.replyTo.sender === 'me' ? 'You' : 'Them'}</span>
                        {message.replyTo.text}
                    </div>
                )}

                <div className="px-3 py-2">
                    {/* View Once Logic */}
                    {message.viewOnce ? (
                        <div className="flex items-center gap-3 p-2 rounded-xl min-w-[120px]">
                            {message.isViewed ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <div className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center">
                                        <div className="w-4 h-4 rounded-full bg-gray-300" />
                                    </div>
                                    <span className="italic text-sm">Opened</span>
                                </div>
                            ) : isMe ? (
                                <div className="flex items-center gap-2 text-white/80">
                                    <div className="w-8 h-8 rounded-full border border-white/50 border-dashed flex items-center justify-center">
                                        <Timer size={16} />
                                    </div>
                                    <span className="italic text-sm">View Once</span>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onViewOnce && onViewOnce(message); }}
                                    className="flex items-center gap-2 text-primary font-bold bg-white/90 px-3 py-1.5 rounded-full shadow-sm hover:scale-105 transition-transform"
                                >
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary text-xs">
                                        1
                                    </div>
                                    <span className="text-sm">Tap to view</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Media: Image / Multi-Image */}
                            {message.type === 'image' && (
                                message.mediaUrls && message.mediaUrls.length > 1 ? (
                                    <div className="mb-1 grid gap-0.5 overflow-hidden rounded-lg cursor-pointer max-w-[300px]"
                                        style={{
                                            gridTemplateColumns: message.mediaUrls.length === 2 ? '1fr 1fr' : '1fr 1fr',
                                            gridTemplateRows: message.mediaUrls.length > 2 ? '1fr 1fr' : 'auto'
                                        }}
                                    >
                                        {message.mediaUrls.slice(0, 4).map((url, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "relative overflow-hidden aspect-square",
                                                    message.mediaUrls!.length === 3 && idx === 0 ? "col-span-2 aspect-[2/1]" : ""
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMediaClick && onMediaClick(url, 'image', message.mediaUrls!);
                                                }}
                                            >
                                                <img src={url} alt="Shared" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                                {/* Overlay for +X more */}
                                                {idx === 3 && message.mediaUrls!.length > 4 && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">
                                                        +{message.mediaUrls!.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    message.mediaUrl && (
                                        <div
                                            className="mb-1 overflow-hidden rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMediaClick && onMediaClick(message.mediaUrl!, 'image', [message.mediaUrl!]);
                                            }}
                                        >
                                            <img src={message.mediaUrl} alt="Shared" className="w-full h-auto max-h-[300px] object-cover" />
                                        </div>
                                    )
                                )
                            )}

                            {/* Media: Video */}
                            {message.type === 'video' && message.mediaUrl && (
                                <div
                                    className="mb-1 overflow-hidden rounded-lg relative cursor-pointer group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMediaClick && onMediaClick(message.mediaUrl!, 'video');
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors z-10">
                                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm shadow-sm ring-1 ring-white/20 group-hover:scale-110 transition-transform">
                                            <Play className="text-white fill-white ml-1" size={24} />
                                        </div>
                                    </div>
                                    {message.metadata?.thumbnailUrl ? (
                                        <img src={message.metadata.thumbnailUrl} className="w-full max-h-[300px] rounded-lg object-cover bg-black" alt="Video thumbnail" />
                                    ) : (
                                        <video src={message.mediaUrl} className="w-full max-h-[300px] rounded-lg object-cover bg-black" preload="metadata" />
                                    )}
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium flex items-center gap-1">
                                        <Video size={10} /> Video
                                    </div>
                                </div>
                            )}

                            {/* Media: Voice OR Audio */}
                            {(message.type === 'voice' || message.type === 'audio') && message.mediaUrl && (
                                <AudioPlayer
                                    url={message.mediaUrl}
                                    isMe={isMe}
                                    duration={message.metadata?.duration}
                                    type={message.type}
                                />
                            )}

                            {/* Media: File (Generic) */}
                            {message.type === 'file' && (
                                (() => {
                                    const isPdf = message.mediaUrl?.toLowerCase().endsWith('.pdf') || message.text?.toLowerCase().endsWith('.pdf');
                                    return (
                                        <div
                                            onClick={(e) => {
                                                if (isPdf) {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    onMediaClick && onMediaClick(message.mediaUrl!, 'file');
                                                }
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl mb-1 transition-colors cursor-pointer",
                                                isMe ? "bg-white/20 hover:bg-white/30" : "bg-gray-100 hover:bg-gray-200"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg flex items-center justify-center",
                                                isMe ? "bg-white/20" : "bg-white",
                                                isPdf ? "text-red-500" : ""
                                            )}>
                                                <FileIcon size={24} />
                                                {isPdf && <span className="absolute text-[8px] font-bold mt-1 text-white bg-red-500 px-0.5 rounded">PDF</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate max-w-[150px]">
                                                    {message.text || "Attachment"}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs opacity-70">
                                                    <span>{isPdf ? "Tap to preview" : "Click to download"}</span>
                                                    {!isPdf && (
                                                        <a href={message.mediaUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline">
                                                            Download
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </>
                    )}

                    {/* Location */}
                    {message.type === 'location' && message.metadata && (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <MapPin size={20} className="text-[#ff1744]" />
                                <span>Location Shared</span>
                            </div>
                            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 opacity-50 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center" />
                                <div className="z-10 bg-white/80 dark:bg-black/50 p-2 rounded-lg backdrop-blur-sm text-xs font-mono">
                                    {Number(message.metadata.lat).toFixed(4)}, {Number(message.metadata.lng).toFixed(4)}
                                </div>
                            </div>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${message.metadata.lat},${message.metadata.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-center py-2 bg-gray-100 dark:bg-gray-700 text-blue-500 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Open in Maps
                            </a>
                        </div>
                    )}

                    {/* Contact */}
                    {message.type === 'contact' && message.metadata && (
                        <div className="flex flex-col gap-3 min-w-[220px] bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{message.metadata.name}</p>
                                    <p className="text-sm text-gray-500 truncate">{message.metadata.phone}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={`tel:${message.metadata.phone}`}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Call
                                </a>
                                <button
                                    onClick={() => navigator.clipboard.writeText(message.metadata.phone)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Text Content */}
                    {message.type === 'text' && (
                        isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                                <input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className={cn(
                                        "rounded p-2 outline-none border transition-colors w-full",
                                        isMe
                                            ? "bg-white/20 text-white border-white/30 placeholder:text-white/60 focus:bg-white/30"
                                            : "bg-gray-100 text-gray-900 border-gray-200 focus:bg-white focus:border-blue-500"
                                    )}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex justify-end gap-2 text-xs font-bold">
                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} className={cn("px-2 py-1 rounded hover:bg-black/10", isMe ? "text-white" : "text-gray-500")}>Cancel</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} className={cn("px-2 py-1 rounded shadow-sm", isMe ? "bg-white text-primary hover:bg-gray-50" : "bg-blue-500 text-white hover:bg-blue-600")}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                                {(() => {
                                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                                    return message.text.split(urlRegex).map((part, i) => {
                                        if (part.match(urlRegex)) {
                                            return (
                                                <a
                                                    key={i}
                                                    href={part}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn(
                                                        "underline hover:opacity-80 break-all font-medium",
                                                        isMe ? "text-white" : "text-blue-600 dark:text-blue-400"
                                                    )}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {part}
                                                </a>
                                            );
                                        }
                                        return part;
                                    });
                                })()}
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
            </div>


            {/* Reactions */}
            {
                message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="absolute -bottom-2 -left-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-full px-1.5 py-0.5 flex text-xs">
                        {Object.entries(message.reactions).map(([emoji, count]) => (
                            <span key={emoji}>{emoji} {(count as number) > 1 ? count : ''}</span>
                        ))}
                    </div>
                )
            }
        </div >
    );
};

export default MessageBubble;
