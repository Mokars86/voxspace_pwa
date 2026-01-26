import React, { useState, useRef, useEffect } from 'react';
import { X, Image, Type, Send, Loader2, Video, Mic, ListChecks, Trash2, StopCircle, Clock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../services/supabase';
import { generateVideoThumbnail } from '../lib/videoUtils';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface CreateStoryModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<'select' | 'text' | 'media' | 'voice' | 'poll'>('select');
    const [text, setText] = useState('');
    const [backgroundColor, setBackgroundColor] = useState('from-purple-500 to-blue-500');
    // Poll State
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [privacy, setPrivacy] = useState<'public' | 'followers' | 'only_me'>('followers');
    const [duration, setDuration] = useState<12 | 24 | 48>(24);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Multi-File State
    const [previewFiles, setPreviewFiles] = useState<{ file: File, type: 'image' | 'video', url: string }[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [caption, setCaption] = useState(''); // Shared caption for now, or per file? Let's use shared for batch or per file if complex. Shared is simpler for MVP batch.

    // Cleanup URLs
    useEffect(() => {
        return () => {
            previewFiles.forEach(f => URL.revokeObjectURL(f.url));
        };
    }, [previewFiles]);

    const colors = [
        'from-purple-500 to-blue-500',
        'from-red-500 to-orange-500',
        'from-green-400 to-blue-500',
        'from-pink-500 to-rose-500',
        'from-gray-700 to-gray-900',
    ];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPreviews: typeof previewFiles = [];

        Array.from(files).forEach(file => {
            const isVideo = file.type.startsWith('video/');
            const url = URL.createObjectURL(file);
            newPreviews.push({
                file,
                type: isVideo ? 'video' : 'image',
                url
            });
        });

        // Append if multiple selects allowed incrementally, or replace? Usually replace in this UI flow.
        setPreviewFiles(newPreviews);
        setCurrentIndex(0);
        setMode('media');
    };

    const handleMediaPost = async () => {
        if (previewFiles.length === 0 || !user) return;

        setLoading(true);
        try {
            // Upload Loop
            for (const item of previewFiles) {
                const file = item.file;
                const fileExt = file.name.split('.').pop() || 'bin';
                const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('stories')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('stories').getPublicUrl(fileName);

                let thumbnailUrl = '';
                if (item.type === 'video') {
                    try {
                        const thumbBlob = await generateVideoThumbnail(file);
                        if (thumbBlob) {
                            const thumbName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}_thumb.jpg`;
                            await supabase.storage.from('stories').upload(thumbName, thumbBlob);
                            const { data: thumbData } = supabase.storage.from('stories').getPublicUrl(thumbName);
                            thumbnailUrl = thumbData.publicUrl;
                        }
                    } catch (e) { console.error("Thumbnail error", e); }
                }

                await createStory({
                    type: item.type,
                    media_url: data.publicUrl,
                    content: caption, // Using same caption for all, or could use ''
                    metadata: thumbnailUrl ? { thumbnailUrl } : undefined
                }, false); // don't close yet
            }

            onSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            alert('Failed to upload one or more items');
        } finally {
            setLoading(false);
        }
    };

    const handleTextPost = async () => {
        if (!text.trim()) return;
        setLoading(true);
        await createStory({
            type: 'text',
            content: text,
            metadata: {
                backgroundColor,
                font: 'sans',
            }
        });
    };

    const handlePollPost = async () => {
        if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
        setLoading(true);
        const optionsData = pollOptions.map(opt => ({ text: opt, count: 0 }));
        await createStory({
            type: 'poll',
            content: pollQuestion,
            poll_options: optionsData
        });
    };

    // Voice Recorder (Existing logic preserved)
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setVoiceBlob(blob);
                chunksRef.current = [];
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            const timer = setInterval(() => setRecordingTime(p => p + 1), 1000);
            (mediaRecorder as any).timerId = timer;
        } catch (e) {
            console.error(e);
            alert("Could not access microphone");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            clearInterval((mediaRecorderRef.current as any).timerId);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const handleVoicePost = async () => {
        if (!voiceBlob || !user) return;
        setLoading(true);
        try {
            const fileName = `${user.id}/${Date.now()}_voice.webm`;
            await supabase.storage.from('stories').upload(fileName, voiceBlob);
            const { data } = supabase.storage.from('stories').getPublicUrl(fileName);
            await createStory({ type: 'voice', media_url: data.publicUrl });
        } catch (e) {
            console.error(e);
            alert("Failed to upload");
            setLoading(false);
        }
    };

    const createStory = async (storyData: any, close = true) => {
        try {
            const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
            const { error } = await supabase.from('stories').insert({
                user_id: user?.id,
                privacy_level: privacy,
                expires_at: expiresAt,
                ...storyData
            });
            if (error) throw error;
            if (close) {
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error(error);
            alert('Failed to post story');
            setLoading(false);
        }
    };

    const currentPreview = previewFiles[currentIndex];

    // Carousel Navigation
    const nextPreview = () => {
        if (currentIndex < previewFiles.length - 1) setCurrentIndex(p => p + 1);
    };
    const prevPreview = () => {
        if (currentIndex > 0) setCurrentIndex(p => p - 1);
    };
    const removeCurrent = () => {
        const newFiles = [...previewFiles];
        newFiles.splice(currentIndex, 1);
        if (newFiles.length === 0) {
            setMode('select');
            setPreviewFiles([]);
        } else {
            setPreviewFiles(newFiles);
            if (currentIndex >= newFiles.length) setCurrentIndex(newFiles.length - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/10 z-50">
                <X size={24} />
            </button>

            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
                {mode === 'select' && (
                    <div className="p-8 flex flex-col gap-4 overflow-y-auto">
                        <h2 className="text-2xl font-bold text-center mb-4 dark:text-white">Add to Story</h2>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Image size={24} /></div>
                            <div className="text-left"><h3 className="font-bold dark:text-white">Photo / Video</h3><p className="text-sm text-gray-500">Select multiple items</p></div>
                        </button>
                        <button onClick={() => setMode('text')} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><Type size={24} /></div>
                            <div className="text-left"><h3 className="font-bold dark:text-white">Text</h3></div>
                        </button>
                        <button onClick={() => setMode('poll')} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full"><ListChecks size={24} /></div>
                            <div className="text-left"><h3 className="font-bold dark:text-white">Poll</h3></div>
                        </button>
                        <button onClick={() => setMode('voice')} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <div className="p-3 bg-red-100 text-red-600 rounded-full"><Mic size={24} /></div>
                            <div className="text-left"><h3 className="font-bold dark:text-white">Voice Note</h3></div>
                        </button>
                    </div>
                )}

                {/* Media Preview Mode */}
                {mode === 'media' && currentPreview && (
                    <div className="flex flex-col h-full bg-black relative">
                        <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
                            {currentPreview.type === 'video' ? (
                                <video src={currentPreview.url} className="max-w-full max-h-full object-contain" controls />
                            ) : (
                                <img src={currentPreview.url} className="max-w-full max-h-full object-contain" alt="Preview" />
                            )}

                            {/* Nav Buttons */}
                            {previewFiles.length > 1 && (
                                <>
                                    {currentIndex > 0 && (
                                        <button onClick={prevPreview} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full"><ChevronLeft /></button>
                                    )}
                                    {currentIndex < previewFiles.length - 1 && (
                                        <button onClick={nextPreview} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full"><ChevronRight /></button>
                                    )}
                                    {/* Pagination Dots */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                                        {previewFiles.map((_, i) => (
                                            <div key={i} className={cn("w-2 h-2 rounded-full transition-all", i === currentIndex ? "bg-white w-4" : "bg-white/50")} />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Remove Button */}
                            <button onClick={removeCurrent} className="absolute top-4 right-4 p-2 bg-red-600/80 text-white rounded-full z-10"><Trash2 size={16} /></button>
                        </div>

                        <div className="p-4 bg-gradient-to-t from-black/90 to-transparent absolute bottom-0 left-0 right-0 z-20">
                            {/* Counter */}
                            {previewFiles.length > 1 && (
                                <div className="text-white text-xs font-bold mb-2 text-center bg-black/30 rounded-full py-1 px-3 self-center inline-block mx-auto w-fit">
                                    {currentIndex + 1} / {previewFiles.length}
                                </div>
                            )}

                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Add a caption..."
                                className="w-full bg-transparent text-white placeholder-white/70 border-b border-white/30 pb-2 mb-4 outline-none focus:border-white font-medium shadow-black drop-shadow-md"
                            />
                            <div className="flex justify-between items-center">
                                <button onClick={() => { setMode('select'); setPreviewFiles([]); setCaption(''); }} className="text-white hover:text-gray-300 font-bold text-sm">Cancel</button>
                                <button
                                    onClick={handleMediaPost}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : (
                                        <>Share {previewFiles.length > 1 ? `(${previewFiles.length})` : ''}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Text and Poll Modes (Simplified Logic Wrapper) */}
                {mode === 'text' && (
                    <div className={`aspect-[9/16] w-full bg-gradient-to-br ${backgroundColor} flex flex-col p-6 relative transition-colors duration-500`}>
                        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type something..." className="flex-1 w-full bg-transparent text-white text-3xl font-bold text-center placeholder-white/50 outline-none resize-none pt-20" autoFocus />
                        <div className="flex flex-col gap-4 mt-auto w-full">
                            <div className="flex justify-center gap-2 flex-wrap">
                                {colors.map(c => (
                                    <button key={c} onClick={() => setBackgroundColor(c)} className={`w-8 h-8 rounded-full bg-gradient-to-br ${c} border-2 ${backgroundColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80'} transition-all`} />
                                ))}
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <button onClick={handleTextPost} disabled={!text.trim() || loading} className="ml-auto p-3 bg-white text-black rounded-full shadow-lg disabled:opacity-50 hover:bg-gray-100 transition-colors">
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'poll' && (
                    <div className="p-6 flex flex-col h-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white min-h-[400px]">
                        <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="text-2xl font-bold bg-transparent placeholder-white/70 outline-none text-center mb-8 w-full" autoFocus />
                        <div className="space-y-3 flex-1">
                            {pollOptions.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input type="text" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[idx] = e.target.value; setPollOptions(newOpts); }} placeholder={`Option ${idx + 1}`} className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 outline-none focus:bg-white/30" />
                                    {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>}
                                </div>
                            ))}
                            {pollOptions.length < 4 && <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full">+ Add Option</button>}
                        </div>
                        <button onClick={handlePollPost} disabled={loading || !pollQuestion.trim()} className="mt-6 w-full py-3 bg-white text-orange-600 font-bold rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto" /> : "Share Poll"}</button>
                    </div>
                )}

                {mode === 'voice' && (
                    <div className="p-6 flex flex-col items-center justify-center h-full bg-gradient-to-br from-red-500 to-pink-600 text-white min-h-[400px]">
                        <div className="text-6xl font-mono mb-8 font-bold">00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}</div>
                        {!voiceBlob ? (
                            <button onClick={isRecording ? stopRecording : startRecording} className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-white text-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'}`}>
                                {isRecording ? <StopCircle size={48} /> : <Mic size={48} />}
                            </button>
                        ) : (
                            <div className="w-full space-y-4">
                                <audio controls src={URL.createObjectURL(voiceBlob)} className="w-full" />
                                <div className="flex gap-2">
                                    <button onClick={() => setVoiceBlob(null)} className="flex-1 py-3 bg-white/20 rounded-xl font-bold">Try Again</button>
                                    <button onClick={handleVoicePost} className="flex-1 py-3 bg-white text-red-600 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin mx-auto" /> : "Share"}</button>
                                </div>
                            </div>
                        )}
                        <p className="mt-8 opacity-70 font-medium">{isRecording ? "Listening..." : voiceBlob ? "Review your note" : "Tap to record"}</p>
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" multiple className="hidden" />
            </div>
        </div>
    );
};

export default CreateStoryModal;
