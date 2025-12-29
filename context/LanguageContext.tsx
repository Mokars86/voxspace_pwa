import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { translations, Language } from '../utils/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [language, setLanguageState] = useState<Language>('English');

    // Load language from profile on start
    useEffect(() => {
        const fetchLanguage = async () => {
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('language_preference')
                .eq('id', user.id)
                .single();

            if (data?.language_preference && translations[data.language_preference as Language]) {
                setLanguageState(data.language_preference as Language);
            }
        };

        fetchLanguage();
    }, [user]);

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        // Also update DB if user is logged in (Settings usually handles this, but context can too)
        if (user) {
            await supabase.from('profiles').update({ language_preference: lang }).eq('id', user.id);
        }
    };

    // Helper to get nested translation
    const t = (path: string) => {
        const keys = path.split('.');
        let current: any = translations[language];

        for (const key of keys) {
            if (current[key] === undefined) {
                // Fallback to English
                let fallback: any = translations['English'];
                for (const fbKey of keys) {
                    fallback = fallback?.[fbKey];
                }
                return fallback || path;
            }
            current = current[key];
        }
        return current;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
