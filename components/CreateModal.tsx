import React, { useState } from 'react';
import { X, Image, Music, MapPin, Smile, Send, Sparkles, Loader2 } from 'lucide-react';
import { generatePostDraft } from '../services/gemini';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface CreateModalProps {
  onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAiDraft = async () => {
    if (!topic) return;
    setIsGenerating(true);
    const draft = await generatePostDraft(topic);
    setContent(draft || '');
    setIsGenerating(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if ((!content.trim() && !selectedImage) || !user) return;
    setIsPosting(true);

    try {
      let mediaUrl = null;

      // 1. Upload Image if selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post_media')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('post_media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      // 2. Create Post
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content,
        media_url: mediaUrl
      });

      if (error) throw error;
      onClose();
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
          disabled={(!content.trim() && !selectedImage) || isPosting}
          className="bg-[#ff1744] text-white px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:bg-gray-300 transition-all active:scale-95 flex items-center gap-2"
        >
          {isPosting && <Loader2 size={16} className="animate-spin" />}
          Post
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4 flex flex-col overflow-y-auto">
        <div className="flex items-start gap-4">
          <img src={user?.user_metadata?.avatar_url || "https://picsum.photos/seed/me/200"} className="w-10 h-10 rounded-full" alt="Profile" />
          <div className="flex-1">
            <textarea
              autoFocus
              placeholder="What's happening?"
              className="w-full text-lg py-2 resize-none focus:outline-none min-h-[100px] bg-transparent dark:text-white dark:placeholder:text-gray-500"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {imagePreview && (
              <div className="relative mt-2 rounded-2xl overflow-hidden group">
                <img src={imagePreview} alt="Preview" className="w-full max-h-[300px] object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        {/* AI Assistant Section */}
        <div className="mt-auto border-t border-gray-100 dark:border-gray-800 pt-4">
          <div className="bg-red-50/50 dark:bg-red-900/10 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-[#ff1744]" size={16} />
              <h4 className="text-xs font-black text-[#ff1744] uppercase tracking-widest">AI Post Assistant</h4>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic for an AI draft..."
                className="flex-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl text-sm border-none focus:ring-1 focus:ring-[#ff1744] dark:text-white"
              />
              <button
                onClick={handleAiDraft}
                disabled={isGenerating || !topic}
                className="bg-black dark:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:bg-gray-400"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={16} /> : 'Draft'}
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[#ff1744]">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"
                title="Add Image"
              >
                <Image size={22} />
              </button>
              <button className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"><Music size={22} /></button>
              <button className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"><MapPin size={22} /></button>
              <button className="hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors"><Smile size={22} /></button>
            </div>
            <div className="text-xs text-gray-400 font-medium">
              {content.length}/280
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateModal;
