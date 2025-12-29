import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface LanguageModalProps {
    onClose: () => void;
    currentLanguage?: string;
    onUpdate: (lang: string) => void;
}

const LANGUAGES = [
    { code: 'English', name: 'English', native: 'English' },
    { code: 'Spanish', name: 'Spanish', native: 'Español' },
    { code: 'French', name: 'French', native: 'Français' },
    { code: 'German', name: 'German', native: 'Deutsch' },
    { code: 'Japanese', name: 'Japanese', native: '日本語' },
    { code: 'Korean', name: 'Korean', native: '한국어' },
    { code: 'Chinese', name: 'Chinese', native: '中文' },
    { code: 'Arabic', name: 'Arabic', native: 'العربية' },
    { code: 'Portuguese', name: 'Portuguese', native: 'Português' },
    { code: 'Russian', name: 'Russian', native: 'Русский' },
];

const LanguageModal: React.FC<LanguageModalProps> = ({ onClose, currentLanguage = 'English', onUpdate }) => {
    const { user } = useAuth();
    const [selected, setSelected] = useState(currentLanguage);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ language_preference: selected })
                .eq('id', user.id);

            if (error) throw error;

            onUpdate(selected);
            onClose();
        } catch (error) {
            console.error("Error updating language", error);
            alert("Failed to update language");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-300">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 rounded-t-2xl z-10">
                    <h2 className="text-xl font-bold dark:text-white">Select Language</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-2">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => setSelected(lang.code)}
                            className={`w-full p-4 flex items-center justify-between rounded-xl transition-all ${selected === lang.code
                                    ? 'bg-red-50 dark:bg-red-900/20 text-[#ff1744]'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
                                }`}
                        >
                            <div className="flex flex-col items-start">
                                <span className={`font-bold ${selected === lang.code ? 'text-[#ff1744]' : ''}`}>{lang.native}</span>
                                <span className="text-sm text-gray-500">{lang.name}</span>
                            </div>
                            {selected === lang.code && <Check size={20} className="text-[#ff1744]" />}
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-2xl">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-4 bg-[#ff1744] text-white font-bold rounded-xl shadow-lg hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Saving...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LanguageModal;
