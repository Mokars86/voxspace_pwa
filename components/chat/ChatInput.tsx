import React, { useState, useRef } from 'react';
import {
    Smile, Paperclip, Mic, Send, Image as ImageIcon, Video, X, Trash2, StopCircle, Zap, Camera, MapPin, FileText, Music, Timer, User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../services/supabase';

interface ChatInputProps {
    onSend: (content: string, type: 'text' | 'image' | 'video' | 'voice' | 'buzz' | 'location' | 'audio' | 'file' | 'contact', files?: File | File[], duration?: number, metadata?: any) => void;
    onTyping?: () => void;
    onRecording?: (isRecording: boolean) => void;
    replyTo?: any; // The message being replied to
    onCancelReply?: () => void;
}

const COMMON_EMOJIS = ["😀", "😂", "🥰", "😍", "😭", "😮", "😡", "👍", "👎", "🔥", "✨", "🎉", "💯", "🙏", "👋", "🤔", "👀", "🧠", "💀", "👻", "💩", "🤡", "❤️", "🧡", "💛", "💚", "💜", "🚀", "🌟"];

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onTyping, onRecording, replyTo, onCancelReply }) => {
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

    const onContactPickerClick = async () => {
        setShowAttachMenu(false);

        // Native Contact Picker
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                // @ts-ignore
                const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });

                if (contacts && contacts.length > 0) {
                    const contact = contacts[0];
                    const name = contact.name ? contact.name[0] : 'Unknown';
                    const phone = contact.tel ? contact.tel[0] : '';

                    if (name && phone) {
                        onSend(`Contact: ${name}`, 'contact', undefined, undefined, { name, phone });
                    } else {
                        alert("Selected contact missing name or phone number.");
                    }
                }
            } catch (err) {
                console.error("Contact picker failed or cancelled", err);
                setShowContactModal(true);
            }
        } else {
            setShowContactModal(true);
        }
    };

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
            if (onRecording) onRecording(true);
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
        if (onRecording) onRecording(false);
        clearInterval(timerRef.current);
    };

    const [previewFiles, setPreviewFiles] = useState<{ file: File, type: 'image' | 'video' | 'audio' | 'file', url: string, isViewOnce?: boolean }[]>([]);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

    // Generic File Handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, typeOverride?: 'image' | 'video' | 'file' | 'audio', isViewOnce?: boolean) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => {
                let type: any = typeOverride;
                if (!type) {
                    if (file.type.startsWith('image/')) type = 'image';
                    else if (file.type.startsWith('video/')) type = 'video';
                    else if (file.type.startsWith('audio/')) type = 'audio';
                    else type = 'file';
                }
                const url = URL.createObjectURL(file);
                return { file, type, url, isViewOnce };
            });

            setPreviewFiles(prev => [...prev, ...newFiles]);
            setShowAttachMenu(false);
            e.target.value = '';
        }
    };

    const confirmSendPreview = () => {
        if (previewFiles.length === 0) return;

        const files = previewFiles.map(f => f.file);
        // Determine main type from first file, or mixed? Usually just send as 'image' if photos.
        // If mixed types, backend or chat logic handles it. For now assuming homogeneous or defaulting to first.
        const mainType = previewFiles[0].type;
        const isViewOnce = previewFiles[0].isViewOnce;

        onSend(
            previewFiles.length > 1 ? `${previewFiles.length} files` : files[0].name,
            mainType,
            files, // Send array
            undefined,
            isViewOnce ? { viewOnce: true } : undefined
        );

        // Cleanup
        previewFiles.forEach(f => URL.revokeObjectURL(f.url));
        setPreviewFiles([]);
        setCurrentPreviewIndex(0);
    };

    const cancelPreview = () => {
        previewFiles.forEach(f => URL.revokeObjectURL(f.url));
        setPreviewFiles([]);
        setCurrentPreviewIndex(0);
    };

    // ... (rest of helper functions) ...

    const handleLocation = () => {
        // ... (existing implementation) ...
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

    // ... (rest of handlers) ...

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

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    const handleSendContact = () => {
        // ... (existing implementation) ...
        if (contactName && contactPhone) {
            onSend(`Contact: ${contactName}`, 'contact', undefined, undefined, { name: contactName, phone: contactPhone });
            setShowContactModal(false);
            setContactName('');
            setContactPhone('');
            setShowAttachMenu(false);
        } else {
            alert("Please enter both name and phone number.");
        }
    };



    return (
        <div className="flex flex-col w-full max-w-full">
            {/* File Preview Modal */}
            {previewFiles.length > 0 && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col pt-4 pb-8 px-4 animate-in fade-in duration-200">

                    {/* Main Preview */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden relative rounded-2xl bg-black mb-4">
                        {previewFiles[currentPreviewIndex].type === 'video' ? (
                            <video src={previewFiles[currentPreviewIndex].url} controls className="max-w-full max-h-[60vh] rounded-xl" />
                        ) : previewFiles[currentPreviewIndex].type === 'image' ? (
                            <img src={previewFiles[currentPreviewIndex].url} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded-xl" />
                        ) : (
                            <div className="flex flex-col items-center text-white gap-4">
                                <div className="p-6 bg-gray-800 rounded-full">
                                    {previewFiles[currentPreviewIndex].type === 'audio' ? <Music size={48} /> : <FileText size={48} />}
                                </div>
                                <p className="font-medium text-lg">{previewFiles[currentPreviewIndex].file.name}</p>
                            </div>
                        )}

                        <button
                            onClick={cancelPreview}
                            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Thumbnail Strip */}
                    {previewFiles.length > 1 && (
                        <div className="flex gap-2 mb-6 overflow-x-auto px-2 justify-center">
                            {previewFiles.map((f, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setCurrentPreviewIndex(idx)}
                                    className={cn(
                                        "w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0",
                                        currentPreviewIndex === idx ? "border-[#ff1744] scale-105" : "border-transparent opacity-60 hover:opacity-100"
                                    )}
                                >
                                    {f.type === 'image' || f.type === 'video' ? (
                                        <img src={f.url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                            {f.type === 'audio' ? <Music size={20} className="text-white" /> : <FileText size={20} className="text-white" />}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {/* Add More Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-16 h-16 rounded-lg border-2 border-gray-700 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                            >
                                <plus size={24} />
                                <span className="text-xs absolute mt-8">+</span>
                            </button>
                        </div>
                    )}

                    <div className="w-full max-w-md mx-auto flex gap-4">
                        {/* Caption Input could go here */}
                    </div>

                    <div className="w-full max-w-md mx-auto flex gap-4">
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
                            <Send size={20} /> Send {previewFiles.length > 1 ? `(${previewFiles.length})` : ''}
                        </button>
                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Share Contact</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-[#ff1744] text-gray-900 dark:text-white"
                                    placeholder="Enter name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-[#ff1744] text-gray-900 dark:text-white"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowContactModal(false)}
                                className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendContact}
                                className="flex-1 py-3 bg-[#ff1744] text-white font-bold rounded-xl hover:bg-[#d50000] transition-colors"
                            >
                                Send
                            </button>
                        </div>
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
                                <button type="button" onClick={onContactPickerClick} className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-500 flex items-center justify-center"><User size={20} /></div>
                                    <span className="text-xs font-medium dark:text-gray-300">Contact</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* Hidden Inputs */}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={(e) => handleFileSelect(e)} />
                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" multiple onChange={(e) => handleFileSelect(e, 'image')} />
                    <input type="file" ref={docInputRef} className="hidden" accept="*/*" multiple onChange={(e) => handleFileSelect(e, 'file')} />
                    <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" multiple onChange={(e) => handleFileSelect(e, 'audio')} />
                    <input type="file" ref={viewOnceInputRef} className="hidden" accept="image/*,video/*" multiple onChange={(e) => handleFileSelect(e, undefined, true)} />

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
