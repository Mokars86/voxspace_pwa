import React, { useState, useRef } from 'react';
import {
    Smile, Paperclip, Mic, Send, Image as ImageIcon, Video, X, Trash2, StopCircle, Zap, Camera, MapPin, FileText, Music, Timer
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../services/supabase';

interface ChatInputProps {
    onSend: (content: string, type: 'text' | 'image' | 'video' | 'voice' | 'buzz' | 'location' | 'audio' | 'file', file?: File, duration?: number, metadata?: any) => void;
    onTyping?: () => void;
    replyTo?: any; // The message being replied to
    onCancelReply?: () => void;
}

const COMMON_EMOJIS = ["😀", "😂", "🥰", "😍", "😭", "😮", "😡", "👍", "👎", "🔥", "✨", "🎉", "💯", "🙏", "👋", "🤔", "👀", "🧠", "💀", "👻", "💩", "🤡", "❤️", "🧡", "💛", "💚", "💙", "💜", "🚀", "🌟"];

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onTyping, replyTo, onCancelReply }) => {
    const [inputValue, setInputValue] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [localBuzz, setLocalBuzz] = useState(false);

    const handleBuzzClick = () => {
        setLocalBuzz(true);
        if (navigator.vibrate) navigator.vibrate(50);
        (onSend as any)("BUZZ!", 'buzz');
        setShowAttachMenu(false);
        setTimeout(() => setLocalBuzz(false), 500);
    };

    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    // File Inputs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const viewOnceInputRef = useRef<HTMLInputElement>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (onTyping) onTyping();
    };

    const handleEmojiClick = (emoji: string) => {
        setInputValue(prev => prev + emoji);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.current.push(event.data);
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(d => d + 1);
            }, 1000);

        } catch (err) {
            console.error("Mic access denied", err);
            alert("Microphone access is needed for voice notes.");
        }
    };

    const stopRecording = (shouldSend: boolean) => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

                if (shouldSend) {
                    onSend('', 'voice', audioFile, recordingDuration);
                }

                // Cleanup
                const tracks = mediaRecorder.current?.stream.getTracks();
                tracks?.forEach(track => track.stop());
            };
            mediaRecorder.current.stop();
        }

        setIsRecording(false);
        clearInterval(timerRef.current);
    };

    const [previewFile, setPreviewFile] = useState<{ file: File, type: 'image' | 'video' | 'audio' | 'file', url: string, isViewOnce?: boolean } | null>(null);

    // Generic File Handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, typeOverride?: 'image' | 'video' | 'file' | 'audio', isViewOnce?: boolean) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            let type: any = typeOverride;

            if (!type) {
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';
                else type = 'file'; // Default to file for everything else
            }

            // Create local preview URL
            const url = URL.createObjectURL(file);
            setPreviewFile({ file, type, url, isViewOnce });
            setShowAttachMenu(false);

            // Reset input
            e.target.value = '';
        }
    };

    const confirmSendPreview = () => {
        if (!previewFile) return;
        onSend(previewFile.file.name, previewFile.type, previewFile.file, undefined, previewFile.isViewOnce ? { viewOnce: true } : undefined);
        URL.revokeObjectURL(previewFile.url); // Cleanup
        setPreviewFile(null);
    };

    const cancelPreview = () => {
        if (previewFile) URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
    };

    const handleLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // We send location as a special "message" with metadata
                onSend(`Location: ${latitude}, ${longitude}`, 'location', undefined, undefined, {
                    lat: latitude,
                    lng: longitude
                });
                setShowAttachMenu(false);
            },
            (error) => {
                console.error("Error getting location", error);
                alert("Unable to retrieve your location");
            }
        );
    };

    const handleSendClick = () => {
        if (inputValue.trim()) {
            onSend(inputValue, 'text', undefined, undefined, isViewOnce ? { viewOnce: true } : undefined);
            setInputValue('');
            setIsViewOnce(false);
        }
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}: ${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="flex flex-col w-full max-w-full">
            {/* File Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md flex-1 flex items-center justify-center overflow-hidden relative rounded-2xl bg-black">
                        {previewFile.type === 'video' ? (
                            <video src={previewFile.url} controls className="max-w-full max-h-[70vh] rounded-xl" />
                        ) : previewFile.type === 'image' ? (
                            <img src={previewFile.url} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
                        ) : (
                            <div className="flex flex-col items-center text-white gap-4">
                                <div className="p-6 bg-gray-800 rounded-full">
                                    {previewFile.type === 'audio' ? <Music size={48} /> : <FileText size={48} />}
                                </div>
                                <p className="font-medium text-lg">{previewFile.file.name}</p>
                                <p className="text-sm text-gray-400">{(previewFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        )}

                        <button
                            onClick={cancelPreview}
                            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="w-full max-w-md mt-6 flex gap-4">
                        <button
                            onClick={cancelPreview}
                            className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmSendPreview}
                            className="flex-1 py-3 bg-[#ff1744] text-white font-bold rounded-xl hover:bg-red-600 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Send size={20} /> Send
                        </button>
                    </div>
                </div>
            )}

            {replyTo && (
                <div className="flex items-center justify-between p-2 mx-4 mb-1 bg-gray-50 dark:bg-gray-800 border-l-4 border-primary rounded-r-lg shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="overflow-hidden">
                        <span className="text-xs font-bold text-primary">Replying to {replyTo.sender}</span>
                        <p className="text-sm truncate text-gray-600 dark:text-gray-300">{replyTo.text || 'Media'}</p>
                    </div>
                    <button onClick={onCancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" type="button">
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 w-full safe-bottom shadow-sm z-20 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-end gap-1 p-1 relative">
                    {/* Attachment Menu */}
                    {showAttachMenu && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
                            <div className="absolute bottom-16 left-2 z-40 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 grid grid-cols-3 gap-2 w-64 animate-in slide-in-from-bottom-5 duration-200">
                                <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center"><Camera size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Camera</span>
                                </button>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center"><ImageIcon size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Gallery</span>
                                </button>
                                <button type="button" onClick={() => docInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center"><FileText size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Document</span>
                                </button>
                                <button type="button" onClick={() => audioInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center"><Music size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Audio</span>
                                </button>
                                <button type="button" onClick={handleLocation} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-500 flex items-center justify-center"><MapPin size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Location</span>
                                </button>
                                <button type="button" onClick={() => viewOnceInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center"><Timer size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">View Once</span>
                                </button>
                                <button type="button" onClick={handleBuzzClick} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className={cn("w-10 h-10 rounded-full bg-[#ff1744] hover:bg-[#ff1744]/90 text-white flex items-center justify-center shadow-md transition-all active:scale-95", localBuzz && "animate-shake")}>
                                        <Zap size={20} className={cn("fill-current", localBuzz && "text-yellow-300")} />
                                    </div>
                                    <span className="text-xs font-medium dark:text-gray-300">Buzz</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* Hidden Inputs */}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => handleFileSelect(e)} />
                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={docInputRef} className="hidden" accept="*/*" onChange={(e) => handleFileSelect(e, 'file')} />
                    <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => handleFileSelect(e, 'audio')} />
                    <input type="file" ref={viewOnceInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => handleFileSelect(e, undefined, true)} />

                    {isRecording ? (
                        <div className="flex-1 bg-red-50 dark:bg-red-900/10 rounded-3xl flex items-center justify-between px-4 py-3 animate-pulse border border-red-100 dark:border-red-900/30">
                            <div className="flex items-center gap-3 text-red-500 font-medium">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                                <span>Recording {formatDuration(recordingDuration)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <button type="button" onClick={() => stopRecording(false)} className="text-gray-400 hover:text-red-500">
                                    <Trash2 size={24} />
                                </button>
                                <button type="button" onClick={() => stopRecording(true)} className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                                    <Send size={20} className="ml-1" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center px-2 py-1.5 transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-white dark:focus-within:bg-gray-900 relative">
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl p-4 grid grid-cols-6 gap-2 w-64 h-48 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
                                        {COMMON_EMOJIS.map(emoji => (
                                            <button
                                                type="button"
                                                key={emoji}
                                                onClick={() => handleEmojiClick(emoji)}
                                                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsViewOnce(!isViewOnce); }}
                                    className={cn("p-1 mr-1 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors", isViewOnce && "text-pink-500")}
                                >
                                    <Timer size={20} className={cn(isViewOnce && "fill-current")} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                                    className={cn("p-1 mr-1 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors", showEmojiPicker && "text-primary")}
                                >
                                    <Smile size={24} />
                                </button>



                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={handleTextChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSendClick();
                                    }}
                                    className="flex-1 bg-transparent border-none outline-none text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-500 max-h-32 py-1 min-w-0"
                                />

                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
                                    className={cn("p-1 ml-1 text-gray-400 hover:text-gray-600 transition-colors rotate-45", showAttachMenu && "text-primary")}
                                >
                                    <Paperclip size={22} />
                                </button>
                            </div>

                            <div className="h-10 w-10 flex-shrink-0">
                                {inputValue ? (
                                    <button
                                        onClick={handleSendClick}
                                        className="w-full h-full bg-[#ff1744] hover:bg-[#ff1744]/90 text-white rounded-full flex items-center justify-center shadow-md transition-all active:scale-95"
                                    >
                                        <Send size={20} className="ml-1" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        className="w-full h-full bg-[#ff1744] hover:bg-[#ff1744]/90 text-white rounded-full flex items-center justify-center shadow-md transition-all active:scale-95"
                                    >
                                        <Mic size={22} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatInput;
