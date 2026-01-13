import React, { useState } from 'react';
import { X, Image, Music, MapPin, Smile, Send, Loader2, Video, BarChart2, Plus } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface CreateModalProps {
  onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ onClose }) => {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Media Upload State
  const [selectedMedia, setSelectedMedia] = useState<{ file: File, type: 'image' | 'video' | 'audio' } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Poll State
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
      setSelectedMedia({ file, type });
      // Create preview URL
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
    setShowEmojiPicker(false);
  };

  const handlePost = async () => {
    if ((!content.trim() && !selectedMedia && !isPollMode) || !user) return;
    if (isPollMode && pollOptions.filter(o => o.trim()).length < 2) {
      alert("Please add at least 2 poll options.");
      return;
    }
    setIsPosting(true);

    try {
      let mediaUrl = null;

      // 1. Upload Media if selected
      if (selectedMedia) {
        // ... (upload logic unchanged)
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

      // 2. Create Post
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content,
        media_url: mediaUrl,
        media_type: selectedMedia?.type,
        poll_options: isPollMode ? pollOptions.filter(o => o.trim()).map(text => ({ text, count: 0 })) : undefined
      });

      if (error) throw error;

      // Cleanup
      onClose();
      setContent('');
      removeMedia();
      setIsPollMode(false);
      setPollOptions(['', '']);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to post");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b dark:border-gray-800">
        <button onClick={onClose} className="p-2 -ml-2 dark:text-white">
          <X size={24} />
        </button>
        <button
          onClick={handlePost}
          disabled={(!content.trim() && !selectedMedia) || isPosting}
          className="bg-[#ff1744] text-white px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:bg-gray-300 transition-all active:scale-95 flex items-center gap-2"
        >
          {isPosting && <Loader2 size={16} className="animate-spin" />}
          Post
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4 flex flex-col overflow-y-auto">
        <div className="flex items-start gap-4">
          <img src={profile?.avatar_url || user?.user_metadata?.avatar_url || "https://picsum.photos/seed/me/200"} className="w-10 h-10 rounded-full object-cover" alt="Profile" />
          <div className="flex-1">
            <textarea
              autoFocus
              placeholder="What's happening?"
              className="w-full text-lg py-2 resize-none focus:outline-none min-h-[100px] bg-transparent dark:text-white dark:placeholder:text-gray-500"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {isPollMode && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 w-full">
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
                      className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#ff1744] transition-colors dark:text-white"
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

            {mediaPreview && (
              <div className="relative mt-2 rounded-2xl overflow-hidden group w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                {selectedMedia?.type === 'video' ? (
                  <video src={mediaPreview} className="w-full max-h-[300px] object-cover" controls />
                ) : selectedMedia?.type === 'audio' ? (
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ff1744] rounded-full flex items-center justify-center text-white">
                      <Music size={20} />
                    </div>
                    <audio src={mediaPreview} controls className="flex-1" />
                  </div>
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full max-h-[300px] object-cover" />
                )}
                <button
                  onClick={removeMedia}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className="absolute top-full left-0 z-50 shadow-xl rounded-xl">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setContent(prev => prev + emojiData.emoji);
                    setShowEmojiPicker(false);
                  }}
                  width={320}
                  height={400}
                  lazyLoadEmojis={true}
                />
                <div
                  className="fixed inset-0 z-[-1]"
                  onClick={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleMediaSelect}
          accept="image/*,video/*"
          className="hidden"
        />
        <input
          type="file"
          ref={audioInputRef}
          onChange={handleMediaSelect}
          accept="audio/*"
          className="hidden"
        />



        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[#ff1744]">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
              title="Add Image or Video"
            >
              <Image size={22} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
              title="Add Video"
            >
              <Video size={22} />
            </button>
            <button
              onClick={() => {
                setIsPollMode(!isPollMode);
                if (!isPollMode) removeMedia();
              }}
              className={`hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors ${isPollMode ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
            >
              <BarChart2 size={22} />
            </button>

            <button
              onClick={() => audioInputRef.current?.click()}
              className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
              title="Add Audio/Music"
            >
              <Music size={22} />
            </button>
            <button className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"><MapPin size={22} /></button>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-[#ff1744] bg-red-50' : ''}`}
            >
              <Smile size={22} />
            </button>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            {content.length}/280
          </div>
        </div>
      </div>
    </div>

  );
};

export default CreateModal;
