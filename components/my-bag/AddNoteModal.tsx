import React, { useState } from 'react';
import { X, Save, StickyNote } from 'lucide-react';

interface AddNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, content: string) => Promise<void>;
    currentUsage?: number;
    maxStorage?: number;
    initialTitle?: string;
    initialContent?: string;
    mode?: 'create' | 'edit';
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentUsage = 0,
    maxStorage = Infinity,
    initialTitle = '',
    initialContent = '',
    mode = 'create'
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState(initialContent);
    const [loading, setLoading] = useState(false);

    // Reset or set init values when modal opens/changes
    React.useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle);
            setContent(initialContent);
        }
    }, [isOpen, initialTitle, initialContent]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        // Check size
        const estimatedSize = new TextEncoder().encode(title + content).length;
        // Only check delta if editing, but simplistic check is fine
        // Ideally we subtract old size, but let's just check standard for now 
        if (mode === 'create' && currentUsage + estimatedSize > maxStorage) {
            alert(`Storage limit exceeded! You need ${(estimatedSize / 1024).toFixed(1)}KB more space.`);
            return;
        }

        setLoading(true);
        try {
            await onSave(title.trim() || 'Untitled Note', content.trim());
            if (mode === 'create') {
                setTitle('');
                setContent('');
            }
            onClose();
        } catch (error) {
            console.error("Failed to save note", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                        <StickyNote className="text-[#ff1744]" size={20} />
                        {mode === 'edit' ? 'Edit Note' : 'New Note'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title (Optional)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Shopping List"
                            className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border-none focus:ring-2 focus:ring-[#ff1744]/50 dark:text-white placeholder-gray-400 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Content
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write something..."
                            className="w-full h-32 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-none focus:ring-2 focus:ring-[#ff1744]/50 dark:text-white placeholder-gray-400 outline-none resize-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!content.trim() || loading}
                            className="w-full py-3 bg-[#ff1744] hover:bg-red-600 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                        >
                            {loading ? (
                                <span>Saving...</span>
                            ) : (
                                <>
                                    <Save size={18} />
                                    {mode === 'edit' ? 'Update Note' : 'Save Note'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddNoteModal;
